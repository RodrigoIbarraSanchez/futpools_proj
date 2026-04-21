//
//  HudChip.swift
//  futpoolsapp
//

import SwiftUI

struct HudChip: View {
    let text: String
    var color: Color = .arenaPrimary
    var showLiveDot: Bool = false
    var background: Color? = nil

    var body: some View {
        HStack(spacing: 4) {
            if showLiveDot {
                LiveDot(color: color, size: 5)
            }
            Text(text.uppercased())
                .font(ArenaFont.display(size: 10, weight: .bold))
                .tracking(1.2)
                .foregroundColor(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            HudChipShape().fill(background ?? color.opacity(0.13))
        )
        .clipShape(HudChipShape())
    }
}
