//
//  RewardedAdService.swift
//  futpoolsapp
//
//  Abstraction layer over the rewarded-ad SDK. Three concrete impls ship:
//
//    StubRewardedAdService — DEBUG only, no SDK required. Simulates a
//      3-second ad and calls the backend's /ads/ticket-rewarded/dev-credit
//      to credit a real Ticket. The endpoint is gated NODE_ENV !==
//      'production' on the backend, so it can never fire in prod.
//
//    AdMobRewardedAdService — wraps GoogleMobileAds. Compiled only when
//      the SDK is present (`canImport(GoogleMobileAds)`), so this file
//      keeps compiling before the SPM package is added in Xcode.
//      ▸ DEBUG  → uses Google's official test ad unit (no real revenue,
//                 but the full real ad flow including ATT prompt + SSV).
//      ▸ RELEASE→ uses the production ad unit ID.
//
//  RewardedAd.shared picks the right impl at startup. Add the SPM package
//  https://github.com/googleads/swift-package-manager-google-mobile-ads
//  to the futpoolsapp target and the AdMob path activates automatically.
//

import Foundation
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// Outcome of a rewarded-ad attempt.
enum RewardedAdResult {
    /// User watched the ad to completion. The Ticket credit happens
    /// server-side via SSV — `tickets` may be nil because the SDK callback
    /// returns before the SSV ping is processed; the UI should refetch the
    /// user balance shortly after to surface the new total.
    case earned(tickets: Int?)
    /// User dismissed the ad before earning the reward.
    case dismissedEarly
    /// Ad failed to load — network down, no fill, etc.
    case noFill
    /// Other error (backend failed to credit, network blip after watch).
    case error(String)
}

/// Anything that can show a rewarded ad and credit a Ticket on success.
@MainActor
protocol RewardedAdService {
    /// True when an ad is loaded and ready to show. UI can disable the
    /// button when false. The stub always returns true.
    var isReady: Bool { get }
    /// Show the ad. `userId` lets the implementation tag the SSV callback
    /// with the right user (AdMob's `ServerSideVerificationOptions
    /// .userIdentifier`). Resolves with the outcome once the ad finishes
    /// / dismisses / errors out.
    func showAd(token: String?, userId: String?) async -> RewardedAdResult
}

// MARK: - Stub (no SDK required)

/// DEBUG-only service that simulates a 3-second ad watch and calls the
/// backend's dev-credit endpoint. Lets the iOS app be tested in
/// simulator without an AdMob account.
@MainActor
final class StubRewardedAdService: RewardedAdService {
    var isReady: Bool { true }

    func showAd(token: String?, userId: String?) async -> RewardedAdResult {
        guard let token else { return .error("Not authenticated") }
        // Simulate the ad-watch delay so the UI gets to show its loading state.
        try? await Task.sleep(nanoseconds: 3 * 1_000_000_000)

        // Generate a fresh transactionId per simulated watch — the backend
        // uses it as the idempotency key, so a re-tap gives a fresh credit.
        let txId = UUID().uuidString
        struct Body: Encodable { let transactionId: String }
        struct Response: Decodable {
            let ok: Bool
            let tickets: Int?
            let alreadyProcessed: Bool?
        }
        do {
            let res: Response = try await APIClient.shared.request(
                method: "POST",
                path: "/ads/ticket-rewarded/dev-credit",
                body: Body(transactionId: txId),
                token: token
            )
            return res.ok ? .earned(tickets: res.tickets) : .error("Credit refused")
        } catch {
            return .error(error.localizedDescription)
        }
    }
}

// MARK: - AdMob (only compiled when SDK is present)

#if canImport(GoogleMobileAds)

/// Production rewarded-ad service backed by Google AdMob. Activates
/// automatically when the GoogleMobileAds SPM package is added to the
/// target. Until then the file falls back to the stub for both DEBUG and
/// RELEASE builds.
///
/// Test ad units (Google-published, safe for development) are used in
/// DEBUG; the real production ad unit is used in RELEASE. SSV is wired
/// via `userIdentifier` so the backend (`adsController.admobSSVCallback`)
/// knows which user to credit.
@MainActor
final class AdMobRewardedAdService: NSObject, RewardedAdService {

