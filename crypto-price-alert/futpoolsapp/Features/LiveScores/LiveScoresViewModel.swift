//
//  LiveScoresViewModel.swift
//  futpoolsapp
//
//  Drives the simple_version SCORES tab. Reads the user's favorite
//  leagues + teams from onboarding state (UserDefaults) and aggregates
//  fixtures via the new /football/fixtures/feed endpoint, then groups
//  them by league for display.
//
//  Polling cadence (30s) matches the backend cache TTL so back-to-back
//  refreshes hit the cache and avoid burning api-football quota.
//

import Foundation
import Combine

@MainActor
final class LiveScoresViewModel: ObservableObject {
    enum Tab: String, CaseIterable, Identifiable {
        // Order is the order they appear in the tab strip — LIVE first
        // matches user expectation (Scorespot-style "what's playing
        // right now").
        case live, today, tomorrow, favorites
        var id: String { rawValue }
        var label: String {
            switch self {
            case .live:      return String(localized: "LIVE")
            case .today:     return String(localized: "TODAY")
            case .tomorrow:  return String(localized: "TOMORROW")
            case .favorites: return String(localized: "FAVORITES")
            }
        }
    }

    @Published var fixtures: [FeedFixture] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedTab: Tab = .live

    /// User's currently-active pool entries (joined via web; iOS just
    /// surfaces them). Loaded once per appear, not polled — pool state
    /// changes slowly relative to live scores.
    @Published var activePools: [QuinielaEntry] = []

    private let client = APIClient.shared
    private var pollTask: Task<Void, Never>?
    private var lastFetchKey: String?

    /// Switches the visible tab. Each tab implies a different fetch
    /// (live-all vs date+favorites vs date+favorites for tomorrow), so
    /// switching always triggers a load.
    func selectTab(_ tab: Tab) {
        guard tab != selectedTab else { return }
        selectedTab = tab
        load()
    }

    /// Fetch the feed for whichever shape the current tab implies.
    func load() {
        let key = makeFetchKey()
        guard key != lastFetchKey || fixtures.isEmpty else { return }
        lastFetchKey = key
        Task { await refresh() }
    }

    func startPolling() {
        stopPolling()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if Task.isCancelled { break }
                await self?.refresh(silent: true)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    /// Load pools the user is entered in and that are STILL ACTIVE —
    /// any fixture is currently live OR any fixture is still upcoming.
    /// The previous filter was too permissive (`status != "FT"` matched
    /// fixtures with empty status, leaving finished pools in the banner
    /// indefinitely). Live pools sort to the top of the carousel.
    func loadActivePools() {
        Task {
            guard let token = KeychainHelper.getToken() else { return }
            do {
                let entries: [QuinielaEntry] = try await client.request(
                    method: "GET",
                    path: "/quinielas/entries/me",
                    token: token
                )
                let now = Date()
                let liveCodes: Set<String> = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]

                func isFixtureLive(_ fx: QuinielaFixture) -> Bool {
                    liveCodes.contains((fx.status ?? "").uppercased())
                }
                func isFixtureUpcoming(_ fx: QuinielaFixture) -> Bool {
                    guard let date = fx.kickoffDate else { return false }
                    return date > now
                }
                func poolIsActive(_ entry: QuinielaEntry) -> Bool {
                    let fixtures = entry.quiniela.fixtures
                    guard !fixtures.isEmpty else { return false }
                    return fixtures.contains { isFixtureLive($0) || isFixtureUpcoming($0) }
                }
                func poolIsLive(_ entry: QuinielaEntry) -> Bool {
                    entry.quiniela.fixtures.contains { isFixtureLive($0) }
                }

                activePools = entries
                    .filter(poolIsActive)
                    .sorted { (a, b) in
                        // Live pools first, then upcoming sorted by
                        // earliest kickoff. Pure startDate sort would
                        // bury a live pool whose other fixtures are
                        // older than another pool's first fixture.
                        let aLive = poolIsLive(a)
                        let bLive = poolIsLive(b)
                        if aLive != bLive { return aLive && !bLive }
                        let ad = a.quiniela.startDateValue ?? .distantFuture
                        let bd = b.quiniela.startDateValue ?? .distantFuture
                        return ad < bd
                    }
            } catch {
                // Silent — banner just stays empty. Auth failures are
                // handled by the existing AuthService.
            }
        }
    }

