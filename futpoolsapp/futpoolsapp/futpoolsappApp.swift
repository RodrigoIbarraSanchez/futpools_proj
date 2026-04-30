//
//  futpoolsappApp.swift
//  futpoolsapp
//

import SwiftUI
import Combine

private let kAppLanguageKey = "app_language"

/// Wraps content and applies the user's chosen app language. Two
/// things happen here:
/// 1. `AppLanguage.setLanguage(...)` reroutes every `String(localized:)`
///    lookup to the chosen language bundle (via `Bundle.main` swizzle).
/// 2. `.environment(\.locale, …)` keeps date/number formatters in sync.
/// 3. `.id(appLanguage)` forces SwiftUI to rebuild the entire view
///    tree on switch — without this the on-screen text would stay in
///    the previous language until a manual refresh.
struct AppLanguageWrapper<Content: View>: View {
    @AppStorage(kAppLanguageKey) private var appLanguage = ""
    @ViewBuilder let content: () -> Content

    private var effectiveLocale: Locale {
        if appLanguage.isEmpty { return Locale.current }
        return Locale(identifier: appLanguage == "es" ? "es" : "en")
    }

    var body: some View {
        content()
            .environment(\.locale, effectiveLocale)
            .id(appLanguage)
            .onAppear { AppLanguage.setLanguage(appLanguage) }
            .onChange(of: appLanguage) { _, newValue in
                AppLanguage.setLanguage(newValue)
            }
    }
}

// NOTE — To enable deep links (`futpools://p/<CODE>`) you still need to register
// the URL scheme in Xcode: open the project target → Info → URL Types → add
//   • Identifier:  com.futpools.futpoolsapp
//   • URL Schemes: futpools
// This project auto-generates Info.plist (GENERATE_INFOPLIST_FILE = YES) so the
// scheme must be added via the Xcode UI or a custom Info.plist file. The
// `.onOpenURL` handler below will activate automatically once the scheme is
// registered. Until then, the invite-code copy/paste flow still works end-to-end.

@main
struct futpoolsappApp: App {
    @StateObject private var auth = AuthService()
    @StateObject private var inviteRouter = InviteRouter()

    init() {
        // Apply the persisted language BEFORE the first view body is
        // evaluated. Otherwise the initial render uses the device
        // language and only rebuilds via .id(...) once the user
        // touches a setting.
        let saved = UserDefaults.standard.string(forKey: kAppLanguageKey) ?? ""
        AppLanguage.setLanguage(saved)
    }

    var body: some Scene {
        WindowGroup {
            AppLanguageWrapper {
                RootView()
                    .environmentObject(auth)
                    .environmentObject(inviteRouter)
                    .onOpenURL { url in
                        // Two deep link shapes handled here:
                        //   futpools://p/<CODE>  → pool invite     (host == "p")
                        //   futpools://c/<CODE>  → challenge invite (host == "c")
                        guard url.scheme == "futpools" else { return }
                        let code = url.pathComponents.dropFirst().first
                            ?? url.lastPathComponent
                        guard !code.isEmpty else { return }
                        if url.host == "p" {
                            Task { await inviteRouter.resolve(code: code) }
                        } else if url.host == "c" {
                            Task { await inviteRouter.resolveChallenge(code: code) }
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
    }
}

/// Shared state that resolves an invite code → Quiniela and exposes it to `RootView`
/// so it can push `QuinielaDetailView`. Kept tiny on purpose.
@MainActor
final class InviteRouter: ObservableObject {
    @Published var pendingPool: Quiniela?
    /// Populated when a `futpools://c/<CODE>` link is opened. RootView reads
    /// this and pushes `ChallengeDetailView(challengeId: c.id)`.
    @Published var pendingChallenge: Challenge?
    private let client = APIClient.shared

    func resolve(code: String) async {
        let normalized = code.uppercased()
        do {
            pendingPool = try await client.request(
                method: "GET",
                path: "/quinielas/invite/\(normalized)"
            )
        } catch {
            print("[InviteRouter] resolve failed for \(normalized): \(error)")
        }
    }

    func resolveChallenge(code: String) async {
        let normalized = code.uppercased()
        guard let token = KeychainHelper.getToken() else {
            print("[InviteRouter] challenge resolve skipped — unauthenticated")
            return
        }
        do {
            pendingChallenge = try await client.request(
                method: "GET",
                path: "/challenges/code/\(normalized)",
                token: token
            )
        } catch {
            print("[InviteRouter] challenge resolve failed for \(normalized): \(error)")
        }
    }

    func clear() { pendingPool = nil }
    func clearChallenge() { pendingChallenge = nil }
}
