//
//  FixturePickerSheet.swift
//  futpoolsapp
//
//  Full-screen sheet where the user searches leagues or teams, then picks
//  fixtures from the selected source. Fixtures are added directly to the
//  shared CreatePoolViewModel so the parent screen stays up to date.
//

import SwiftUI

struct FixturePickerSheet: View {
    @ObservedObject var vm: CreatePoolViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var searchFocused: Bool

    private let popularLeagues: [(String, String)] = [
        ("Liga MX", "liga mx"),
        ("Premier League", "premier league"),
        ("La Liga", "la liga"),
        ("Champions League", "uefa champions"),
        ("MLS", "major league soccer"),
        ("Serie A", "serie a"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()

                VStack(spacing: 0) {
                    searchBar
                    Divider().background(Color.arenaStroke)

                    if vm.selectedSource != nil {
                        fixturesPane
                    } else {
                        searchPane
                    }
                }

                if !vm.selectedFixtures.isEmpty {
                    VStack {
                        Spacer()
                        basketBar
                    }
                }
            }
            .navigationTitle(vm.selectedSource == nil ? "ADD FIXTURES" : "PICK FIXTURES")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        if vm.selectedSource != nil {
                            vm.clearSelectedSource()
                        } else {
                            dismiss()
                        }
                    } label: {
                        Text(vm.selectedSource == nil ? "Close" : "Back")
                            .foregroundColor(.arenaTextDim)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundColor(.arenaPrimary)
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                }
            }
        }
    }

    // MARK: Search bar (always visible at top)

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.arenaTextMuted)
            TextField("Search a league or team…", text: $vm.searchQuery)
                .font(ArenaFont.mono(size: 14))
                .foregroundColor(.arenaText)
                .focused($searchFocused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onChange(of: vm.searchQuery) { _, _ in
                    vm.onSearchQueryChange()
                    if !vm.searchQuery.isEmpty && vm.selectedSource != nil {
                        vm.clearSelectedSource()
                    }
                }
            if !vm.searchQuery.isEmpty {
                Button {
                    vm.searchQuery = ""
                    vm.onSearchQueryChange()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.arenaTextDim)
                }
                .buttonStyle(.plain)
            }
            if vm.isSearching {
                ProgressView().tint(.arenaPrimary).scaleEffect(0.7)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.arenaBg2)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Color.arenaStroke), alignment: .bottom)
    }

    // MARK: State A/B — search pane (results OR popular shortcuts)

    private var searchPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if vm.searchQuery.isEmpty {
                    popularSection
                } else if vm.searchResults.isEmpty && !vm.isSearching {
                    emptyResults
                } else {
                    resultsList
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, vm.selectedFixtures.isEmpty ? 60 : 120)
        }
    }

    private var popularSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("◆ POPULAR")
                .font(ArenaFont.display(size: 11, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaPrimary)

            let cols = [GridItem(.adaptive(minimum: 140), spacing: 8)]
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(popularLeagues, id: \.0) { item in
                    Button {
                        vm.searchQuery = item.1
                        vm.onSearchQueryChange()
                        searchFocused = false
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.arenaAccent)
                            Text(item.0.uppercased())
                                .font(ArenaFont.display(size: 11, weight: .bold))
                                .tracking(1.2)
                                .foregroundColor(.arenaText)
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurface))
                        .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaStroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            Text("Or type any team or league name above — we'll pull upcoming games from API-Football.")
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
                .padding(.top, 8)
        }
    }

    private var emptyResults: some View {
        VStack(spacing: 10) {
            Image(systemName: "sparkle.magnifyingglass")
                .font(.system(size: 28))
                .foregroundColor(.arenaTextDim)
            Text("No matches")
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            Text("Try another spelling or shorter query.")
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var resultsList: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(vm.searchResults) { source in
                Button {
                    Task {
                        searchFocused = false
                        await vm.selectSource(source)
                    }
                } label: {
                    HStack(spacing: 12) {
                        sourceBadge(source)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(source.displayName)
                                .font(ArenaFont.display(size: 14, weight: .bold))
                                .foregroundColor(.arenaText)
                                .lineLimit(1)
                            HStack(spacing: 6) {
                                Text(source.kindLabel)
                                    .font(ArenaFont.mono(size: 9, weight: .bold))
                                    .tracking(1.5)
                                    .foregroundColor(.arenaAccent)
                                Text("·")
                                    .foregroundColor(.arenaTextDim)
                                Text(source.subtitle)
                                    .font(ArenaFont.mono(size: 10))
                                    .foregroundColor(.arenaTextMuted)
                                    .lineLimit(1)
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.arenaTextDim)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurface))
                    .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaStroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func sourceBadge(_ source: PickerSource) -> some View {
        if let logo = source.logo, let url = URL(string: logo) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFit()
                        .frame(width: 34, height: 34)
                        .background(Color.white.opacity(0.02))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                default:
                    placeholderBadge(source)
                }
            }
        } else {
            placeholderBadge(source)
        }
    }

    private func placeholderBadge(_ source: PickerSource) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.arenaSurfaceAlt)
            Image(systemName: {
                switch source {
                case .league: return "trophy.fill"
                case .team:   return "shield.fill"
                }
            }())
            .font(.system(size: 14))
            .foregroundColor(.arenaAccent)
        }
        .frame(width: 34, height: 34)
    }

    // MARK: State C — fixtures pane for a selected source

    private var fixturesPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let source = vm.selectedSource {
                    sourceHeader(source)
                }

                if vm.isLoadingFixtures {
                    HStack {
                        ProgressView().tint(.arenaPrimary)
                        Text("LOADING FIXTURES…")
                            .font(ArenaFont.mono(size: 11))
                            .foregroundColor(.arenaTextDim)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else if vm.fixturesForSource.isEmpty {
                    emptyFixtures
                } else {
                    VStack(spacing: 8) {
                        ForEach(vm.fixturesForSource) { fx in
                            pickableFixtureRow(fx)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, vm.selectedFixtures.isEmpty ? 60 : 120)
        }
    }

    private func sourceHeader(_ source: PickerSource) -> some View {
        HStack(spacing: 12) {
            sourceBadge(source)
            VStack(alignment: .leading, spacing: 2) {
                Text(source.kindLabel)
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaAccent)
                Text(source.displayName)
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                    .foregroundColor(.arenaText)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(12)
        .background(HudCornerCutShape(cut: 8).fill(Color.arenaSurfaceAlt))
    }

    private var emptyFixtures: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 24))
                .foregroundColor(.arenaTextDim)
            Text("No upcoming matches")
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            Text("The season may be off or this team has no scheduled games.")
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private func pickableFixtureRow(_ fx: PickerFixture) -> some View {
        let isPicked = vm.isSelected(fx)
        let isLive = fx.isLive
        // Already-played fixtures (past + non-live status) are locked; upcoming
        // and live are both fair game for a pool.
        let played = !fx.isPickable
        return Button {
            vm.toggleFixture(fx)
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .stroke(isPicked ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1.5)
                        .frame(width: 22, height: 22)
                    if isPicked {
                        Circle().fill(Color.arenaPrimary).frame(width: 14, height: 14)
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        TeamCrestArena(
                            name: fx.teams.home.name ?? "?",
                            color: .arenaAccent,
                            size: 28,
                            logoURL: fx.teams.home.logo
                        )
                        Text(fx.teams.home.name ?? "?")
                            .font(ArenaFont.display(size: 12, weight: .bold))
                            .foregroundColor(.arenaText)
                            .lineLimit(1)
                        Text("vs")
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextDim)
                        Text(fx.teams.away.name ?? "?")
                            .font(ArenaFont.display(size: 12, weight: .bold))
                            .foregroundColor(.arenaText)
                            .lineLimit(1)
                        TeamCrestArena(
                            name: fx.teams.away.name ?? "?",
                            color: .arenaHot,
                            size: 28,
                            logoURL: fx.teams.away.logo
                        )
                    }
                    HStack(spacing: 6) {
                        Text(fx.kickoffLabel)
                            .font(ArenaFont.mono(size: 10))
                            .foregroundColor(played ? .arenaDanger : (isLive ? .arenaDanger : .arenaTextMuted))
                        if isLive {
                            HStack(spacing: 3) {
                                Circle().fill(Color.arenaDanger).frame(width: 5, height: 5)
                                Text("LIVE")
                                    .font(ArenaFont.mono(size: 9, weight: .bold))
                                    .tracking(1.2)
                                    .foregroundColor(.arenaDanger)
                            }
                        } else if played {
                            Text("· PAST")
                                .font(ArenaFont.mono(size: 9, weight: .bold))
                                .tracking(1.2)
                                .foregroundColor(.arenaDanger)
                        }
                    }
                }
                Spacer()
            }
            .padding(10)
            .background(HudCornerCutShape(cut: 6).fill(isPicked ? Color.arenaPrimary.opacity(0.12) : Color.arenaSurface))
            .overlay(
                HudCornerCutShape(cut: 6)
                    .stroke(isPicked ? Color.arenaPrimary : Color.arenaStroke, lineWidth: isPicked ? 1.5 : 1)
            )
            .opacity(played ? 0.45 : 1)
        }
        .buttonStyle(.plain)
        .disabled(played)
    }

    // MARK: Basket bar (sticky bottom)

    private var basketBar: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(vm.selectedFixtures.count) IN BASKET")
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaOnPrimary)
                if let first = vm.selectedFixtures.sorted(by: {
                    ($0.kickoffDate ?? .distantFuture) < ($1.kickoffDate ?? .distantFuture)
                }).first {
                    Text("FIRST · \(first.kickoffShortTag)")
                        .font(ArenaFont.mono(size: 10))
                        .tracking(1)
                        .foregroundColor(.arenaOnPrimary.opacity(0.8))
                }
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                HStack(spacing: 4) {
                    Text("DONE")
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .tracking(2)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundColor(.arenaPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(HudCornerCutShape(cut: 6).fill(Color.arenaBg))
                .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaPrimary, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .padding(.bottom, 8)
        .background(
            LinearGradient(
                colors: [Color.arenaPrimary.opacity(0.9), Color.arenaPrimary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }
}
