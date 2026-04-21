//
//  MyEntriesView.swift
//  futpoolsapp
//

import SwiftUI

struct MyEntriesView: View {
    @StateObject private var vm = MyEntriesViewModel()
    @EnvironmentObject var auth: AuthService
    @State private var expandedGroups: Set<String> = []

    private var groupedEntries: [ArenaEntryGroup] {
        let groups = Dictionary(grouping: vm.entries, by: { $0.quiniela.id })
        return groups.values.compactMap { entries in
            guard let first = entries.first else { return nil }
            let sorted = entries.sorted { ($0.createdAtValue ?? .distantPast) > ($1.createdAtValue ?? .distantPast) }
            return ArenaEntryGroup(id: first.quiniela.id, quiniela: first.quiniela, entries: sorted)
        }
        .sorted { ($0.quiniela.startDateValue ?? .distantPast) > ($1.quiniela.startDateValue ?? .distantPast) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        header

                        content
                    }
                    .padding(.vertical, 14)
                    .padding(.bottom, 120)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .onAppear {
                vm.load()
                vm.startLiveUpdates()
            }
            .onDisappear { vm.stopLiveUpdates() }
            .refreshable { vm.load() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("MY ENTRIES")
                .font(ArenaFont.display(size: 28, weight: .heavy))
                .tracking(1)
                .foregroundColor(.arenaText)
            if !vm.entries.isEmpty {
                Text("[ \(vm.entries.count) TOTAL ]")
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1)
                    .foregroundColor(.arenaTextMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading && vm.entries.isEmpty {
            VStack(spacing: 8) {
                ProgressView().tint(.arenaPrimary)
                Text("LOADING ENTRIES…")
                    .font(ArenaFont.mono(size: 11))
                    .tracking(2)
                    .foregroundColor(.arenaTextDim)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 40)
        } else if let err = vm.errorMessage {
            Text(err)
                .font(ArenaFont.body(size: 13))
                .foregroundColor(.arenaTextDim)
                .padding()
        } else if vm.entries.isEmpty {
            HudFrame {
                VStack(spacing: 12) {
                    Text("🎯")
                        .font(.system(size: 40))
                    Text("NO ENTRIES YET")
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .tracking(2)
                        .foregroundColor(.arenaText)
                    Text("Join a pool and submit picks to get started.")
                        .font(ArenaFont.body(size: 12))
                        .foregroundColor(.arenaTextDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(24)
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 16)
        } else {
            LazyVStack(spacing: 10) {
                ForEach(groupedEntries) { group in
                    ArenaEntryGroupCard(
                        group: group,
                        liveFixtures: vm.liveFixtures,
                        isExpanded: Binding(
                            get: { expandedGroups.contains(group.id) },
                            set: { newValue in
                                if newValue { expandedGroups.insert(group.id) }
                                else { expandedGroups.remove(group.id) }
                            }
                        )
                    )
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

private struct ArenaEntryGroup: Identifiable {
    let id: String
    let quiniela: Quiniela
    let entries: [QuinielaEntry]
}

private struct ArenaEntryGroupCard: View {
    let group: ArenaEntryGroup
    let liveFixtures: [Int: LiveFixture]
    @Binding var isExpanded: Bool

    private var statusColor: Color {
        if let end = group.quiniela.endDateValue, end < Date() { return .arenaTextMuted }
        if group.entries.contains(where: { $0.quiniela.fixtures.contains { liveFixtures[$0.fixtureId]?.status.isLive == true } }) {
            return .arenaDanger
        }
        return .arenaAccent
    }

    private var statusLabel: String {
        if let end = group.quiniela.endDateValue, end < Date() { return "CLOSED" }
        if statusColor == .arenaDanger { return "LIVE" }
        return "PENDING"
    }

    private var bestScore: (Int, Int) {
        let items: [(Int, Int)] = group.entries.map { e in
            let s = e.score ?? 0
            let t = (e.totalPossible ?? 0) > 0 ? (e.totalPossible ?? 0) : e.quiniela.fixtures.count
            return (s, t)
        }
        return items.max(by: { $0.0 < $1.0 }) ?? (0, group.quiniela.fixtures.count)
    }

    var body: some View {
        HudFrame(cut: 14, glow: statusColor == .arenaDanger ? .arenaDanger : nil) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(group.quiniela.name.uppercased())
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaText)
                    Spacer()
                    HudChip(text: statusLabel, color: statusColor, showLiveDot: statusLabel == "LIVE")
                }

                HStack(spacing: 10) {
                    Text("ENTRIES #\(group.entries.count)")
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                    Text("·")
                        .foregroundColor(.arenaTextFaint)
                    Text(dateRange)
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }

                HStack(spacing: 10) {
                    XpBar(value: Double(bestScore.0), max: Double(max(bestScore.1, 1)), color: statusColor, segments: max(bestScore.1, 1), height: 8)
                    Text("\(bestScore.0)/\(bestScore.1)")
                        .font(ArenaFont.mono(size: 13, weight: .bold))
                        .foregroundColor(statusColor)
                }

                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack {
                        Text(isExpanded ? "HIDE PICKS" : "SHOW PICKS")
                            .font(ArenaFont.display(size: 10, weight: .bold))
                            .tracking(2)
                            .foregroundColor(.arenaTextDim)
                        Spacer()
                        Text(isExpanded ? "▲" : "▼")
                            .font(.system(size: 10))
                            .foregroundColor(.arenaTextMuted)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(HudCornerCutShape(cut: 6).fill(Color.arenaBg2))
                    .clipShape(HudCornerCutShape(cut: 6))
                }
                .buttonStyle(.plain)

                if isExpanded {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(Array(group.entries.enumerated()), id: \.element.id) { idx, entry in
                            EntryDetailArena(entry: entry, fallback: idx + 1, liveFixtures: liveFixtures)
                            if idx < group.entries.count - 1 {
                                Rectangle().fill(Color.arenaStroke).frame(height: 1)
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            }
            .padding(14)
        }
    }

    private var dateRange: String {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short; f.locale = Locale(identifier: "en_US")
        guard let start = group.quiniela.startDateValue else { return "—" }
        return f.string(from: start)
    }
}

private struct EntryDetailArena: View {
    let entry: QuinielaEntry
    let fallback: Int
    let liveFixtures: [Int: LiveFixture]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("ENTRY #\(entry.entryNumber ?? fallback)")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundColor(.arenaPrimary)
                if let pts = entry.score, let total = entry.totalPossible, total > 0 {
                    Text("\(pts)/\(total) PTS")
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .tracking(1)
                        .foregroundColor(.arenaGold)
                }
                Spacer()
                if let d = entry.createdAtValue {
                    Text(shortDate(d))
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextMuted)
                }
            }

            HStack(spacing: 4) {
                ForEach(entry.quiniela.fixtures, id: \.fixtureId) { fx in
                    let pick = entry.picks.first { $0.fixtureId == fx.fixtureId }?.pick ?? "-"
                    PickChipCompact(home: fx.homeTeam, away: fx.awayTeam, pick: pick, live: liveFixtures[fx.fixtureId])
                }
            }
        }
    }

    private func shortDate(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "d MMM HH:mm"
        return f.string(from: d)
    }
}

private struct PickChipCompact: View {
    let home: String
    let away: String
    let pick: String
    let live: LiveFixture?

    var body: some View {
        let isLive = live?.status.isLive == true
        let isFinal = ["FT","AET","PEN"].contains(live?.status.short?.uppercased() ?? "")
        let color: Color = isLive ? .arenaDanger : (isFinal ? .arenaPrimary : .arenaTextMuted)

        Text("\(short(home)) \(pick) \(short(away))")
            .font(ArenaFont.mono(size: 9, weight: .bold))
            .tracking(1)
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(HudCornerCutShape(cut: 4).fill(color.opacity(0.2)))
            .clipShape(HudCornerCutShape(cut: 4))
    }

    private func short(_ n: String) -> String { String(n.prefix(3)).uppercased() }
}

#Preview {
    MyEntriesView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
