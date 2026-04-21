//
//  ArenaBackground.swift
//  futpoolsapp
//
//  Dark atmospheric backdrop for Arena screens: gradient orbs + isometric grid floor.
//

import SwiftUI

struct ArenaBackground: View {
    var showGridFloor: Bool = false
    var scanlineIntensity: Double = 0.0

    @State private var animate = false

    var body: some View {
        ZStack {
            Color.arenaBg.ignoresSafeArea()

            GeometryReader { geo in
                let w = geo.size.width
                let h = geo.size.height

                // Floating primary orb (top-left)
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.arenaPrimary.opacity(0.22), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: 260
                        )
                    )
                    .frame(width: 440, height: 440)
                    .position(
                        x: animate ? w * 0.10 : w * 0.28,
                        y: animate ? h * 0.08 : h * 0.18
                    )
                    .blur(radius: 30)

                // Floating accent orb (bottom-right)
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.arenaAccent.opacity(0.18), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: 240
                        )
                    )
                    .frame(width: 420, height: 420)
                    .position(
                        x: animate ? w * 0.92 : w * 0.72,
                        y: animate ? h * 0.88 : h * 0.75
                    )
                    .blur(radius: 32)

                // Magenta hotspot (center)
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.arenaHot.opacity(0.10), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: 180
                        )
                    )
                    .frame(width: 360, height: 360)
                    .position(x: w / 2, y: h / 2)
                    .blur(radius: 40)

                // Grid overlay (full)
                ArenaGridPattern(spacing: 44)
                    .stroke(Color.white.opacity(0.03), lineWidth: 0.5)

                if showGridFloor {
                    ArenaGridFloor()
                        .fill(Color.arenaPrimary.opacity(0.13))
                        .frame(height: h * 0.45)
                        .position(x: w / 2, y: h * 0.82)
                        .mask(
                            LinearGradient(
                                colors: [.clear, .black],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                }

                // Vignette
                RadialGradient(
                    colors: [.clear, Color.black.opacity(0.55)],
                    center: .center,
                    startRadius: w * 0.35,
                    endRadius: max(w, h) * 0.8
                )
            }
            .ignoresSafeArea()

            ScanlineOverlay(intensity: scanlineIntensity)
                .ignoresSafeArea()
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 18).repeatForever(autoreverses: true)) {
                animate = true
            }
        }
    }
}

/// Full-screen HUD grid (subtle lines).
struct ArenaGridPattern: Shape {
    var spacing: CGFloat = 44

    func path(in rect: CGRect) -> Path {
        var p = Path()
        var x: CGFloat = 0
        while x <= rect.width {
            p.move(to: CGPoint(x: x, y: 0))
            p.addLine(to: CGPoint(x: x, y: rect.height))
            x += spacing
        }
        var y: CGFloat = 0
        while y <= rect.height {
            p.move(to: CGPoint(x: 0, y: y))
            p.addLine(to: CGPoint(x: rect.width, y: y))
            y += spacing
        }
        return p
    }
}

/// Perspective grid floor — draws a series of horizontal lines getting closer to simulate
/// receding depth, plus converging verticals. Used under the Login hero.
struct ArenaGridFloor: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let rows = 8
        // Horizontal lines — spaced geometrically so they look receding
        for i in 0...rows {
            let t = pow(Double(i) / Double(rows), 1.8)
            let y = CGFloat(t) * rect.height
            p.move(to: CGPoint(x: 0, y: y))
            p.addLine(to: CGPoint(x: rect.width, y: y))
        }
        // Vertical converging lines
        let cols = 12
        let vanishX = rect.midX
        for i in 0...cols {
            let startX = CGFloat(i) / CGFloat(cols) * rect.width
            p.move(to: CGPoint(x: startX, y: rect.maxY))
            p.addLine(to: CGPoint(x: vanishX + (startX - vanishX) * 0.2, y: rect.minY))
        }
        return p
    }
}
