//
//  futpoolsappApp.swift
//  futpoolsapp
//

import SwiftUI

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

@main
struct futpoolsappApp: App {
    @StateObject private var auth = AuthService()

    var body: some Scene {
        WindowGroup {
            AppLanguageWrapper {
                RootView()
                    .environmentObject(auth)
            }
            .preferredColorScheme(.dark)
        }
    }
}
