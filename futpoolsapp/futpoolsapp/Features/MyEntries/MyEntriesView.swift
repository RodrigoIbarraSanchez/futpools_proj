//
//  MyEntriesView.swift
//  futpoolsapp
//

import SwiftUI

struct MyEntriesView: View {
    @StateObject private var vm = MyEntriesViewModel()
    @State private var expandedGroups: Set<String> = []

    private var groupedEntries: [EntryGroup] {
        let groups = Dictionary(grouping: vm.entries, by: { $0.quiniela.id })
        return groups.values.compactMap { entries in
            guard let first = entries.first else { return nil }
            let sorted = entries.sorted {
                ($0.createdAtValue ?? .distantPast) > ($1.createdAtValue ?? .distantPast)
            }
            return EntryGroup(id: first.quiniela.id, quiniela: first.quiniela, entries: sorted)
        }
        .sorted {
            ($0.quiniela.startDateValue ?? .distantPast) > ($1.quiniela.startDateValue ?? .distantPast)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        if vm.isLoading && vm.entries.isEmpty {
                            EntriesLoadingView(
                                title: "Loading entries…",
                                subtitle: "Fetching your picks and live scores"
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.top, AppSpacing.xl)
                        } else if let err = vm.errorMessage {
                            Text(err)
                                .font(AppFont.body())
                                .foregroundColor(.appTextSecondary)
                                .padding()
                        } else if vm.entries.isEmpty {
                            Text("You don't have any entries yet. Join a pool to create one.")
                                .font(AppFont.body())
                                .foregroundColor(.appTextSecondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.top, AppSpacing.xl)
                        } else {
                            LazyVStack(spacing: AppSpacing.sm) {
                                ForEach(groupedEntries) { group in
                                    PoolEntriesCard(
                                        group: group,
                                        liveFixtures: vm.liveFixtures,
                                        isExpanded: Binding(
                                            get: { expandedGroups.contains(group.id) },
                                            set: { newValue in
                                                if newValue {
                                                    expandedGroups.insert(group.id)
                                                } else {
                                                    expandedGroups.remove(group.id)
                                                }
                                            }
                                        )
                                    )
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                    .padding(.vertical)
                }
            }
            .navigationTitle("My Entries")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear {
                print("[Mis entradas] Pantalla mostrada — refrescando lista")
                vm.load()
                vm.startLiveUpdates()
            }
            .onDisappear {
                vm.stopLiveUpdates()
            }
            .refreshable {
                print("[Mis entradas] Pull-to-refresh")
                vm.load()
            }
        }
    }
}

private struct EntryGroup: Identifiable {
    let id: String
    let quiniela: Quiniela
    let entries: [QuinielaEntry]
}

private struct EntriesLoadingView: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            ProgressView()
                .tint(.appPrimary)
                .scaleEffect(1.1)
            Text(title)
                .font(AppFont.headline())
                .foregroundColor(.appTextPrimary)
            Text(subtitle)
                .font(AppFont.caption())
                .foregroundColor(.appTextSecondary)
        }
    }
}

struct QuinielaEntryCard: View {
    let entry: QuinielaEntry
    let fallbackNumber: Int

    private var statusText: String {
        if let end = entry.quiniela.endDateValue, end < Date() {
            return "Closed"
        }
        return "Pending"
    }

    var body: some View {
        CardView(compact: true) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Text(entry.quiniela.name)
                        .font(AppFont.headline())
                        .foregroundColor(.appTextPrimary)
                    Spacer()
                    Text(statusText)
                        .font(AppFont.caption())
                        .foregroundColor(statusText == "Closed" ? .appTextSecondary : .white)
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, AppSpacing.xs)
                        .background(
                            Capsule()
                                .fill(statusText == "Closed" ? Color.appSurfaceAlt : Color.appPrimary)
                        )
                }
                let number = entry.entryNumber ?? fallbackNumber
                Text("Entry #\(number)")
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)
                ForEach(entry.quiniela.fixtures) { fixture in
                    let pick = entry.picks.first { $0.fixtureId == fixture.fixtureId }?.pick ?? ""
                    MatchPickLine(
                        homeName: fixture.homeTeam,
                        awayName: fixture.awayTeam,
                        homeLogo: fixture.homeLogo,
                        awayLogo: fixture.awayLogo,
                        pick: pick
                    )
                }
            }
        }
    }
}

