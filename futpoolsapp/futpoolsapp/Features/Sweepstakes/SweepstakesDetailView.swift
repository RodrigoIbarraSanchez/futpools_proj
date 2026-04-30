//
//  SweepstakesDetailView.swift
//  futpoolsapp
//
//  Sweepstakes detail + entry button. Shows the prize, entry cost, time
//  left, current entry count, the user's entries, and a CTA to enter
//  (debits Tickets). Embeds ContestRulesView so the user can read the
//  bases del concurso without leaving the screen — required by the
//  legal AMOE disclaimer.
//

import SwiftUI
import Combine

struct SweepstakesDetailView: View {
    let sweepstakesId: String
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = SweepstakesDetailViewModel()
    @State private var showRules = false
    @State private var showDeleteConfirm = false

    var body: some View {
        ZStack {
            ArenaBackground()
            ScrollView {
                if let s = vm.item {
                    VStack(alignment: .leading, spacing: 16) {
                        prizeCard(s)
                        statsCard(s)
                        actionCard(s)
                        Button {
                            showRules = true
                        } label: {
                            Text("📜 " + String(localized: "View contest rules"))
                                .font(ArenaFont.mono(size: 11, weight: .bold))
                                .tracking(1.5)
                                .foregroundColor(.arenaAccent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaAccent.opacity(0.4), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        if let err = vm.errorMessage {
                            Text(err)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaDanger)
                                .padding(10)
                                .background(HudCornerCutShape(cut: 5).fill(Color.arenaDanger.opacity(0.12)))
                        }
                    }
                    .padding(16)
                    .padding(.bottom, 80)
                } else if vm.isLoading {
                    ProgressView().tint(.arenaPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 60)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(String(localized: "REAL PRIZE POOL"))
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(3)
                    .foregroundColor(.arenaText)
            }
            // Admin-only trash button. Backend re-checks isAdmin on
            // DELETE /sweepstakes/:id, so non-admins can't reach it
            // even with a forged build.
            if auth.isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showDeleteConfirm = true
                    } label: {
                        Image(systemName: "trash")
                            .foregroundColor(.arenaDanger)
                    }
                }
            }
        }
        .alert(String(localized: "Delete this sweepstake?"), isPresented: $showDeleteConfirm) {
            Button(String(localized: "Cancel"), role: .cancel) {}
            Button(String(localized: "Delete"), role: .destructive) {
                Task {
                    await vm.delete(id: sweepstakesId, token: auth.token)
                    if vm.errorMessage == nil { dismiss() }
                }
            }
        } message: {
            Text(String(localized: "Any entries already paid will be refunded."))
        }
        .sheet(isPresented: $showRules) {
            NavigationStack {
                ContestRulesView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button(String(localized: "Close")) { showRules = false }
                                .foregroundColor(.arenaTextDim)
                        }
                    }
            }
        }
        .task { await vm.load(id: sweepstakesId, token: auth.token) }
    }

    private func prizeCard(_ s: Sweepstakes) -> some View {
        HudFrame(glow: .arenaGold) {
            VStack(alignment: .leading, spacing: 12) {
                // Hero prize image — for Amazon-prize sweepstakes we
                // render the bundled Gift Card asset so users see what
                // they're playing for the moment they open the screen.
                // Gracefully hidden when the prize doesn't match.
                if prizeImageName(for: s) != nil {
                    Image(prizeImageName(for: s)!)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .frame(maxHeight: 200)
                        .shadow(color: .arenaGold.opacity(0.4), radius: 14, y: 4)
                }
                Text(s.title.uppercased())
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .tracking(1)
                    .foregroundColor(.arenaText)
                if let desc = s.description, !desc.isEmpty {
                    Text(desc)
                        .font(ArenaFont.body(size: 13))
                        .foregroundColor(.arenaTextDim)
                }
                HStack(spacing: 8) {
                    Text("🏆")
                        .font(.system(size: 28))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "Prize"))
                            .font(ArenaFont.mono(size: 9))
                            .tracking(1.5)
                            .foregroundColor(.arenaTextMuted)
                        Text(s.prizeLabel)
                            .font(ArenaFont.display(size: 18, weight: .heavy))
                            .foregroundColor(.arenaGold)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Best-effort match from the prize label to a bundled hero image.
    /// Pre-Backend-prizeImageURL stopgap: keyword-detect "amazon" /
    /// "gift card" and return the asset name. Returns nil for prizes
    /// without a matching asset so the section just collapses.
    private func prizeImageName(for s: Sweepstakes) -> String? {
        let label = s.prizeLabel.lowercased()
        if label.contains("amazon") || label.contains("gift card") {
            return "PrizeAmazonGift"
        }
        return nil
    }

    private func statsCard(_ s: Sweepstakes) -> some View {
        HudFrame {
            VStack(spacing: 10) {
                statRow(
                    label: String(localized: "Entry cost"),
                    value: "\(s.entryCostTickets) " + String(localized: "Tickets")
                )
                statRow(
                    label: String(localized: "Your entries"),
                    value: "\(s.myEntries ?? 0)"
                )
                statRow(
                    label: String(localized: "Total entries"),
                    value: "\(s.totalEntries ?? 0) / \(s.minEntries) " + String(localized: "min")
                )
                if let closes = s.entryClosesDate {
                    statRow(
                        label: String(localized: "Closes"),
                        value: Self.dateFmt.string(from: closes)
                    )
                }
            }
            .padding(14)
        }
    }

    @ViewBuilder
    private func actionCard(_ s: Sweepstakes) -> some View {
        let canEnter = s.status == .open && !s.hasClosed
        let userTickets = auth.currentUser?.ticketsValue ?? 0
        let canAfford = userTickets >= s.entryCostTickets

        VStack(spacing: 8) {
            ArcadeButton(
                title: enterTitle(s, canEnter: canEnter, canAfford: canAfford),
                size: .lg,
                fullWidth: true,
                disabled: !canEnter || !canAfford || vm.isSubmitting
            ) {
                Task {
                    await vm.enter(id: s.id, token: auth.token)
                    await auth.fetchUser()
                }
            }
            if canEnter && !canAfford {
                Text(String(format: String(localized: "Need %lld more Tickets"), s.entryCostTickets - userTickets))
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaDanger)
            }
            // AMOE disclaimer — required for legal compliance. Lives
            // here AND in ContestRulesView so the user always sees it
            // before clicking Enter.
            Text(String(localized: "Free entry: 7 daily check-ins (one per day for a week) = 1 entry. No purchase required."))
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(.arenaTextDim)
                .multilineTextAlignment(.center)
                .padding(.top, 4)
            // Apple Guideline 5.3 disclaimer — must appear on the same
            // surface as the entry CTA, not buried in rules. Hairline
            // text style keeps it unobtrusive but always present.
            Text(String(localized: "This sweepstakes is in no way sponsored, endorsed, administered by, or associated with Apple Inc."))
                .font(ArenaFont.mono(size: 8))
                .foregroundColor(.arenaTextFaint)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 10)
        }
    }

    private func enterTitle(_ s: Sweepstakes, canEnter: Bool, canAfford: Bool) -> String {
        if vm.isSubmitting { return String(localized: "ENTERING…") }
        if !canEnter {
            switch s.status {
            case .settled:   return String(localized: "SETTLED")
            case .cancelled: return String(localized: "CANCELLED")
            default:         return String(localized: "ENTRIES CLOSED")
            }
        }
        if !canAfford { return String(localized: "INSUFFICIENT TICKETS") }
        return "▶ " + String(format: String(localized: "ENTER · %lld TICKETS"), s.entryCostTickets)
    }

    private func statRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(ArenaFont.mono(size: 10))
                .tracking(1)
                .foregroundColor(.arenaTextMuted)
            Spacer()
            Text(value)
                .font(ArenaFont.mono(size: 12, weight: .bold))
                .foregroundColor(.arenaText)
        }
    }

    static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short; return f
    }()
}

