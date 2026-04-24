//
//  ChallengesListView.swift
//  futpoolsapp
//
//  Feed of 1v1 challenges the current user is involved in, with a tab strip
//  for (active / received / sent / history). The backend settles eligible
//  challenges opportunistically when this endpoint is called, so merely
//  opening this screen progresses any pending payouts.
//

import Combine
import SwiftUI

enum ChallengeListTab: String, CaseIterable, Identifiable {
    case active, received, sent, settled
    var id: String { rawValue }
    var label: String {
        switch self {
        case .active:   return String(localized: "ACTIVE")
        case .received: return String(localized: "RECEIVED")
        case .sent:     return String(localized: "SENT")
        case .settled:  return String(localized: "HISTORY")
        }
    }
}

struct ChallengesListView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = ChallengesListViewModel()
    @State private var tab: ChallengeListTab = .active
    @State private var showCreate = false

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                VStack(spacing: 0) {
                    header
                    tabBar
                    content
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showCreate) {
                ChallengeCreateView()
            }
            .task(id: tab) {
                await vm.load(tab: tab, token: auth.token)
            }
            .refreshable {
                await vm.load(tab: tab, token: auth.token)
            }
        }
    }

    // MARK: — Header

    private var header: some View {
        HStack(spacing: 10) {
            Text("⚔ \(String(localized: "CHALLENGES"))")
                .font(ArenaFont.display(size: 22, weight: .heavy))
                .tracking(2)
                .foregroundColor(.arenaText)
            Spacer()
            Button {
                showCreate = true
            } label: {
                Text("＋")
                    .font(ArenaFont.display(size: 20, weight: .heavy))
                    .foregroundColor(.arenaPrimary)
                    .frame(width: 36, height: 36)
                    .background(
                        HudCornerCutShape(cut: 6)
                            .fill(Color.arenaPrimary.opacity(0.12))
                    )
                    .overlay(
                        HudCornerCutShape(cut: 6)
                            .stroke(Color.arenaPrimary.opacity(0.35), lineWidth: 1)
                    )
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(ChallengeListTab.allCases) { t in
                    Button {
                        tab = t
                    } label: {
                        Text(t.label)
                            .font(ArenaFont.mono(size: 10, weight: .bold))
                            .tracking(1.5)
                            .foregroundColor(tab == t ? .arenaOnPrimary : .arenaTextDim)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                HudCornerCutShape(cut: 6)
                                    .fill(tab == t ? Color.arenaPrimary : Color.clear)
                            )
                            .overlay(
                                HudCornerCutShape(cut: 6)
                                    .stroke(tab == t ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
        }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading && vm.items.isEmpty {
            Spacer()
            ProgressView().tint(.arenaPrimary)
            Spacer()
        } else if let err = vm.error {
            Text(err)
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaDanger)
                .padding()
        } else if vm.items.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(vm.items) { c in
                        NavigationLink {
                            ChallengeDetailView(challengeId: c.id)
                        } label: {
                            ChallengeRowCard(challenge: c)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 120)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Text("⚔").font(.system(size: 40))
            Text(emptyTitle)
                .font(ArenaFont.display(size: 14, weight: .heavy))
                .tracking(2)
                .foregroundColor(.arenaText)
            Text(emptySub)
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
            Button {
                showCreate = true
            } label: {
                Text("▶ \(String(localized: "NEW CHALLENGE"))")
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaOnPrimary)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(HudCornerCutShape(cut: 6).fill(Color.arenaPrimary))
            }
            .padding(.top, 6)
        }
        .padding(.vertical, 40)
        .frame(maxWidth: .infinity)
    }

    private var emptyTitle: String {
        switch tab {
        case .active:   return String(localized: "No active challenges")
        case .received: return String(localized: "Nothing to accept")
        case .sent:     return String(localized: "No outgoing challenges")
        case .settled:  return String(localized: "No history yet")
        }
    }
    private var emptySub: String {
        switch tab {
        case .active:   return String(localized: "Send your first one.")
        case .received: return String(localized: "You don't have incoming challenges.")
        case .sent:     return String(localized: "Tap + to create one.")
        case .settled:  return String(localized: "Finished challenges show up here.")
        }
    }
}

// MARK: — Row card

struct ChallengeRowCard: View {
    let challenge: Challenge

    private var statusColor: Color {
        switch challenge.status {
        case .pending:   return .arenaAccent
        case .accepted:  return .arenaPrimary
        case .settled:   return .arenaGold
        default:         return .arenaTextMuted
        }
    }
    private var statusLabel: String {
        switch challenge.status {
        case .pending:   return String(localized: "PENDING")
        case .accepted:  return String(localized: "LOCKED")
        case .settled:   return String(localized: "SETTLED")
        case .refunded:  return String(localized: "REFUNDED")
        case .declined:  return String(localized: "DECLINED")
        case .cancelled: return String(localized: "CANCELLED")
        }
    }
    private var iWon: Bool {
        challenge.status == .settled && challenge.winnerUserId != nil &&
        ((challenge.youAre == "challenger" && challenge.winnerUserId == challenge.challenger.id) ||
         (challenge.youAre == "opponent"   && challenge.winnerUserId == challenge.opponent?.id))
    }

    private var myPick: String? {
        challenge.youAre == "challenger" ? challenge.challengerPick : challenge.opponentPick
    }
    private var theirPick: String? {
        challenge.youAre == "challenger" ? challenge.opponentPick : challenge.challengerPick
    }
    private var opponentName: String {
        // For an open challenge that the viewer created, `opponent` is nil
        // until someone claims the slot — render a placeholder instead of
        // collapsing to "—" which reads like a deleted user.
        if challenge.youAre == "challenger" {
            return challenge.opponent?.username ?? String(localized: "OPEN SLOT")
        }
        return challenge.challenger.username ?? "—"
    }

    var body: some View {
        HudFrame {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    HudChip(text: statusLabel, color: statusColor)
                    Text(challenge.marketType.label)
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextMuted)
                    Spacer()
                    Text("🪙 \(challenge.stakeCoins)")
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .foregroundColor(.arenaGold)
                }

                Text("\(challenge.fixture.homeTeam) vs \(challenge.fixture.awayTeam)")
                    .font(ArenaFont.display(size: 13, weight: .bold))
                    .tracking(0.5)
                    .foregroundColor(.arenaText)

                if let lg = challenge.fixture.leagueName {
                    Text(lg)
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }

                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "YOU"))
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextMuted)
                        Text(Challenge.pickLabel(myPick, market: challenge.marketType))
                            .font(ArenaFont.display(size: 13, weight: .heavy))
                            .foregroundColor(.arenaPrimary)
                    }
                    Spacer()
                    Text("vs")
                        .font(ArenaFont.display(size: 12))
                        .foregroundColor(.arenaTextMuted)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("@\(opponentName)")
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextMuted)
                        Text(Challenge.pickLabel(theirPick, market: challenge.marketType))
                            .font(ArenaFont.display(size: 13, weight: .heavy))
                            .foregroundColor(.arenaHot)
                    }
                }

                if challenge.status == .settled {
                    Text(iWon ? String(format: String(localized: "YOU WON · +%d COINS"), challenge.payoutIfWin)
                              : String(localized: "YOU LOST"))
                        .font(ArenaFont.display(size: 11, weight: .heavy))
                        .tracking(1.5)
                        .foregroundColor(iWon ? .arenaPrimary : .arenaDanger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(
                            HudCornerCutShape(cut: 5)
                                .fill((iWon ? Color.arenaPrimary : Color.arenaDanger).opacity(0.12))
                        )
                }
            }
            .padding(12)
        }
    }
}

// MARK: — VM

@MainActor
final class ChallengesListViewModel: ObservableObject {
    @Published var items: [Challenge] = []
    @Published var isLoading = false
    @Published var error: String?
    private let client = APIClient.shared

    func load(tab: ChallengeListTab, token: String?) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            items = try await client.request(
                method: "GET",
                path: "/challenges/me?tab=\(tab.rawValue)",
                token: token
            )
        } catch {
            self.error = String(localized: "Could not load challenges")
            items = []
        }
    }
}
