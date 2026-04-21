//
//  CreatePoolViewModel.swift
//  futpoolsapp
//

import Foundation
import Combine

// MARK: - Picker data models

struct PickerLeague: Decodable, Identifiable, Equatable, Hashable {
    let id: Int
    let name: String
    let logo: String?
    let country: String?
    let season: Int?
}

struct PickerTeam: Decodable, Identifiable, Equatable, Hashable {
    let id: Int
    let name: String
    let logo: String?
    let country: String?
}

enum PickerSource: Identifiable, Equatable, Hashable {
    case league(PickerLeague)
    case team(PickerTeam)

    var id: String {
        switch self {
        case .league(let l): return "L\(l.id)"
        case .team(let t): return "T\(t.id)"
        }
    }
    var displayName: String {
        switch self {
        case .league(let l): return l.name
        case .team(let t): return t.name
        }
    }
    var subtitle: String {
        switch self {
        case .league(let l): return l.country ?? "League"
        case .team(let t): return t.country ?? "Team"
        }
    }
    var logo: String? {
        switch self {
        case .league(let l): return l.logo
        case .team(let t): return t.logo
        }
    }
    var kindLabel: String {
        switch self {
        case .league: return "LEAGUE"
        case .team:   return "TEAM"
        }
    }
}

/// One fixture as returned by `/football/fixtures?teamId=X` or `?leagueId=X`.
/// Matches `mapFixturePreview` on the backend exactly.
struct PickerFixture: Decodable, Identifiable, Equatable, Hashable {
    let fixtureId: Int
    let date: String?
    let status: String?
    let league: LeagueBlock?
    let teams: TeamsBlock

    var id: Int { fixtureId }

    struct LeagueBlock: Decodable, Equatable, Hashable {
        let id: Int?
        let name: String?
        let logo: String?
    }
    struct TeamsBlock: Decodable, Equatable, Hashable {
        struct Team: Decodable, Equatable, Hashable {
            let id: Int?
            let name: String?
            let logo: String?
        }
        let home: Team
        let away: Team
    }

    var kickoffDate: Date? {
        guard let s = date else { return nil }
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFractional.date(from: s) { return d }
        let basic = ISO8601DateFormatter()
        basic.formatOptions = [.withInternetDateTime]
        if let d = basic.date(from: s) { return d }
        return basic.date(from: s.replacingOccurrences(of: "Z", with: "+00:00"))
    }

    var isUpcoming: Bool {
        guard let d = kickoffDate else { return false }
        return d > Date()
    }

    /// API-Football live statuses. A live match is still pickable for a pool —
    /// useful for demos right before/during game time.
    private static let liveStatuses: Set<String> = ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT", "SUSP"]

    var isLive: Bool {
        guard let s = status?.uppercased() else { return false }
        return Self.liveStatuses.contains(s)
    }

    /// True when the fixture is still fair game for a pool (upcoming OR live).
    var isPickable: Bool { isUpcoming || isLive }

    var kickoffLabel: String {
        guard let d = kickoffDate else { return "TBD" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale.current
        return f.string(from: d)
    }

    /// Short "APR 24" style tag for compact chips
    var kickoffShortTag: String {
        guard let d = kickoffDate else { return "TBD" }
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("MMM d")
        return f.string(from: d).uppercased()
    }
}

// MARK: - ViewModel

@MainActor
final class CreatePoolViewModel: ObservableObject {
    // Draft inputs
    @Published var draftName = ""
    @Published var draftPrizeLabel = ""
    @Published var draftVisibility = "private"  // "public" | "private"

    // Search
    @Published var searchQuery = ""
    @Published var searchResults: [PickerSource] = []
    @Published var isSearching = false
    @Published var searchError: String?

    // Selected source → fixtures preview
    @Published var selectedSource: PickerSource?
    @Published var fixturesForSource: [PickerFixture] = []
    @Published var isLoadingFixtures = false

    // Basket
    @Published var selectedFixtures: [PickerFixture] = []

    // Submission
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    private let client = APIClient.shared
    private var searchTask: Task<Void, Never>?

    var canSubmit: Bool {
        !draftName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !selectedFixtures.isEmpty
    }

    // MARK: Search (debounced)

