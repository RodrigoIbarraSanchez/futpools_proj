//
//  User.swift
//  futpoolsapp
//

import Foundation

struct User: Codable {
    let id: String
    let email: String
    let username: String?
    let displayName: String?
    let isAdmin: Bool?
    /// User balance (e.g. in MXN or app currency). Used to pay pool entry cost.
    let balance: Double?

    // ── FutPools Rank ─────────────────────────────────────────────────
    // All optional so existing responses that predate the rank layer keep
    // decoding. UI falls back to the rating floor (1000) when missing.
    let rating: Double?
    let ratingPeak: Double?
    let streakCurrent: Int?
    let streakBest: Int?
    let poolsPlayed: Int?
    let poolsWon: Int?
    let poolsTop3: Int?
    let picksCorrect: Int?
    let picksTotal: Int?
    let achievements: [UserAchievement]?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case username
        case displayName
        case isAdmin
        case balance
        case rating
        case ratingPeak
        case streakCurrent
        case streakBest
        case poolsPlayed
        case poolsWon
        case poolsTop3
        case picksCorrect
        case picksTotal
        case achievements
    }

    var balanceValue: Double { balance ?? 0 }
    var ratingValue: Int { Int((rating ?? 1000).rounded()) }
}

struct UserAchievement: Codable, Identifiable {
    let code: String
    let unlockedAt: Date?

    var id: String { code }
}

struct AuthResponse: Codable {
    let token: String
    let user: User
    /// Coins granted at signup (null if no bonus was applied on this call).
    let signupBonus: Int?
}

/// Mirror of GET /leaderboard/me. Single source of truth for the rank hero.
struct UserRankSummary: Codable {
    let rank: Int
    let rating: Int
    let ratingPeak: Int
    let tier: String
    let tierName: String
    let tierMin: Int
    let tierMax: Int
    let streakCurrent: Int
    let streakBest: Int
    let poolsPlayed: Int
    let poolsWon: Int
    let poolsTop3: Int
    let picksCorrect: Int
    let picksTotal: Int
    let winRate: Double
    let achievements: [UserAchievement]

    var progressInTier: Double {
        let span = max(tierMax - tierMin, 1)
        let position = max(0, min(tierMax - tierMin, rating - tierMin))
        return Double(position) / Double(span)
    }
}

/// Mirror of GET /leaderboard/global row.
struct GlobalLeaderboardRow: Codable, Identifiable {
    let rank: Int
    let userId: String
    let username: String
    let displayName: String
    let rating: Int
    let ratingPeak: Int
    let tier: String
    let tierName: String
    let poolsPlayed: Int
    let poolsWon: Int
    let streakBest: Int
    let winRate: Double

    var id: String { userId }
}

struct GlobalLeaderboardResponse: Codable {
    let leaderboard: [GlobalLeaderboardRow]
    let totalCount: Int
}

/// Maps the backend tier code to the existing DivisionBadge visual tiers.
/// Kept in one place so if we add a tier between Pro and Veteran later, this
/// is the only line to touch.
enum RankTier: String {
    case rookie, amateur, pro, veteran, legend

    init(code: String) {
        self = RankTier(rawValue: code.lowercased()) ?? .amateur
    }

    var displayName: String {
        switch self {
        case .rookie:  return "Rookie"
        case .amateur: return "Amateur"
        case .pro:     return "Pro"
        case .veteran: return "Veteran"
        case .legend:  return "Legend"
        }
    }
}
