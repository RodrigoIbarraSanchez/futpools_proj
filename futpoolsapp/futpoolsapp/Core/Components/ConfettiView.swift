//
//  ConfettiView.swift
//  futpoolsapp
//

import SwiftUI

/// Reusable confetti/particle celebration overlay. Use for success moments (e.g. picks saved).
struct ConfettiView: View {
    var particleCount: Int = 80
    var duration: Double = 3.0
    var isActive: Bool = true

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30)) { timeline in
            Canvas { context, size in
                guard isActive else { return }
                let now = timeline.date.timeIntervalSinceReferenceDate
                for i in 0..<particleCount {
                    let seed = Double(i)
                    let xBase = (seed * 0.13).truncatingRemainder(dividingBy: 1) * size.width
                    let delay = (seed * 0.08).truncatingRemainder(dividingBy: 1.2)
                    let progress = min(1, max(0, (now - delay) / duration))
                    let y = -20 + progress * (size.height + 40)
                    let sway = sin(now * 2 + seed) * 12
                    let x = xBase + sway
                    let opacity = progress < 0.85 ? 1.0 : Double(1 - (progress - 0.85) / 0.15)
                    let colors: [Color] = [.appPrimary, .appAccent, .appPrimarySoft, .white, .appGold]
                    let color = colors[Int(seed) % colors.count]
                    let rect = CGRect(x: x - 4, y: y - 4, width: 8, height: 8)
                    context.fill(Path(ellipseIn: rect), with: .color(color.opacity(opacity)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        ConfettiView(particleCount: 40, duration: 2, isActive: true)
    }
    .preferredColorScheme(.dark)
}
