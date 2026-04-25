//
//  SettingsView.swift
//  futpoolsapp
//

import SwiftUI

private let kAppLanguageKey = "app_language"

struct SettingsView: View {
    @AppStorage(kAppLanguageKey) private var appLanguage = ""
    @Environment(\.dismiss) private var dismiss

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
                    } header: {
                        Text(String(localized: "App Language"))
                    } footer: {
                        Text(String(localized: "Changes apply instantly"))
                    }
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
        }
    }
}

#Preview {
    SettingsView()
        .preferredColorScheme(.dark)
}
