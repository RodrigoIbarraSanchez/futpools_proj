//
//  CardView.swift
//  futpoolsapp
//

import SwiftUI

struct CardView<Content: View>: View {
    let compact: Bool
    let content: Content

    init(compact: Bool = false, @ViewBuilder content: () -> Content) {
        self.compact = compact
        self.content = content()
    }

    var body: some View {
        content
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, compact ? AppSpacing.sm : AppSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    colors: [Color.appSurface, Color.appSurfaceAlt],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.card)
                    .stroke(Color.appStroke.opacity(0.7), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.card))
            .shadow(color: Color.black.opacity(0.35), radius: 12, x: 0, y: 8)
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Jornada 1")
                    .font(AppFont.headline())
                    .foregroundColor(.appTextPrimary)
                Text("Liga MX · 1-7 Feb")
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)
            }
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
