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

    /// Entry-edit is allowed only while the pool is still scheduled — every
    /// fixture must be in the future AND none can be mid-match. Mirrors the
    /// backend's `computePoolStatus === 'scheduled'` gate.
    private var isScheduled: Bool {
        if let end = group.quiniela.endDateValue, end < Date() { return false }
        let now = Date()
        for fx in group.quiniela.fixtures {
            if let date = fx.kickoffDate, date <= now { return false }
            let short = (liveFixtures[fx.fixtureId]?.status.short ?? "").uppercased()
            if !short.isEmpty && short != "NS" { return false }
        }
        return !group.quiniela.fixtures.isEmpty
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
                            EntryDetailArena(
                                entry: entry,
                                fallback: idx + 1,
                                liveFixtures: liveFixtures,
                                isScheduled: isScheduled
                            )
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
    let isScheduled: Bool

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
                if isScheduled {
                    NavigationLink {
                        QuinielaPickView(quiniela: entry.quiniela, entryToEdit: entry)
                    } label: {
                        Text("✎ EDIT")
                            .font(ArenaFont.mono(size: 9, weight: .bold))
                            .tracking(1.5)
                            .foregroundColor(.arenaAccent)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .overlay(
                                RoundedRectangle(cornerRadius: 3)
                                    .stroke(Color.arenaAccent.opacity(0.45), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                if let d = entry.createdAtValue {
                    Text(shortDate(d))
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextMuted)
                }
            }

            VStack(spacing: 6) {
                ForEach(entry.quiniela.fixtures, id: \.fixtureId) { fx in
                    let pick = entry.picks.first { $0.fixtureId == fx.fixtureId }?.pick
                    PickRow(fixture: fx, pick: pick, live: liveFixtures[fx.fixtureId])
                }
            }
        }
    }

    private func shortDate(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "d MMM HH:mm"
        return f.string(from: d)
    }
}

// MARK: - Pick row

/// Full-width row per pick: match teams, live score, and the user's pick
/// called out with a state-aware badge (pending / leading / trailing / won / lost).
/// Replaces the old cryptic "CLU 2 CRU" chips which were unreadable.
private struct PickRow: View {
    let fixture: QuinielaFixture
    let pick: String?               // "1" | "X" | "2" | nil (no pick)
    let live: LiveFixture?

    /// Current result from the live feed, if scores are published.
    private var liveResult: String? {
        guard let h = live?.score.home, let a = live?.score.away else { return nil }
        if h > a { return "1" }
        if h < a { return "2" }
        return "X"
    }

    private var isLive: Bool  { live?.status.isLive == true }
    private var isFinal: Bool { ["FT","AET","PEN"].contains(live?.status.short?.uppercased() ?? "") }

    private enum PickState { case missing, pending, leading, trailing, won, lost }

    private var state: PickState {
        guard let pick, !pick.isEmpty, pick != "-" else { return .missing }
        guard let result = liveResult else { return .pending }
        if isFinal { return pick == result ? .won : .lost }
        return pick == result ? .leading : .trailing
    }

