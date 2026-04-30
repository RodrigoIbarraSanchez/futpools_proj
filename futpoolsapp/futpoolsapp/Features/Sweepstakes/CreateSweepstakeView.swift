//
//  CreateSweepstakeView.swift
//  futpoolsapp
//
//  Admin-only form to seed a real-prize weekly sweepstake. Mirrors the
//  fields exposed by `POST /sweepstakes` (sweepstakesController.create):
//  title, description, prizeLabel, prizeUSD, entryCostTickets,
//  minEntries, entryOpensAt, entryClosesAt, allowedCountries.
//
//  Visibility is gated client-side via `AuthService.isAdmin` (email
//  allowlist mirroring the backend), and server-side via the same
//  allowlist on the route handler — so even if the UI leaks, a non-
//  admin token gets a 403.
//

import SwiftUI

struct CreateSweepstakeView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var prizeLabel: String = "Gift card Amazon $250 MXN"
    @State private var prizeUSD: String = "14"
    @State private var entryCostTickets: String = "7"
    @State private var minEntries: String = "20"
    @State private var entryOpensAt: Date = Date()
    @State private var entryClosesAt: Date = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var country: String = "MX"

    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var createdSweepstake: Sweepstakes?

    var body: some View {
        NavigationStack {
            Form {
                basicsSection
                prizeSection
                entrySection
                geoSection
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
        Section(String(localized: "Entry rules")) {
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
            DatePicker(String(localized: "Opens"), selection: $entryOpensAt)
            DatePicker(String(localized: "Closes"), selection: $entryClosesAt)
        }
    }

    private var geoSection: some View {
        Section(String(localized: "Geography")) {
            Picker(String(localized: "Allowed country"), selection: $country) {
                Text("🇲🇽 México").tag("MX")
                Text("🇺🇸 USA").tag("US")
            }
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
        !prizeLabel.trimmingCharacters(in: .whitespaces).isEmpty &&
        entryClosesAt > entryOpensAt
    }

    private func submit() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let payload = CreatePayload(
            title: title,
            description: description,
            prizeLabel: prizeLabel,
            prizeUSD: Int(prizeUSD) ?? 0,
            entryCostTickets: Int(entryCostTickets) ?? 7,
            minEntries: Int(minEntries) ?? 20,
            entryOpensAt: iso.string(from: entryOpensAt),
            entryClosesAt: iso.string(from: entryClosesAt),
            allowedCountries: [country]
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
