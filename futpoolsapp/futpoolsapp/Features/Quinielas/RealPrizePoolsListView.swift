//
//  RealPrizePoolsListView.swift
//  futpoolsapp
//
//  List of Quinielas that carry a real-world prize. Replaces the
//  separate Sweepstakes raffle screen — these are normal pools (with
//  fixtures + scoring) where the highest scorer wins the prize.
//
//  Surfaces only pools where `realPrize.label` is set, served by the
//  backend via `GET /quinielas?realPrize=1`.
//

import SwiftUI
import Combine

struct RealPrizePoolsListView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = RealPrizePoolsListViewModel()

    var body: some View {
        ZStack {
            ArenaBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    if vm.isLoading && vm.items.isEmpty {
                        ProgressView().tint(.arenaPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else if vm.items.isEmpty {
                        emptyState
                    } else {
                        ForEach(vm.items) { q in
                            NavigationLink {
                                QuinielaDetailView(quiniela: q)
                                    .environmentObject(auth)
                            } label: {
                                RealPrizeRow(quiniela: q, liveFixtures: [:])
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 120)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("🏆 " + String(localized: "REAL PRIZE POOLS"))
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(3)
                    .foregroundColor(.arenaText)
            }
        }
        .task { await vm.load(token: auth.token) }
        .refreshable { await vm.load(token: auth.token) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(String(localized: "Win real-world prizes"))
                .font(ArenaFont.display(size: 18, weight: .heavy))
                .foregroundColor(.arenaText)
            Text(String(localized: "Predict matches in these pools. Highest score wins the prize."))
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaTextMuted)
        }
    }

    private var emptyState: some View {
        HudFrame {
            VStack(spacing: 10) {
                Text("🏆").font(.system(size: 32))
                Text(String(localized: "No real-prize pools right now"))
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text(String(localized: "A new pool with a real prize appears every week."))
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextDim)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct RealPrizeRow: View {
    let quiniela: Quiniela
    let liveFixtures: [Int: LiveFixture]

    var body: some View {
        HudFrame(glow: .arenaGold) {
            VStack(alignment: .leading, spacing: 10) {
                if let key = quiniela.realPrize?.imageKey, !key.isEmpty,
                   UIImage(named: key) != nil {
                    Image(key)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .frame(maxHeight: 110)
                        .shadow(color: .arenaGold.opacity(0.4), radius: 10, y: 3)
                }
                HStack {
                    Text(quiniela.name.uppercased())
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaText)
                    Spacer()
                }
                if let label = quiniela.realPrize?.label {
                    Text(label)
                        .font(ArenaFont.mono(size: 12))
                        .foregroundColor(.arenaGold)
                }
                if let start = quiniela.startDateValue {
                    Text(String(format: String(localized: "Closes %@"), Self.dateFmt.string(from: start)))
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextMuted)
                }
            }
            .padding(14)
        }
    }

    static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short; return f
    }()
}

@MainActor
final class RealPrizePoolsListViewModel: ObservableObject {
    @Published var items: [Quiniela] = []
    @Published var isLoading = false

    func load(token: String?) async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await APIClient.shared.request(
                method: "GET",
                path: "/quinielas?realPrize=1",
                token: token
            )
        } catch {
            // Quiet — empty state surfaces.
        }
    }
}
