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
    /// Admin-controlled "featured" flag. When true the pool is pinned to the Home
    /// QUICK PLAY hero (or the featured carousel when multiple are marked).
    let featured: Bool?
    /// User id of the creator (null for legacy admin-seeded pools).
    let createdBy: String?
    /// Resolved username of the creator (from backend populate), used for "Created by @x" badge.
    let createdByUsername: String?
    let createdByDisplayName: String?
    /// `public` → discoverable in Home. `private` → only reachable via inviteCode.
    let visibility: String?
    /// Short alphanum code used in share links (e.g. `futpools://p/ABC23456`).
    let inviteCode: String?
    /// Free-text label for MVP user-pools ("the loser buys pizza"). Not money.
    let prizeLabel: String?
    /// v3 economy — filled by backend. nil on legacy pools.
    let fundingModel: String?
    let platformPrizeCoins: Int?
    let entryCostCoins: Int?
    let rakePercent: Int?

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
        case featured
        case createdBy
        case createdByUsername
        case createdByDisplayName
        case visibility
        case inviteCode
        case prizeLabel
        case fundingModel
        case platformPrizeCoins
        case entryCostCoins
        case rakePercent
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
    let featured: Bool?
}

/// Partial update for admin quick-actions (e.g. toggle the featured flag) without
/// having to resend every editable field.
struct QuinielaFeaturedRequest: Encodable {
    let featured: Bool
}

/// Body for `POST /quinielas` — any authenticated user can create a pool.
/// v3: mutually exclusive economy picks.
///   - `entryCostCoins > 0` → peer pool, all participants pay (presets 10/25/50/100/250/500).
///   - `prizeCoins > 0`     → sponsored pool, creator pays prize × 1.1 upfront
///     (presets 50/100/250/500/1000). Participants play free.
/// Server rejects if both are > 0 simultaneously.
struct QuinielaCreateRequest: Encodable {
    let name: String
    let description: String?
    let prizeLabel: String?
    let visibility: String // "public" | "private"
    let entryCostCoins: Int
    let prizeCoins: Int
    let fixtures: [QuinielaCreateFixture]
}

struct QuinielaCreateFixture: Encodable {
    let fixtureId: Int
    let leagueId: Int?
    let leagueName: String?
    let homeTeamId: Int?
    let awayTeamId: Int?
    let homeTeam: String
    let awayTeam: String
    let homeLogo: String?
    let awayLogo: String?
    /// ISO-8601 UTC kickoff.
    let kickoff: String
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

/// Response shape for `GET /quinielas/:id/participants` — creator-only admin
/// view. Picks are bundled per entry once the pool starts (status !=
/// "scheduled"); during the scheduled phase the backend strips them and
/// sets `picksHidden: true` so the creator can't kick a player based on who
/// guessed well. Web parity: futpools_backend/.../quinielaController.js
/// getParticipants.
struct ParticipantsResponse: Decodable {
    let status: String
    let picksHidden: Bool?
    let participants: [ParticipantDTO]
}

struct ParticipantDTO: Decodable, Identifiable {
    let user: ParticipantUser
    let entryCount: Int
    let firstEntryAt: String?
    let entries: [ParticipantEntry]
    var id: String { user.id }
}

struct ParticipantUser: Decodable {
    let id: String
    let username: String?
    let displayName: String?
}

struct ParticipantEntry: Decodable, Identifiable {
    let _id: String
    let entryNumber: Int
    let createdAt: String?
    /// Optional — present only when the backend reveals picks (post-kickoff).
    /// Nil during scheduled phase.
    let picks: [ParticipantPick]?
    /// Optional scoring stamp. Both nil until first FT in the pool.
    let score: Int?
    let totalPossible: Int?
    var id: String { _id }
}

struct ParticipantPick: Decodable, Hashable {
    let fixtureId: Int
    let pick: String
}

/// Response from `DELETE /quinielas/:id/entries/:entryId`.
struct DeleteEntryResponse: Decodable {
    let ok: Bool
    let refundedAmount: Int?
    let entryId: String?
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
