//
//  RewardedAdButton.swift
//  futpoolsapp
//
//  Embedded in HomeView under DailyPickCard. Tapping it shows a rewarded
//  ad; on completion the user gets +1 Ticket via the backend. UI states:
//    idle    → "▶ Ver anuncio · +1 Ticket"
//    loading → spinner + "Reproduciendo anuncio…"
//    earned  → green flash + "+1 Ticket ganado" (1.5s) → back to idle
//    error   → red toast for 2s
//

import SwiftUI

struct RewardedAdButton: View {
    @EnvironmentObject var auth: AuthService

    @State private var isShowing = false
    @State private var earnedFlash = false
    @State private var errorMessage: String?

    var body: some View {
        Button(action: tap) {
            HStack(spacing: 10) {
                if isShowing {
                    ProgressView()
                        .tint(.arenaAccent)
                        .scaleEffect(0.85)
                    Text(String(localized: "Loading ad…"))
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaTextDim)
                } else if earnedFlash {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                    Text("+1 " + String(localized: "Ticket earned"))
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaPrimary)
                } else {
                    Image(systemName: "play.rectangle.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.arenaAccent)
                    Text(String(localized: "Watch ad · +1 Ticket"))
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaText)
                }
                Spacer()
                if !isShowing && !earnedFlash {
                    HStack(spacing: 3) {
                        Image(systemName: "ticket.fill")
                            .font(.system(size: 9, weight: .bold))
                        Text("+1")
                            .font(ArenaFont.mono(size: 10, weight: .bold))
                    }
                    .foregroundColor(.arenaAccent)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(HudCornerCutShape(cut: 4).fill(Color.arenaAccent.opacity(0.13)))
                    .overlay(HudCornerCutShape(cut: 4).stroke(Color.arenaAccent.opacity(0.3), lineWidth: 1))
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(
                HudCornerCutShape(cut: 8)
                    .fill(earnedFlash ? Color.arenaPrimary.opacity(0.18) : Color.arenaSurface)
            )
            .overlay(
                HudCornerCutShape(cut: 8)
                    .stroke(
                        earnedFlash
                            ? Color.arenaPrimary.opacity(0.6)
                            : Color.arenaAccent.opacity(0.4),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(isShowing)

        if let err = errorMessage {
            Text(err)
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaDanger)
                .padding(.top, 4)
        }
    }

    private func tap() {
        guard !isShowing else { return }
        Task {
            isShowing = true
            errorMessage = nil
            let result = await RewardedAd.shared.showAd(token: auth.token)
            isShowing = false
            switch result {
            case .earned:
                // Flash success state, then refresh user balance so the
                // header pill ticks up and the green flash naturally
                // returns to idle.
                earnedFlash = true
                await auth.fetchUser()
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                earnedFlash = false
            case .dismissedEarly:
                // No reward — silent. User will retry if they want it.
                break
            case .noFill:
                errorMessage = String(localized: "No ads available right now. Try again later.")
                hideErrorAfterDelay()
            case .error(let msg):
                errorMessage = msg
                hideErrorAfterDelay()
            }
        }
    }

    private func hideErrorAfterDelay() {
        Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            errorMessage = nil
        }
    }
}
