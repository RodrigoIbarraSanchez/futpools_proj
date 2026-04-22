//
//  LiveMatchView.swift
//  futpoolsapp
//
//  Live match detail for one fixture inside a pool. Shows the scoreboard,
//  the user's pick status (leading / trailing / tied), and the match feed
//  (goals, cards, substitutions) from API-Football.
//

import SwiftUI
import Combine

// MARK: - Match feed event

struct MatchFeedEvent: Decodable, Identifiable {
    let minute: Int?
    let extra: Int?
    let team: TeamBlock?
    let player: String?
    let assist: String?
    let type: String?
    let detail: String?
    let comments: String?

    var id: String { "\(minute ?? -1)-\(type ?? "")-\(player ?? "")-\(detail ?? "")" }

    struct TeamBlock: Decodable, Equatable, Hashable {
        let id: Int?
        let name: String?
        let logo: String?
    }

    /// High-level classification for icon + color.
    enum Category {
        case goal, yellowCard, redCard, substitution, varEvent, other
    }

    var category: Category {
        let t = (type ?? "").lowercased()
        let d = (detail ?? "").lowercased()
        if t.contains("goal") { return .goal }
        if t.contains("card") && d.contains("yellow") { return .yellowCard }
        if t.contains("card") && d.contains("red")    { return .redCard }
        if t.contains("subst") { return .substitution }
        if t.contains("var")   { return .varEvent }
        return .other
    }

    var label: String {
        switch category {
        case .goal:         return "GOL"
        case .yellowCard:   return "AMONESTACIÓN"
        case .redCard:      return "EXPULSIÓN"
        case .substitution: return "CAMBIO"
        case .varEvent:     return "VAR"
        case .other:        return (type ?? "EVENT").uppercased()
        }
    }

    var minuteLabel: String {
        guard let m = minute else { return "—'" }
        if let e = extra, e > 0 { return "\(m)+\(e)'" }
        return "\(m)'"
    }
}

// MARK: - ViewModel

@MainActor
final class LiveMatchViewModel: ObservableObject {
    @Published var live: LiveFixture?
    @Published var events: [MatchFeedEvent] = []
    @Published var isLoading = false

    private let client = APIClient.shared
    private let fixtureId: Int
    private var timer: Timer?

    init(fixtureId: Int) {
        self.fixtureId = fixtureId
    }

    func start() {
        Task { await refresh() }
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { await self?.refresh() }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    func refresh() async {
        async let liveCall: [LiveFixture] = client.request(
            method: "GET",
            path: "/football/fixtures?ids=\(fixtureId)"
        )
        async let eventsCall: [MatchFeedEvent] = client.request(
            method: "GET",
            path: "/football/fixtures/\(fixtureId)/events"
        )
        do {
            let (lives, evs) = try await (liveCall, eventsCall)
            live = lives.first
            events = evs
        } catch {
            // keep previous values on network hiccup
        }
    }
}

// MARK: - View

struct LiveMatchView: View {
    /// Pool fixture context (home/away name fallback when the live feed is empty).
    let fixture: QuinielaFixture
    /// User's pick for THIS fixture, if any ("1" | "X" | "2").
    let userPick: String?

    @StateObject private var vm: LiveMatchViewModel

    init(fixture: QuinielaFixture, userPick: String? = nil) {
        self.fixture = fixture
        self.userPick = userPick
        _vm = StateObject(wrappedValue: LiveMatchViewModel(fixtureId: fixture.fixtureId))
    }

