//
//  OnboardingDesign.swift
//  futpoolsapp
//
//  Shared design primitives for the skill-driven onboarding redesign.
//  Mirrors the HTML/CSS prototype in Claude Design (FutPools
//  Onboarding.html) — same vertical rhythm, same TitleBlock pattern,
//  same play-glyph button. Reuses Arena tokens (colors + fonts +
//  HudCornerCutShape).
//

import SwiftUI

// MARK: - Brand wordmark

struct OnbBrandMark: View {
    var size: CGFloat = 12
    var body: some View {
        Text("FUTPOOLS")
            .font(ArenaFont.display(size: size, weight: .heavy))
            .tracking(size * 0.32)
            .foregroundColor(.arenaPrimary)
            .shadow(color: .arenaPrimary.opacity(0.4), radius: 14)
    }
}

// MARK: - Eyebrow + title + subtitle block

/// Three-line metadata header used at the top of most screens.
/// `eyebrow` carries the step pretext ("STEP 02 — PICK ALL THAT
/// APPLY"), `title` the loud headline, `subtitle` an optional
/// supporting line. Center-aligned, balanced wrap.
struct OnbTitleBlock: View {
    enum Size { case xl, lg, md }
    let eyebrow: String?
    let title: String
    var subtitle: String? = nil
    var size: Size = .lg
    var titleColor: Color = .arenaText

    private var titleFontSize: CGFloat {
        switch size { case .xl: return 30; case .lg: return 24; case .md: return 18 }
    }

    var body: some View {
        VStack(spacing: 10) {
            if let eyebrow {
                Text(eyebrow)
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(2.2)
                    .foregroundColor(.arenaTextMuted)
                    .multilineTextAlignment(.center)
            }
            Text(title)
                .font(ArenaFont.display(size: titleFontSize, weight: .heavy))
                .tracking(titleFontSize * 0.06)
                .lineSpacing(2)
                .foregroundColor(titleColor)
                .multilineTextAlignment(.center)
            if let subtitle {
                Text(subtitle)
                    .font(ArenaFont.body(size: 14))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }
        }
        .padding(.horizontal, 20)
    }
}

// MARK: - Primary button with proper play glyph

/// Replaces `ArcadeButton` for onboarding so we get the design's
/// triangular play glyph (drawn as a `Path`, not a "▶ " emoji prefix
/// that varies in size between locales).
struct OnbPrimaryButton: View {
    enum Variant { case primary, ghost }
    let label: String
    var variant: Variant = .primary
    var disabled: Bool = false
    var action: () -> Void

    @State private var pressed = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if variant == .primary {
                    PlayGlyph()
                        .fill(Color.arenaOnPrimary)
                        .frame(width: 9, height: 10)
                }
                Text(label.uppercased())
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                    .tracking(2.5)
                    .foregroundColor(variant == .primary ? .arenaOnPrimary : .arenaText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                HudCornerCutShape(cut: 8)
                    .fill(variant == .primary ? Color.arenaPrimary : Color.clear)
            )
            .overlay(
                HudCornerCutShape(cut: 8)
                    .stroke(variant == .ghost ? Color.arenaStrokeStrong : Color.clear, lineWidth: 1)
            )
            .shadow(color: variant == .primary && !disabled ? .arenaPrimary.opacity(0.32) : .clear, radius: 16)
            .clipShape(HudCornerCutShape(cut: 8))
            .scaleEffect(pressed ? 0.99 : 1)
            .offset(y: pressed ? 1 : 0)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.35 : 1)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in if !pressed { pressed = true } }
                .onEnded { _ in pressed = false }
        )
    }
}

private struct PlayGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: 0))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: 0, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

// MARK: - Badge pill (small green tag, e.g. "Free to play")

struct OnbBadge: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(ArenaFont.mono(size: 10, weight: .bold))
            .tracking(1.2)
            .foregroundColor(.arenaPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(HudCornerCutShape(cut: 5).fill(Color.arenaPrimary.opacity(0.08)))
            .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaPrimary.opacity(0.25), lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 5))
    }
}

// MARK: - Stat card (e.g. "47K · active players this week")

struct OnbStatCard: View {
    let value: String
    let label: String
    var color: Color = .arenaPrimary
    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(ArenaFont.display(size: 18, weight: .heavy))
                .tracking(0.5)
                .foregroundColor(color)
            Text(label.uppercased())
                .font(ArenaFont.mono(size: 8, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.arenaTextMuted)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background(HudCornerCutShape(cut: 10).fill(Color.white.opacity(0.03)))
        .overlay(HudCornerCutShape(cut: 10).stroke(Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 10))
    }
}

// MARK: - Step indicator (linear progress + 01/11 counter)

struct OnbStepIndicator: View {
    let current: Int
    let total: Int
    var body: some View {
        HStack(spacing: 10) {
            Text(String(format: "%02d / %02d", current, total))
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .tracking(1.8)
                .foregroundColor(.arenaTextMuted)
                .monospacedDigit()
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 3)
                    Rectangle()
                        .fill(LinearGradient(
                            colors: [.arenaPrimary, Color(red: 0.16, green: 0.96, blue: 0.63)],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: geo.size.width * CGFloat(current) / CGFloat(max(total, 1)), height: 3)
                        .shadow(color: .arenaPrimary.opacity(0.6), radius: 6)
                        .animation(.easeInOut(duration: 0.3), value: current)
                }
            }
            .frame(height: 3)
        }
    }
}

// MARK: - Icon back button

struct OnbBackButton: View {
    var disabled: Bool = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.arenaTextDim)
                .frame(width: 32, height: 32)
                .background(HudCornerCutShape(cut: 5).fill(Color.white.opacity(0.04)))
                .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
                .clipShape(HudCornerCutShape(cut: 5))
                .opacity(disabled ? 0.3 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

// MARK: - Background with gradient orbs + grid + vignette

struct OnbBackground: View {
    var body: some View {
        ZStack {
            Color.arenaBg.ignoresSafeArea()
            // top-left green orb
            Circle()
                .fill(RadialGradient(
                    colors: [Color.arenaPrimary.opacity(0.22), .clear],
                    center: .center,
                    startRadius: 0, endRadius: 220
                ))
                .frame(width: 440, height: 440)
                .offset(x: -180, y: -300)
                .blur(radius: 40)
            // bottom-right cyan orb
            Circle()
                .fill(RadialGradient(
                    colors: [Color.arenaAccent.opacity(0.18), .clear],
                    center: .center,
                    startRadius: 0, endRadius: 210
                ))
                .frame(width: 420, height: 420)
                .offset(x: 180, y: 320)
                .blur(radius: 40)
            // grid overlay
            GridOverlay()
                .opacity(0.04)
            // vignette
            RadialGradient(
                colors: [.clear, Color.black.opacity(0.55)],
                center: .center,
                startRadius: 200, endRadius: 480
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

private struct GridOverlay: View {
    var body: some View {
        Canvas { ctx, size in
            let step: CGFloat = 44
            var x: CGFloat = 0
            while x < size.width {
                ctx.stroke(Path { p in
                    p.move(to: CGPoint(x: x, y: 0))
                    p.addLine(to: CGPoint(x: x, y: size.height))
                }, with: .color(.white), lineWidth: 1)
                x += step
            }
            var y: CGFloat = 0
            while y < size.height {
                ctx.stroke(Path { p in
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: size.width, y: y))
                }, with: .color(.white), lineWidth: 1)
                y += step
            }
        }
    }
}
