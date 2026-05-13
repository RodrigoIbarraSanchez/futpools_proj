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
    /// simple_version per-entry MXN fee. Replaces the legacy coin-based
    /// economy for pools created via /admin/pools/new. Optional so the
    /// model still decodes legacy pools that don't carry it.
    let entryFeeMXN: Int?
    /// Real-world prize attached to admin-curated pools. When set,
    /// the detail view renders the prize hero image + AMOE + Apple
    /// Guideline 5.3 disclaimers, and the pool surfaces in the Home
    /// "WEEKLY POOL · REAL PRIZE" teaser.
    let realPrize: RealPrize?

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
        case entryFeeMXN
        case realPrize
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

    /// User-facing entry fee. Prefers the new MXN field; falls back to
    /// the legacy coin string for pools created on master. Returns
    /// "—" when neither is set.
    var entryFeeDisplay: String {
        if let mxn = entryFeeMXN, mxn > 0 { return "$\(mxn) MXN" }
        let trimmed = cost.trimmingCharacters(in: .whitespaces)
        return (!trimmed.isEmpty && trimmed != "0") ? cost : "—"
    }

    /// Live-computed prize pool. For simple_version pools (entryFeeMXN
    /// set) the prize is `entries × fee × (1 - rake/100)` — the rake
    /// defaults to 10%. For legacy pools fall back to the prize string
    /// the admin set.
    var prizePoolDisplay: String {
        if let mxn = entryFeeMXN, mxn > 0 {
            let entries = entriesCount ?? 0
            let rake = Double(rakePercent ?? 10) / 100.0
            let pot = Int(Double(entries) * Double(mxn) * (1.0 - rake))
            return pot > 0 ? "$\(pot) MXN" : "—"
        }
        let trimmed = prize.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "—" : prize
    }

    /// Backend can wedge a finished pool at `status: "live"` when the
    /// API-Football status fetch fails (no data → fallback marks past
    /// kickoffs as anyStarted but never as allFinished). Override the
    /// label client-side once `endDate` is more than 6h in the past so a
    /// 5-day-old pool stops glowing red on Home.
    var effectiveStatus: String? {
        if status == "live", let end = endDateValue, end < Date().addingTimeInterval(-6 * 3600) {
            return "completed"
        }
        return status
    }

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
    /// Optional admin-only real-world prize. Backend silently drops
    /// this field for non-admin tokens, so it's safe to attach
    /// unconditionally from the form.
    let realPrize: RealPrize?
}

/// Real-world prize attached to a pool. Shape mirrors the backend
/// `realPrizeSchema` subdoc on Quiniela. `imageKey` is a bundled
/// asset identifier the iOS app resolves locally
/// (e.g. "PrizeAmazonGift").
struct RealPrize: Codable {
    let label: String
    let prizeUSD: Int
    let imageKey: String?
    let deliveryNote: String?
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

/// Wrapper used when decoding arrays of entries from the backend so a
/// single malformed row (e.g. `quiniela: null` left behind by a deleted
/// pool) doesn't fail the entire response. Decode succeeds for every
/// row; `value` is nil for rows that didn't satisfy `QuinielaEntry`.
struct FailableQuinielaEntry: Decodable {
    let value: QuinielaEntry?
    init(from decoder: Decoder) throws {
        value = try? QuinielaEntry(from: decoder)
    }
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
