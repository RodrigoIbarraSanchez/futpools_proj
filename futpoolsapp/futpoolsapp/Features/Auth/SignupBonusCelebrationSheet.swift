//
//  SignupBonusCelebrationSheet.swift
//  futpoolsapp
//
//  One-shot welcome sheet shown after a successful `register`. Makes the
//  signup bonus visible and celebratory — otherwise the coins quietly appear
//  in the balance and new users might never notice them.
//

import SwiftUI

struct SignupBonusCelebrationSheet: View {
    let amount: Int
    let onDismiss: () -> Void

    @State private var appear = false

    var body: some View {
        ZStack {
            // Dim the app behind the sheet. Tap-to-dismiss is deliberately
            // disabled — we want the user to acknowledge via the CTA so we
            // know they saw it.
            Color.arenaBg.opacity(0.94).ignoresSafeArea()

            VStack(spacing: 20) {
                Text("🎁")
                    .font(.system(size: 72))
                    .scaleEffect(appear ? 1 : 0.3)
                    .opacity(appear ? 1 : 0)

                Text(String(localized: "WELCOME BONUS"))
                    .font(ArenaFont.display(size: 18, weight: .black))
                    .tracking(3)
                    .foregroundColor(.arenaPrimary)

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("+\(amount)")
                        .font(ArenaFont.display(size: 56, weight: .black))
                        .foregroundColor(.arenaGold)
                    Text(String(localized: "COINS"))
                        .font(ArenaFont.display(size: 18, weight: .heavy))
                        .tracking(2)
                        .foregroundColor(.arenaGold)
                }

                Text(String(localized: "On the house — enough to sponsor your first pool."))
                    .font(ArenaFont.mono(size: 12))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                ArcadeButton(
                    title: String(localized: "LET'S GO").uppercased(),
                    size: .lg,
                    fullWidth: true
                ) {
                    onDismiss()
                }
                .padding(.horizontal, 32)
                .padding(.top, 8)
            }
            .padding(.vertical, 40)
        }
        .onAppear {
            withAnimation(.spring(response: 0.55, dampingFraction: 0.6)) {
                appear = true
            }
            // Subtle haptic to sell the "reward" moment.
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        }
        .interactiveDismissDisabled() // force explicit ack via the CTA
    }
}
