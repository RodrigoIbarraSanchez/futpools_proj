//
//  PrimaryButton.swift
//  futpoolsapp
//

import SwiftUI

struct PrimaryButton: View {
    let title: String
    let style: Style
    let action: () -> Void

    enum Style {
        case purple
        case green
    }

    init(_ title: String, style: Style = .purple, action: @escaping () -> Void) {
        self.title = title
        self.style = style
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AppFont.headline())
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.md)
                .background(
                    LinearGradient(
                        colors: style == .purple
                            ? [Color.appPrimary, Color.appAccent]
                            : [Color.appPrimarySoft, Color.appPrimary],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.button)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.button))
                .shadow(color: Color.appPrimary.opacity(0.35), radius: 16, x: 0, y: 10)
        }
        .buttonStyle(PrimaryButtonStyle())
    }
}

private struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
            .sensoryFeedback(.impact(weight: .light), trigger: configuration.isPressed)
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        VStack(spacing: 16) {
            PrimaryButton("Entrar", style: .purple) {}
            PrimaryButton("Enviar quiniela", style: .green) {}
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
