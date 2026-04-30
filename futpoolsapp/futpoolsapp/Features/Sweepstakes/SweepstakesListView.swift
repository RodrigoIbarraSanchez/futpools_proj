//
//  SweepstakesListView.swift
//  futpoolsapp
//
//  Lists open sweepstakes the user can enter. Tapping a row opens
//  SweepstakesDetailView. Reachable from a "Premios" row in the Pools
//  tab or Profile (TBD — for v2.4 we'll add a small banner on Home).
//

import SwiftUI
import Combine

struct SweepstakesListView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = SweepstakesListViewModel()

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
                        ForEach(vm.items) { s in
                            NavigationLink {
                                SweepstakesDetailView(sweepstakesId: s.id)
                            } label: {
                                SweepstakesRow(item: s)
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
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(String(localized: "Win real-world prizes"))
                .font(ArenaFont.display(size: 18, weight: .heavy))
                .foregroundColor(.arenaText)
            Text(String(localized: "Predict matches with Tickets. Earn Tickets via Daily Pick or watching ads."))
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

private struct SweepstakesRow: View {
    let item: Sweepstakes

    var body: some View {
        HudFrame {
            VStack(alignment: .leading, spacing: 10) {
                if let imageName = prizeImageName {
                    Image(imageName)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .frame(maxHeight: 110)
                        .shadow(color: .arenaGold.opacity(0.35), radius: 10, y: 3)
                }
                HStack {
                    Text(item.title.uppercased())
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaText)
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: "ticket.fill")
                            .font(.system(size: 9, weight: .bold))
                        Text("\(item.entryCostTickets)")
                            .font(ArenaFont.mono(size: 11, weight: .bold))
                    }
                    .foregroundColor(.arenaAccent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(HudCornerCutShape(cut: 4).fill(Color.arenaAccent.opacity(0.13)))
                }
                Text(item.prizeLabel)
                    .font(ArenaFont.mono(size: 12))
                    .foregroundColor(.arenaGold)
                if let closes = item.entryClosesDate {
                    Text(String(format: String(localized: "Closes %@"), Self.dateFmt.string(from: closes)))
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextMuted)
                }
            }
            .padding(14)
        }
    }

    private var prizeImageName: String? {
        let label = item.prizeLabel.lowercased()
        if label.contains("amazon") || label.contains("gift card") {
            return "PrizeAmazonGift"
        }
        return nil
    }

    static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short; return f
    }()
}

@MainActor
final class SweepstakesListViewModel: ObservableObject {
    @Published var items: [Sweepstakes] = []
    @Published var isLoading = false

    func load(token: String?) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let res: SweepstakesListResponse = try await APIClient.shared.request(
                method: "GET",
                path: "/sweepstakes?status=open",
                token: token
            )
            items = res.sweepstakes
        } catch {
            // Quiet — empty state shows.
        }
    }
}
