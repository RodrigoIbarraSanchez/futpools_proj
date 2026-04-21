//
//  DivisionBadge.swift
//  futpoolsapp
//

import SwiftUI

enum DivisionTier: String {
    case bronze, silver, gold, diamond, legend

    var colors: (Color, Color) {
        switch self {
        case .bronze:  return (Color(hex: "E08855"), Color(hex: "9C5234"))
        case .silver:  return (Color(hex: "E6EAF0"), Color(hex: "8A92A0"))
        case .gold:    return (Color(hex: "FFD166"), Color(hex: "C99122"))
        case .diamond: return (Color(hex: "6FEBFF"), Color(hex: "2B8AC0"))
        case .legend:  return (Color(hex: "FF55E0"), Color(hex: "7A1FB8"))
        }
    }

    var label: String {
        switch self {
        case .bronze:  return "III"
        case .silver:  return "II"
        case .gold:    return "I"
        case .diamond: return "◆"
        case .legend:  return "★"
        }
    }
}

struct DivisionBadge: View {
    var tier: DivisionTier = .gold
    var size: CGFloat = 44

    var body: some View {
        DivisionShieldShape()
            .fill(
                LinearGradient(
                    colors: [tier.colors.0, tier.colors.1],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(width: size, height: size)
            .overlay {
                Text(tier.label)
                    .font(ArenaFont.display(size: size * 0.42, weight: .black))
                    .foregroundColor(.arenaOnPrimary)
                    .shadow(color: .white.opacity(0.3), radius: 0, y: 1)
            }
    }
}
