//
//  AppTheme.swift
//  futpoolsapp
//

import SwiftUI

extension Color {
    init(hex: String, alpha: Double = 1) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: UInt64
        switch cleaned.count {
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: alpha
        )
    }

    // Draftea-inspired palette (deep charcoal + neon green accents)
    static let appBackground = Color(hex: "#0B0F14")
    static let appSurface = Color(hex: "#141A21")
    static let appSurfaceAlt = Color(hex: "#1B2430")
    static let appStroke = Color(hex: "#263244")
    static let appPrimary = Color(hex: "#21E28C")
    static let appPrimarySoft = Color(hex: "#2AF5A2")
    static let appAccent = Color(hex: "#36E9FF")
    static let appLiveRed = Color(hex: "#FF5D5D")
    static let appPitch = Color(hex: "#0C2322")
    static let appPitchDeep = Color(hex: "#091716")
    static let appTextPrimary = Color.white
    static let appTextSecondary = Color.white.opacity(0.7)
    static let appTextMuted = Color.white.opacity(0.5)
    static let appCardBackground = appSurface
    static let appPurple = appPrimary
    static let appGreen = appPrimarySoft
    // Game-like prize/trophy accents (gold, silver, bronze for podiums)
    static let appGold = Color(hex: "#FFD700")
    static let appGoldSoft = Color(hex: "#FFE55C")
    static let appSilver = Color(hex: "#C0C0C0")
    static let appBronze = Color(hex: "#CD7F32")
}

enum AppFont {
    static func title() -> Font { .system(size: 22, weight: .bold, design: .rounded) }
    static func headline() -> Font { .system(size: 17, weight: .semibold, design: .rounded) }
    static func body() -> Font { .system(size: 15, weight: .regular, design: .rounded) }
    static func caption() -> Font { .system(size: 13, weight: .regular, design: .rounded) }
    static func overline() -> Font { .system(size: 11, weight: .semibold, design: .rounded) }
}

enum AppSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
}

enum AppRadius {
    static let card: CGFloat = 18
    static let button: CGFloat = 14
    static let pill: CGFloat = 999
}
