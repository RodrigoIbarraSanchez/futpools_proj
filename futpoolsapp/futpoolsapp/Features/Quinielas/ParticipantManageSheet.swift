//
//  ParticipantManageSheet.swift
//  futpoolsapp
//
//  Creator-only admin surface for removing participants or individual entries
//  from a pool before it starts. Mirrors the web `ParticipantManageModal`.
//

import Combine
import SwiftUI

struct ParticipantManageSheet: View {
    let quinielaId: String
    let token: String?
    let onDismiss: () -> Void
    let onMutated: () -> Void

    @StateObject private var vm = ParticipantManageViewModel()
    @State private var confirmAction: ConfirmAction?

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
                        } else if vm.status != "scheduled" {
                            Text(String(localized: "Pool already started. Participants are locked in."))
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaTextMuted)
                                .multilineTextAlignment(.center)
                                .padding(.top, 24)
                                .frame(maxWidth: .infinity)
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
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(String(localized: "Manage participants"))
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
        HStack(spacing: 8) {
            Text("#\(entry.entryNumber)")
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(.arenaPrimary)
                .frame(minWidth: 28, alignment: .leading)
            Text(date)
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(.arenaTextMuted)
            Spacer()
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
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
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

@MainActor
final class ParticipantManageViewModel: ObservableObject {
    @Published var participants: [ParticipantDTO] = []
    @Published var status: String = "scheduled"
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
