//
//  AppBackground.swift
//  futpoolsapp
//

import SwiftUI

struct AppBackground: View {
    var body: some View {
        ZStack {
            Color.appBackground
            LinearGradient(
                colors: [
                    Color.appPrimary.opacity(0.12),
                    Color.appAccent.opacity(0.08),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [
                    Color.appPrimary.opacity(0.08),
                    Color.clear
                ],
                center: .top,
                startRadius: 10,
                endRadius: 420
            )
            RadialGradient(
                colors: [
                    Color.appPitch.opacity(0.4),
                    Color.clear
                ],
                center: .bottom,
                startRadius: 80,
                endRadius: 350
            )
            LinearGradient(
                colors: [
                    Color.clear,
                    Color.black.opacity(0.15)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
    }
}

#Preview {
    AppBackground()
        .preferredColorScheme(.dark)
}