    /// Visible fixtures after the current tab's filter is applied.
    var visibleFixtures: [FeedFixture] {
        switch selectedTab {
        case .live, .today, .tomorrow:
            return fixtures
        case .favorites:
            // The feed already includes favorite teams' fixtures (we
            // pass them as the `teams` query param). For the FAVORITES
            // tab we additionally filter to fixtures where one of the
            // teams is in the user's favorite team set, since the
            // league-derived fixtures may include matches between
            // non-favorite teams.
            let favoriteTeamIDs = Self.favoriteTeamIDs()
            guard !favoriteTeamIDs.isEmpty else { return [] }
            return fixtures.filter {
                let h = $0.teams.home.id ?? -1
                let a = $0.teams.away.id ?? -1
                return favoriteTeamIDs.contains(h) || favoriteTeamIDs.contains(a)
            }
        }
    }

    /// Visible fixtures grouped by league, leagues ordered by earliest
    /// kickoff. Drives the section headers in the list.
    var groupedByLeague: [LeagueGroup] {
        let groups = Dictionary(grouping: visibleFixtures, by: { $0.league.id ?? -1 })
        return groups.map { (lid, fixtures) -> LeagueGroup in
            let sorted = fixtures.sorted { (a, b) in
                let ad = a.kickoffDate ?? .distantFuture
                let bd = b.kickoffDate ?? .distantFuture
                return ad < bd
            }
            let first = sorted.first
            return LeagueGroup(
                leagueId: lid,
                name: first?.league.name ?? String(localized: "FOOTBALL"),
                logoURL: first?.league.logo.flatMap(URL.init(string:)),
                fixtures: sorted
            )
        }.sorted { (a, b) -> Bool in
            // Sort leagues by earliest fixture kickoff. Pure alpha would
            // be inconsistent with the live-first sort inside each group.
            let ad = a.fixtures.first?.kickoffDate ?? .distantFuture
            let bd = b.fixtures.first?.kickoffDate ?? .distantFuture
            return ad < bd
        }
    }

    // MARK: - Private

    private func makeFetchKey() -> String {
        if selectedTab == .live { return "LIVE_ALL" }
        let date = isoDate(for: dateForCurrentTab())
        let leagues = Self.favoriteLeagueIDs().sorted().map(String.init).joined(separator: ",")
        let teams = Self.favoriteTeamIDs().sorted().map(String.init).joined(separator: ",")
        return "\(date)|L:\(leagues)|T:\(teams)"
    }

    private func dateForCurrentTab() -> Date {
        switch selectedTab {
        case .tomorrow:
            return Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        case .live, .today, .favorites:
            return Date()
        }
    }

    private func isoDate(for date: Date) -> String {
        // Backend expects YYYY-MM-DD; api-football treats dates as UTC.
        // Using ISO8601DateFormatter with `.withFullDate` returns local
        // calendar date, which matches what the user sees on their phone.
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .iso8601)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func refresh(silent: Bool = false) async {
        if !silent { isLoading = true }
        defer { isLoading = false }

        // LIVE tab: globally-live mode — ignore favorites, hit
        // /fixtures/feed?live=true. Users want to see all live football,
        // not just intersection of their followings.
        if selectedTab == .live {
            do {
                let payload: [FeedFixture] = try await client.request(
                    method: "GET",
                    path: "/football/fixtures/feed?live=true"
                )
                fixtures = payload
                errorMessage = nil
            } catch {
                if !silent { errorMessage = error.localizedDescription }
            }
            return
        }

        let leagueIDs = Self.favoriteLeagueIDs()
        let teamIDs = Self.favoriteTeamIDs()
        // No favorites at all → empty state for non-LIVE tabs. Avoids
        // hitting the backend with a guaranteed-empty query.
        guard !leagueIDs.isEmpty || !teamIDs.isEmpty else {
            fixtures = []
            return
        }

        let date = isoDate(for: dateForCurrentTab())
        let leagues = leagueIDs.map(String.init).joined(separator: ",")
        let teams = teamIDs.map(String.init).joined(separator: ",")
        let path = "/football/fixtures/feed?date=\(date)&leagues=\(leagues)&teams=\(teams)"

        do {
            let payload: [FeedFixture] = try await client.request(method: "GET", path: path)
            fixtures = payload
            errorMessage = nil
        } catch {
            if !silent {
                errorMessage = error.localizedDescription
            }
            // Silent failures keep the previous payload so a flaky
            // network doesn't blank the UI.
        }
    }