private struct PoolEntriesCard: View {
    let group: EntryGroup
    let liveFixtures: [Int: LiveFixture]
    @Binding var isExpanded: Bool
    @State private var leaderboard: LeaderboardResponse?
    @State private var leaderboardLoading = false
    private let client = APIClient.shared

    private var dateRange: String {
        guard let start = group.quiniela.startDateValue else { return "—" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "en_US")
        if let end = group.quiniela.endDateValue {
            return "\(f.string(from: start)) - \(f.string(from: end))"
        }
        return f.string(from: start)
    }

    private var statusText: String {
        if let end = group.quiniela.endDateValue, end < Date() {
            return "Closed"
        }
        return "Pending"
    }

    private func loadLeaderboard() {
        Task {
            leaderboardLoading = true
            do {
                let data: LeaderboardResponse = try await client.request(
                    method: "GET",
                    path: "/quinielas/\(group.quiniela.id)/leaderboard",
                    token: KeychainHelper.getToken()
                )
                leaderboard = data
            } catch {
                leaderboard = nil
            }
            leaderboardLoading = false
        }
    }

    var body: some View {
        CardView(compact: true) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Text(group.quiniela.name)
                        .font(AppFont.headline())
                        .foregroundColor(.appTextPrimary)
                    Spacer()
                    Text(statusText)
                        .font(AppFont.caption())
                        .foregroundColor(statusText == "Closed" ? .appTextSecondary : .white)
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, AppSpacing.xs)
                        .background(
                            Capsule()
                                .fill(statusText == "Closed" ? Color.appSurfaceAlt : Color.appPrimary)
                        )
                }
                Text(dateRange)
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)
                HStack(spacing: AppSpacing.sm) {
                    EntryPill(label: "Entries: \(group.entries.count)")
                    EntryPill(label: "Prize: \(group.quiniela.prize)")
                    EntryPill(label: "Entry: \(group.quiniela.cost)")
                }

                LeaderboardView(
                    leaderboard: leaderboard,
                    isLoading: leaderboardLoading,
                    quinielaId: group.quiniela.id,
                    token: KeychainHelper.getToken()
                )

                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack {
                        Text("Entries")
                            .font(AppFont.caption().weight(.semibold))
                            .foregroundColor(.appTextPrimary)
                        Spacer()
                        Text("\(group.entries.count)")
                            .font(AppFont.caption().weight(.semibold))
                            .foregroundColor(.appTextSecondary)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.appTextSecondary)
                            .rotationEffect(.degrees(isExpanded ? 180 : 0))
                    }
                    .padding(.horizontal, AppSpacing.sm)
                    .padding(.vertical, AppSpacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.appSurfaceAlt.opacity(0.6))
                    )
                }
                .buttonStyle(.plain)
                .onAppear {
                    loadLeaderboard()
                }

                if isExpanded {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        ForEach(Array(group.entries.enumerated()), id: \.element.id) { index, entry in
                            EntryDetailCard(entry: entry, fallbackNumber: index + 1, liveFixtures: liveFixtures)
                            if index < group.entries.count - 1 {
                                Divider()
                                    .background(Color.white.opacity(0.08))
                            }
                        }
                    }
                    .padding(.top, AppSpacing.sm)
                }
            }
        }
    }
}

private struct EntryDetailCard: View {
    let entry: QuinielaEntry
    let fallbackNumber: Int
    let liveFixtures: [Int: LiveFixture]

    private var entryLabel: String {
        let number = entry.entryNumber ?? fallbackNumber
        return "Entry #\(number)"
    }