    /// Debounces for 350ms so we don't hit the API on every keystroke.
    func onSearchQueryChange() {
        searchTask?.cancel()
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else {
            searchResults = []
            isSearching = false
            return
        }
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
            await self?.runSearch(query: q)
        }
    }

    private func runSearch(query: String) async {
        isSearching = true
        searchError = nil
        defer { isSearching = false }

        do {
            async let leaguesCall: [PickerLeague] = client.request(
                method: "GET",
                path: "/football/leagues/search?query=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
            )
            async let teamsCall: [PickerTeam] = client.request(
                method: "GET",
                path: "/football/teams/search?query=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
            )
            let (leagues, teams) = try await (leaguesCall, teamsCall)
            var combined: [PickerSource] = []
            combined.append(contentsOf: leagues.prefix(8).map { .league($0) })
            combined.append(contentsOf: teams.prefix(12).map { .team($0) })
            searchResults = combined
        } catch {
            searchError = "Search failed: \(error.localizedDescription)"
            searchResults = []
        }
    }

    // MARK: Source → fixtures

    func selectSource(_ source: PickerSource) async {
        selectedSource = source
        fixturesForSource = []
        isLoadingFixtures = true
        defer { isLoadingFixtures = false }

        let path: String
        switch source {
        case .league(let l):
            let seasonQ = l.season.map { "&season=\($0)" } ?? ""
            path = "/football/fixtures?leagueId=\(l.id)\(seasonQ)"
        case .team(let t):
            path = "/football/fixtures?teamId=\(t.id)"
        }

        do {
            fixturesForSource = try await client.request(method: "GET", path: path)
        } catch {
            errorMessage = "Could not load fixtures: \(error.localizedDescription)"
        }
    }

    func clearSelectedSource() {
        selectedSource = nil
        fixturesForSource = []
    }

    // MARK: Basket ops

    func isSelected(_ fx: PickerFixture) -> Bool {
        selectedFixtures.contains(where: { $0.fixtureId == fx.fixtureId })
    }

    func toggleFixture(_ fx: PickerFixture) {
        guard fx.isPickable else { return }  // backend accepts upcoming or live
        if let idx = selectedFixtures.firstIndex(where: { $0.fixtureId == fx.fixtureId }) {
            selectedFixtures.remove(at: idx)
        } else {
            selectedFixtures.append(fx)
        }
    }

    func removeFixture(_ fx: PickerFixture) {
        selectedFixtures.removeAll(where: { $0.fixtureId == fx.fixtureId })
    }

    // MARK: Submit

    /// Returns the created pool on success.
    func submit() async -> Quiniela? {
        errorMessage = nil
        guard let token = KeychainHelper.getToken() else {
            errorMessage = "You're not signed in."
            return nil
        }
        let picks = selectedFixtures.filter { $0.isPickable }
        guard !picks.isEmpty else {
            errorMessage = "Add at least one upcoming or live fixture"
            return nil
        }

        isSubmitting = true
        defer { isSubmitting = false }

        let body = QuinielaCreateRequest(
            name: draftName.trimmingCharacters(in: .whitespacesAndNewlines),
            description: nil,
            prizeLabel: draftPrizeLabel.trimmingCharacters(in: .whitespacesAndNewlines),
            visibility: draftVisibility,
            fixtures: picks.map { fx in
                QuinielaCreateFixture(
                    fixtureId: fx.fixtureId,
                    leagueId: fx.league?.id,
                    leagueName: fx.league?.name,
                    homeTeamId: fx.teams.home.id,
                    awayTeamId: fx.teams.away.id,
                    homeTeam: fx.teams.home.name ?? "Home",
                    awayTeam: fx.teams.away.name ?? "Away",
                    homeLogo: fx.teams.home.logo,
                    awayLogo: fx.teams.away.logo,
                    kickoff: fx.date ?? ISO8601DateFormatter().string(from: fx.kickoffDate ?? Date())
                )
            }
        )

        do {
            let pool: Quiniela = try await client.request(
                method: "POST",
                path: "/quinielas",
                body: body,
                token: token
            )
            return pool
        } catch {
            errorMessage = "Could not create pool: \(error.localizedDescription)"
            return nil
        }
    }
}
