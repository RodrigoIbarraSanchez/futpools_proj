//
//  ParticipantManageSheet.swift
//  futpoolsapp
//
//  Creator-only admin surface. Two modes off the same fetch:
//    • scheduled       → MANAGE PARTICIPANTS — kick player / delete entry.
//                        Backend strips picks so the creator can't moderate
//                        on the basis of who guessed well.
//    • live / completed → VIEW PREDICTIONS — read-only picks per entry, with
//                        won/lost/leading/trailing color states. Mirrors the
//                        web `ParticipantManageModal` and `ParticipantPickRow`.
//

import Combine
import SwiftUI

struct ParticipantManageSheet: View {
    let quinielaId: String
    let token: String?
    /// Fixture metadata for rendering each pick row in view-predictions
    /// mode. Empty in pure manage mode (sheet works without it).
    let fixtures: [QuinielaFixture]
    /// Live score map keyed by fixtureId. Drives the won/lost/leading/
    /// trailing palette in the pick row.
    let liveFixtures: [Int: LiveFixture]
    let onDismiss: () -> Void
    let onMutated: () -> Void

    @StateObject private var vm = ParticipantManageViewModel()
    @State private var confirmAction: ConfirmAction?
    /// Set of entry ids currently expanded in view-predictions mode. Empty
    /// by default — even small pools blow up the sheet otherwise.
    @State private var openEntries: Set<String> = []

    /// Discriminates the confirmation dialog so a single dialog drives both
    /// "delete this entry" and "kick this participant" branches.
    enum ConfirmAction: Identifiable {
        case deleteEntry(participantName: String, entryId: String, entryNumber: Int)
        case removeParticipant(participant: ParticipantDTO)

