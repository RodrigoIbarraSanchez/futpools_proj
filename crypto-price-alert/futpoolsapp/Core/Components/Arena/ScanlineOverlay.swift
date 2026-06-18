//
//  ScanlineOverlay.swift
//  futpoolsapp
//

import SwiftUI

struct ScanlineOverlay: View {
    var intensity: Double = 0.25

    var body: some View {
        if intensity <= 0 {
            Color.clear
        } else {
            Canvas { ctx, size in
                let step: CGFloat = 3
                var y: CGFloat = 0
                let color = Color.white.opacity(0.03 * intensity)
                while y < size.height {
                    ctx.fill(
                        Path(CGRect(x: 0, y: y, width: size.width, height: 1)),
                        with: .color(color)
                    )
                    y += step
                }
            }
            .blendMode(.overlay)
            .allowsHitTesting(false)
            .opacity(intensity)
        }
    }
}
