//
//  RankHeroCard.swift
//  futpoolsapp
//
//  The big tier/rating block at the top of the profile. Shows tier shield,
//  current rating, peak, global rank, and a progress bar toward the next tier.
//

import SwiftUI

struct RankHeroCard: View {
    let summary: UserRankSummary?

    private var tier: RankTier { RankTier(code: summary?.tier ?? "amateur") }
    private var divisionTier: DivisionTier { DivisionTier(rank: tier) }
    private var hasData: Bool { (summary?.poolsPlayed ?? 0) > 0 }

    var body: some View {
        HudFrame(
            cut: 16,
            fill: AnyShapeStyle(
                LinearGradient(
                    colors: [
                        divisionTier.colors.0.opacity(0.18),
                        Color.arenaSurface,
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        ) {
            VStack(spacing: 14) {
                HStack(alignment: .center, spacing: 14) {
                    DivisionBadge(tier: divisionTier, size: 74)
                        .shadow(color: divisionTier.colors.0.opacity(0.55), radius: 12)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(tier.displayName.uppercased())
                            .font(ArenaFont.display(size: 22, weight: .black))
                            .tracking(2)
                            .foregroundColor(.arenaText)
                            .fixedSize(horizontal: true, vertical: false)

                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text("\(summary?.rating ?? 1000)")
                                .font(ArenaFont.display(size: 26, weight: .heavy))
                                .foregroundColor(.arenaPrimary)
                            Text(String(localized: "RATING"))
                                .font(ArenaFont.mono(size: 9, weight: .bold))
                                .tracking(1.5)
                                .foregroundColor(.arenaTextMuted)
                        }

                        if hasData {
                            HStack(spacing: 8) {
                                miniStat(
                                    label: String(localized: "PEAK"),
                                    value: "\(summary?.ratingPeak ?? 1000)"
                                )
                                miniStat(
                                    label: String(localized: "GLOBAL RANK"),
                                    value: "#\(summary?.rank ?? 0)"
                                )
                            }
                        } else {
                            Text(String(localized: "Play a pool to start ranking."))
                                .font(ArenaFont.mono(size: 10))
                                .foregroundColor(.arenaTextDim)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: 0)
                }

                if hasData, let s = summary {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("→ \(nextTierName(after: tier))")
                                .font(ArenaFont.mono(size: 9, weight: .bold))
                                .tracking(1.5)
                                .foregroundColor(.arenaTextMuted)
                            Spacer()
                            Text("\(s.rating)/\(s.tierMax)")
                                .font(ArenaFont.mono(size: 9))
                                .foregroundColor(.arenaTextDim)
                        }
                        XpBar(
                            value: s.progressInTier * 100,
                            max: 100,
                            color: divisionTier.colors.0,
                            segments: 24,
                            height: 6
                        )
                    }
                }
            }
            .padding(16)
        }
    }

    private func miniStat(label: String, value: String) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.arenaTextMuted)
            Text(value)
                .font(ArenaFont.mono(size: 11, weight: .bold))
                .foregroundColor(.arenaText)
        }
    }

    private func nextTierName(after tier: RankTier) -> String {
        switch tier {
        case .rookie:  return RankTier.amateur.displayName.uppercased()
        case .amateur: return RankTier.pro.displayName.uppercased()
        case .pro:     return RankTier.veteran.displayName.uppercased()
        case .veteran: return RankTier.legend.displayName.uppercased()
        case .legend:  return String(localized: "Legend").uppercased()
        }
    }
}

/// Four equal-width stat cards — W/L, streaks, pools played, win rate.
struct RankStatsGrid: View {
    let summary: UserRankSummary?

    var body: some View {
        let s = summary
        let winRatePct = Int(((s?.winRate ?? 0) * 100).rounded())
        return LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
            spacing: 8
        ) {
            statTile(
                label: String(localized: "POOLS PLAYED"),
                value: "\(s?.poolsPlayed ?? 0)",
                accent: .arenaPrimary
            )
            statTile(
                label: String(localized: "POOLS WON"),
                value: "\(s?.poolsWon ?? 0)",
                accent: .arenaGold
            )
            statTile(
                label: String(localized: "WIN RATE"),
                value: "\(winRatePct)%",
                accent: .arenaAccent
            )
            statTile(
                label: String(localized: "BEST STREAK"),
                value: "\(s?.streakBest ?? 0)",
                accent: .arenaHot
            )
        }
    }

    private func statTile(label: String, value: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.5)
                .foregroundColor(.arenaTextMuted)
            Text(value)
                .font(ArenaFont.display(size: 22, weight: .heavy))
                .foregroundColor(accent)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            ZStack {
                HudCornerCutShape(cut: 10).fill(Color.arenaSurface)
                HudCornerCutShape(cut: 10).stroke(Color.arenaStroke, lineWidth: 1)
            }
        )
        .clipShape(HudCornerCutShape(cut: 10))
    }
}
