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
        case .withFriends:   return String(localized: "Play pools with my friends")
        case .realPrizes:    return String(localized: "Win real prizes for free")
        case .oneVOne:       return String(localized: "Challenge anyone 1v1")
        case .predictRank:   return String(localized: "Predict solo and rank up")
        case .justBrowsing:  return String(localized: "Just looking around")
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
        case .manualScoring:    return String(localized: "Tracking points by hand")
        case .friendsDontPay:   return String(localized: "Half my group never pays")
        case .smallPrizes:      return String(localized: "Tiny prizes that aren't worth it")
        case .excelChaos:       return String(localized: "Excel + WhatsApp is chaos")
        case .missedDeadlines:  return String(localized: "Nobody respects pick deadlines")
        case .honorOnly:        return String(localized: "Just honor, nothing tangible")
        }
    }
    /// The "solution" copy shown back on the Personalised Solution screen.
    var solution: (emoji: String, headline: String) {
        switch self {
        case .manualScoring:
            return ("⚡", String(localized: "Live automatic scoring — every goal moves your score instantly"))
        case .friendsDontPay:
            return ("🎁", String(localized: "Nobody pays anything — the prize is funded by ads"))
        case .smallPrizes:
            return ("🏆", String(localized: "Amazon $250 MXN gift cards every week"))
        case .excelChaos:
            return ("🚀", String(localized: "Build a pool in under 30 seconds, share by link"))
        case .missedDeadlines:
            return ("🔒", String(localized: "Picks lock automatically at the first kickoff"))
        case .honorOnly:
            return ("💰", String(localized: "Tangible prize guaranteed for the winner"))
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
    @Published var demoPicks: [OnboardingDemoPick] = []

    func advance() {
        if let next = Step(rawValue: step.rawValue + 1) {
            withAnimation(.easeInOut(duration: 0.25)) { step = next }
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
        if let data = try? JSONEncoder().encode(demoPicks) {
            d.set(data, forKey: "onboardingDemoPicks")
        }
        d.synchronize()
    }
}

