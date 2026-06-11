//
//  PrizeLadderThermometer.swift
//  futpoolsapp
//
//  Gamified prize-ladder hero for prize_ladder pools: a vertical
//  thermometer whose mercury rises with the player's aciertos, next to
//  the tier cards, plus a big animated "live prize" readout. SwiftUI
//  counterpart of the web <ThermometerLadder>.
//

import SwiftUI

struct PrizeLadderThermometer: View {
    let ladder: [PrizeTier]
    let liveScore: Int
    let settledScore: Int
    let fixtureCount: Int
    let hasLiveFixtures: Bool

    private var denom: Int { max(fixtureCount, 1) }
    private var fillRatio: CGFloat { max(0, min(1, CGFloat(liveScore) / CGFloat(denom))) }
    private var livePrize: Int { PrizeLadder.prize(for: liveScore, in: ladder) }
    private var currentTier: PrizeTier? { PrizeLadder.currentTier(for: liveScore, in: ladder) }

    // Green (winning) at the top of the scale → red (cold) at the bottom.
    private func ramp(_ ratio: CGFloat) -> Color {
        if ratio >= 0.92 { return .arenaPrimary }
        if ratio >= 0.75 { return Color(red: 0.49, green: 0.88, blue: 0.35) }
        if ratio >= 0.6 { return .arenaGold }
        if ratio >= 0.45 { return Color(red: 1.0, green: 0.62, blue: 0.27) }
        return .arenaDanger
    }

    private var thermoGradient: LinearGradient {
        LinearGradient(
            colors: [
                .arenaDanger,
                Color(red: 1.0, green: 0.62, blue: 0.27),
                .arenaGold,
                Color(red: 0.49, green: 0.88, blue: 0.35),
                .arenaPrimary,
            ],
            startPoint: .bottom, endPoint: .top
        )
    }

    var body: some View {
        VStack(spacing: 14) {
            readout
            HStack(alignment: .top, spacing: 12) {
                thermometer
                VStack(spacing: 6) {
                    ForEach(ladder) { tier in tierRow(tier) }
                }
            }
        }
        .padding(.horizontal, 16)
        .sensoryFeedback(.increase, trigger: liveScore)
    }

    // MARK: Live prize readout

    private var readout: some View {
        HudFrame(cut: 14, glow: ramp(fillRatio), brackets: true) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(hasLiveFixtures
                         ? String(localized: "YOUR LIVE PRIZE")
                         : String(localized: "YOUR PRIZE"))
                        .font(ArenaFont.display(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    Spacer()
                    if hasLiveFixtures {
                        HudChip(text: String(localized: "LIVE · MAY CHANGE"),
                                color: .arenaDanger, showLiveDot: true)
                    }
                }
                Text(PrizeLadder.formatMXN(livePrize))
                    .font(ArenaFont.display(size: 44, weight: .heavy))
                    .foregroundColor(ramp(fillRatio))
                    .contentTransition(.numericText())
                    .shadow(color: ramp(fillRatio).opacity(0.4), radius: 16)
                    .animation(.spring(response: 0.4, dampingFraction: 0.7), value: livePrize)
                Text("\(liveScore) / \(fixtureCount) \(String(localized: "aciertos_word"))")
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: Thermometer tube

    private var thermometer: some View {
        let tubeHeight = CGFloat(ladder.count) * 40 + CGFloat(max(ladder.count - 1, 0)) * 6
        return VStack(spacing: 0) {
            ZStack(alignment: .bottom) {
                Capsule().fill(Color.arenaBg2)
                    .overlay(Capsule().stroke(Color.arenaStroke, lineWidth: 1))
                Capsule().fill(thermoGradient).opacity(0.18)
                GeometryReader { g in
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        Capsule()
                            .fill(thermoGradient)
                            .frame(height: g.size.height * fillRatio)
                            .shadow(color: ramp(fillRatio).opacity(0.7), radius: 10)
                    }
                }
            }
            .frame(width: 24, height: max(tubeHeight, 60))
            .animation(.spring(response: 0.8, dampingFraction: 0.85), value: fillRatio)

            // Bulb — carries the player's current acierto count.
            Circle()
                .fill(RadialGradient(
                    colors: [ramp(fillRatio), .arenaDanger],
                    center: .topLeading, startRadius: 2, endRadius: 30))
                .frame(width: 42, height: 42)
                .overlay(Circle().stroke(Color.arenaStroke, lineWidth: 1))
                .overlay(
                    Text("\(liveScore)")
                        .font(ArenaFont.display(size: 18, weight: .heavy))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.45), radius: 1, y: 1)
                )
                .shadow(color: ramp(fillRatio).opacity(0.7), radius: 12)
                .offset(y: -6)
        }
        .frame(width: 46)
    }

    // MARK: Tier card

    private func tierRow(_ tier: PrizeTier) -> some View {
        let ratio = max(0, min(1, CGFloat(tier.max) / CGFloat(denom)))
        let color = ramp(ratio)
        let isCurrent = currentTier == tier
        let zeroPrize = tier.prizeMXN <= 0
        return HStack {
            Text(PrizeLadder.rangeLabel(tier))
                .font(ArenaFont.display(size: 14, weight: .bold))
                .foregroundColor(isCurrent ? .arenaText : .arenaTextDim)
            Spacer()
            Text(PrizeLadder.formatMXN(tier.prizeMXN))
                .font(ArenaFont.display(size: 18, weight: .heavy))
                .foregroundColor(zeroPrize ? .arenaTextMuted : color)
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(HudCornerCutShape(cut: 8).fill(isCurrent ? color.opacity(0.22) : Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 8).stroke(isCurrent ? color : Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 8))
        .shadow(color: isCurrent ? color.opacity(0.4) : .clear, radius: 10)
        .scaleEffect(isCurrent ? 1.02 : 1.0)
        .opacity(zeroPrize && !isCurrent ? 0.6 : 1)
        .animation(.easeInOut(duration: 0.25), value: isCurrent)
    }
}
