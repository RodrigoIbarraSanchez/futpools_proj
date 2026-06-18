//
//  SettingsView.swift
//  futpoolsapp
//

import SwiftUI

private let kAppLanguageKey = "app_language"

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthService
    @AppStorage(kAppLanguageKey) private var appLanguage = ""
    @Environment(\.dismiss) private var dismiss
    @State private var showRestartPrompt = false
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false

    private var languageOptions: [(id: String, label: String)] {
        [
            ("", String(localized: "Use your iPhone language")),
            ("en", String(localized: "English (US)")),
            ("es", String(localized: "Español (México)")),
        ]
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                Form {
                    Section {
                        Picker(selection: $appLanguage, label: Text(String(localized: "App Language"))) {
                            ForEach(languageOptions, id: \.id) { option in
                                Text(option.label).tag(option.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .onChange(of: appLanguage) { _, _ in
                            // String(localized:) reads its translation
                            // from the bundle's preferred localization,
                            // which Foundation caches at launch. The
                            // only reliable way to switch every string
                            // is to relaunch — prompt the user.
                            showRestartPrompt = true
                        }
                    } header: {
                        Text(String(localized: "App Language"))
                    } footer: {
                        Text(String(localized: "App restart required for the change to fully apply."))
                    }

                    // Account management — App Store Guideline 5.1.1(v)
                    // requires any app with sign-up to offer in-app account
                    // deletion. Destructive + confirmation-gated.
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            HStack {
                                Text(String(localized: "Delete account"))
                                if isDeleting {
                                    Spacer()
                                    ProgressView()
                                }
                            }
                        }
                        .disabled(isDeleting)
                    } header: {
                        Text(String(localized: "Account"))
                    } footer: {
                        Text(String(localized: "Permanently deletes your account and all your data. This can't be undone."))
                    }

                    #if DEBUG
                    Section {
                        Button {
                            Task { await PushService.shared.sendTestPush() }
                        } label: {
                            Text("DEBUG · Send test push")
                        }
                        Button(role: .destructive) {
                            UserDefaults.standard.set(false, forKey: "hasSeenOnboarding")
                            UserDefaults.standard.set("", forKey: "onboardingGoal")
                            UserDefaults.standard.synchronize()
                            exit(0)
                        } label: {
                            Text("DEBUG · Reset onboarding")
                        }
                    } footer: {
                        Text("Clears hasSeenOnboarding and relaunches so QA can replay the 6-screen flow without reinstalling.")
                    }
                    #endif
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(String(localized: "Settings"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Text(String(localized: "Done"))
                            .foregroundColor(.appPrimary)
                    }
                }
            }
            .alert(
                String(localized: "Restart to apply language?"),
                isPresented: $showRestartPrompt
            ) {
                Button(String(localized: "Restart now"), role: .destructive) {
                    // Belt-and-suspenders: re-apply + force-flush
                    // UserDefaults to disk before exit(0) so the
                    // AppleLanguages write actually persists.
                    AppLanguage.setLanguage(appLanguage)
                    UserDefaults.standard.synchronize()
                    exit(0)
                }
                Button(String(localized: "Later"), role: .cancel) {}
            } message: {
                Text(String(localized: "Some text will stay in the previous language until you relaunch the app."))
            }
            .alert(
                String(localized: "Delete your account?"),
                isPresented: $showDeleteConfirm
            ) {
                Button(String(localized: "Delete account"), role: .destructive) {
                    isDeleting = true
                    Task {
                        let ok = await auth.deleteAccount()
                        isDeleting = false
                        // On success, isAuthenticated flips to false and
                        // RootView swaps back to the auth flow, tearing down
                        // this sheet automatically. On failure we just dismiss.
                        if ok { dismiss() }
                    }
                }
                Button(String(localized: "Cancel"), role: .cancel) {}
            } message: {
                Text(String(localized: "This permanently deletes your account and all your data. This action can't be undone."))
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
