//
//  GlobalLeaderboardView.swift
//  futpoolsapp
//

import SwiftUI
import Combine

@MainActor
final class GlobalLeaderboardViewModel: ObservableObject {
    @Published var rows: [GlobalLeaderboardRow] = []
    @Published var loading = false
    @Published var errorText: String?

    private let client = APIClient.shared

    func load() async {
        loading = true
        defer { loading = false }
        do {
            let res: GlobalLeaderboardResponse = try await client.request(
                method: "GET",
                path: "/leaderboard/global?top=100"
            )
            rows = res.leaderboard
            errorText = nil
        } catch {
            errorText = (error as? APIError).flatMap {
                if case .server(let msg) = $0 { return msg } else { return nil }
            } ?? error.localizedDescription
        }
    }
}

struct GlobalLeaderboardView: View {
    @StateObject private var vm = GlobalLeaderboardViewModel()
    @EnvironmentObject var auth: AuthService

    var body: some View {
        ZStack {
            ArenaBackground()
            if vm.loading && vm.rows.isEmpty {
                VStack(spacing: 8) {
                    ProgressView().tint(.arenaPrimary)
                    Text(String(localized: "LOADING"))
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaTextDim)
                }
            } else if vm.rows.isEmpty, let err = vm.errorText {
                VStack(spacing: 8) {
                    Text("⚠")
                        .font(.system(size: 32))
                        .foregroundColor(.arenaHot)
                    Text(err)
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaTextDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
            } else if vm.rows.isEmpty {
                // Fresh install or offline backend — explain the void instead of
                // shipping a blank scroll view.
                VStack(spacing: 10) {
                    Text("◆")
                        .font(ArenaFont.display(size: 36, weight: .heavy))
                        .foregroundColor(.arenaPrimary.opacity(0.4))
                    Text(String(localized: "NO RANKINGS YET"))
                        .font(ArenaFont.display(size: 14, weight: .black))
                        .tracking(3)
                        .foregroundColor(.arenaText)
                    Text(String(localized: "Play a pool to appear here."))
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaTextDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(vm.rows) { row in
                            LeaderboardRowView(
                                row: row,
                                highlighted: row.userId == auth.currentUser?.id
                            )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 120)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(String(localized: "GLOBAL RANK"))
                    .font(ArenaFont.display(size: 13, weight: .black))
                    .tracking(3)
                    .foregroundColor(.arenaText)
            }
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }
}

private struct LeaderboardRowView: View {
    let row: GlobalLeaderboardRow
    let highlighted: Bool

    private var tier: DivisionTier { DivisionTier(rank: RankTier(code: row.tier)) }

    var body: some View {
        HStack(spacing: 12) {
            Text("#\(row.rank)")
                .font(ArenaFont.mono(size: 11, weight: .bold))
                .tracking(1)
                .foregroundColor(row.rank <= 3 ? .arenaGold : .arenaTextMuted)
                .frame(width: 44, alignment: .leading)

            DivisionBadge(tier: tier, size: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.displayName)
                    .font(ArenaFont.display(size: 13, weight: .bold))
                    .foregroundColor(.arenaText)
                    .lineLimit(1)
                Text("@\(row.username)")
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextDim)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(row.rating)")
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                    .foregroundColor(.arenaPrimary)
                Text("\(row.poolsWon) W · \(row.poolsPlayed) P")
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextMuted)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            ZStack {
                HudCornerCutShape(cut: 8)
                    .fill(highlighted
                          ? Color.arenaPrimary.opacity(0.14)
                          : Color.arenaSurface)
                HudCornerCutShape(cut: 8)
                    .stroke(highlighted ? Color.arenaPrimary : Color.arenaStroke,
                            lineWidth: 1)
            }
        )
        .clipShape(HudCornerCutShape(cut: 8))
    }
}