@MainActor
final class SweepstakesDetailViewModel: ObservableObject {
    @Published var item: Sweepstakes?
    @Published var isLoading = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    func load(id: String, token: String?) async {
        isLoading = true
        defer { isLoading = false }
        do {
            item = try await APIClient.shared.request(
                method: "GET",
                path: "/sweepstakes/\(id)",
                token: token
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func enter(id: String, token: String?) async {
        guard !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            let _: SweepstakesEnterResponse = try await APIClient.shared.request(
                method: "POST",
                path: "/sweepstakes/\(id)/enter",
                token: token
            )
            // Refetch to update myEntries/totalEntries counters.
            await load(id: id, token: token)
        } catch {
            let desc = error.localizedDescription
            if desc.contains("INSUFFICIENT_TICKETS") {
                errorMessage = String(localized: "Not enough Tickets to enter.")
            } else if desc.contains("ENTRY_CLOSED") {
                errorMessage = String(localized: "Entries are closed.")
                await load(id: id, token: token)
            } else if desc.contains("NOT_OPEN") {
                errorMessage = String(localized: "This sweepstakes isn't open.")
            } else {
                errorMessage = desc
            }
        }
    }

    func delete(id: String, token: String?) async {
        errorMessage = nil
        struct EmptyBody: Encodable {}
        struct DeleteResponse: Decodable { let ok: Bool }
        do {
            let _: DeleteResponse = try await APIClient.shared.request(
                method: "DELETE",
                path: "/sweepstakes/\(id)",
                token: token
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
