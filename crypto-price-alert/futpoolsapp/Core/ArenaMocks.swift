//
//  ArenaMocks.swift
//  futpoolsapp
//
//  Remaining helper: deterministic team brand colours for crests when the API
//  doesn't provide one. (The earlier gamification mocks — player stats and
//  achievements — were removed because no backend fields existed yet.)
//

import SwiftUI

enum ArenaTeamColor {
    static func color(for team: String) -> Color {
        let known: [String: String] = [
            "Real Madrid": "FFFFFF", "Barcelona": "A50044", "Atlético": "CB3524",
            "Sevilla": "D4001E", "Real Betis": "00954C", "Valencia": "FF6A00",
            "Villarreal": "FFE667", "Real Sociedad": "0F4C9D", "Athletic": "EE2E24",
            "Getafe": "004FA3", "Arsenal": "EF0107", "Chelsea": "034694",
            "Liverpool": "C8102E", "Man City": "6CABDD", "PSG": "004170",
            "Bayern": "DC052D", "Inter": "0068A8", "América": "FEE100",
            "Chivas": "C4122E",
        ]
        if let hex = known[team] { return Color(hex: hex) }
        let palette = ["21E28C", "36E9FF", "FF2BD6", "FFD166", "E08855", "6FEBFF", "FF55E0"]
        let idx = abs(team.hashValue) % palette.count
        return Color(hex: palette[idx])
    }
}
