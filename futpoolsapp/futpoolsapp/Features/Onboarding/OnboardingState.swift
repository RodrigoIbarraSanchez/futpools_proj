//
//  OnboardingState.swift
//  futpoolsapp
//
//  Single source of truth for the 11-screen skill-driven onboarding.
//  All user inputs (goal, pain selections, league preferences, demo
//  picks) live here and persist to UserDefaults so the post-signup
//  experience can use them (e.g. populate Home with the leagues they
//  picked, prefill the first Quiniela create).
//

import Foundation
import Combine
import SwiftUI

// MARK: - Goal (screen 2)

enum OnboardingGoalChoice: String, CaseIterable, Identifiable, Codable {
    case withFriends, realPrizes, oneVOne, predictRank, justBrowsing
    var id: String { rawValue }
    var emoji: String {
        switch self {
        case .withFriends:   return "👥"
        case .realPrizes:    return "🏆"
        case .oneVOne:       return "⚔"
        case .predictRank:   return "📈"
        case .justBrowsing:  return "🤔"
        }
    }
    var label: String {
        switch self {
        case .withFriends:   return L("Play pools with my friends")
        case .realPrizes:    return L("Win real prizes for free")
        case .oneVOne:       return L("Challenge anyone 1v1")
        case .predictRank:   return L("Predict solo and rank up")
        case .justBrowsing:  return L("Just looking around")
        }
    }
}

// MARK: - Pain points (screen 3, multi-select)

enum OnboardingPain: String, CaseIterable, Identifiable, Codable {
    case manualScoring, friendsDontPay, smallPrizes, excelChaos, missedDeadlines, honorOnly
    var id: String { rawValue }
    var emoji: String {
        switch self {
        case .manualScoring:    return "📊"
        case .friendsDontPay:   return "💸"
        case .smallPrizes:      return "🥱"
        case .excelChaos:       return "📱"
        case .missedDeadlines:  return "⏰"
        case .honorOnly:        return "🤷"
        }
    }
    var label: String {
        switch self {
        case .manualScoring:    return L("Tracking points by hand")
        case .friendsDontPay:   return L("Half my group never pays")
        case .smallPrizes:      return L("Tiny prizes that aren't worth it")
        case .excelChaos:       return L("Excel + WhatsApp is chaos")
        case .missedDeadlines:  return L("Nobody respects pick deadlines")
        case .honorOnly:        return L("Just honor, nothing tangible")
        }
    }
    /// The "solution" copy shown back on the Personalised Solution screen.
    var solution: (emoji: String, headline: String) {
        switch self {
        case .manualScoring:
            return ("⚡", L("Live automatic scoring — every goal moves your score instantly"))
        case .friendsDontPay:
            return ("🎁", L("Nobody pays anything — the prize is funded by ads"))
        case .smallPrizes:
            return ("🏆", L("Amazon $250 MXN gift cards every week"))
        case .excelChaos:
            return ("🚀", L("Build a pool in under 30 seconds, share by link"))
        case .missedDeadlines:
            return ("🔒", L("Picks lock automatically at the first kickoff"))
        case .honorOnly:
            return ("💰", L("Tangible prize guaranteed for the winner"))
        }
    }
}

// MARK: - Tinder swipe (screen 5)

enum OnboardingTinderResponse: String, Codable { case agree, dismiss, skipped }

// MARK: - League preference (screen 7)

enum OnboardingLeague: String, CaseIterable, Identifiable, Codable {
    case ligaMX, champions, laLiga, premier, worldCup, mls
    var id: String { rawValue }
    var label: String {
        switch self {
        case .ligaMX:    return "🇲🇽 Liga MX"
        case .champions: return "⚽ Champions League"
        case .laLiga:    return "🇪🇸 LaLiga"
        case .premier:   return "🇬🇧 Premier League"
        case .worldCup:  return "🏆 Mundial"
        case .mls:       return "🇺🇸 MLS"
        }
    }
    /// API-Football league IDs used by the public fixtures endpoint.
    /// Mundial returns no upcoming fixtures outside cycle, so we
    /// substitute Champions for the demo when only `worldCup` is
    /// selected — keeps the demo from showing an empty state.
    var apiFootballID: Int {
        switch self {
        case .ligaMX:    return 262
        case .champions: return 2
        case .laLiga:    return 140
        case .premier:   return 39
        case .worldCup:  return 1   // FIFA World Cup id
        case .mls:       return 253
        }
    }

    /// Public CDN URL for the league logo from api-sports' media bucket.
    /// Same source as team crests; PNG with transparent background.
    var logoURL: URL? {
        URL(string: "https://media.api-sports.io/football/leagues/\(apiFootballID).png")
    }
}

// MARK: - Team preference (screen 7, alongside leagues)

