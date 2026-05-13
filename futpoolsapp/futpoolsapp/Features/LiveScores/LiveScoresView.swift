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
    @StateObject private var vm = LiveScoresViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                VStack(spacing: 0) {
                    header
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
        // Distinguish "no favorites picked" from "no fixtures today".
        let hasFavorites = !LiveScoresViewModel.favoriteLeagueIDs().isEmpty
            || !LiveScoresViewModel.favoriteTeamIDs().isEmpty
        VStack(spacing: 12) {
            Text("⚽")
                .font(.system(size: 48))
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
        HudFrame(cut: 10, glow: fixture.isLive ? .arenaDanger : nil) {
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
