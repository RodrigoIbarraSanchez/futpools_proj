//
//  LadderParticipantsView.swift
//  futpoolsapp
//
//  Participants tab for prize_ladder pools: every player sorted by
//  aciertos (desc, server-side), with lazy loading once a pool passes
//  ~10 players. Each row shows the player's correct count and their
//  (live) prize. Web parity: futpools_web/src/arena-ui/LadderParticipants.jsx
//

import SwiftUI

struct LadderParticipantsView: View {
    let quinielaId: String
    let ladder: [PrizeTier]
    let hasLiveFixtures: Bool
    let currentUserId: String?

    @State private var rows: [LeaderboardEntry] = []
    @State private var totalCount = 0
    @State private var loading = true
    @State private var loadingMore = false

    private let client = APIClient.shared
    private let pageSize = 10

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(String(localized: "PARTICIPANTS"))
                    .font(ArenaFont.display(size: 10, weight: .bold))
                    .tracking(3)
                    .foregroundColor(.arenaAccent)
                Spacer()
                if !loading {
                    Text("\(totalCount) \(String(localized: "players_word"))")
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }
            }

            if loading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else if rows.isEmpty {
                Text(String(localized: "No participants yet"))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                LazyVStack(spacing: 6) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                        participantRow(rank: idx + 1, row: row)
                            .onAppear {
                                // Prefetch when the user nears the end.
                                if idx >= rows.count - 3 { loadMore() }
                            }
                    }
                    if rows.count < totalCount {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                }
            }
        }
        .task { await initialLoad() }
    }

    private func participantRow(rank: Int, row: LeaderboardEntry) -> some View {
        let aciertos = hasLiveFixtures ? (row.liveScore ?? row.score) : row.score
        let prize = hasLiveFixtures
            ? (row.livePrizeMXN ?? PrizeLadder.prize(for: aciertos, in: ladder))
            : (row.settledPrizeMXN ?? PrizeLadder.prize(for: aciertos, in: ladder))
        let isMe = currentUserId != nil && row.userId == currentUserId
        let won = prize > 0

        return HStack(spacing: 10) {
            Text("\(rank)")
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .foregroundColor(rank <= 3 ? .arenaGold : .arenaTextMuted)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 1) {
                Text(displayName(row))
                    .font(ArenaFont.display(size: 13, weight: .bold))
                    .foregroundColor(.arenaText)
                    .lineLimit(1)
                if isMe {
                    Text(String(localized: "YOU"))
                        .font(ArenaFont.mono(size: 8))
                        .foregroundColor(.arenaPrimary)
                }
            }
            Spacer()
            Text("\(aciertos) \(String(localized: "aciertos_word"))")
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaTextDim)
            HudChip(text: PrizeLadder.formatMXN(prize),
                    color: won ? .arenaPrimary : .arenaTextMuted,
                    showLiveDot: hasLiveFixtures && won)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(HudCornerCutShape(cut: 8).fill(isMe ? Color.arenaPrimary.opacity(0.14) : Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 8).stroke(isMe ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 8))
    }

    private func displayName(_ row: LeaderboardEntry) -> String {
        let base = row.displayName
        return row.entryNumber > 1 ? "\(base) \(row.entryNumber)" : base
    }

    // MARK: Fetch

    private func initialLoad() async {
        loading = true
        if let res = await fetchPage(offset: 0) {
            rows = res.leaderboard
            totalCount = res.totalCount
        }
        loading = false
    }

    private func loadMore() {
        guard !loadingMore, rows.count < totalCount else { return }
        loadingMore = true
        Task {
            if let res = await fetchPage(offset: rows.count) {
                let seen = Set(rows.map { $0.entryId })
                rows.append(contentsOf: res.leaderboard.filter { !seen.contains($0.entryId) })
            }
            loadingMore = false
        }
    }

    private func fetchPage(offset: Int) async -> LeaderboardResponse? {
        try? await client.request(
            method: "GET",
            path: "/quinielas/\(quinielaId)/leaderboard?offset=\(offset)&limit=\(pageSize)",
            token: KeychainHelper.getToken()
        )
    }
}
