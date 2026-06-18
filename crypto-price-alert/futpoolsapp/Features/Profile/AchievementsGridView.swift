//
//  AchievementsGridView.swift
//  futpoolsapp
//

import SwiftUI

struct AchievementsGridView: View {
    /// Codes unlocked by the current user. The grid is the full catalog; this
    /// set drives the unlocked/locked styling per tile.
    let unlockedCodes: Set<String>

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(AchievementCatalog.all) { meta in
                AchievementTile(
                    meta: meta,
                    unlocked: unlockedCodes.contains(meta.code)
                )
            }
        }
    }
}

private struct AchievementTile: View {
    let meta: AchievementMeta
    let unlocked: Bool

    var body: some View {
        VStack(spacing: 6) {
            Text(meta.icon)
                .font(.system(size: 28))
                .saturation(unlocked ? 1 : 0)
                .opacity(unlocked ? 1 : 0.35)
            Text(meta.title.uppercased())
                .font(ArenaFont.mono(size: 8, weight: .bold))
                .tracking(1.2)
                .foregroundColor(unlocked ? .arenaText : .arenaTextDim)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 6)
        .background(
            ZStack {
                HudCornerCutShape(cut: 8)
                    .fill(unlocked
                          ? meta.accent.opacity(0.14)
                          : Color.arenaSurface)
                HudCornerCutShape(cut: 8)
                    .stroke(unlocked ? meta.accent.opacity(0.55) : Color.arenaStroke,
                            lineWidth: 1)
            }
        )
        .shadow(color: unlocked ? meta.accent.opacity(0.35) : .clear, radius: 6)
        .clipShape(HudCornerCutShape(cut: 8))
    }
}