    private var entryDate: String {
        guard let date = entry.createdAtValue else { return "" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "en_US")
        return f.string(from: date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(entryLabel)
                    .font(AppFont.caption().weight(.semibold))
                    .foregroundColor(.appTextPrimary)
                Spacer()
                if !entryDate.isEmpty {
                    Text(entryDate)
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                }
            }
            ForEach(entry.quiniela.fixtures, id: \.fixtureId) { fixture in
                let pick = entry.picks.first { $0.fixtureId == fixture.fixtureId }?.pick ?? ""
                MatchPickLine(
                    homeName: fixture.homeTeam,
                    awayName: fixture.awayTeam,
                    homeLogo: fixture.homeLogo,
                    awayLogo: fixture.awayLogo,
                    pick: pick,
                    live: liveFixtures[fixture.fixtureId]
                )
            }
        }
    }
}

private struct EntryPill: View {
    let label: String

    var body: some View {
        Text(label)
            .font(AppFont.caption())
            .foregroundColor(.appTextSecondary)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xs)
            .background(Capsule().fill(Color.appSurfaceAlt))
    }
}

private struct MatchPickLine: View {
    let homeName: String
    let awayName: String
    let homeLogo: String?
    let awayLogo: String?
    let pick: String
    let live: LiveFixture?

    init(
        homeName: String,
        awayName: String,
        homeLogo: String?,
        awayLogo: String?,
        pick: String,
        live: LiveFixture? = nil
    ) {
        self.homeName = homeName
        self.awayName = awayName
        self.homeLogo = homeLogo
        self.awayLogo = awayLogo
        self.pick = pick
        self.live = live
    }

    private var pickNormalized: String {
        pick.uppercased()
    }

    private var statusMeta: (text: String, isLive: Bool, isFinal: Bool)? {
        guard let short = live?.status.short?.uppercased(), !short.isEmpty else { return nil }
        let isLive = live?.status.isLive == true
        let isFinal = ["FT", "AET", "PEN"].contains(short)
        let text = isLive ? "LIVE" : (isFinal ? "FINAL" : short)
        return (text, isLive, isFinal)
    }

    private var scoreText: String? {
        guard let live else { return nil }
        if live.score.home == nil && live.score.away == nil { return nil }
        return "\(live.score.home ?? 0) : \(live.score.away ?? 0)"
    }

    var body: some View {
        VStack(spacing: AppSpacing.xs) {
            HStack(spacing: AppSpacing.sm) {
                TeamMiniRow(name: homeName, logoURL: homeLogo)
                    .frame(maxWidth: .infinity, alignment: .leading)
                PickBadge(label: "1", selected: pickNormalized == "1")
                PickBadge(label: "X", selected: pickNormalized == "X")
                PickBadge(label: "2", selected: pickNormalized == "2")
                TeamMiniRow(name: awayName, logoURL: awayLogo)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            HStack {
                if let meta = statusMeta {
                    MatchStatusBadge(text: meta.text, isLive: meta.isLive, isFinal: meta.isFinal)
                }
                Spacer()
                if let score = scoreText {
                    Text(score)
                        .font(AppFont.caption().weight(.semibold))
                        .foregroundColor(.appTextPrimary)
                }
            }
        }
    }
}

private struct PickBadge: View {
    let label: String
    let selected: Bool

    var body: some View {
        Text(label)
            .font(AppFont.caption().weight(.semibold))
            .foregroundColor(selected ? .black : .appTextSecondary)
            .frame(width: 24, height: 24)
            .background(
                Circle()
                    .fill(selected ? Color.appPrimary : Color.appSurfaceAlt)
            )
    }
}

private struct TeamMiniRow: View {
    let name: String
    let logoURL: String?

    var body: some View {
        HStack(spacing: AppSpacing.xs) {
            ZStack {
                Circle()
                    .fill(Color.appSurfaceAlt)
                    .frame(width: 18, height: 18)
                if let logoURL, let url = URL(string: logoURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFit()
                    } placeholder: {
                        Text(String(name.prefix(1)))
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.appTextPrimary)
                    }
                    .frame(width: 12, height: 12)
                } else {
                    Text(String(name.prefix(1)))
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.appTextPrimary)
                }
            }
            Text(name)
                .font(AppFont.caption())
                .foregroundColor(.appTextSecondary)
                .lineLimit(1)
        }
    }
}

#Preview {
    MyEntriesView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
