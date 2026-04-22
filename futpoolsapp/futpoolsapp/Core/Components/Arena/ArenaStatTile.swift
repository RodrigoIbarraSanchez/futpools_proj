//
//  ArenaStatTile.swift
//  futpoolsapp
//
//  Small monospace stat tile used throughout Arena screens.
//

import SwiftUI

struct ArenaStatTile: View {
    let label: String
    let value: String
    var color: Color = .arenaText

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(ArenaFont.mono(size: 8, weight: .regular))
                .tracking(1.5)
                .foregroundColor(.arenaTextMuted)
            Text(value)
                .font(ArenaFont.mono(size: 14, weight: .bold))
                .tracking(0.3)
                .foregroundColor(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            HudCornerCutShape(cut: 8).fill(Color.arenaBg2)
        )
        .clipShape(HudCornerCutShape(cut: 8))
    }
}

struct ArenaStatInline: View {
    // LocalizedStringKey so callers can pass literal keys ("PRIZE POOL", etc.)
    // and SwiftUI resolves them against Localizable.strings.
    let label: LocalizedStringKey
    let value: String
    var color: Color = .arenaText
    var isMono: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .textCase(.uppercase)
                .font(ArenaFont.mono(size: 9))
                .tracking(1.5)
                .foregroundColor(.arenaTextMuted)
            Text(value)
                .font(isMono ? ArenaFont.mono(size: 18, weight: .bold) : ArenaFont.display(size: 18, weight: .heavy))
                .tracking(0.5)
                .foregroundColor(color)
        }
    }
}