    // MARK: - Onboarding-derived favorites

    /// API-Football league IDs the user picked during onboarding. Combines
    /// the OnboardingLeague enum (popular leagues) with custom IDs added
    /// via the API search picker (stored separately in UserDefaults).
    static func favoriteLeagueIDs() -> [Int] {
        let d = UserDefaults.standard
        let popularRaws = d.stringArray(forKey: "onboardingLeagues") ?? []
        let popularIDs = popularRaws.compactMap { OnboardingLeague(rawValue: $0)?.apiFootballID }
        let customIDs = (d.array(forKey: "onboardingCustomLeagueIDs") as? [Int]) ?? []
        return Array(Set(popularIDs + customIDs))
    }

    /// API-Football team IDs the user picked during onboarding. Same dual
    /// source as leagues — popular OnbTeam enum + custom search picks.
    static func favoriteTeamIDs() -> [Int] {
        let d = UserDefaults.standard
        let popularRaws = d.stringArray(forKey: "onboardingTeams") ?? []
        let popularIDs = popularRaws.compactMap { OnbTeam(rawValue: $0)?.apiFootballID }
        let customIDs = (d.array(forKey: "onboardingCustomTeamIDs") as? [Int]) ?? []
        return Array(Set(popularIDs + customIDs))
    }
}

// MARK: - Models matching the backend feed payload

/// Mirrors the JSON returned by GET /football/fixtures/feed. Distinct
/// from `LiveFixture` (which lacks team names) and from `LiveMatch`
/// (which uses string `matchId` and `scheduledAt` keys); the feed
/// endpoint returns the full `mapFixturePreview` shape with goals.
struct FeedFixture: Decodable, Identifiable, Hashable {
    let fixtureId: Int
    let date: String?
    let status: String?
    let elapsed: Int?
    let goals: FeedScore
    let league: FeedLeague
    let teams: FeedTeams

    var id: Int { fixtureId }

    var kickoffDate: Date? {
        guard let s = date else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        let f2 = ISO8601DateFormatter()
        f2.formatOptions = [.withInternetDateTime]
        return f2.date(from: s)
    }

    /// API-Football "live" status codes — all the in-progress states.
    var isLive: Bool {
        let liveCodes: Set<String> = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]
        return liveCodes.contains((status ?? "").uppercased())
    }

    /// Final / abandoned states — match has concluded.
    var isFinished: Bool {
        let doneCodes: Set<String> = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]
        return doneCodes.contains((status ?? "").uppercased())
    }

    /// Adapter so the SCORES tab can push the existing LiveMatchView,
    /// which was built for a pool-fixture context (and thus expects a
    /// `QuinielaFixture` with team names baked in). Mapping is loss-less
    /// for everything LiveMatchView reads.
    func toQuinielaFixture() -> QuinielaFixture {
        QuinielaFixture(
            fixtureId: fixtureId,
            leagueId: league.id,
            leagueName: league.name,
            homeTeamId: teams.home.id,
            awayTeamId: teams.away.id,
            homeTeam: teams.home.name ?? "—",
            awayTeam: teams.away.name ?? "—",
            homeLogo: teams.home.logo,
            awayLogo: teams.away.logo,
            kickoff: date ?? "",
            status: status
        )
    }
}

struct FeedScore: Decodable, Hashable {
    let home: Int?
    let away: Int?
}

struct FeedLeague: Decodable, Hashable {
    let id: Int?
    let name: String?
    let logo: String?
}

struct FeedTeams: Decodable, Hashable {
    let home: FeedTeam
    let away: FeedTeam
}

struct FeedTeam: Decodable, Hashable {
    let id: Int?
    let name: String?
    let logo: String?
}

/// Display-only grouping over FeedFixtures by league. The view renders
/// one section per group with the league badge as header.
struct LeagueGroup: Identifiable {
    let leagueId: Int
    let name: String
    let logoURL: URL?
    let fixtures: [FeedFixture]
    var id: Int { leagueId }
}
