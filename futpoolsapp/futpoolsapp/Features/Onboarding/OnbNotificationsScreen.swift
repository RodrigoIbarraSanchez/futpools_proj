//
//  OnbNotificationsScreen.swift
//  futpoolsapp
//
//  simple_version onboarding step 3 — explains push value, then asks
//  permission. The CTA is intentionally NEUTRAL ("CONTINUAR") because
//  Apple flags onboarding flows that promise the app will turn on
//  notifications (the user is always the one who decides via the system
//  alert). Wording the button as "Activate notifications" gets reviews
//  rejected under App Review guideline 4.5.4.
//

import SwiftUI
import UserNotifications

struct OnbNotificationsScreen: View {
    @ObservedObject var state: OnboardingState
    @State private var requesting = false

    var body: some View {
        // Vertically-centered single column. The legacy layout
        // top-anchored everything, leaving a big empty bottom band.
        VStack(spacing: 28) {
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 03",
                title: L("STAY IN THE GAME"),
                subtitle: L("Get instant alerts when your teams play."),
                size: .md
            )

            VStack(spacing: 12) {
                bullet(
                    icon: "⚽",
                    title: L("LIVE GOALS"),
                    desc: L("Banner pops the second your team scores or concedes.")
                )
                bullet(
                    icon: "⏰",
                    title: L("KICKOFF REMINDERS"),
                    desc: L("30-minute warning before any pool you joined starts.")
                )
                bullet(
                    icon: "🏁",
                    title: L("FINAL RESULTS"),
                    desc: L("Get the FT score the moment the match ends.")
                )
            }
            .padding(.horizontal, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.horizontal, 24)
        .safeAreaInset(edge: .bottom) {
            // Footer pinned to the bottom safe area so the centered
            // content above doesn't get crowded.
            VStack(spacing: 8) {
                Text(L("You can change this any time in Settings."))
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                OnbPrimaryButton(
                    label: requesting ? L("ASKING…") : L("CONTINUE"),
                    disabled: requesting
                ) {
                    requestPermission()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
            // Skip path removed entirely — the simple_version onboarding
            // is mandatory end-to-end. The system alert itself gives the
            // user the actual yes/no, and either way we advance.
        }
    }

    // MARK: - Bullet row

    private func bullet(icon: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(icon)
                .font(.system(size: 28))
                .frame(width: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(1.5)
                    .foregroundColor(.arenaText)
                Text(desc)
                    .font(ArenaFont.body(size: 12))
                    .foregroundColor(.arenaTextDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            HudCornerCutShape(cut: 10)
                .fill(Color.arenaSurface)
                .overlay(
                    HudCornerCutShape(cut: 10)
                        .stroke(Color.arenaStroke, lineWidth: 1)
                )
        )
        .clipShape(HudCornerCutShape(cut: 10))
    }

    // MARK: - Permission

    private func requestPermission() {
        requesting = true
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, _ in
            DispatchQueue.main.async {
                requesting = false
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                // Always advance — onboarding is mandatory. If the user
                // denied, they continue without push (Settings re-entry
                // ships in Phase 8 so they can change their mind later).
                state.advance()
            }
        }
    }
}

#Preview {
    OnbNotificationsScreen(state: OnboardingState())
        .preferredColorScheme(.dark)
}
