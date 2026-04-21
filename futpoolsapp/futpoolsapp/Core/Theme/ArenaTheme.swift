//
//  ArenaTheme.swift
//  futpoolsapp
//
//  Design tokens for the "FutPools Arena" cyber-arcade redesign.
//  Additive to AppTheme — existing code keeps working, new UI uses these.
//

import SwiftUI

// MARK: - Palette

extension Color {
    static let arenaBg         = Color(hex: "#07090D")
    static let arenaBg2        = Color(hex: "#0B0F14")
    static let arenaSurface    = Color(hex: "#11161E")
    static let arenaSurfaceAlt = Color(hex: "#18202B")
    static let arenaStroke     = Color.white.opacity(0.08)
    static let arenaStrokeStrong = Color.white.opacity(0.18)

    static let arenaText      = Color(hex: "#F3F6FB")
    static let arenaTextDim   = Color(hex: "#F3F6FB").opacity(0.68)
    static let arenaTextMuted = Color(hex: "#F3F6FB").opacity(0.40)
    static let arenaTextFaint = Color(hex: "#F3F6FB").opacity(0.22)

    // Accent palette — NEON (default)
    static let arenaPrimary     = Color(hex: "#21E28C")
    static let arenaPrimarySoft = Color(hex: "#2AF5A2")
    static let arenaAccent      = Color(hex: "#36E9FF")
    static let arenaHot         = Color(hex: "#FF2BD6")
    static let arenaDanger      = Color(hex: "#FF3B5C")

    // Podium / rarity
    static let arenaGold   = Color(hex: "#FFD166")
    static let arenaSilver = Color(hex: "#D0D4DA")
    static let arenaBronze = Color(hex: "#E08855")

    // Pitch
    static let arenaPitch     = Color(hex: "#0B2219")
    static let arenaPitchLine = Color(hex: "#21E28C").opacity(0.28)

    /// Dark text used on top of neon primary fills (chips, buttons).
    static let arenaOnPrimary = Color(hex: "#061018")
}

// MARK: - Fonts
//
// The Arena design calls for Oxanium / Chakra Petch / JetBrains Mono.
// Those .ttf files are not registered in the project. The helpers below
// use the CUSTOM font name if installed and fall back to the system rounded /
// monospaced designs — which give an acceptable arcade/HUD feel out of the box.
//
// To install the real fonts later:
//   1. Drop .ttf files into the project (e.g. Resources/Fonts/)
//   2. Add them to "Fonts provided by application" in Info.plist
//   3. Use the PostScript names (e.g. "Oxanium-Bold").

enum ArenaFont {
    /// Display — angular/geometric game HUD feel.
    static func display(size: CGFloat, weight: Font.Weight = .heavy) -> Font {
        // Try Oxanium first, else system rounded heavy.
        if UIFont(name: "Oxanium-Bold", size: size) != nil {
            return .custom("Oxanium-Bold", size: size)
        }
        return .system(size: size, weight: weight, design: .rounded)
    }

    /// Mono — tactical data, scores, timestamps (Football Manager vibe).
    static func mono(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        if UIFont(name: "JetBrainsMono-Regular", size: size) != nil {
            return .custom("JetBrainsMono-Regular", size: size)
        }
        return .system(size: size, weight: weight, design: .monospaced)
    }

    /// Body — default reading font.
    static func body(size: CGFloat = 13, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}

// MARK: - Letter spacing helper

extension Text {
    /// Approximate the `letter-spacing` CSS vibe. SwiftUI uses absolute tracking in pt.
    func arenaTracking(_ tracking: CGFloat) -> Text {
        self.tracking(tracking)
    }
}

// MARK: - Palette / Theme toggles (future-proof for tweak panel)

enum ArenaPalette: String, CaseIterable {
    case neon, magenta, gold

    var primary: Color {
        switch self {
        case .neon:    return .arenaPrimary
        case .magenta: return Color(hex: "#FF2BD6")
        case .gold:    return Color(hex: "#FFC738")
        }
    }

    var hot: Color {
        switch self {
        case .neon:    return .arenaHot
        case .magenta: return .arenaPrimary
        case .gold:    return .arenaHot
        }
    }
}
