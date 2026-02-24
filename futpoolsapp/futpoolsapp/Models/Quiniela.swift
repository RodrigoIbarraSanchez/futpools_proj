//
//  Quiniela.swift
//  futpoolsapp
//

import Foundation

struct Quiniela: Decodable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let prize: String
    let cost: String
    let currency: String?
    let startDate: String
    let endDate: String?
    let fixtures: [QuinielaFixture]
    let entriesCount: Int?
    /// Pool lifecycle: `scheduled` (not started), `live` (in progress), `completed` (finished).
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case description
        case prize
        case cost
        case currency
        case startDate
        case endDate
        case fixtures
        case entriesCount
        case status
    }

    var startDateValue: Date? {
        DateParser.parse(startDate)
    }

    var endDateValue: Date? {
        guard let endDate else { return nil }
        return DateParser.parse(endDate)
    }

    var isScheduled: Bool { status == "scheduled" }
    var isLive: Bool { status == "live" }
    var isCompleted: Bool { status == "completed" }

    /// Parsed entry cost for balance checks (e.g. 35 from "35" or "$35").
    var entryCostValue: Double {
        let trimmed = cost.trimmingCharacters(in: .whitespaces)
        let digits = trimmed.filter { $0.isNumber || $0 == "." || $0 == "-" }
        return Double(digits) ?? 0
    }
}

struct QuinielaFixture: Decodable, Identifiable {
    let fixtureId: Int
    let leagueId: Int?
    let leagueName: String?
    let homeTeamId: Int?
    let awayTeamId: Int?
    let homeTeam: String
    let awayTeam: String
    let homeLogo: String?
    let awayLogo: String?
    let kickoff: String
    let status: String?

    var id: Int { fixtureId }

    var kickoffDate: Date? {
        DateParser.parse(kickoff)
    }
}

struct QuinielaUpdateRequest: Encodable {
    let name: String
    let description: String?
    let prize: String
    let cost: String
    let currency: String?
}

struct QuinielaEntryRequest: Encodable {
    let picks: [QuinielaPick]
}

struct QuinielaPick: Encodable {
    let fixtureId: Int
    let pick: String
}

struct QuinielaEntry: Decodable, Identifiable {
    let id: String
    let quiniela: Quiniela
    let user: String?
    let entryNumber: Int?
    let picks: [QuinielaPickResponse]
    let createdAt: String?
    let updatedAt: String?
    /// Points for this entry (1 per correct forecast). From backend when available.
    let score: Int?
    /// Total fixtures with a final result in this quiniela (max possible points).
    let totalPossible: Int?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case quiniela
        case user
        case entryNumber
        case picks
        case createdAt
        case updatedAt
        case score
        case totalPossible
    }

    var createdAtValue: Date? {
        guard let createdAt else { return nil }
        return DateParser.parse(createdAt)
    }
}

struct QuinielaPickResponse: Decodable {
    let fixtureId: Int
    let pick: String
}

enum DateParser {
    private static let isoWithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoBasic: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ value: String) -> Date? {
        if let d = isoWithFractional.date(from: value) { return d }
        if let d = isoBasic.date(from: value) { return d }
        return nil
    }
}
