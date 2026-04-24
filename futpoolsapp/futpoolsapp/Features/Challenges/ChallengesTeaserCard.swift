//
//  ChallengesTeaserCard.swift
//  futpoolsapp
//
//  Compact Home banner that routes to the challenges list. Shows an incoming
//  count badge when there are pending challenges to accept, otherwise invites
//  the user to create their first one.
//

import Combine
import SwiftUI

struct ChallengesTeaserCard: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = ChallengesTeaserViewModel()

    var body: some View {
        NavigationLink {
            ChallengesListView()
        } label: {
            HStack(spacing: 10) {
                Text("⚔").font(.system(size: 22))
                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "1V1 CHALLENGES"))
                        .font(ArenaFont.display(size: 13, weight: .black))
                        .tracking(1.5)
                        .foregroundColor(.arenaText)
                    Text(vm.pendingReceived > 0
                         ? String(format: String(localized: "%d incoming · tap to review"), vm.pendingReceived)
                         : String(localized: "Bet coins head-to-head on any match"))
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }
                Spacer()
                if vm.pendingReceived > 0 {
                    Text("\(vm.pendingReceived)")
                        .font(ArenaFont.display(size: 11, weight: .black))
                        .foregroundColor(.arenaOnPrimary)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(HudCornerCutShape(cut: 5).fill(Color.arenaHot))
                }
                Text("→").font(.system(size: 18)).foregroundColor(.arenaTextMuted)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(
                HudCornerCutShape(cut: 6)
                    .fill(LinearGradient(colors: [Color.arenaHot.opacity(0.18), Color.arenaSurface], startPoint: .topLeading, endPoint: .bottomTrailing))
            )
            .overlay(
                HudCornerCutShape(cut: 6)
                    .stroke(Color.arenaHot.opacity(0.4), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .task { await vm.loadCount(token: auth.token) }
    }
}

@MainActor
final class ChallengesTeaserViewModel: ObservableObject {
    @Published var pendingReceived: Int = 0
    private let client = APIClient.shared

    func loadCount(token: String?) async {
        guard token != nil else { return }
        do {
            let list: [Challenge] = try await client.request(
                method: "GET",
                path: "/challenges/me?tab=received",
                token: token
            )
            pendingReceived = list.filter { $0.status == .pending }.count
        } catch {
            pendingReceived = 0
        }
    }
}
