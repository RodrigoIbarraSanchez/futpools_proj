//
//  AppBackground.swift
//  futpoolsapp
//

import SwiftUI

struct AppBackground: View {
    @State private var animating = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.appBackground

                // Green orb — top-left, slow drift
                Circle()
                    .fill(Color.appPrimary.opacity(0.13))
                    .frame(width: 400, height: 400)
                    .blur(radius: 85)
                    .scaleEffect(animating ? 1.12 : 1.0)
                    .position(
                        x: animating ? geo.size.width * 0.15 + 18 : geo.size.width * 0.12,
                        y: animating ? -50 : -30
                    )
                    .animation(
                        .easeInOut(duration: 18).repeatForever(autoreverses: true),
                        value: animating
                    )

                // Cyan orb — bottom-right, opposite phase
                Circle()
                    .fill(Color.appAccent.opacity(0.10))
                    .frame(width: 340, height: 340)
                    .blur(radius: 75)
                    .scaleEffect(animating ? 0.91 : 1.0)
                    .position(
                        x: animating ? geo.size.width * 0.92 : geo.size.width * 0.88,
                        y: animating ? geo.size.height * 0.90 : geo.size.height * 0.95
                    )
                    .animation(
                        .easeInOut(duration: 23).repeatForever(autoreverses: true).delay(6),
                        value: animating
                    )

                // Subtle grid overlay
                GridPattern()
                    .stroke(Color.white.opacity(0.025), lineWidth: 1)
                    .allowsHitTesting(false)

                // Pitch bottom glow (static)
                RadialGradient(
                    colors: [Color.appPitch.opacity(0.35), Color.clear],
                    center: .bottom,
                    startRadius: 80,
                    endRadius: 350
                )

                // Vignette
                RadialGradient(
                    colors: [Color.clear, Color.black.opacity(0.45)],
                    center: .center,
                    startRadius: 180,
                    endRadius: max(geo.size.width, geo.size.height) * 0.85
                )

                // Bottom fade
                LinearGradient(
                    colors: [Color.clear, Color.black.opacity(0.12)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        }
        .ignoresSafeArea()
        .onAppear { animating = true }
    }
}

private struct GridPattern: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let spacing: CGFloat = 44
        var x = spacing
        while x < rect.width {
            path.move(to: CGPoint(x: x, y: rect.minY))
            path.addLine(to: CGPoint(x: x, y: rect.maxY))
            x += spacing
        }
        var y = spacing
        while y < rect.height {
            path.move(to: CGPoint(x: rect.minX, y: y))
            path.addLine(to: CGPoint(x: rect.maxX, y: y))
            y += spacing
        }
        return path
    }
}

#Preview {
    AppBackground()
        .preferredColorScheme(.dark)
}
