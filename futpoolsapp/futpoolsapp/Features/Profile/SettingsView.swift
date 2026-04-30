//
//  SettingsView.swift
//  futpoolsapp
//

import SwiftUI

private let kAppLanguageKey = "app_language"

struct SettingsView: View {
    @AppStorage(kAppLanguageKey) private var appLanguage = ""
    @Environment(\.dismiss) private var dismiss
    @State private var showRestartPrompt = false

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
                    #if DEBUG
                    Section {
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
        }
    }
}

#Preview {
    SettingsView()
        .preferredColorScheme(.dark)
}