        var id: String {
            switch self {
            case .deleteEntry(_, let entryId, _): return "entry:\(entryId)"
            case .removeParticipant(let p):       return "participant:\(p.user.id)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if vm.isLoading {
                            Text(String(localized: "Loading…"))
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaTextDim)
                                .padding(.top, 24)
                                .frame(maxWidth: .infinity)
                        } else if let err = vm.error {
                            Text(err)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaDanger)
                                .padding(10)
                        } else if vm.participants.isEmpty {
                            Text(String(localized: "No entries yet"))
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaTextMuted)
                                .padding(.top, 24)
                                .frame(maxWidth: .infinity)
                        } else {
                            ForEach(vm.participants) { p in
                                participantCard(for: p)
                            }
                            if showPicks {
                                Text(String(localized: "Tap an entry to reveal picks."))
                                    .font(ArenaFont.mono(size: 9))
                                    .foregroundColor(.arenaTextMuted)
                                    .padding(.top, 4)
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(showPicks
                             ? String(localized: "PARTICIPANT PREDICTIONS")
                             : String(localized: "Manage participants"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Close")) { onDismiss() }
                        .foregroundColor(.arenaTextDim)
                }
            }
            .task { await vm.load(quinielaId: quinielaId, token: token) }
            .confirmationDialog(
                confirmTitle,
                isPresented: Binding(
                    get: { confirmAction != nil },
                    set: { if !$0 { confirmAction = nil } }
                ),
                titleVisibility: .visible,
                presenting: confirmAction
            ) { action in
                Button(String(localized: "Confirm"), role: .destructive) {
                    performConfirmed(action)
                }
                Button(String(localized: "Cancel"), role: .cancel) { confirmAction = nil }
            } message: { action in
                Text(confirmMessage(for: action))
            }
        }
    }

    // MARK: — Participant card

    /// Backend authority — `picksHidden=false` means the response carries
    /// picks per entry (post-kickoff). Don't infer from local state, since
    /// the moderation UI must never appear when picks are exposed.
    private var showPicks: Bool { vm.picksHidden == false }
    private var isScheduled: Bool { vm.status == "scheduled" }

    @ViewBuilder
    private func participantCard(for p: ParticipantDTO) -> some View {
        let name = p.user.displayName ?? p.user.username ?? "—"
        let handle = p.user.username.map { "@\($0)" } ?? ""
        let busy = vm.pendingIds.contains(p.user.id)

        HudFrame {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name.uppercased())
                            .font(ArenaFont.display(size: 13, weight: .heavy))
                            .foregroundColor(.arenaText)
                        Text("\(handle.isEmpty ? "" : "\(handle) · ")\(p.entryCount) \(String(localized: "ENTRIES"))")
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextMuted)
                    }
                    Spacer()
                    if isScheduled {
                        Button {
                            confirmAction = .removeParticipant(participant: p)
                        } label: {
                            Text(busy ? "…" : String(localized: "REMOVE"))
                                .font(ArenaFont.mono(size: 9, weight: .bold))
                                .foregroundColor(.arenaDanger)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 4)
                                        .stroke(Color.arenaDanger.opacity(0.55), lineWidth: 1)
                                )
                        }
                        .disabled(busy)
                        .opacity(busy ? 0.5 : 1)
                    }
                }

                VStack(spacing: 4) {
                    ForEach(p.entries) { e in
                        entryRow(participantName: name, entry: e)
                    }
                }
            }
            .padding(12)
        }
    }

    @ViewBuilder
    private func entryRow(participantName: String, entry: ParticipantEntry) -> some View {
        let busy = vm.pendingIds.contains(entry.id)
        let date = formatDate(entry.createdAt)
        let isOpen = openEntries.contains(entry.id)
        let hasScore = entry.score != nil
                    && entry.totalPossible != nil
                    && (entry.totalPossible ?? 0) > 0

        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("#\(entry.entryNumber)")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaPrimary)
                    .frame(minWidth: 28, alignment: .leading)
                Text(date)
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextMuted)
                Spacer()
                if showPicks, hasScore, let s = entry.score, let t = entry.totalPossible {
                    Text("\(s)/\(t) \(String(localized: "PTS"))")
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .foregroundColor(.arenaGold)
                }
                if isScheduled {
                    Button {
                        confirmAction = .deleteEntry(
                            participantName: participantName,
                            entryId: entry.id,
                            entryNumber: entry.entryNumber
                        )
                    } label: {
                        Text(busy ? "…" : String(localized: "DELETE"))
                            .font(ArenaFont.mono(size: 9, weight: .bold))
                            .foregroundColor(.arenaDanger)
                    }
                    .disabled(busy)
                    .opacity(busy ? 0.5 : 1)
                } else if showPicks {
                    Text(isOpen ? "▲" : "▼")
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            .onTapGesture {
                guard showPicks else { return }
                if isOpen { openEntries.remove(entry.id) }
                else      { openEntries.insert(entry.id) }
            }

            if showPicks, isOpen {
                VStack(spacing: 6) {
                    if fixtures.isEmpty {
                        Text(String(localized: "NO PICKS YET"))
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        ForEach(fixtures) { fx in
                            let pick = entry.picks?.first(where: { $0.fixtureId == fx.fixtureId })?.pick
                            ParticipantPickRowView(
                                fixture: fx,
                                pick: pick,
                                live: liveFixtures[fx.fixtureId]
                            )
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(Rectangle().fill(Color.arenaStroke).frame(height: 1), alignment: .top)
            }
        }
        .background(Color.arenaSurface)
    }

    // MARK: — Confirmation helpers

    private var confirmTitle: String {
        switch confirmAction {
        case .deleteEntry: return String(localized: "Delete entry?")
        case .removeParticipant: return String(localized: "Remove participant?")
        case .none: return ""
        }
    }

    private func confirmMessage(for action: ConfirmAction) -> String {
        switch action {
        case .deleteEntry(let who, _, let n):
            return String(
                format: String(localized: "Delete entry #%d of %@? Coins are refunded if paid."),
                n, who
            )
        case .removeParticipant(let p):
            return String(
                format: String(localized: "Remove %@? All %d entries will be deleted (coins refunded)."),
                (p.user.displayName ?? p.user.username ?? "—"), p.entryCount
            )
        }
    }

    private func performConfirmed(_ action: ConfirmAction) {
        confirmAction = nil
        Task {
            switch action {
            case .deleteEntry(_, let entryId, _):
                await vm.deleteEntry(quinielaId: quinielaId, entryId: entryId, token: token)
            case .removeParticipant(let p):
                await vm.removeParticipant(quinielaId: quinielaId, participant: p, token: token)
            }
            onMutated()
        }
    }

    private func formatDate(_ iso: String?) -> String {
        guard let iso, let d = DateParser.parse(iso) else { return "" }
        let f = DateFormatter()
        f.dateStyle = .short; f.timeStyle = .short
        f.locale = Locale.current
        return f.string(from: d)
    }
}

// MARK: — View model

// MARK: — Pick row (predictions mode)
//
// Read-only fixture row showing the participant's pick + a status badge
// (won/lost/leading/trailing/pending/missing). Mirrors the web
// `ParticipantPickRow` in futpools_web/.../PoolDetail.jsx so picks read the
// same on both surfaces.

private let FINISHED_PICK_STATUSES: Set<String> = ["FT", "AET", "PEN"]

private struct ParticipantPickRowView: View {
    let fixture: QuinielaFixture
    let pick: String?
    let live: LiveFixture?

    private enum PickState { case missing, pending, leading, trailing, won, lost }

    private var state: PickState {
        guard let p = pick, !p.isEmpty, p != "-" else { return .missing }
        let home = live?.score.home
        let away = live?.score.away
        guard let h = home, let a = away else { return .pending }
        let liveResult: String = h > a ? "1" : (h < a ? "2" : "X")
        let short = (live?.status.short ?? "").uppercased()
        let isFinal = FINISHED_PICK_STATUSES.contains(short)
        if isFinal { return p == liveResult ? .won : .lost }
        return p == liveResult ? .leading : .trailing
    }

    private var accent: Color {
        switch state {
        case .missing: return .arenaStroke
        case .pending: return .arenaAccent.opacity(0.5)
        case .leading, .won: return .arenaPrimary
        case .trailing, .lost: return .arenaDanger.opacity(0.7)
        }
    }
    private var badgeFg: Color {
        switch state {
        case .missing: return .arenaTextDim
        case .pending: return .arenaAccent
        case .leading, .won: return .arenaPrimary
        case .trailing, .lost: return .arenaDanger
        }
    }
    private var badgeBg: Color {
        switch state {
        case .missing: return .arenaBg2
        case .pending: return .arenaAccent.opacity(0.18)
        case .leading, .won: return .arenaPrimary.opacity(0.22)
        case .trailing, .lost: return .arenaDanger.opacity(0.18)
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch state {
        case .missing:
            Text(String(localized: "NO PICK"))
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .foregroundColor(.arenaTextDim)
        case .pending:
            Text(String(localized: "PENDING").uppercased())
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .foregroundColor(.arenaAccent)
        case .leading:
            HStack(spacing: 3) {
                Circle().fill(Color.arenaPrimary).frame(width: 5, height: 5)
                Text(String(localized: "LEADING")).font(ArenaFont.mono(size: 9, weight: .bold))
            }.foregroundColor(.arenaPrimary)
        case .trailing:
            HStack(spacing: 3) {
                Circle().fill(Color.arenaDanger).frame(width: 5, height: 5)
                Text(String(localized: "TRAILING")).font(ArenaFont.mono(size: 9, weight: .bold))
            }.foregroundColor(.arenaDanger)
        case .won:
            Text("✓ +1 \(String(localized: "PT"))")
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .foregroundColor(.arenaPrimary)
        case .lost:
            Text("✗ \(String(localized: "MISSED"))")
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .foregroundColor(.arenaDanger)
        }
    }

    private var badgeText: String {
        if let p = pick, ["1", "X", "2"].contains(p) { return p }
        return "—"
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle().fill(accent).frame(width: 3)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    TeamCrestArena(
                        name: fixture.homeTeam,
                        color: ArenaTeamColor.color(for: fixture.homeTeam),
                        size: 18,
                        logoURL: fixture.homeLogo
                    )
                    Text(fixture.homeTeam)
                        .font(ArenaFont.display(size: 11, weight: pick == "1" ? .heavy : .regular))
                        .foregroundColor(pick == "1" ? .arenaText : .arenaTextDim)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let h = live?.score.home, let a = live?.score.away {
                        Text("\(h)–\(a)")
                            .font(ArenaFont.display(size: 13, weight: .heavy))
                            .foregroundColor(.arenaText)
                    } else {
                        Text("vs").font(ArenaFont.mono(size: 9)).foregroundColor(.arenaTextDim)
                    }
                    Text(fixture.awayTeam)
                        .font(ArenaFont.display(size: 11, weight: pick == "2" ? .heavy : .regular))
                        .foregroundColor(pick == "2" ? .arenaText : .arenaTextDim)
                        .lineLimit(1)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    TeamCrestArena(
                        name: fixture.awayTeam,
                        color: ArenaTeamColor.color(for: fixture.awayTeam),
                        size: 18,
                        logoURL: fixture.awayLogo
                    )
                }
                HStack(spacing: 8) {
                    Text(badgeText)
                        .font(ArenaFont.display(size: 11, weight: .black))
                        .foregroundColor(badgeFg)
                        .frame(width: 24, height: 22)
                        .background(badgeBg)
                    Spacer()
                    statusBadge
                }
            }
            .padding(8)
        }
        .background(Color.arenaSurfaceAlt)
    }
}

