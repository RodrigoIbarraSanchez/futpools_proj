//
//  AchievementCatalog.swift
//  futpoolsapp
//
//  Single source of truth for achievement copy + iconography. Backend stores
//  only the `code` — the UI joins against this catalog to render.
//

import SwiftUI

struct AchievementMeta: Identifiable {
    let code: String
    let title: String
    let detail: String
    let icon: String
    /// Accent color used for the unlocked glow. Locked state ignores this.
    let accent: Color
    var id: String { code }
}

enum AchievementCatalog {
    /// Render order matches the profile grid (row-major). Kept intentional
    /// rather than alphabetical so early-game unlocks appear first.
    static let all: [AchievementMeta] = [
        .init(code: "first_pool",             title: String(localized: "First Pool"),        detail: String(localized: "Played your first pool."),          icon: "🎯", accent: .arenaPrimary),
        .init(code: "first_win",              title: String(localized: "First Win"),         detail: String(localized: "Won your first pool."),             icon: "🏆", accent: .arenaGold),
        .init(code: "first_perfect_matchday", title: String(localized: "Perfect Matchday"),  detail: String(localized: "100%% correct in a pool."),         icon: "✨", accent: .arenaGold),
        .init(code: "streak_5",               title: String(localized: "Streak 5"),          detail: String(localized: "Win 5 pools in a row."),            icon: "🔥", accent: .arenaHot),
        .init(code: "streak_10",              title: String(localized: "Streak 10"),         detail: String(localized: "Win 10 pools in a row."),           icon: "🔥", accent: .arenaHot),
        .init(code: "streak_20",              title: String(localized: "Streak 20"),         detail: String(localized: "Win 20 pools in a row."),           icon: "🔥", accent: .arenaHot),
        .init(code: "veteran_25_pools",       title: String(localized: "Veteran (25)"),      detail: String(localized: "Played 25 pools."),                 icon: "🎖", accent: .arenaAccent),
        .init(code: "veteran_100_pools",      title: String(localized: "Century (100)"),     detail: String(localized: "Played 100 pools."),                icon: "💯", accent: .arenaAccent),
        .init(code: "tier_amateur_reached",   title: String(localized: "Amateur Unlocked"),  detail: String(localized: "Reached the Amateur tier."),        icon: "II", accent: .arenaTextDim),
        .init(code: "tier_pro_reached",       title: String(localized: "Pro Unlocked"),      detail: String(localized: "Reached the Pro tier."),            icon: "I",  accent: .arenaGold),
        .init(code: "tier_veteran_reached",   title: String(localized: "Veteran Unlocked"),  detail: String(localized: "Reached the Veteran tier."),        icon: "◆",  accent: .arenaAccent),
        .init(code: "tier_legend_reached",    title: String(localized: "Legend Unlocked"),   detail: String(localized: "Reached the Legend tier."),         icon: "★",  accent: Color(hex: "FF55E0")),
        .init(code: "top3_x10",               title: String(localized: "Podium Pro"),        detail: String(localized: "10 top-3 finishes."),               icon: "🥉", accent: .arenaPrimary),
        .init(code: "weekly_winner",          title: String(localized: "Weekly Winner"),     detail: String(localized: "Won a weekly event."),              icon: "🗓", accent: .arenaPrimary),
        .init(code: "comeback_kid",           title: String(localized: "Comeback Kid"),      detail: String(localized: "Win after three losses."),          icon: "⚡", accent: .arenaHot),
    ]

    static func meta(for code: String) -> AchievementMeta? {
        all.first { $0.code == code }
    }
}
