//
//  Leaderboard.swift
//  futpoolsapp
//

import Foundation

struct LeaderboardResponse: Decodable {
    let leaderboard: [LeaderboardEntry]
    let totalCount: Int
    let totalPossible: Int
    /// True iff at least one fixture in the pool is currently in progress
    /// (1H/2H/HT/ET/etc.). The UI flips into "live" mode when this is true:
    /// pulsing LIVE chip, ranking by `liveScore`, in-flight delta badges.
    let hasLiveFixtures: Bool?
    let liveFixtureCount: Int?
    let userEntry: UserLeaderboardEntry?
}

struct UserLeaderboardEntry: Decodable {
    let rank: Int
    let score: Int
    let liveScore: Int?
    let liveDelta: Int?
    let totalPossible: Int
    let displayName: String
}

struct LeaderboardEntry: Decodable, Identifiable {
    let rank: Int
    let entryId: String
    let entryNumber: Int
    let userId: String?
    let displayName: String
    let score: Int
    /// Settled + in-progress points. Equal to `score` when nothing is live.
    /// Older payloads (pre live-leaderboard) decode as nil; treat nil as
    /// `score` so the UI keeps working without a coordinated rollout.
    let liveScore: Int?
    /// `liveScore - score`. Positive when the entry is currently picking up
    /// points from in-progress matches; UI shows it as a `+N` pulse.
    let liveDelta: Int?
    let totalPossible: Int

    var id: String { entryId }

    /// Convenience: which score to display given the panel's live mode.
    func displayScore(hasLive: Bool) -> Int {
        if hasLive { return liveScore ?? score }
        return score
    }

    enum CodingKeys: String, CodingKey {
        case rank
        case entryId
        case entryNumber
        case userId
        case displayName
        case score
        case liveScore
        case liveDelta
        case totalPossible
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rank = try c.decode(Int.self, forKey: .rank)
        entryId = try c.decode(String.self, forKey: .entryId)
        entryNumber = try c.decodeIfPresent(Int.self, forKey: .entryNumber) ?? 0
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
        displayName = try c.decodeIfPresent(String.self, forKey: .displayName) ?? "Participant"
        score = try c.decode(Int.self, forKey: .score)
        liveScore = try c.decodeIfPresent(Int.self, forKey: .liveScore)
        liveDelta = try c.decodeIfPresent(Int.self, forKey: .liveDelta)
        totalPossible = try c.decode(Int.self, forKey: .totalPossible)
    }

    init(rank: Int, entryId: String, entryNumber: Int, userId: String?, displayName: String, score: Int, liveScore: Int? = nil, liveDelta: Int? = nil, totalPossible: Int) {
        self.rank = rank
        self.entryId = entryId
        self.entryNumber = entryNumber
        self.userId = userId
        self.displayName = displayName
        self.score = score
        self.liveScore = liveScore
        self.liveDelta = liveDelta
        self.totalPossible = totalPossible
    }
}
