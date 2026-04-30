//
//  RewardedAdService.swift
//  futpoolsapp
//
//  Abstraction layer over the rewarded-ad SDK. Two implementations ship:
//
//    StubRewardedAdService — DEBUG/dev only. Simulates a 3-second ad and
//      calls the backend's /ads/ticket-rewarded/dev-credit endpoint to
//      credit a real Ticket without wiring AdMob. The endpoint is gated
//      on NODE_ENV !== 'production' on the backend, so in prod this can
//      never accidentally credit.
//
//    AdMobRewardedAdService — production. TODO: wire GoogleMobileAds via
//      Swift Package Manager once the user creates an AdMob account and
//      provides app-id + ad-unit-id. The SSV callback is already
//      implemented backend-side and will credit when AdMob hits it.
//
//  HomeView's RewardedAdButton uses whichever service is wired in
//  RewardedAdService.shared. We default to the stub in DEBUG and would
//  swap to AdMob in RELEASE once SDK is integrated.
//

import Foundation

/// Outcome of a rewarded-ad attempt.
enum RewardedAdResult {
    /// User watched the ad to completion AND backend credited the Ticket.
    /// `tickets` is the user's new total after the credit, when known.
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
    /// Show the ad. Resolves with the outcome once the ad finishes /
    /// dismisses / errors out. The button shouldn't be tappable while a
    /// previous attempt is in flight — gate with `isShowing` if needed.
    func showAd(token: String?) async -> RewardedAdResult
}

/// DEBUG-only service that simulates a 3-second ad watch and calls the
/// backend's dev-credit endpoint. Lets the iOS app be tested in
/// simulator without an AdMob account.
@MainActor
final class StubRewardedAdService: RewardedAdService {
    var isReady: Bool { true }

    func showAd(token: String?) async -> RewardedAdResult {
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

/// Single shared instance the UI talks to. Build-config swap goes here
/// when GoogleMobileAds is integrated:
///
///     #if DEBUG
///     static let shared: RewardedAdService = StubRewardedAdService()
///     #else
///     static let shared: RewardedAdService = AdMobRewardedAdService()
///     #endif
@MainActor
enum RewardedAd {
    static let shared: RewardedAdService = StubRewardedAdService()
}
