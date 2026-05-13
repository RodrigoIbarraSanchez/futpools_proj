//
//  OnbNotificationsScreen.swift
//  futpoolsapp
//
//  simple_version onboarding step 4 — asks for push permission and
//  explains the value before tapping. Pre-prompting (showing the
//  benefits before the system alert) materially improves opt-in rate
//  vs prompting cold from the system dialog.
//
//  The user can also Skip; we still let them through because push is a
//  scores-app nice-to-have, not a hard gate. They can re-enable from
//  Settings later (Phase 8 will wire that view too).
//

import SwiftUI
import UserNotifications

struct OnbNotificationsScreen: View {
    @ObservedObject var state: OnboardingState
    @State private var requesting = false
    /// Becomes `true` once we know the system alert was dismissed (either
    /// way). Drives the CTA copy from "Activate" to "Continue" so it's
    /// clear the user can move on.
    @State private var asked = false

    var body: some View {
        VStack(spacing: 0) {
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 04",
                title: L("STAY IN THE GAME"),
                subtitle: L("Get instant alerts when your teams play."),
                size: .md
            )
            .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    bullet(
                        icon: "⚽",
                        title: L("GOALS, LIVE"),
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
                .padding(.horizontal, 24)
                .padding(.top, 20)
            }
            .frame(maxHeight: .infinity)

            // Privacy line — small, subtle, non-blocking. Builds trust
            // without taking a second screen.
            Text(L("You can change this any time in Settings."))
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 8)

            OnbPrimaryButton(
                label: requesting
                    ? L("ASKING…")
                    : (asked ? L("CONTINUE") : L("ACTIVATE NOTIFICATIONS")),
                disabled: requesting
            ) {
                if asked { state.advance() }
                else { requestPermission() }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 8)

            // Skip path — quieter visual treatment so it doesn't pull
            // focus from the primary CTA.
            Button {
                asked = true
                state.advance()
            } label: {
                Text(L("Not now"))
                    .font(ArenaFont.mono(size: 11, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 28)
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
                asked = true
                if granted {
                    // Trigger APNs token registration. The handler
                    // (Phase 8) uploads the resulting token to the
                    // backend. Calling this without permission is a
                    // no-op, so it's safe even when granted=false.
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
}

#Preview {
    OnbNotificationsScreen(state: OnboardingState())
        .preferredColorScheme(.dark)
}
