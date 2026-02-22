//
//  MatchCard.swift
//  futpoolsapp
//

import SwiftUI

struct MatchCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    LinearGradient(
                        colors: [Color.appPitchDeep, Color.appPitch],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    PitchLines()
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.card)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.12), Color.white.opacity(0.04)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.card))
            .shadow(color: Color.appPrimary.opacity(0.08), radius: 14, x: 0, y: 0)
            .shadow(color: Color.black.opacity(0.4), radius: 14, x: 0, y: 10)
    }
}

private struct PitchLines: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let midX = rect.midX
        p.move(to: CGPoint(x: midX, y: rect.minY + 8))
        p.addLine(to: CGPoint(x: midX, y: rect.maxY - 8))

        let circleRadius = min(rect.width, rect.height) * 0.18
        p.addEllipse(
            in: CGRect(
                x: rect.midX - circleRadius,
                y: rect.midY - circleRadius,
                width: circleRadius * 2,
                height: circleRadius * 2
            )
        )
        return p
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        MatchCard {
            Text("América vs Chivas")
                .foregroundColor(.white)
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