    var body: some View {
        VStack(spacing: 8) {
            teamsRow
            pickRow
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurfaceAlt))
        .overlay(
            // Left accent bar reflecting the pick's current state — gives a
            // quick scan down the list to see which picks are winning/losing.
            Rectangle()
                .fill(accentColor)
                .frame(width: 3)
                .frame(maxWidth: .infinity, alignment: .leading)
        )
        .clipShape(HudCornerCutShape(cut: 6))
    }

    // Row 1 — home crest · name · score · name · away crest

    private var teamsRow: some View {
        HStack(spacing: 10) {
            TeamCrestArena(name: fixture.homeTeam, color: .arenaAccent, size: 24, logoURL: fixture.homeLogo)
            Text(fixture.homeTeam)
                .font(ArenaFont.display(size: 12, weight: pick == "1" ? .heavy : .regular))
                .foregroundColor(pick == "1" ? .arenaText : .arenaTextDim)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            scoreBlock
            Spacer(minLength: 4)
            Text(fixture.awayTeam)
                .font(ArenaFont.display(size: 12, weight: pick == "2" ? .heavy : .regular))
                .foregroundColor(pick == "2" ? .arenaText : .arenaTextDim)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .multilineTextAlignment(.trailing)
            TeamCrestArena(name: fixture.awayTeam, color: .arenaHot, size: 24, logoURL: fixture.awayLogo)
        }
    }

    @ViewBuilder
    private var scoreBlock: some View {
        if let h = live?.score.home, let a = live?.score.away {
            HStack(spacing: 4) {
                Text("\(h)")
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                    .foregroundColor(.arenaText)
                Text("-")
                    .font(ArenaFont.display(size: 14, weight: .bold))
                    .foregroundColor(.arenaTextDim)
                Text("\(a)")
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                    .foregroundColor(.arenaText)
            }
        } else {
            Text("vs")
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
        }
    }

    // Row 2 — pick callout + status badge

    private var pickRow: some View {
        HStack(spacing: 8) {
            // Pick badge — the letter they picked, coloured by current state
            ZStack {
                HudCornerCutShape(cut: 4).fill(badgeBackground)
                Text(displayPick)
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .foregroundColor(badgeForeground)
            }
            .frame(width: 28, height: 24)

            Text(pickLabel)
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .tracking(1)
                .foregroundColor(.arenaTextMuted)

            Spacer()

            statusBadge
        }
    }

    private var displayPick: String {
        switch pick {
        case "1": return "1"
        case "X": return "X"
        case "2": return "2"
        default:  return "—"
        }
    }

    private var pickLabel: String {
        switch pick {
        case "1": return "YOUR PICK · HOME"
        case "X": return "YOUR PICK · DRAW"
        case "2": return "YOUR PICK · AWAY"
        default:  return "NO PICK"
        }
    }

    private var badgeBackground: Color {
        switch state {
        case .missing:  return Color.arenaBg2
        case .pending:  return Color.arenaAccent.opacity(0.18)
        case .leading, .won:  return Color.arenaPrimary.opacity(0.22)
        case .trailing, .lost: return Color.arenaDanger.opacity(0.18)
        }
    }

    private var badgeForeground: Color {
        switch state {
        case .missing:  return .arenaTextDim
        case .pending:  return .arenaAccent
        case .leading, .won:  return .arenaPrimary
        case .trailing, .lost: return .arenaDanger
        }
    }

    private var accentColor: Color {
        switch state {
        case .missing:  return .arenaStroke
        case .pending:  return .arenaAccent.opacity(0.5)
        case .leading, .won: return .arenaPrimary
        case .trailing, .lost: return .arenaDanger.opacity(0.7)
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch state {
        case .missing:
            Text("NO PICK")
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.arenaTextDim)
        case .pending:
            HStack(spacing: 4) {
                if isLive, let m = live?.status.elapsed {
                    Circle().fill(Color.arenaDanger).frame(width: 5, height: 5)
                    Text("LIVE \(m)'")
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.2)
                        .foregroundColor(.arenaDanger)
                } else {
                    Text("PENDING")
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.2)
                        .foregroundColor(.arenaAccent)
                }
            }
        case .leading:
            HStack(spacing: 3) {
                Circle().fill(Color.arenaPrimary).frame(width: 5, height: 5)
                Text("LEADING")
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(.arenaPrimary)
            }
        case .trailing:
            HStack(spacing: 3) {
                Circle().fill(Color.arenaDanger).frame(width: 5, height: 5)
                Text("TRAILING")
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(.arenaDanger)
            }
        case .won:
            HStack(spacing: 3) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.arenaPrimary)
                Text("+1 PT")
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(.arenaPrimary)
            }
        case .lost:
            HStack(spacing: 3) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.arenaDanger)
                Text("MISSED")
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(.arenaDanger)
            }
        }
    }
}

#Preview {
    MyEntriesView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
