//
//  CreateSweepstakeView.swift
//  futpoolsapp
//
//  Admin-only form to seed a real-prize weekly sweepstake. Mirrors the
//  fields exposed by `POST /sweepstakes` (sweepstakesController.create).
//
//  Visibility is gated client-side via `AuthService.isAdmin` (email
//  allowlist mirroring the backend), and server-side via the same
//  allowlist on the route handler — so even if the UI leaks, a non-
//  admin token gets a 403.
//
//  By design the admin only chooses the title/description/prize/cost.
//  Open/close timestamps are auto-derived (now → now+7 days) and the
//  pool is open globally (no country gate). Tweak via curl if you ever
//  need to override.
//

import SwiftUI

struct CreateSweepstakeView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var prizeLabel: String = "Amazon Gift Card $250 MXN"
    @State private var prizeUSD: String = "14"
    @State private var entryCostTickets: String = "7"
    @State private var minEntries: String = "20"

    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var createdSweepstake: Sweepstakes?

    var body: some View {
        NavigationStack {
            Form {
                prizePreviewSection
                basicsSection
                prizeSection
                entrySection
                if let err = errorMessage {
                    Section {
                        Text(err).foregroundColor(.red).font(.footnote)
                    }
                }
                submitSection
            }
            .navigationTitle(String(localized: "New real-prize pool"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Close")) { dismiss() }
                }
            }
            .alert(
                String(localized: "Sweepstake created"),
                isPresented: Binding(
                    get: { createdSweepstake != nil },
                    set: { if !$0 { dismiss() } }
                )
            ) {
                Button("OK") { dismiss() }
            } message: {
                if let s = createdSweepstake {
                    Text(String(format: String(localized: "%@ is now live."), s.title))
                }
            }
        }
    }

    // The hero image users will see when browsing the pool. Hardcoded
    // to the Amazon Gift Card asset for now since that's the only
    // prize SKU at launch — when the backend grows a `prizeImageURL`
    // field this becomes a remote AsyncImage with the bundled asset
    // as fallback.
    private var prizePreviewSection: some View {
        Section {
            Image("PrizeAmazonGift")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxHeight: 160)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        } header: {
            Text(String(localized: "Prize preview"))
        } footer: {
            Text(String(localized: "Players will see this image as the prize."))
                .font(.footnote)
        }
    }

    private var basicsSection: some View {
        Section(String(localized: "Basics")) {
            TextField(String(localized: "Title"), text: $title)
            TextField(String(localized: "Description"), text: $description, axis: .vertical)
                .lineLimit(2...4)
        }
    }

    private var prizeSection: some View {
        Section(String(localized: "Prize")) {
            TextField(String(localized: "Prize label"), text: $prizeLabel)
            HStack {
                Text(String(localized: "Prize cost (USD)"))
                Spacer()
                TextField("14", text: $prizeUSD)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
            }
        }
    }

    private var entrySection: some View {
        Section {
            HStack {
                Text(String(localized: "Entry cost (Tickets)"))
                Spacer()
                TextField("7", text: $entryCostTickets)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
            }
            HStack {
                Text(String(localized: "Min entries"))
                Spacer()
                TextField("20", text: $minEntries)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
            }
        } header: {
            Text(String(localized: "Entry rules"))
        } footer: {
            Text(String(localized: "Opens immediately. Closes in 7 days. Open to everyone — no country restriction."))
                .font(.footnote)
        }
    }

    private var submitSection: some View {
        Section {
            Button {
                Task { await submit() }
            } label: {
                HStack {
                    Spacer()
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text(String(localized: "Create real-prize pool")).bold()
                    }
                    Spacer()
                }
            }
            .disabled(!canSubmit || isSubmitting)
        }
    }

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty &&
        !prizeLabel.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func submit() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()
        let inAWeek = Calendar.current.date(byAdding: .day, value: 7, to: now) ?? now
        let payload = CreatePayload(
            title: title,
            description: description,
            prizeLabel: prizeLabel,
            prizeUSD: Int(prizeUSD) ?? 0,
            entryCostTickets: Int(entryCostTickets) ?? 7,
            minEntries: Int(minEntries) ?? 20,
            entryOpensAt: iso.string(from: now),
            entryClosesAt: iso.string(from: inAWeek),
            // Empty array = no country restriction (global). Backend
            // serializes Sweepstakes with `allowedCountries: []` and
            // skips the country gate at /enter time when the array is
            // empty (sweepstakesController.canEnter logic).
            allowedCountries: []
        )
        do {
            let s: Sweepstakes = try await APIClient.shared.request(
                method: "POST",
                path: "/sweepstakes",
                body: payload,
                token: auth.token
            )
            createdSweepstake = s
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private struct CreatePayload: Encodable {
        let title: String
        let description: String
        let prizeLabel: String
        let prizeUSD: Int
        let entryCostTickets: Int
        let minEntries: Int
        let entryOpensAt: String
        let entryClosesAt: String
        let allowedCountries: [String]
    }
}
