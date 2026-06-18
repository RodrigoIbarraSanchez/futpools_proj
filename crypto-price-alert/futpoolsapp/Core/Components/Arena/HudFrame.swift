//
//  HudFrame.swift
//  futpoolsapp
//
//  Corner-cut container with optional glow and corner brackets.
//  SwiftUI equivalent of the React <HudFrame> primitive.
//

import SwiftUI

struct HudFrame<Content: View>: View {
    let cut: CGFloat
    let fill: AnyShapeStyle
    let glow: Color?
    let brackets: Bool
    let stroke: Color
    let content: () -> Content

    init(
        cut: CGFloat = 14,
        fill: AnyShapeStyle = AnyShapeStyle(Color.arenaSurface),
        glow: Color? = nil,
        brackets: Bool = false,
        stroke: Color = .arenaStroke,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.cut = cut
        self.fill = fill
        self.glow = glow
        self.brackets = brackets
        self.stroke = stroke
        self.content = content
    }

    var body: some View {
        let shape = HudCornerCutShape(cut: cut)
        content()
            .background(
                shape.fill(fill)
            )
            .overlay(
                shape
                    .stroke(
                        LinearGradient(
                            colors: [stroke, Color.clear, Color.clear, stroke],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .overlay(alignment: .topLeading) {
                if brackets {
                    HudBrackets(color: glow ?? .arenaPrimary)
                        .allowsHitTesting(false)
                }
            }
            .clipShape(shape)
            .shadow(color: (glow ?? .clear).opacity(glow == nil ? 0 : 0.35), radius: 12, x: 0, y: 0)
    }
}

struct HudBrackets: View {
    var color: Color = .arenaPrimary
    var size: CGFloat = 10

    var body: some View {
        ZStack {
            GeometryReader { geo in
                // Top-left
                Path { p in
                    p.move(to: CGPoint(x: 4, y: 4 + size))
                    p.addLine(to: CGPoint(x: 4, y: 4))
                    p.addLine(to: CGPoint(x: 4 + size, y: 4))
                }.stroke(color, lineWidth: 2)

                // Top-right
                Path { p in
                    p.move(to: CGPoint(x: geo.size.width - 4 - size, y: 4))
                    p.addLine(to: CGPoint(x: geo.size.width - 4, y: 4))
                    p.addLine(to: CGPoint(x: geo.size.width - 4, y: 4 + size))
                }.stroke(color, lineWidth: 2)

                // Bottom-left
                Path { p in
                    p.move(to: CGPoint(x: 4, y: geo.size.height - 4 - size))
                    p.addLine(to: CGPoint(x: 4, y: geo.size.height - 4))
                    p.addLine(to: CGPoint(x: 4 + size, y: geo.size.height - 4))
                }.stroke(color, lineWidth: 2)

                // Bottom-right
                Path { p in
                    p.move(to: CGPoint(x: geo.size.width - 4 - size, y: geo.size.height - 4))
                    p.addLine(to: CGPoint(x: geo.size.width - 4, y: geo.size.height - 4))
                    p.addLine(to: CGPoint(x: geo.size.width - 4, y: geo.size.height - 4 - size))
                }.stroke(color, lineWidth: 2)
            }
        }
    }
}
