//
//  DailyPick.swift
//  futpoolsapp
//
//  Mirrors the backend's GET /daily-pick/today response.
//

import Foundation

struct DailyPickFixture: Codable, Equatable {
    let fixtureId: Int
    let leagueId: Int?
    let leagueName: String?
    let homeTeam: String
    let awayTeam: String
    let homeLogo: String?
    let awayLogo: String?
    /// ISO-8601 — parse via DateParser.parse().
    let kickoff: String

    var kickoffDate: Date? { DateParser.parse(kickoff) }
    var hasStarted: Bool {
        guard let d = kickoffDate else { return false }
        return d <= Date()
    }
}

struct DailyPick: Codable, Identifiable {
    let id: String
    let date: String          // YYYY-MM-DD
    let fixture: DailyPickFixture
    let finalResult: String?  // '1' | 'X' | '2' | nil if not settled
    let settledAt: String?

    var isSettled: Bool { finalResult != nil }
}

struct DailyPickPrediction: Codable, Identifiable {
    let id: String
    let pick: String         // '1' | 'X' | '2'
    let submittedAt: String?
    let immediateAwarded: Bool
    let bonusAwarded: Bool
    let bonusAwardedAt: String?
}

/// Top-level response shape from GET /daily-pick/today and POST /daily-pick/today/predict.
struct DailyPickResponse: Codable {
    let dailyPick: DailyPick?
    let prediction: DailyPickPrediction?
    /// Only populated by the POST response — confirms the +1 Ticket landed.
    let ticketAwarded: Bool?
}
