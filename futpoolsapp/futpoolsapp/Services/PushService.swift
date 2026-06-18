//
//  PushService.swift
//  futpoolsapp
//

import Foundation
import UserNotifications
#if canImport(UIKit)
import UIKit
#endif

/// Bridges APNs device-token registration to the futpools backend.
///
/// The APNs token can arrive (via `didRegisterForRemoteNotifications`)
/// BEFORE the user is authenticated — onboarding asks for the push
/// permission pre-signup — so we cache the latest token locally and
/// (re)send it whenever we have BOTH a device token and an auth token.
/// `AuthService` calls `registerPendingToken()` right after login/register.
@MainActor
final class PushService {
    static let shared = PushService()

    private let client = APIClient.shared
    private let tokenKey = "apns_device_token"

    private init() {}

    /// Called from `AppDelegate` with the raw APNs token data.
    func updateDeviceToken(_ data: Data) {
        let hex = data.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: tokenKey)
        Task { await registerPendingToken() }
    }

    /// Re-send the cached token to the backend. No-op if we don't have a
    /// token yet or the user isn't signed in (the call needs the JWT).
    func registerPendingToken() async {
        guard let deviceToken = UserDefaults.standard.string(forKey: tokenKey),
              let authToken = KeychainHelper.getToken() else { return }

        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif

        let lang = UserDefaults.standard.string(forKey: "app_language") ?? ""
        let locale = lang.isEmpty
            ? (Locale.current.language.languageCode?.identifier ?? "en")
            : lang

        struct Body: Encodable {
            let token: String
            let platform: String
            let bundleId: String
            let locale: String
            let appVersion: String
            let osVersion: String
            let environment: String
        }
        let body = Body(
            token: deviceToken,
            platform: "ios",
            bundleId: Bundle.main.bundleIdentifier ?? "",
            locale: locale,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
            osVersion: UIDevice.current.systemVersion,
            environment: environment
        )
        do {
            try await client.requestVoid(method: "POST", path: "/users/me/devices", body: body, token: authToken)
        } catch {
            print("[Push] register failed: \(error)")
        }
    }

    /// Ask the backend to send a test push to this device. Returns false if
    /// not signed in or the request fails (e.g. APNs not configured: 503).
    @discardableResult
    func sendTestPush() async -> Bool {
        guard let authToken = KeychainHelper.getToken() else { return false }
        do {
            try await client.requestVoid(method: "POST", path: "/users/me/devices/test", token: authToken)
            return true
        } catch {
            print("[Push] test failed: \(error)")
            return false
        }
    }

    /// Drop the cached token (called on logout / account deletion so the
    /// next user on this device doesn't inherit it).
    func clearLocalToken() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
}

/// SwiftUI has no UIKit app delegate by default, but APNs token delivery is
/// delegate-only. `futpoolsappApp` wires this in via
/// `@UIApplicationDelegateAdaptor`.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // If the user already granted permission in a previous session,
        // re-register on every cold launch so a rotated APNs token still
        // reaches the backend.
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushService.shared.updateDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[Push] APNs registration failed: \(error.localizedDescription)")
    }

    // Show banners while the app is in the foreground (otherwise iOS
    // suppresses them when the app is active).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }
}
