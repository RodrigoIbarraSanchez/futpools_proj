//
//  LiveMatch.swift
//  futpoolsapp
//

import Foundation

struct LiveMatch: Decodable, Identifiable {
    let matchId: String
    let scheduledAt: String
    let homeTeam: String
    let awayTeam: String
    let status: LiveStatus
    let score: LiveScore
    let logos: LiveLogos
    let league: LiveLeague?
    let fixtureId: Int?

    var id: String { matchId }

    var scheduledDate: Date? {
        ISO8601DateFormatter().date(from: scheduledAt)
            ?? ISO8601DateFormatter().date(from: scheduledAt.replacingOccurrences(of: "Z", with: "+00:00"))
    }
}

struct LiveStatus: Decodable {
    let short: String?
    let long: String?
    let elapsed: Int?
    let isLive: Bool?
}

struct LiveScore: Decodable {
    let home: Int?
    let away: Int?
}

struct LiveLogos: Decodable {
    let home: String?
    let away: String?
}

struct LiveLeague: Decodable {
    let id: Int?
    let name: String?
    let logo: String?
}

struct LiveFixture: Decodable, Identifiable {
    let fixtureId: Int?
    let scheduledAt: String?
    let status: LiveStatus
    let score: LiveScore
    let logos: LiveLogos?
    let league: LiveLeague?

    var id: Int { fixtureId ?? -1 }

    var scheduledDate: Date? {
        guard let scheduledAt else { return nil }
        return ISO8601DateFormatter().date(from: scheduledAt)
            ?? ISO8601DateFormatter().date(from: scheduledAt.replacingOccurrences(of: "Z", with: "+00:00"))
    }
}
