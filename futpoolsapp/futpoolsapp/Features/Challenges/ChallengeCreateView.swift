//
//  ChallengeCreateView.swift
//  futpoolsapp
//
//  Scrollable single-screen form to create a 1v1 challenge. Reuses the same
//  `/football/leagues/search` + `/football/fixtures` endpoints as CreatePool.
//  On success the view dismisses and the user lands on ChallengeDetailView.
//

import Combine
import SwiftUI

private let STAKE_PRESETS: [Int] = [10, 25, 50, 100, 250, 500]

struct ChallengeCreateView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = ChallengeCreateViewModel()
    @State private var goToDetailId: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            ArenaBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    section(title: "① \(String(localized: "PICK A MATCH"))", locked: false) {
                        fixtureSection
                    }
                    section(title: "② \(String(localized: "MARKET"))", locked: vm.pickedFixture == nil) {
                        marketSection
                    }
                    section(title: "③ \(String(localized: "YOUR PICK"))", locked: vm.marketType == nil) {
                        pickSection
                    }
                    section(title: "④ \(String(localized: "STAKE"))", locked: vm.challengerPick == nil) {
                        stakeSection
                    }
                    section(title: "⑤ \(String(localized: "OPPONENT"))", locked: vm.stakeCoins == nil) {
                        opponentSection
                    }

                    if vm.canSubmit {
                        reviewCard
                    }
                    if let err = vm.error {
                        Text(err)
                            .font(ArenaFont.mono(size: 11))
                            .foregroundColor(.arenaDanger)
                            .padding(10)
                            .background(HudCornerCutShape(cut: 5).fill(Color.arenaDanger.opacity(0.12)))
                    }
                }
                .padding(16)
                .padding(.bottom, 140)
            }

            bottomBar
        }
        .arenaTabBarHidden()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationDestination(item: $goToDetailId) { id in
            ChallengeDetailView(challengeId: id)
        }
        .onChange(of: vm.balance) { _, _ in }
        .task { await auth.fetchUser() }
    }

    // MARK: — Header

    private var header: some View {
        HStack {
            Spacer()
            Text("⚔ \(String(localized: "NEW CHALLENGE"))")
                .font(ArenaFont.display(size: 12, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaText)
            Spacer()
        }
        .padding(.vertical, 4)
    }

    // MARK: — Fixture picker

    @ViewBuilder
    private var fixtureSection: some View {
        if let fx = vm.pickedFixture {
            HStack(spacing: 10) {
                TeamCrestArena(
                    name: fx.teams.home.name ?? "",
                    color: ArenaTeamColor.color(for: fx.teams.home.name ?? ""),
                    size: 28,
                    logoURL: fx.teams.home.logo
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(fx.teams.home.name ?? "") vs \(fx.teams.away.name ?? "")")
                        .font(ArenaFont.display(size: 12, weight: .heavy))
                        .foregroundColor(.arenaText)
                    Text("\(fx.league?.name ?? "") · \(fx.kickoffLabel)")
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextMuted)
                }
                Spacer()
                Button { vm.clearFixture() } label: {
                    Text("✕").font(.system(size: 16)).foregroundColor(.arenaTextDim)
                }
            }
            .padding(10)
            .background(
                HudCornerCutShape(cut: 6)
                    .fill(Color.arenaPrimary.opacity(0.08))
            )
            .overlay(
                HudCornerCutShape(cut: 6)
                    .stroke(Color.arenaPrimary.opacity(0.5), lineWidth: 1)
            )
        } else {
            VStack(spacing: 8) {
                TextField(String(localized: "Search a league or team…"), text: $vm.searchQuery)
                    .textInputAutocapitalization(.never)
                    .font(ArenaFont.body(size: 14))
                    .foregroundColor(.arenaText)
                    .padding(10)
                    .background(HudCornerCutShape(cut: 5).fill(Color.arenaBg2))
                    .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
                    .onChange(of: vm.searchQuery) { _, _ in vm.scheduleSearch() }

                if vm.selectedSource == nil {
                    ForEach(vm.searchResults) { source in
                        Button {
                            Task { await vm.selectSource(source) }
                        } label: {
                            HStack(spacing: 8) {
                                Text(source.kindLabel)
                                    .font(ArenaFont.mono(size: 8))
                                    .foregroundColor(.arenaTextMuted)
                                Text(source.displayName)
                                    .font(ArenaFont.body(size: 12))
                                    .foregroundColor(.arenaText)
                                Spacer()
                            }
                            .padding(8)
                            .background(HudCornerCutShape(cut: 5).fill(Color.arenaBg2))
                            .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    HStack(spacing: 6) {
                        Button { vm.clearSelectedSource() } label: {
                            Text("← BACK")
                                .font(ArenaFont.mono(size: 9))
                                .foregroundColor(.arenaTextDim)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .overlay(HudCornerCutShape(cut: 4).stroke(Color.arenaStroke, lineWidth: 1))
                        }
                        Text(vm.selectedSource?.displayName ?? "")
                            .font(ArenaFont.display(size: 11, weight: .bold))
                            .foregroundColor(.arenaText)
                        Spacer()
                    }
                    if vm.isLoadingFixtures {
                        ProgressView().tint(.arenaPrimary).frame(maxWidth: .infinity).padding()
                    } else if vm.fixturesForSource.isEmpty {
                        Text(String(localized: "No upcoming matches found."))
                            .font(ArenaFont.mono(size: 10))
                            .foregroundColor(.arenaTextMuted)
                            .padding()
                    } else {
                        VStack(spacing: 4) {
                            ForEach(vm.fixturesForSource.filter { $0.isUpcoming }.prefix(40)) { fx in
                                Button {
                                    vm.pickFixture(fx)
                                } label: {
                                    HStack(spacing: 8) {
                                        TeamCrestArena(name: fx.teams.home.name ?? "", color: ArenaTeamColor.color(for: fx.teams.home.name ?? ""), size: 20, logoURL: fx.teams.home.logo)
                                        Text("\(fx.teams.home.name ?? "") vs \(fx.teams.away.name ?? "")")
                                            .font(ArenaFont.body(size: 11))
                                            .foregroundColor(.arenaText)
                                        Spacer()
                                        Text(fx.kickoffShortTag)
                                            .font(ArenaFont.mono(size: 9))
                                            .foregroundColor(.arenaTextMuted)
                                    }
                                    .padding(8)
                                    .background(HudCornerCutShape(cut: 5).fill(Color.arenaBg2))
                                    .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: — Market / Pick / Stake / Opponent sections

    private var marketSection: some View {
        HStack(spacing: 8) {
            ForEach(ChallengeMarketType.allCases, id: \.self) { m in
                Button {
                    vm.setMarket(m)
                } label: {
                    VStack(spacing: 2) {
                        Text(m.label)
                            .font(ArenaFont.display(size: 14, weight: .heavy))
                        Text(m == .match1X2 ? "home/draw/away" : m == .overUnder25 ? "over or under" : "both score?")
                            .font(ArenaFont.mono(size: 8))
                            .opacity(0.7)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .foregroundColor(vm.marketType == m ? .arenaOnPrimary : .arenaTextDim)
                    .background(
                        HudCornerCutShape(cut: 5)
                            .fill(vm.marketType == m ? Color.arenaPrimary : Color.arenaBg2)
                    )
                    .overlay(
                        HudCornerCutShape(cut: 5)
                            .stroke(vm.marketType == m ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(vm.pickedFixture == nil)
            }
        }
    }

    @ViewBuilder
    private var pickSection: some View {
        if let mt = vm.marketType {
            HStack(spacing: 6) {
                ForEach(mt.validPicks, id: \.self) { p in
                    Button {
                        vm.challengerPick = p
                    } label: {
                        VStack(spacing: 2) {
                            Text(p)
                                .font(ArenaFont.display(size: 16, weight: .heavy))
                            Text(Challenge.pickLabel(p, market: mt))
                                .font(ArenaFont.mono(size: 8))
                                .opacity(0.7)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundColor(vm.challengerPick == p ? .arenaOnPrimary : .arenaTextDim)
                        .background(
                            HudCornerCutShape(cut: 5)
                                .fill(vm.challengerPick == p ? Color.arenaPrimary : Color.arenaBg2)
                        )
                        .overlay(
                            HudCornerCutShape(cut: 5)
                                .stroke(vm.challengerPick == p ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        } else {
            Text(String(localized: "Pick a market first."))
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextFaint)
                .padding(8)
        }
    }

    private var stakeSection: some View {
        VStack(spacing: 8) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach(STAKE_PRESETS, id: \.self) { n in
                    Button {
                        vm.stakeCoins = n
                    } label: {
                        VStack(spacing: 2) {
                            Text("🪙 \(n)")
                                .font(ArenaFont.display(size: 14, weight: .heavy))
                            if vm.balance < n {
                                Text("NEED MORE")
                                    .font(ArenaFont.mono(size: 7))
                                    .foregroundColor(.arenaDanger)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundColor(vm.stakeCoins == n ? .arenaOnPrimary : .arenaTextDim)
                        .background(
                            HudCornerCutShape(cut: 5)
                                .fill(vm.stakeCoins == n ? Color.arenaPrimary : Color.arenaBg2)
                        )
                        .overlay(
                            HudCornerCutShape(cut: 5)
                                .stroke(vm.stakeCoins == n ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(vm.challengerPick == nil)
                }
            }
            Text(String(format: String(localized: "Your balance: %d coins"), vm.balance))
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(vm.stakeCoins.map { vm.balance < $0 } ?? false ? .arenaDanger : .arenaTextMuted)
        }
    }

    private var opponentSection: some View {
        TextField("@username", text: $vm.opponentUsername)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .font(ArenaFont.mono(size: 13))
            .foregroundColor(.arenaText)
            .padding(10)
            .background(HudCornerCutShape(cut: 5).fill(Color.arenaBg2))
            .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
            .disabled(vm.stakeCoins == nil)
    }

    // MARK: — Review + submit

    private var reviewCard: some View {
        HudFrame {
            VStack(alignment: .leading, spacing: 8) {
                Text("◆ \(String(localized: "REVIEW"))")
                    .font(ArenaFont.mono(size: 10))
                    .tracking(2)
                    .foregroundColor(.arenaTextMuted)
                Text(vm.reviewText)
                    .font(ArenaFont.display(size: 13))
                    .foregroundColor(.arenaText)
            }
            .padding(14)
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom).frame(height: 40)
            ArcadeButton(
                title: vm.submitTitle,
                size: .lg,
                fullWidth: true,
                disabled: !vm.canSubmit || vm.isSubmitting || vm.insufficientBalance
            ) {
                Task {
                    let id = await vm.submit(token: auth.token, refreshUser: { await auth.fetchUser() })
                    if let id = id { goToDetailId = id }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
            .background(Color.arenaBg)
        }
        .onAppear { vm.balance = Int(auth.currentUser?.balanceValue ?? 0) }
        .onChange(of: auth.currentUser?.balance) { _, v in vm.balance = Int(v ?? 0) }
    }

    // MARK: — Section wrapper

    @ViewBuilder
    private func section<Content: View>(title: String, locked: Bool, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(ArenaFont.mono(size: 10))
                .tracking(2)
                .foregroundColor(.arenaPrimary)
            content()
        }
        .opacity(locked ? 0.45 : 1)
    }
}

// String is already Identifiable via its own hashable identity on iOS 17? No —
// we give it explicit Identifiable conformance for navigation destinations.
extension String: @retroactive Identifiable {
    public var id: String { self }
}

// MARK: — VM

@MainActor
final class ChallengeCreateViewModel: ObservableObject {
    // Fixture search state (mirrors CreatePoolViewModel where possible)
    @Published var searchQuery: String = ""
    @Published var searchResults: [PickerSource] = []
    @Published var isSearching = false
    @Published var selectedSource: PickerSource?
    @Published var fixturesForSource: [PickerFixture] = []
    @Published var isLoadingFixtures = false
    @Published var pickedFixture: PickerFixture?

    // Challenge draft state
    @Published var marketType: ChallengeMarketType?
    @Published var challengerPick: String?
    @Published var stakeCoins: Int?
    @Published var opponentUsername: String = ""
    @Published var balance: Int = 0

    @Published var isSubmitting = false
    @Published var error: String?

    private let client = APIClient.shared
    private var searchTask: Task<Void, Never>?

    var canSubmit: Bool {
        pickedFixture != nil && marketType != nil && challengerPick != nil
            && stakeCoins != nil && !opponentUsername.trimmingCharacters(in: .whitespaces).isEmpty
    }
    var insufficientBalance: Bool {
        if let s = stakeCoins { return balance < s }
        return false
    }
    var submitTitle: String {
        if isSubmitting { return String(localized: "SENDING…") }
        if insufficientBalance { return String(localized: "INSUFFICIENT BALANCE") }
        if canSubmit, let s = stakeCoins {
            return "▶ " + String(format: String(localized: "SEND · %d COINS"), s)
        }
        return String(localized: "COMPLETE ALL STEPS")
    }
    var reviewText: String {
        guard let fx = pickedFixture, let mt = marketType,
              let p = challengerPick, let s = stakeCoins else { return "" }
        let payout = Int((Double(s * 2) * 0.9).rounded(.down))
        let outcome: String
        switch (mt, p) {
        case (.match1X2, "1"): outcome = String(localized: "home wins")
        case (.match1X2, "2"): outcome = String(localized: "away wins")
        case (.match1X2, "X"): outcome = String(localized: "it ends in a draw")
        case (.overUnder25, "OVER"):   outcome = String(localized: "there are 3 or more goals")
        case (.overUnder25, "UNDER"):  outcome = String(localized: "there are 2 or fewer goals")
        case (.bothTeamsScore, "YES"): outcome = String(localized: "both teams score")
        case (.bothTeamsScore, "NO"):  outcome = String(localized: "one team doesn't score")
        default: outcome = p
        }
        return String(
            format: String(localized: "You're betting %d coins that %@ in %@ vs %@. Winner gets %d coins."),
            s, outcome, fx.teams.home.name ?? "", fx.teams.away.name ?? "", payout
        )
    }

    // MARK: Search lifecycle

    func scheduleSearch() {
        searchTask?.cancel()
        let q = searchQuery.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { searchResults = []; return }
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
            await self?.runSearch(query: q)
        }
    }

    private func runSearch(query: String) async {
        isSearching = true
        defer { isSearching = false }
        do {
            async let leagues: [PickerLeague] = client.request(
                method: "GET",
                path: "/football/leagues/search?query=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
            )
            async let teams: [PickerTeam] = client.request(
                method: "GET",
                path: "/football/teams/search?query=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
            )
            let (ls, ts) = try await (leagues, teams)
            searchResults = ls.prefix(8).map { .league($0) } + ts.prefix(12).map { .team($0) }
        } catch {
            searchResults = []
        }
    }

    func selectSource(_ src: PickerSource) async {
        selectedSource = src
        fixturesForSource = []
        isLoadingFixtures = true
        defer { isLoadingFixtures = false }
        let path: String
        switch src {
        case .league(let l):
            let seasonQ = l.season.map { "&season=\($0)" } ?? ""
            path = "/football/fixtures?leagueId=\(l.id)\(seasonQ)"
        case .team(let t):
            path = "/football/fixtures?teamId=\(t.id)"
        }
        do {
            fixturesForSource = try await client.request(method: "GET", path: path)
        } catch {
            fixturesForSource = []
        }
    }

    func clearSelectedSource() {
        selectedSource = nil
        fixturesForSource = []
    }

    func pickFixture(_ fx: PickerFixture) {
        pickedFixture = fx
        // Reset downstream picks so the user doesn't carry stale state from a
        // previously considered match.
        marketType = nil
        challengerPick = nil
        stakeCoins = nil
    }
    func clearFixture() {
        pickedFixture = nil
        marketType = nil
        challengerPick = nil
        stakeCoins = nil
    }

    func setMarket(_ m: ChallengeMarketType) {
        marketType = m
        challengerPick = nil
    }

    // MARK: Submit

    /// Returns the new challenge's id on success, nil on failure.
    func submit(token: String?, refreshUser: () async -> Void) async -> String? {
        guard let fx = pickedFixture, let mt = marketType,
              let p = challengerPick, let s = stakeCoins else { return nil }
        guard !opponentUsername.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        isSubmitting = true
        error = nil
        defer { isSubmitting = false }

        let isoKickoff: String = {
            guard let d = fx.kickoffDate else { return fx.date ?? "" }
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime]
            return f.string(from: d)
        }()
        let body = ChallengeCreateRequest(
            opponentUsername: opponentUsername.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "@", with: "").lowercased(),
            fixture: ChallengeFixture(
                fixtureId: fx.fixtureId,
                leagueId: fx.league?.id,
                leagueName: fx.league?.name,
                homeTeamId: fx.teams.home.id,
                awayTeamId: fx.teams.away.id,
                homeTeam: fx.teams.home.name ?? "",
                awayTeam: fx.teams.away.name ?? "",
                homeLogo: fx.teams.home.logo,
                awayLogo: fx.teams.away.logo,
                kickoff: isoKickoff
            ),
            marketType: mt.rawValue,
            challengerPick: p,
            stakeCoins: s
        )
        do {
            let created: Challenge = try await client.request(
                method: "POST",
                path: "/challenges",
                body: body,
                token: token
            )
            await refreshUser()
            return created.id
        } catch {
            let desc = error.localizedDescription
            if desc.contains("INSUFFICIENT_BALANCE") {
                self.error = String(localized: "Insufficient balance — visit the shop to recharge.")
            } else if desc.contains("Opponent not found") {
                self.error = String(localized: "That user does not exist.")
            } else if desc.contains("Cannot challenge yourself") {
                self.error = String(localized: "You can't challenge yourself.")
            } else if desc.contains("FIXTURE_STARTED") {
                self.error = String(localized: "Fixture already started.")
            } else {
                self.error = desc
            }
            return nil
        }
    }
}
