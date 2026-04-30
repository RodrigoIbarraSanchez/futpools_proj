//
//  SweepstakesTeaserCard.swift
//  futpoolsapp
//
//  Compact banner on Home that links into SweepstakesListView. Shows a
//  trophy + "Sweepstakes" label + arrow. Designed to be eye-catching
//  but not noisy — the real value prop lives inside the list.
//

import SwiftUI

struct SweepstakesTeaserCard: View {
    var body: some View {
        NavigationLink {
            SweepstakesListView()
        } label: {
            HStack(spacing: 12) {
                Text("🏆")
                    .font(.system(size: 28))
                    .shadow(color: .arenaGold.opacity(0.5), radius: 6)
                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "WEEKLY SWEEPSTAKES"))
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .tracking(2)
                        .foregroundColor(.arenaText)
                    Text(String(localized: "Win real prizes — pay with Tickets"))
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.arenaGold)
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(
                HudCornerCutShape(cut: 8)
                    .fill(
                        LinearGradient(
                            colors: [Color.arenaGold.opacity(0.18), Color.arenaSurface],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                HudCornerCutShape(cut: 8)
                    .stroke(Color.arenaGold.opacity(0.45), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
