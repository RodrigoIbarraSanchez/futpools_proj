//
//  ArcadeButton.swift
//  futpoolsapp
//

import SwiftUI

enum ArcadeButtonVariant {
    case primary, accent, hot, ghost, surface
}

enum ArcadeButtonSize {
    case sm, md, lg

    var padV: CGFloat { self == .lg ? 16 : self == .sm ? 8 : 12 }
    var padH: CGFloat { self == .lg ? 24 : self == .sm ? 14 : 20 }
    var fontSize: CGFloat { self == .lg ? 16 : self == .sm ? 12 : 14 }
}

struct ArcadeButton: View {
    let title: String
    var variant: ArcadeButtonVariant = .primary
    var size: ArcadeButtonSize = .md
    var fullWidth: Bool = false
    var disabled: Bool = false
    var action: () -> Void

    @State private var pressed = false

    private var bg: Color {
        switch variant {
        case .primary: return .arenaPrimary
        case .accent:  return .arenaAccent
        case .hot:     return .arenaHot
        case .ghost:   return .clear
        case .surface: return .arenaSurfaceAlt
        }
    }

    private var fg: Color {
        switch variant {
        case .primary, .accent, .hot: return .arenaOnPrimary
        default: return .arenaText
        }
    }

    var body: some View {
        Button {
            action()
        } label: {
            Text(title.uppercased())
                .font(ArenaFont.display(size: size.fontSize, weight: .heavy))
                .tracking(2)
                .foregroundColor(fg)
                .padding(.vertical, size.padV)
                .padding(.horizontal, size.padH)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(
                    HudCornerCutShape(cut: 8)
                        .fill(bg)
                )
                .overlay {
                    if variant == .ghost {
                        HudCornerCutShape(cut: 8)
                            .stroke(Color.arenaStrokeStrong, lineWidth: 1)
                    }
                }
                .shadow(color: variant == .primary && !disabled ? bg.opacity(0.35) : .clear, radius: 16, y: 0)
                .clipShape(HudCornerCutShape(cut: 8))
                .scaleEffect(pressed ? 0.985 : 1)
                .offset(y: pressed ? 1 : 0)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in if !pressed { pressed = true } }
                .onEnded { _ in pressed = false }
        )
    }
}
