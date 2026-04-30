//
//  Challenge.swift
//  futpoolsapp
//
//  Head-to-head 1v1 challenge. Wire-compatible with backend
//  /challenges endpoints.
//

import Foundation

enum ChallengeMarketType: String, Codable, CaseIterable {
    case match1X2 = "1X2"
    case overUnder25 = "OU25"
    case bothTeamsScore = "BTTS"

    /// Picks valid for this market. Used both for client-side validation and
    /// to drive the pick-selector UI.
    var validPicks: [String] {
        switch self {
        case .match1X2:        return ["1", "X", "2"]
        case .overUnder25:     return ["OVER", "UNDER"]
        case .bothTeamsScore:  return ["YES", "NO"]
        }
    }

    /// Human label for the pill in the market selector.
    var label: String {
        switch self {
        case .match1X2:        return "1X2"
        case .overUnder25:     return "O/U 2.5"
        case .bothTeamsScore:  return "BTTS"
        }
    }
}

enum ChallengeStatus: String, Codable {
    case pending, accepted, settled, refunded, declined, cancelled
}

/// Embedded fixture snapshot — kept as its own type so Challenge stands on its
/// own without depending on Quiniela's fixture model.
struct ChallengeFixture: Codable, Equatable {
    let fixtureId: Int
    let leagueId: Int?
    let leagueName: String?
    let homeTeamId: Int?
    let awayTeamId: Int?
    let homeTeam: String
    let awayTeam: String
    let homeLogo: String?
    let awayLogo: String?
    /// ISO-8601 — parse via DateParser.parse().
    let kickoff: String

    var kickoffDate: Date? { DateParser.parse(kickoff) }
}

struct ChallengeUser: Codable, Equatable, Identifiable {
    let id: String
    let username: String?
    let displayName: String?
}

struct Challenge: Codable, Identifiable {
    let id: String
    let code: String
    let challenger: ChallengeUser
    /// Optional now: open challenges are created with no opponent, and any
    /// non-creator can claim the slot via the share link. Once claimed, the
    /// field is populated and behaves like a directed challenge.
    let opponent: ChallengeUser?
    let stakeCoins: Int
    let marketType: ChallengeMarketType
    let challengerPick: String
    let opponentPick: String?
    let fixture: ChallengeFixture
    let status: ChallengeStatus
    let winnerUserId: String?
    let outcomeKey: String?
    let rakePercent: Int?
    let createdAt: String?
    let acceptedAt: String?
    let settledAt: String?
    /// Computed by the backend — `"challenger"` / `"opponent"` / `nil`.
    let youAre: String?
    /// True iff opponent is null AND status is pending — the slot can still be
    /// claimed by any non-creator hitting the share link. Older payloads (or
    /// non-pending challenges) decode this as nil; treat nil as false.
    let isOpen: Bool?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case code, challenger, opponent, stakeCoins, marketType
        case challengerPick, opponentPick, fixture, status
        case winnerUserId, outcomeKey, rakePercent
        case createdAt, acceptedAt, settledAt, youAre, isOpen
    }

    var payoutIfWin: Int {
        let rake = rakePercent ?? 10
        return Int((Double(stakeCoins * 2) * (100.0 - Double(rake)) / 100.0).rounded(.down))
    }

    /// Human-facing pick label — e.g. '1' → "HOME", 'X' → "DRAW". Goes
    /// through `String(localized:)` so Spanish users see "LOCAL / EMPATE
    /// / VISITA" instead of the English keys.
    static func pickLabel(_ pick: String?, market: ChallengeMarketType) -> String {
        guard let pick = pick else { return "—" }
        if market == .match1X2 {
            switch pick {
            case "1": return String(localized: "HOME")
            case "X": return String(localized: "DRAW")
            case "2": return String(localized: "AWAY")
            default:  return pick
            }
        }
        return pick
    }
}

// MARK: — Request bodies

struct ChallengeCreateRequest: Encodable {
    /// Optional. When nil, the backend creates an "open" challenge whose
    /// share link can be claimed by any non-creator. Web parity:
    /// `futpools_web/.../ChallengeCreate.jsx` omits this field entirely
    /// when the opponent input is blank.
    let opponentUsername: String?
    let fixture: ChallengeFixture
    let marketType: String
    let challengerPick: String
    let stakeCoins: Int

    enum CodingKeys: String, CodingKey {
        case opponentUsername, fixture, marketType, challengerPick, stakeCoins
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        // Only include opponentUsername when set — backend distinguishes
        // "missing identifier" (open) from "identifier provided but blank"
        // (would 400 with Opponent not found).
        if let u = opponentUsername, !u.isEmpty {
            try c.encode(u, forKey: .opponentUsername)
        }
        try c.encode(fixture, forKey: .fixture)
        try c.encode(marketType, forKey: .marketType)
        try c.encode(challengerPick, forKey: .challengerPick)
        try c.encode(stakeCoins, forKey: .stakeCoins)
    }
}

struct ChallengeAcceptRequest: Encodable {
    let opponentPick: String
}

struct ChallengeActionResponse: Decodable {
    let ok: Bool
    let status: String?
}
