//
//  futpoolsappApp.swift
//  futpoolsapp
//

import SwiftUI
import Combine

private let kAppLanguageKey = "app_language"

/// Wraps content and applies the user's chosen app language via locale environment.
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

    var body: some Scene {
        WindowGroup {
            AppLanguageWrapper {
                RootView()
                    .environmentObject(auth)
                    .environmentObject(inviteRouter)
                    .onOpenURL { url in
                        // Deep link: `futpools://p/<CODE>` → fetch pool and push detail.
                        guard url.scheme == "futpools", url.host == "p" else { return }
                        let code = url.pathComponents.dropFirst().first
                            ?? url.lastPathComponent
                        if !code.isEmpty {
                            Task { await inviteRouter.resolve(code: code) }
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

    func clear() { pendingPool = nil }
}
