//
//  CountryPicker.swift
//  futpoolsapp
//
//  Searchable full-world country picker used by RegisterView. The
//  list comes from `Locale.Region.isoRegions` (ISO 3166-1 alpha-2)
//  so it stays in sync with whatever Apple ships per iOS version,
//  and each row's localized name comes from `Locale.current` so MX
//  users see "México" while EN users see "Mexico".
//

import SwiftUI

// MARK: - ISO country list

struct ISOCountry: Identifiable, Equatable {
    let code: String       // ISO 3166-1 alpha-2 (e.g. "MX")
    let name: String       // Localized (e.g. "México" in es, "Mexico" in en)
    let flag: String       // Emoji flag derived from the code

    var id: String { code }
}

enum CountryCatalog {
    /// All ISO 3166-1 alpha-2 countries, sorted by their localized
    /// name in the current bundle locale. Cached per locale lookup.
    static func all(locale: Locale = .current) -> [ISOCountry] {
        if #available(iOS 16.0, *) {
            // Foundation's modern source-of-truth.
            let codes = Locale.Region.isoRegions
                .map(\.identifier)
                .filter { $0.count == 2 }
            return codes.map { code in
                ISOCountry(
                    code: code,
                    name: locale.localizedString(forRegionCode: code) ?? code,
                    flag: flagEmoji(from: code)
                )
            }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        } else {
            // Fallback for older iOS — Locale.isoRegionCodes is the
            // deprecated alias that still ships globally.
            return Locale.isoRegionCodes
                .filter { $0.count == 2 }
                .map { code in
                    ISOCountry(
                        code: code,
                        name: locale.localizedString(forRegionCode: code) ?? code,
                        flag: flagEmoji(from: code)
                    )
                }
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
    }

    /// Build a 🇲🇽-style flag emoji from a 2-letter country code by
    /// shifting each ASCII char into the regional indicator block.
    static func flagEmoji(from code: String) -> String {
        let upper = code.uppercased()
        guard upper.count == 2 else { return "" }
        let base: UInt32 = 127397 // 0x1F1E6 - 'A'
        var result = ""
        for scalar in upper.unicodeScalars {
            if let s = UnicodeScalar(base + scalar.value) {
                result.unicodeScalars.append(s)
            }
        }
        return result
    }

    static func name(for code: String, locale: Locale = .current) -> String {
        guard !code.isEmpty else { return "" }
        return locale.localizedString(forRegionCode: code) ?? code
    }
}

// MARK: - Picker sheet

struct CountryPickerSheet: View {
    @Binding var selected: String
    @Environment(\.dismiss) private var dismiss
    @State private var query: String = ""

    private var allCountries: [ISOCountry] { CountryCatalog.all() }

    private var filtered: [ISOCountry] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return allCountries }
        let lower = q.lowercased()
        return allCountries.filter { c in
            c.name.lowercased().contains(lower)
                || c.code.lowercased().contains(lower)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(filtered) { c in
                    Button {
                        selected = c.code
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Text(c.flag).font(.system(size: 22))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(c.name)
                                    .font(ArenaFont.body(size: 14))
                                    .foregroundColor(.arenaText)
                                Text(c.code)
                                    .font(ArenaFont.mono(size: 10))
                                    .foregroundColor(.arenaTextDim)
                            }
                            Spacer()
                            if c.code == selected {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.arenaPrimary)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .listRowBackground(Color.arenaSurface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.arenaBg)
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: Text(String(localized: "Search countries"))
            )
            .navigationTitle(Text(String(localized: "Country")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Cancel")) { dismiss() }
                        .foregroundColor(.arenaTextDim)
                }
            }
        }
    }
}