    // Google's official test rewarded ad unit. Safe to click during
    // development — never generates real revenue and never violates
    // policy. https://developers.google.com/admob/ios/test-ads
    private static let testAdUnitID    = "ca-app-pub-3940256099942544/1712485313"
    // Production rewarded ad unit (set in AdMob console).
    private static let prodAdUnitID    = "ca-app-pub-8119374439004718/1966942538"

    private static var adUnitID: String {
        #if DEBUG
        return testAdUnitID
        #else
        return prodAdUnitID
        #endif
    }

    private var loaded: RewardedAd?
    private var earnedThisShow = false
    private var resumeContinuation: CheckedContinuation<RewardedAdResult, Never>?

    override init() {
        super.init()
        Task { await bootstrap() }
    }

    /// Start the SDK once and pre-cache the first ad. Also requests ATT
    /// authorisation — required iOS 14+ for personalised ads (rewarded
    /// fill rate drops sharply without it).
    private func bootstrap() async {
        if #available(iOS 14, *) {
            _ = await ATTrackingManager.requestTrackingAuthorization()
        }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            MobileAds.shared.start { _ in cont.resume() }
        }
        await loadAd()
    }

    var isReady: Bool { loaded != nil }

    func showAd(token: String?, userId: String?) async -> RewardedAdResult {
        guard token != nil else { return .error("Not authenticated") }
        guard let ad = loaded else {
            // Try to recover by loading on the spot. If that also fails we
            // surface noFill so the UI can show "try again later".
            await loadAd()
            guard let retry = loaded else { return .noFill }
            return await present(retry, userId: userId)
        }
        return await present(ad, userId: userId)
    }

    private func present(_ ad: RewardedAd, userId: String?) async -> RewardedAdResult {
        guard let root = Self.topViewController() else {
            return .error("No root view controller")
        }
        // Stamp the SSV callback with the user id so the backend can
        // credit the right account. AdMob will append this verbatim as
        // `user_id` in the signed query string.
        if let userId, !userId.isEmpty {
            let opts = ServerSideVerificationOptions()
            opts.userIdentifier = userId
            ad.serverSideVerificationOptions = opts
        }

        earnedThisShow = false
        ad.fullScreenContentDelegate = self

        return await withCheckedContinuation { cont in
            self.resumeContinuation = cont
            ad.present(from: root) { [weak self] in
                // Reward earned. Ticket credit happens server-side via SSV
                // — flag the success and let the dismissal handler resume
                // the continuation so the UI gets a single coherent event.
                self?.earnedThisShow = true
            }
        }
    }

    private func loadAd() async {
        do {
            let request = Request()
            loaded = try await RewardedAd.load(with: Self.adUnitID, request: request)
        } catch {
            loaded = nil
        }
    }

    /// Best-effort lookup of the foreground key window's root VC — needed
    /// to anchor the full-screen ad presentation.
    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
        let window = scenes.flatMap { $0.windows }.first(where: { $0.isKeyWindow })
            ?? scenes.flatMap { $0.windows }.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

extension AdMobRewardedAdService: FullScreenContentDelegate {
    nonisolated func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        Task { @MainActor in
            let result: RewardedAdResult = earnedThisShow
                ? .earned(tickets: nil)
                : .dismissedEarly
            resumeContinuation?.resume(returning: result)
            resumeContinuation = nil
            // Pre-cache the next ad so the button is ready immediately.
            await loadAd()
        }
    }

    nonisolated func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        Task { @MainActor in
            resumeContinuation?.resume(returning: .error(error.localizedDescription))
            resumeContinuation = nil
        }
    }
}

#endif

// MARK: - Shared instance

/// Single shared instance the UI talks to. The AdMob path activates
/// automatically when the SDK is linked; otherwise the stub keeps DEBUG
/// builds usable. (Plural namespace name to avoid shadowing the
/// `GoogleMobileAds.RewardedAd` class from inside this file.)
@MainActor
enum RewardedAds {
    static let shared: RewardedAdService = {
        #if canImport(GoogleMobileAds)
        return AdMobRewardedAdService()
        #else
        return StubRewardedAdService()
        #endif
    }()
}
