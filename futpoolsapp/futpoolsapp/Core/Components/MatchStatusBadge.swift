//
//  MatchStatusBadge.swift
//  futpoolsapp
//

import SwiftUI

struct MatchStatusBadge: View {
    let text: String
    let isLive: Bool
    let isFinal: Bool
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 6) {
            if isLive {
                Circle()
                    .fill(Color.appPrimary)
                    .frame(width: 6, height: 6)
            }
            Text(text)
                .font(AppFont.overline())
                .foregroundColor(isLive ? .black : .appTextSecondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule().fill(
                isLive
                    ? AnyShapeStyle(
                        LinearGradient(
                            colors: [Color.appPrimary, Color.appAccent],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    : AnyShapeStyle(isFinal ? Color.appSurfaceAlt : Color.appSurface)
            )
        )
        .overlay(
            Capsule()
                .stroke(Color.white.opacity(isLive ? (pulse ? 0.35 : 0.15) : 0.08), lineWidth: 1)
        )
        .shadow(color: isLive ? Color.appPrimary.opacity(pulse ? 0.5 : 0.2) : .clear, radius: isLive ? 10 : 0)
        .onAppear {
            if isLive {
                withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
        }
    }
}
