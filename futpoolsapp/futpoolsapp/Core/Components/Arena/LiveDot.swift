//
//  LiveDot.swift
//  futpoolsapp
//

import SwiftUI

struct LiveDot: View {
    var color: Color = .arenaDanger
    var size: CGFloat = 6

    @State private var pulsing = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay(
                Circle()
                    .stroke(color, lineWidth: 2)
                    .scaleEffect(pulsing ? 2.2 : 1)
                    .opacity(pulsing ? 0 : 0.6)
            )
            .onAppear {
                withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) {
                    pulsing = true
                }
            }
    }
}
