//
//  SegmentTab.swift
//  futpoolsapp
//

import SwiftUI

struct SegmentTab: View {
    let titles: [String]
    @Binding var selectedIndex: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(titles.enumerated()), id: \.offset) { index, title in
                Button {
                    selectedIndex = index
                } label: {
                    Text(title.uppercased())
                        .font(AppFont.overline())
                        .fontWeight(selectedIndex == index ? .semibold : .regular)
                        .foregroundColor(selectedIndex == index ? .white : .appTextSecondary)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(
                            selectedIndex == index
                                ? LinearGradient(
                                    colors: [Color.appPrimary, Color.appAccent],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                                : LinearGradient(
                                    colors: [Color.clear, Color.clear],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                if index < titles.count - 1 {
                    Spacer().frame(width: AppSpacing.xs)
                }
            }
        }
        .padding(AppSpacing.xs)
        .background(Color.appSurfaceAlt.opacity(0.7))
        .overlay(
            Capsule()
                .stroke(Color.appStroke.opacity(0.7), lineWidth: 1)
        )
        .clipShape(Capsule())
    }
}
