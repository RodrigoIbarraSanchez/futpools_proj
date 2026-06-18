//
//  XpBar.swift
//  futpoolsapp
//
//  Segmented pixel-chunk progress bar.
//

import SwiftUI

struct XpBar: View {
    let value: Double
    var max: Double = 100
    var color: Color = .arenaPrimary
    var segments: Int = 20
    var height: CGFloat = 8

    private var filled: Int {
        let ratio = Swift.max(0, Swift.min(1, value / Swift.max(max, 0.0001)))
        return Int((ratio * Double(segments)).rounded(.down))
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<segments, id: \.self) { i in
                Rectangle()
                    .fill(i < filled ? color : Color.arenaSurfaceAlt)
                    .shadow(color: i < filled ? color.opacity(0.65) : .clear, radius: 2)
            }
        }
        .frame(height: height)
    }
}