@MainActor
final class ParticipantManageViewModel: ObservableObject {
    @Published var participants: [ParticipantDTO] = []
    @Published var status: String = "scheduled"
    /// Mirrors backend `picksHidden`: true (or nil for older payloads) means
    /// picks were stripped from the response — UI must stay in moderation
    /// mode. False means picks are exposed and UI flips to predictions view.
    @Published var picksHidden: Bool? = true
    @Published var isLoading = false
    @Published var error: String?
    /// Keys are either a participant id (for full-kick) or an entry id (for
    /// per-row delete). Used to disable the button while a request is
    /// in-flight so a second tap doesn't queue a duplicate mutation.
    @Published var pendingIds: Set<String> = []

    private let client = APIClient.shared

    func load(quinielaId: String, token: String?) async {
        isLoading = true
        error = nil
        do {
            let res: ParticipantsResponse = try await client.request(
                method: "GET",
                path: "/quinielas/\(quinielaId)/participants",
                token: token
            )
            participants = res.participants
            status = res.status
            picksHidden = res.picksHidden
        } catch {
            self.error = String(localized: "Could not load participants")
        }
        isLoading = false
    }

    func deleteEntry(quinielaId: String, entryId: String, token: String?) async {
        pendingIds.insert(entryId)
        defer { pendingIds.remove(entryId) }
        do {
            let _: DeleteEntryResponse = try await client.request(
                method: "DELETE",
                path: "/quinielas/\(quinielaId)/entries/\(entryId)",
                token: token
            )
            await load(quinielaId: quinielaId, token: token)
        } catch {
            self.error = String(localized: "Delete failed")
        }
    }

    func removeParticipant(quinielaId: String, participant: ParticipantDTO, token: String?) async {
        pendingIds.insert(participant.user.id)
        defer { pendingIds.remove(participant.user.id) }
        // Fire deletes in parallel. Backend idempotency on refund keys makes
        // a retry safe if any individual request blips.
        await withTaskGroup(of: Void.self) { group in
            for e in participant.entries {
                group.addTask { [weak self] in
                    guard let self else { return }
                    _ = try? await self.client.request(
                        method: "DELETE",
                        path: "/quinielas/\(quinielaId)/entries/\(e.id)",
                        token: token
                    ) as DeleteEntryResponse
                }
            }
        }
        await load(quinielaId: quinielaId, token: token)
    }
}
