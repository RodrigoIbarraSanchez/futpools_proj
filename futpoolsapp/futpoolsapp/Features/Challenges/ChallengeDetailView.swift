//
//  ChallengeDetailView.swift
//  futpoolsapp
//
//  Challenge detail screen with role-aware actions:
//     viewer = challenger, status = pending, directed → share + cancel ("WAITING FOR @user")
//     viewer = challenger, status = pending, open     → share + cancel ("OPEN — SHARE THE LINK")
//     viewer = opponent,   status = pending           → pick a side + accept/decline
//     viewer = third party, status = pending, open    → claim picker (accept only)
//     any,                 status = accepted          → locked picks, watch settlement
//     any,                 status = settled           → winner highlight
//

import Combine
import SwiftUI

struct ChallengeDetailView: View {
    let challengeId: String
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = ChallengeDetailViewModel()
    @Environment(\.dismiss) private var dismiss

    /// Shared kickoff formatter — created once, not per render.
    static let kickoffFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .full
        f.timeStyle = .short
        f.locale = Locale.current
        return f
    }()

    var body: some View {
        ZStack {
            ArenaBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let c = vm.challenge {
                        content(c)
                    } else if vm.isLoading {
                        ProgressView().tint(.arenaPrimary).frame(maxWidth: .infinity).padding(.top, 60)
                    } else {
                        Text(vm.error ?? String(localized: "Challenge not found"))
                            .font(ArenaFont.mono(size: 12))
                            .foregroundColor(.arenaDanger)
                            .padding(.top, 60)
                    }
                }
                .padding(16)
                .padding(.bottom, 120)
            }
        }
        .arenaTabBarHidden()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task { await vm.load(id: challengeId, token: auth.token) }
    }

    // MARK: — Content

    @ViewBuilder
    private func content(_ c: Challenge) -> some View {
        HStack(spacing: 8) {
            HudChip(text: statusLabel(c), color: statusColor(c))
            Text(c.marketType.label)
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextMuted)
            Spacer()
            Text("🪙 \(c.stakeCoins)")
                .font(ArenaFont.display(size: 22, weight: .black))
                .foregroundColor(.arenaGold)
        }

        // Fixture card
        HudFrame {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    TeamCrestArena(name: c.fixture.homeTeam, color: ArenaTeamColor.color(for: c.fixture.homeTeam), size: 34, logoURL: c.fixture.homeLogo)
                    VStack(spacing: 2) {
                        Text("\(c.fixture.homeTeam) vs \(c.fixture.awayTeam)")
                            .font(ArenaFont.display(size: 14, weight: .heavy))
                            .foregroundColor(.arenaText)
                        if let lg = c.fixture.leagueName {
                            Text(lg)
                                .font(ArenaFont.mono(size: 10))
                                .foregroundColor(.arenaTextMuted)
                        }
                    }
                    TeamCrestArena(name: c.fixture.awayTeam, color: ArenaTeamColor.color(for: c.fixture.awayTeam), size: 34, logoURL: c.fixture.awayLogo)
                }
                if let d = c.fixture.kickoffDate {
                    Text(Self.kickoffFormatter.string(from: d))
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaAccent)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity)
        }

        // Picks faceoff. Opponent column collapses to an "OPEN SLOT" badge
        // when the slot hasn't been claimed yet — mirrors web parity.
        let isOpen = c.isOpen ?? false
        let opponentLabel: String = {
            if let dn = c.opponent?.displayName { return dn }
            if let un = c.opponent?.username { return "@\(un)" }
            return String(localized: "OPEN SLOT")
        }()
        HudFrame {
            HStack(spacing: 12) {
                pickColumn(
                    label: c.challenger.displayName ?? "@\(c.challenger.username ?? "—")",
                    isMe: c.youAre == "challenger",
                    isOpen: false,
                    pick: Challenge.pickLabel(c.challengerPick, market: c.marketType),
                    winner: c.status == .settled && c.winnerUserId == c.challenger.id
                )
                Text(String(localized: "VS")).font(ArenaFont.display(size: 14, weight: .black)).foregroundColor(.arenaTextMuted)
                pickColumn(
                    label: opponentLabel,
                    isMe: c.youAre == "opponent",
                    isOpen: isOpen,
                    pick: c.opponentPick.map { Challenge.pickLabel($0, market: c.marketType) }
                        ?? (isOpen ? String(localized: "WAITING") : String(localized: "PENDING")),
                    winner: c.status == .settled && c.winnerUserId == c.opponent?.id
                )
            }
            .padding(14)
        }

        // Role-aware action zone
        if c.status == .pending && c.youAre == "opponent" {
            // Directed receive: full picker + decline.
            acceptPanel(c, showDecline: true, heading: String(localized: "PICK YOUR SIDE"))
        } else if c.status == .pending && isOpen && c.youAre == nil {
            // Third party hitting an open challenge link — same picker, no
            // decline (nothing to refuse), and a "claim" heading. Self-accept
            // is blocked server-side; we don't render this for challengers.
            acceptPanel(c, showDecline: false, heading: String(localized: "CLAIM THIS CHALLENGE"))
        } else if c.status == .pending && c.youAre == "challenger" {
            waitingPanel(c)
        } else if c.status == .accepted {
            lockedPanel(c)
        } else if c.status == .settled {
            settledPanel(c)
        } else if c.status == .refunded {
            refundedPanel(c)
        }

        if let err = vm.actionError {
            Text(err)
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaDanger)
                .padding(10)
                .background(HudCornerCutShape(cut: 5).fill(Color.arenaDanger.opacity(0.12)))
        }
    }

    // MARK: — Accept panel (directed-opponent OR open-claim)
    //
    // Same UI for both flows. Only difference: open-claim has no Decline
    // button (third party didn't receive a directed invite — there's nothing
    // to refuse). Heading copy varies via the `heading` arg.
    @ViewBuilder
    private func acceptPanel(_ c: Challenge, showDecline: Bool, heading: String) -> some View {
        HudFrame {
            VStack(alignment: .leading, spacing: 10) {
                Text("◆ \(heading)")
                    .font(ArenaFont.mono(size: 10))
                    .tracking(2)
                    .foregroundColor(.arenaPrimary)
                HStack(spacing: 6) {
                    ForEach(c.marketType.validPicks, id: \.self) { p in
                        let taken = p == c.challengerPick
                        Button {
                            vm.opponentPickDraft = p
                        } label: {
                            VStack(spacing: 2) {
                                Text(p).font(ArenaFont.display(size: 16, weight: .heavy))
                                Text(taken ? String(localized: "TAKEN") : Challenge.pickLabel(p, market: c.marketType))
                                    .font(ArenaFont.mono(size: 8))
                                    .opacity(0.7)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .foregroundColor(taken ? .arenaTextFaint : (vm.opponentPickDraft == p ? .arenaOnPrimary : .arenaTextDim))
                            .background(
                                HudCornerCutShape(cut: 5)
                                    .fill(taken ? Color.arenaBg2 : (vm.opponentPickDraft == p ? Color.arenaPrimary : Color.arenaSurface))
                            )
                            .overlay(
                                HudCornerCutShape(cut: 5)
                                    .stroke(vm.opponentPickDraft == p ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
                            )
                            .opacity(taken ? 0.5 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(taken)
                    }
                }
                ArcadeButton(
                    title: vm.isBusy
                        ? String(localized: "ACCEPTING…")
                        : "▶ " + String(format: String(localized: "ACCEPT · %d COINS"), c.stakeCoins),
                    size: .lg, fullWidth: true,
                    disabled: vm.opponentPickDraft == nil || vm.isBusy
                ) {
                    Task {
                        await vm.accept(id: c.id, token: auth.token)
                        await auth.fetchUser()
                    }
                }
                if showDecline {
                    Button {
                        Task {
                            await vm.decline(id: c.id, token: auth.token)
                        }
                    } label: {
                        Text(String(localized: "DECLINE"))
                            .font(ArenaFont.display(size: 12, weight: .bold))
                            .tracking(2)
                            .foregroundColor(.arenaTextMuted)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(vm.isBusy)
                }
            }
            .padding(14)
        }
    }

    // MARK: — Waiting / locked / settled / refunded panels

    @ViewBuilder
    private func waitingPanel(_ c: Challenge) -> some View {
        let isOpen = c.isOpen ?? false
        HudFrame {
            VStack(alignment: .leading, spacing: 10) {
                Text("◆ " + (isOpen
                    ? String(localized: "OPEN — SHARE THE LINK")
                    : String(format: String(localized: "WAITING FOR @%@"), (c.opponent?.username ?? "—").uppercased())))
                    .font(ArenaFont.mono(size: 10))
                    .tracking(2)
                    .foregroundColor(isOpen ? .arenaAccent : .arenaPrimary)
                if isOpen {
                    Text(String(localized: "The first person to open this link and accept will become your opponent."))
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }
                ArcadeButton(
                    title: vm.copied ? String(localized: "LINK COPIED ✓") : "▶ " + String(localized: "SHARE LINK"),
                    size: .lg, fullWidth: true,
                    disabled: false
                ) {
                    vm.copyShareLink(code: c.code)
                }
                Button {
                    Task {
                        await vm.cancel(id: c.id, token: auth.token)
                        await auth.fetchUser()
                    }
                } label: {
                    Text(String(localized: "CANCEL CHALLENGE"))
                        .font(ArenaFont.display(size: 12, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaDanger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaDanger.opacity(0.45), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(vm.isBusy)
            }
            .padding(14)
        }
    }

    @ViewBuilder
    private func lockedPanel(_ c: Challenge) -> some View {
        VStack(spacing: 6) {
            Text("🔒 \(String(localized: "PICKS LOCKED"))")
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .tracking(1.5)
                .foregroundColor(.arenaPrimary)
            Text(String(format: String(localized: "Winner takes %d coins."), c.payoutIfWin))
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaPrimary.opacity(0.08)))
        .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaPrimary.opacity(0.4), lineWidth: 1))
    }

    @ViewBuilder
    private func settledPanel(_ c: Challenge) -> some View {
        let iWon = c.winnerUserId != nil &&
            ((c.youAre == "challenger" && c.winnerUserId == c.challenger.id) ||
             (c.youAre == "opponent" && c.winnerUserId == c.opponent?.id))
        VStack(spacing: 4) {
            Text(iWon ? "🏆" : "💀").font(.system(size: 36))
            Text(iWon
                 ? String(format: String(localized: "YOU WON · +%d COINS"), c.payoutIfWin)
                 : String(localized: "YOU LOST"))
                .font(ArenaFont.display(size: 16, weight: .black))
                .tracking(2)
                .foregroundColor(iWon ? .arenaPrimary : .arenaDanger)
            if let key = c.outcomeKey {
                Text(String(format: String(localized: "Outcome: %@"), Challenge.pickLabel(key, market: c.marketType)))
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextMuted)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(
            HudCornerCutShape(cut: 6)
                .fill((iWon ? Color.arenaPrimary : Color.arenaDanger).opacity(0.14))
        )
        .overlay(
            HudCornerCutShape(cut: 6)
                .stroke(iWon ? Color.arenaPrimary : Color.arenaDanger, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func refundedPanel(_ c: Challenge) -> some View {
        VStack(spacing: 4) {
            Text(String(localized: "BOTH REFUNDED"))
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .tracking(1.5)
                .foregroundColor(.arenaText)
            if let key = c.outcomeKey {
                Text(String(format: String(localized: "Outcome %@ — neither pick matched, no rake."), Challenge.pickLabel(key, market: c.marketType)))
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaStroke, lineWidth: 1))
    }

    // MARK: — Helpers

    private func pickColumn(label: String, isMe: Bool, isOpen: Bool, pick: String, winner: Bool) -> some View {
        // Open-slot column gets the accent palette to read as a "claim me"
        // badge instead of a player. Web parity in PoolDetail PickColumn.
        let labelColor: Color = isOpen ? .arenaAccent : (isMe ? .arenaPrimary : .arenaTextMuted)
        let pickColor: Color = winner ? .arenaPrimary : (isOpen ? .arenaAccent : .arenaText)
        return VStack(spacing: 4) {
            Text(isMe ? String(localized: "YOU") : label)
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(labelColor)
            Text(pick)
                .font(ArenaFont.display(size: 16, weight: .black))
                .foregroundColor(pickColor)
                .shadow(color: winner ? .arenaPrimary.opacity(0.6) : .clear, radius: 16)
        }
        .frame(maxWidth: .infinity)
    }

    private func statusLabel(_ c: Challenge) -> String {
        switch c.status {
        case .pending:   return String(localized: "PENDING")
        case .accepted:  return String(localized: "LOCKED")
        case .settled:   return String(localized: "SETTLED")
        case .refunded:  return String(localized: "REFUNDED")
        case .declined:  return String(localized: "DECLINED")
        case .cancelled: return String(localized: "CANCELLED")
        }
    }
    private func statusColor(_ c: Challenge) -> Color {
        switch c.status {
        case .pending:   return .arenaAccent
        case .accepted:  return .arenaPrimary
        case .settled:   return .arenaGold
        default:         return .arenaTextMuted
        }
    }
}

// MARK: — VM

@MainActor
final class ChallengeDetailViewModel: ObservableObject {
    @Published var challenge: Challenge?
    @Published var isLoading = false
    @Published var isBusy = false
    @Published var error: String?
    @Published var actionError: String?
    @Published var opponentPickDraft: String?
    @Published var copied = false

    private let client = APIClient.shared

    func load(id: String, token: String?) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            challenge = try await client.request(method: "GET", path: "/challenges/\(id)", token: token)
        } catch {
            self.error = String(localized: "Could not load challenge")
        }
    }

    func accept(id: String, token: String?) async {
        guard let pick = opponentPickDraft else { return }
        isBusy = true
        actionError = nil
        defer { isBusy = false }
        do {
            challenge = try await client.request(
                method: "POST",
                path: "/challenges/\(id)/accept",
                body: ChallengeAcceptRequest(opponentPick: pick),
                token: token
            )
        } catch {
            let desc = error.localizedDescription
            if desc.contains("INSUFFICIENT_BALANCE") {
                actionError = String(localized: "Insufficient balance — visit the shop to recharge.")
            } else if desc.contains("DUPLICATE_PICK") {
                actionError = String(localized: "Pick must differ from the challenger.")
            } else if desc.contains("FIXTURE_STARTED") {
                actionError = String(localized: "Fixture already started.")
            } else if desc.contains("ALREADY_CLAIMED") {
                // Lost the open-claim race — refresh so UI flips to the
                // accepted-by-someone-else state instead of leaving the picker
                // visible (which would let them try again on a closed slot).
                actionError = String(localized: "Someone else just claimed this challenge.")
                await load(id: id, token: token)
            } else if desc.contains("SELF_ACCEPT") {
                actionError = String(localized: "You can't accept your own challenge.")
            } else {
                actionError = desc
            }
        }
    }

    func decline(id: String, token: String?) async {
        isBusy = true
        actionError = nil
        defer { isBusy = false }
        do {
            let _: ChallengeActionResponse = try await client.request(
                method: "POST", path: "/challenges/\(id)/decline", token: token
            )
            await load(id: id, token: token)
        } catch {
            actionError = error.localizedDescription
        }
    }

    func cancel(id: String, token: String?) async {
        isBusy = true
        actionError = nil
        defer { isBusy = false }
        do {
            let _: ChallengeActionResponse = try await client.request(
                method: "DELETE", path: "/challenges/\(id)", token: token
            )
            await load(id: id, token: token)
        } catch {
            actionError = error.localizedDescription
        }
    }

    /// Copy the `/c/<code>` universal link to clipboard. Flag toggles for 1.5s
    /// so the UI can show "LINK COPIED ✓" feedback.
    ///
    /// Uses `api.futpools.com` (backend host) instead of `futpools.com`
    /// because the og.js routes that serve link previews for WhatsApp /
    /// Telegram / iMessage live on the backend. A link to the web SPA
    /// would render no preview — the bot-scrape sees an empty React shell.
    /// (Render Static Sites doesn't support external proxies in _redirects,
    /// so we can't keep the branded host without a CF Worker or Web Service.)
    func copyShareLink(code: String) {
        #if canImport(UIKit)
        UIPasteboard.general.string = "https://api.futpools.com/c/\(code)"
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.copied = false
        }
        #endif
    }
}