/// Popular teams shown on the prefs screen alongside leagues. The list is
/// hand-curated for Mexico-first audience: 6 Liga MX + 8 European powerhouses
/// covers the bulk of likely fandoms without overwhelming the grid. New
/// teams can be added without touching the screen — the grid is data-driven.
enum OnbTeam: String, CaseIterable, Identifiable, Codable {
    // Top 9 globally popular clubs — ordered by global popularity so the
    // grid surfaces the most recognized ones first. Liga MX teams are
    // covered indirectly via the Liga MX league chip; if we ever need a
    // dedicated regional row we can add it as a separate section.
    case realMadrid, barcelona, manUnited, psg, manCity, liverpool, bayern, juventus, chelsea

    var id: String { rawValue }

    var label: String {
        switch self {
        case .realMadrid: return "Real Madrid"
        case .barcelona:  return "Barcelona"
        case .manUnited:  return "Manchester United"
        case .psg:        return "PSG"
        case .manCity:    return "Manchester City"
        case .liverpool:  return "Liverpool"
        case .bayern:     return "Bayern Munich"
        case .juventus:   return "Juventus"
        case .chelsea:    return "Chelsea"
        }
    }

    /// API-Football team IDs. These are the same IDs the public fixtures
    /// endpoint uses, so a logo fetched via this id matches the crest the
    /// rest of the app shows. If a logo 404s on the CDN, double-check the
    /// id at https://www.api-football.com/documentation-v3#tag/Teams.
    var apiFootballID: Int {
        switch self {
        case .realMadrid: return 541
        case .barcelona:  return 529
        case .manUnited:  return 33
        case .psg:        return 85
        case .manCity:    return 50
        case .liverpool:  return 40
        case .bayern:     return 157
        case .juventus:   return 496
        case .chelsea:    return 49
        }
    }

    /// Public CDN URL for the team crest. No auth needed — the assets
    /// live on api-sports' media bucket and are served directly. PNG with
    /// transparent background, ~150x150 typical, sometimes larger.
    var logoURL: URL? {
        URL(string: "https://media.api-sports.io/football/teams/\(apiFootballID).png")
    }
}

// MARK: - Pick (screen 9)

struct OnboardingDemoPick: Codable, Identifiable {
    let fixtureId: Int
    let pick: String   // "1" | "X" | "2"
    var id: Int { fixtureId }
}

// MARK: - State

@MainActor
final class OnboardingState: ObservableObject {
    /// The 11 ordered steps. Welcome..AccountGate.
    enum Step: Int, CaseIterable {
        case welcome, goal, pain, social, tinder, solution, prefs, processing, demo, value, gate

        var progress: Double {
            Double(rawValue + 1) / Double(Step.allCases.count)
        }
    }

    @Published var step: Step = .welcome
    @Published var goals: Set<OnboardingGoalChoice> = []
    @Published var pains: Set<OnboardingPain> = []
    @Published var swipes: [OnboardingTinderResponse] = []
    @Published var leagues: Set<OnboardingLeague> = [.ligaMX]
    @Published var teams: Set<OnbTeam> = []
    /// Teams selected from API search results — keyed by API-Football
    /// team id. Stored as a dict so the lookup keeps the picker
    /// metadata (name, logo, country) needed to render a chip without
    /// re-hitting the API. Persists to UserDefaults as the bare IDs and
    /// ships up to the backend prefixed with "api:".
    @Published var customTeams: [Int: PickerTeam] = [:]
    @Published var customLeagues: [Int: PickerLeague] = [:]
    @Published var demoPicks: [OnboardingDemoPick] = []

    func advance() {
        if let next = Step(rawValue: step.rawValue + 1) {
            withAnimation(.easeInOut(duration: 0.25)) { step = next }
        }
    }

    func back() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            withAnimation(.easeInOut(duration: 0.25)) { step = prev }
        }
    }

    /// Persist the captured state so post-signup screens can use it
    /// (e.g. preselect leagues on Home, prefill the first Pool create
    /// with the demo picks).
    func persist() {
        let d = UserDefaults.standard
        d.set(true, forKey: "hasSeenOnboarding")
        d.set(goals.map(\.rawValue), forKey: "onboardingGoals")
        d.set(pains.map(\.rawValue), forKey: "onboardingPains")
        d.set(leagues.map(\.rawValue), forKey: "onboardingLeagues")
        d.set(teams.map(\.rawValue), forKey: "onboardingTeams")
        d.set(Array(customTeams.keys), forKey: "onboardingCustomTeamIDs")
        d.set(Array(customLeagues.keys), forKey: "onboardingCustomLeagueIDs")
        if let data = try? JSONEncoder().encode(demoPicks) {
            d.set(data, forKey: "onboardingDemoPicks")
        }
        d.synchronize()
    }
}

