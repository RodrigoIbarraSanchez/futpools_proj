//
//  LiveScoresView.swift
//  futpoolsapp
//
//  simple_version SCORES tab — Scorespot-style live + upcoming fixture
//  list, filtered to the user's favorite leagues + teams (captured at
//  onboarding). Tap a row to open the existing LiveMatchView for the
//  full match feed.
//

import SwiftUI

struct LiveScoresView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = LiveScoresViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                VStack(spacing: 0) {
                    header
                    activePoolsBanner
                    tabStrip
                    content
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .onAppear {
                vm.load()
                vm.startPolling()
                vm.loadActivePools()
            }
            .onDisappear { vm.stopPolling() }
        }
    }

    private var header: some View {
        Text(String(localized: "LIVE SCORES"))
            .font(ArenaFont.display(size: 24, weight: .heavy))
            .tracking(3)
            .foregroundColor(.arenaText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 6)
    }

    /// Horizontally-scrolling carousel of pools the user joined via the web
    /// app and that are still active. Only shown when there's at least one;
    /// taps push into the existing read-only QuinielaDetailView.
    @ViewBuilder
    private var activePoolsBanner: some View {
        if !vm.activePools.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Text("◆")
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                    Text(String(localized: "MY ACTIVE POOLS"))
                        .font(ArenaFont.display(size: 11, weight: .heavy))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                }
                .padding(.horizontal, 16)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(vm.activePools) { entry in
                            NavigationLink {
                                QuinielaDetailView(quiniela: entry.quiniela)
                                    .environmentObject(auth)
                            } label: {
                                ActivePoolCard(entry: entry)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.bottom, 12)
        }
    }

    private var tabStrip: some View {
        HStack(spacing: 6) {
            ForEach(LiveScoresViewModel.Tab.allCases) { tab in
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { vm.selectTab(tab) }
                } label: {
                    Text(tab.label)
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(vm.selectedTab == tab ? .arenaOnPrimary : .arenaTextDim)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            HudCornerCutShape(cut: 6)
                                .fill(vm.selectedTab == tab ? Color.arenaPrimary : Color.clear)
                        )
                        .overlay(
                            HudCornerCutShape(cut: 6)
                                .stroke(vm.selectedTab == tab ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    @ViewBuilder
    private var content: some View {
        let groups = vm.groupedByLeague
        if vm.isLoading && vm.fixtures.isEmpty {
            VStack(spacing: 8) {
                ProgressView().tint(.arenaPrimary)
                Text(String(localized: "LOADING FIXTURES…"))
                    .font(ArenaFont.mono(size: 11))
                    .tracking(2)
                    .foregroundColor(.arenaTextDim)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 60)
        } else if groups.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(spacing: 14, pinnedViews: [.sectionHeaders]) {
                    ForEach(groups) { group in
                        Section {
                            VStack(spacing: 6) {
                                ForEach(group.fixtures) { fixture in
                                    NavigationLink {
                                        LiveMatchView(fixture: fixture.toQuinielaFixture())
                                    } label: {
                                        FixtureRow(fixture: fixture)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                        } header: {
                            LeagueHeader(group: group)
                        }
                    }
                }
                .padding(.top, 4)
                .padding(.bottom, 120)
            }
            .refreshable { vm.load() }
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        // LIVE tab has its own copy — when nothing's playing globally we
        // say so explicitly rather than implying the user lacks
        // favorites (which is the other tabs' problem).
        if vm.selectedTab == .live {
            VStack(spacing: 12) {
                Text("⏳").font(.system(size: 48))
                Text(String(localized: "NO LIVE GAMES"))
                    .font(ArenaFont.display(size: 14, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text(String(localized: "Nothing kicking off worldwide right now. Check TODAY for upcoming."))
                    .font(ArenaFont.body(size: 12))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.top, 60)
        } else {
            // Date/Favorites tabs: distinguish "no favorites picked" from
            // "no fixtures today".
            let hasFavorites = !LiveScoresViewModel.favoriteLeagueIDs().isEmpty
                || !LiveScoresViewModel.favoriteTeamIDs().isEmpty
            VStack(spacing: 12) {
                Text("⚽").font(.system(size: 48))
                Text(hasFavorites
                     ? String(localized: "NO FIXTURES")
                     : String(localized: "PICK YOUR FAVORITES"))
                    .font(ArenaFont.display(size: 14, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text(hasFavorites
                     ? String(localized: "Nothing scheduled in your leagues today. Try TOMORROW.")
                     : String(localized: "Add favorite teams or leagues from your profile to see live scores."))
                    .font(ArenaFont.body(size: 12))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.top, 60)
        }
    }
}

// MARK: - Active pool card

/// Compact carousel card for a pool the user joined via web. Shows the
/// pool's status (LIVE pulse / OPEN with kickoff in / CLOSED), name, and
/// score progress against the maximum possible. Designed for horizontal
/// scrolling — fixed width so multiple cards fit on screen at once.
private struct ActivePoolCard: View {
    let entry: QuinielaEntry

    private var hasLiveFixture: Bool {
        let now = Date()
        for fx in entry.quiniela.fixtures {
            guard let date = fx.kickoffDate else { continue }
            // Live ≈ kickoff in the past + status not finished.
            if date <= now && (fx.status ?? "") != "FT" { return true }
        }
        return false
    }

    private var statusLabel: String {
        if hasLiveFixture { return String(localized: "LIVE") }
        if let start = entry.quiniela.startDateValue, start > Date() {
            // Show "STARTS IN 2H" style copy. Compact relative format.
            let f = RelativeDateTimeFormatter()
            f.unitsStyle = .abbreviated
            return f.localizedString(for: start, relativeTo: Date()).uppercased()
        }
        return String(localized: "OPEN")
    }

    private var statusColor: Color {
        hasLiveFixture ? .arenaDanger : .arenaPrimary
    }

    private var scoreLine: String {
        let score = entry.score ?? 0
        let total = entry.totalPossible ?? entry.quiniela.fixtures.count
        return "\(score) / \(total)"
    }

    var body: some View {
        // Note: no `glow:` — see FixtureRow above for rationale. The
        // LIVE label + red pulse on the card header is enough.
        HudFrame(cut: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    if hasLiveFixture {
                        Circle()
                            .fill(Color.arenaDanger)
                            .frame(width: 6, height: 6)
                            .shadow(color: .arenaDanger, radius: 4)
                    }
                    Text(statusLabel)
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(statusColor)
                    Spacer(minLength: 0)
                }
                Text(entry.quiniela.name.uppercased())
                    .font(ArenaFont.display(size: 14, weight: .heavy))
                    .tracking(0.5)
                    .foregroundColor(.arenaText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Spacer(minLength: 4)
                HStack(alignment: .firstTextBaseline) {
                    Text(scoreLine)
                        .font(ArenaFont.display(size: 22, weight: .heavy))
                        .foregroundColor(statusColor)
                        .monospacedDigit()
                    Text(String(localized: "PTS"))
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .foregroundColor(.arenaTextMuted)
                    Spacer()
                    Text("\(entry.quiniela.fixtures.count) \(String(localized: "FIXTURES"))")
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextDim)
                }
            }
            .padding(12)
            .frame(width: 220, height: 124, alignment: .topLeading)
        }
    }
}

// MARK: - League header

private struct LeagueHeader: View {
    let group: LeagueGroup

    var body: some View {
        HStack(spacing: 8) {
            if let url = group.logoURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: Color.clear
                    }
                }
                .frame(width: 18, height: 18)
            }
            Text(group.name.uppercased())
                .font(ArenaFont.display(size: 11, weight: .heavy))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.arenaBg)
    }
}

// MARK: - Fixture row

private struct FixtureRow: View {
    let fixture: FeedFixture

    var body: some View {
        // Note: no `glow:` — the red shadow effect was too aggressive
        // visually with multiple live games stacked. The LIVE pulse +
        // red minute counter inside the row carry the urgency cue.
        HudFrame(cut: 10) {
            HStack(spacing: 12) {
                // Status / kickoff time on the left
                statusColumn
                    .frame(width: 56, alignment: .leading)

                // Team rows: home top, away bottom. Score on the right
                // of each team — a vertical layout reads cleaner than a
                // horizontal "home X-X away" when team names are long.
                VStack(alignment: .leading, spacing: 6) {
                    teamLine(name: fixture.teams.home.name ?? "—", logo: fixture.teams.home.logo, score: fixture.goals.home)
                    teamLine(name: fixture.teams.away.name ?? "—", logo: fixture.teams.away.logo, score: fixture.goals.away)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
    }

    @ViewBuilder
    private var statusColumn: some View {
        if fixture.isLive {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.arenaDanger)
                        .frame(width: 6, height: 6)
                        .shadow(color: .arenaDanger, radius: 4)
                    Text("LIVE")
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .foregroundColor(.arenaDanger)
                }
                if let elapsed = fixture.elapsed {
                    Text("\(elapsed)'")
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .foregroundColor(.arenaText)
                }
            }
        } else if fixture.isFinished {
            Text("FT")
                .font(ArenaFont.mono(size: 11, weight: .bold))
                .foregroundColor(.arenaTextMuted)
        } else if let date = fixture.kickoffDate {
            VStack(alignment: .leading, spacing: 2) {
                Text(date.formatted(.dateTime.weekday(.abbreviated)))
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextMuted)
                Text(date.formatted(.dateTime.hour().minute()))
                    .font(ArenaFont.mono(size: 12, weight: .bold))
                    .foregroundColor(.arenaText)
            }
        } else {
            Text("—")
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaTextDim)
        }
    }

    private func teamLine(name: String, logo: String?, score: Int?) -> some View {
        HStack(spacing: 8) {
            if let logoURL = logo.flatMap(URL.init(string:)) {
                AsyncImage(url: logoURL) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: Color.clear
                    }
                }
                .frame(width: 18, height: 18)
            }
            Text(name)
                .font(ArenaFont.body(size: 13, weight: .semibold))
                .foregroundColor(.arenaText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let s = score {
                Text("\(s)")
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                    .foregroundColor(fixture.isLive ? .arenaDanger : .arenaText)
                    .monospacedDigit()
            }
        }
    }
}

#Preview {
    LiveScoresView()
        .preferredColorScheme(.dark)
}