    var body: some View {
        ZStack {
            ArenaBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    scoreboard
                    if let pick = userPick, !pick.isEmpty {
                        yourPickCard(pick: pick)
                    }
                    matchFeed
                }
                .padding(.vertical, 14)
                .padding(.bottom, 40)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) { titleBar }
        }
        .onAppear { vm.start() }
        .onDisappear { vm.stop() }
    }

    /// Arena-styled nav title. "MATCH" in white, then a colored status chip
    /// that changes with the real-time state (LIVE / HT / FINAL / UPCOMING).
    /// Replaces the plain-text "[ MATCH · LIVE ]" which looked like a debug
    /// placeholder in the nav bar.
    private var titleBar: some View {
        let short = vm.live?.status.short?.uppercased() ?? ""
        let isLive = vm.live?.status.isLive == true
        let isHT = short == "HT"
        let isFinal = ["FT", "AET", "PEN"].contains(short)
        let elapsed = vm.live?.status.elapsed

        return HStack(spacing: 8) {
            Text("MATCH")
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .tracking(3)
                .foregroundColor(.arenaText)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)

            if isLive || isHT || isFinal {
                // HT takes precedence over LIVE — the API flags HT as isLive,
                // but conceptually the match is paused so we want "HALF TIME"
                // not "LIVE".
                statusChip(isLive: isLive && !isHT, isHT: isHT, isFinal: isFinal, elapsed: elapsed)
            } else {
                Text("· UPCOMING")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaAccent)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        // Let the principal toolbar slot grow to its natural width so Spanish
        // labels ("EN VIVO", "MEDIO TIEMPO") don't get ellipsized.
        .fixedSize(horizontal: true, vertical: false)
    }

    private func statusChip(isLive: Bool, isHT: Bool, isFinal: Bool, elapsed: Int?) -> some View {
        HStack(spacing: 4) {
            if isLive {
                // Minute is surfaced on the scoreboard below — here the chip
                // just needs to signal "live right now".
                Circle()
                    .fill(Color.arenaDanger)
                    .frame(width: 5, height: 5)
                    .shadow(color: .arenaDanger.opacity(0.7), radius: 3)
                Text("LIVE")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaDanger)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            } else if isHT {
                Text("HALF TIME")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaGold)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            } else if isFinal {
                Text("FINAL")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextMuted)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            HudCornerCutShape(cut: 4)
                .fill(isLive ? Color.arenaDanger.opacity(0.12)
                      : isHT ? Color.arenaGold.opacity(0.12)
                      : Color.arenaTextMuted.opacity(0.12))
        )
        .clipShape(HudCornerCutShape(cut: 4))
        // Stops SwiftUI from squeezing the chip when the Spanish locale renders
        // longer strings like "EN VIVO" / "MEDIO TIEMPO" in the principal slot.
        .fixedSize(horizontal: true, vertical: false)
    }

    // MARK: Scoreboard

    private var scoreboard: some View {
        let live = vm.live
        let homeScore = live?.score.home
        let awayScore = live?.score.away
        let statusShort = live?.status.short?.uppercased() ?? ""
        let isLive = live?.status.isLive == true
        let minute = live?.status.elapsed
        let isFinal = ["FT", "AET", "PEN"].contains(statusShort)

        return VStack(spacing: 14) {
            HStack(alignment: .center, spacing: 20) {
                teamPlate(
                    name: fixture.homeTeam,
                    logo: live?.logos?.home ?? fixture.homeLogo,
                    tint: .arenaAccent,
                    abbrev: threeLetter(fixture.homeTeam)
                )
                VStack(spacing: 6) {
                    Text(scoreText(homeScore, awayScore))
                        .font(ArenaFont.display(size: 40, weight: .black))
                        .tracking(2)
                        .foregroundColor(.arenaText)
                    statusLine(isLive: isLive, isFinal: isFinal, minute: minute, short: statusShort)
                }
                teamPlate(
                    name: fixture.awayTeam,
                    logo: live?.logos?.away ?? fixture.awayLogo,
                    tint: .arenaHot,
                    abbrev: threeLetter(fixture.awayTeam)
                )
            }
            .padding(.vertical, 18)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    HudCornerCutShape(cut: 14).fill(Color.arenaSurface)
                    pitchGrid
                }
            )
            .overlay(
                HudCornerCutShape(cut: 14).stroke(Color.arenaStroke, lineWidth: 1)
            )
            .clipShape(HudCornerCutShape(cut: 14))
        }
        .padding(.horizontal, 16)
    }

    private func teamPlate(name: String, logo: String?, tint: Color, abbrev: String) -> some View {
        VStack(spacing: 8) {
            TeamCrestArena(name: name, color: tint, size: 56, logoURL: logo)
            Text(abbrev)
                .font(ArenaFont.display(size: 13, weight: .heavy))
                .tracking(2)
                .foregroundColor(.arenaTextDim)
        }
        .frame(maxWidth: .infinity)
    }

    private func scoreText(_ home: Int?, _ away: Int?) -> String {
        let h = home.map(String.init) ?? "–"
        let a = away.map(String.init) ?? "–"
        return "\(h) - \(a)"
    }

    private func statusLine(isLive: Bool, isFinal: Bool, minute: Int?, short: String) -> some View {
        let isHT = short == "HT"
        return HStack(spacing: 6) {
            if isHT {
                // HT bubbles up to the scoreboard too — API reports elapsed = 45
                // during the break, which is misleading. Show a neutral gold dot
                // + label so the user understands the match is paused.
                Circle().fill(Color.arenaGold).frame(width: 6, height: 6)
                Text("HALF TIME")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaGold)
            } else if isLive {
                // "LIVE" is already shown in the nav title chip; down here we
                // focus on the ticking minute so both surfaces aren't repeating
                // each other.
                Circle().fill(Color.arenaDanger).frame(width: 6, height: 6)
                if let m = minute {
                    Text("\(m)'")
                        .font(ArenaFont.mono(size: 12, weight: .bold))
                        .foregroundColor(.arenaDanger)
                        .tracking(1)
                }
            } else if isFinal {
                Text("FINAL")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextMuted)
            } else if short == "NS" || short == "" {
                Text("NOT STARTED")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
            } else {
                Text(short)
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
            }
        }
    }

    /// Faint pitch grid inspired by the design — keeps the scoreboard feeling
    /// like an on-field overlay without fighting for attention.
    private var pitchGrid: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            Canvas { ctx, _ in
                var path = Path()
                // outer rect
                path.addRect(CGRect(x: 8, y: 8, width: w - 16, height: h - 16))
                // center line
                path.move(to: CGPoint(x: w / 2, y: 8))
                path.addLine(to: CGPoint(x: w / 2, y: h - 8))
                // center circle
                path.addEllipse(in: CGRect(x: w / 2 - 22, y: h / 2 - 22, width: 44, height: 44))
                ctx.stroke(path, with: .color(.arenaPrimary.opacity(0.18)), lineWidth: 1)
            }
        }
    }

    // MARK: Your pick card

    /// `pick` is "1" | "X" | "2".
    private func yourPickCard(pick: String) -> some View {
        let live = vm.live
        let home = live?.score.home
        let away = live?.score.away
        let short = live?.status.short?.uppercased() ?? ""
        let isFinal = ["FT", "AET", "PEN"].contains(short)
        let isLive = live?.status.isLive == true
        let result = liveResult(home: home, away: away)           // "1" | "X" | "2" | nil
        let isCorrect = result == pick
        let state: PickState = {
            guard let _ = result else { return .waiting }
            if isFinal && isCorrect { return .earned }
            if isFinal && !isCorrect { return .missed }
            if isCorrect { return .leading }
            return .trailing
        }()

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                pickBadge(pick: pick, state: state)
                VStack(alignment: .leading, spacing: 3) {
                    Text("YOUR PICK")
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.8)
                        .foregroundColor(.arenaTextMuted)
                    Text(pickLongLabel(pick))
                        .font(ArenaFont.display(size: 18, weight: .heavy))
                        .foregroundColor(.arenaText)
                    pickStatusLine(state: state, isLive: isLive)
                }
                Spacer()
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                HudCornerCutShape(cut: 10).fill(state.background)
            )
            .overlay(
                HudCornerCutShape(cut: 10).stroke(state.strokeColor, lineWidth: 1)
            )
            .clipShape(HudCornerCutShape(cut: 10))
        }
        .padding(.horizontal, 16)
    }

    private enum PickState {
        case waiting, leading, trailing, earned, missed

        var background: Color {
            switch self {
            case .waiting:  return Color.arenaSurface
            case .leading:  return Color.arenaPrimary.opacity(0.15)
            case .trailing: return Color.arenaSurface
            case .earned:   return Color.arenaPrimary.opacity(0.22)
            case .missed:   return Color.arenaSurface.opacity(0.6)
            }
        }
        var strokeColor: Color {
            switch self {
            case .waiting:  return .arenaStroke
            case .leading:  return .arenaPrimary
            case .trailing: return .arenaDanger.opacity(0.35)
            case .earned:   return .arenaPrimary
            case .missed:   return .arenaDanger.opacity(0.35)
            }
        }
        var badgeFill: Color {
            switch self {
            case .leading, .earned:  return .arenaPrimary
            case .trailing, .missed: return Color.arenaSurfaceAlt
            case .waiting:           return Color.arenaSurfaceAlt
            }
        }
        var badgeTextColor: Color {
            switch self {
            case .leading, .earned:  return .arenaOnPrimary
            case .trailing, .missed: return .arenaTextDim
            case .waiting:           return .arenaText
            }
        }
    }

    private func pickBadge(pick: String, state: PickState) -> some View {
        Text(pick)
            .font(ArenaFont.display(size: 30, weight: .black))
            .foregroundColor(state.badgeTextColor)
            .frame(width: 60, height: 60)
            .background(HudCornerCutShape(cut: 10).fill(state.badgeFill))
            .clipShape(HudCornerCutShape(cut: 10))
    }

    private func pickLongLabel(_ pick: String) -> String {
        switch pick {
        case "1": return "HOME WIN"
        case "X": return "DRAW"
        case "2": return "AWAY WIN"
        default:  return pick
        }
    }

    @ViewBuilder
    private func pickStatusLine(state: PickState, isLive: Bool) -> some View {
        HStack(spacing: 4) {
            switch state {
            case .waiting:
                Circle().fill(Color.arenaAccent).frame(width: 5, height: 5)
                Text("WAITING FOR KICKOFF")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaAccent)
                    .tracking(1.2)
            case .leading:
                Circle().fill(Color.arenaPrimary).frame(width: 5, height: 5)
                Text("LEADING · +1 PT IF IT HOLDS")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaPrimary)
                    .tracking(1.2)
            case .trailing:
                Circle().fill(Color.arenaDanger).frame(width: 5, height: 5)
                Text(isLive ? "TRAILING · 0 PTS IF IT HOLDS" : "TRAILING")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaDanger)
                    .tracking(1.2)
            case .earned:
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 11))
                    .foregroundColor(.arenaPrimary)
                Text("EARNED · +1 PT")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaPrimary)
                    .tracking(1.2)
            case .missed:
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 11))
                    .foregroundColor(.arenaDanger)
                Text("MISSED · 0 PTS")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaDanger)
                    .tracking(1.2)
            }
        }
    }

    /// Compute "1", "X", "2" from the current score.
    private func liveResult(home: Int?, away: Int?) -> String? {
        guard let h = home, let a = away else { return nil }
        if h > a { return "1" }
        if h < a { return "2" }
        return "X"
    }

    // MARK: Match feed

    private var matchFeed: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("◆ MATCH FEED")
                .font(ArenaFont.display(size: 11, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaPrimary)
                .padding(.horizontal, 16)

            if vm.events.isEmpty {
                Text("No events yet — check back as the match progresses.")
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextDim)
                    .padding(.horizontal, 16)
            } else {
                VStack(spacing: 6) {
                    ForEach(vm.events) { ev in
                        eventRow(ev)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private func eventRow(_ ev: MatchFeedEvent) -> some View {
        let color: Color = {
            switch ev.category {
            case .goal:         return .arenaPrimary
            case .yellowCard:   return .arenaGold
            case .redCard:      return .arenaDanger
            case .substitution: return .arenaAccent
            case .varEvent:     return .arenaHot
            case .other:        return .arenaTextDim
            }
        }()
        return HStack(spacing: 10) {
            Text(ev.minuteLabel)
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(.arenaTextDim)
                .frame(width: 36, alignment: .leading)
            eventIcon(category: ev.category, color: color)
                .frame(width: 22, alignment: .center)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(ev.label)
                    .font(ArenaFont.display(size: 11, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(color)
                Text("·")
                    .foregroundColor(.arenaTextDim)
                Text(ev.player ?? "—")
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaText)
                    .lineLimit(1)
            }
            Spacer()
            // Team crest at the trailing edge — users were guessing which team
            // each sub/card/goal belonged to. 20pt logo is big enough to read
            // at a glance without eating layout.
            if let team = ev.team {
                teamCrestTag(team)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(Color.arenaSurface)
        .overlay(
            Rectangle()
                .fill(color.opacity(0.8))
                .frame(width: 3)
                .frame(maxWidth: .infinity, alignment: .leading)
        )
    }

    /// Team crest + 3-letter abbreviation for a match-feed event. Prefers the
    /// remote logo URL; falls back to the abbreviation tag if the logo fails
    /// or is missing (e.g. minor leagues where API-Football lacks crests).
    @ViewBuilder
    private func teamCrestTag(_ team: MatchFeedEvent.TeamBlock) -> some View {
        HStack(spacing: 4) {
            if let urlString = team.logo, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().aspectRatio(contentMode: .fit)
                    default:
                        Color.clear
                    }
                }
                .frame(width: 20, height: 20)
            }
            if let name = team.name, !name.isEmpty {
                Text(threeLetter(name))
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1)
                    .foregroundColor(.arenaTextMuted)
            }
        }
    }

    @ViewBuilder
    private func eventIcon(category: MatchFeedEvent.Category, color: Color) -> some View {
        switch category {
        case .goal:
            Image(systemName: "soccerball")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(color)
        case .yellowCard:
            RoundedRectangle(cornerRadius: 2).fill(Color.arenaGold).frame(width: 11, height: 14)
        case .redCard:
            RoundedRectangle(cornerRadius: 2).fill(Color.arenaDanger).frame(width: 11, height: 14)
        case .substitution:
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(color)
        case .varEvent:
            Text("VAR")
                .font(ArenaFont.mono(size: 8, weight: .bold))
                .foregroundColor(color)
        case .other:
            Circle().fill(color).frame(width: 6, height: 6)
        }
    }

    // MARK: Helpers

    /// 3-letter abbreviation for a team name (e.g. "Real Madrid" → "REA").
    private func threeLetter(_ s: String) -> String {
        let parts = s.split(separator: " ")
        if parts.count >= 2 {
            return String((parts[0].prefix(1) + parts[1].prefix(1) + (parts.count > 2 ? parts[2].prefix(1) : parts[1].dropFirst().prefix(1))))
                .uppercased()
        }
        return String(s.prefix(3)).uppercased()
    }
}
