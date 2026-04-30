//
//  ContestRulesView.swift
//  futpoolsapp
//
//  Bases del Concurso embedded inside the app. Required by Apple
//  Guideline 5.3 (sweepstakes must show full rules, AMOE, and an "Apple
//  is not a sponsor" disclaimer) AND by SEGOB MX (LFJS art. X requires
//  bases on file).
//
//  Copy is intentionally legalese — it's the actual rules of the
//  concurso, not marketing. Operations should review with the MX
//  abogado before launch and update the version string at the bottom.
//

import SwiftUI

struct ContestRulesView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(String(localized: "CONTEST RULES"))
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)

                section(
                    title: String(localized: "1. Eligibility"),
                    body: String(localized: "Open to legal residents of Mexico aged 18 or older with a valid Futpools account. Employees of the organizing entity and their immediate families are not eligible.")
                )

                section(
                    title: String(localized: "2. No purchase necessary (AMOE)"),
                    body: String(localized: "No purchase or payment is required to participate. You can earn a free entry by predicting the Daily Pick once per day for seven consecutive days (7 Tickets = 1 entry). Tickets cannot be purchased; they are earned only through Daily Pick predictions and rewarded ad views, which are also free.")
                )

                section(
                    title: String(localized: "3. How to enter"),
                    body: String(localized: "Spend 7 Tickets to receive 1 entry. You may enter as many times as your Tickets balance allows. Each entry has equal odds of winning.")
                )

                section(
                    title: String(localized: "4. Prize"),
                    body: String(localized: "The prize for each weekly sweepstakes is described on the sweepstakes detail screen at entry time. Prize is non-transferable and has no cash equivalent unless explicitly stated. Winner is responsible for any applicable taxes per Mexican law.")
                )

                section(
                    title: String(localized: "5. Winner selection and notification"),
                    body: String(localized: "After entries close, one winner is selected uniformly at random across all entries. The winner is notified via in-app notification and the email address on their Futpools account within 48 hours. Winner has 7 days to claim the prize; unclaimed prizes are forfeit.")
                )

                section(
                    title: String(localized: "6. Minimum participation"),
                    body: String(localized: "If a sweepstakes does not reach the minimum number of entries shown on its detail screen by the closing time, the sweepstakes is cancelled and all Tickets are refunded. No prize is awarded.")
                )

                section(
                    title: String(localized: "7. Apple disclaimer"),
                    body: String(localized: "This sweepstakes is in no way sponsored, endorsed, administered by, or associated with Apple Inc.")
                )

                section(
                    title: String(localized: "8. Operator"),
                    body: String(localized: "Sweepstakes are organized by the Futpools entity registered in Mexico. For questions or to claim a prize, contact support@futpools.com.")
                )

                Text(String(localized: "Version 2026-04-29 — subject to update."))
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextDim)
                    .padding(.top, 8)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.arenaBg.ignoresSafeArea())
    }

    private func section(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(ArenaFont.display(size: 12, weight: .heavy))
                .tracking(1)
                .foregroundColor(.arenaAccent)
            Text(body)
                .font(ArenaFont.body(size: 12))
                .foregroundColor(.arenaTextDim)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
