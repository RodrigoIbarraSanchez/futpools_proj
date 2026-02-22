//
//  Leaderboard.swift
//  futpoolsapp
//

import Foundation

struct LeaderboardResponse: Decodable {
    let leaderboard: [LeaderboardEntry]
    let totalCount: Int
    let totalPossible: Int
    let userEntry: UserLeaderboardEntry?
}

struct UserLeaderboardEntry: Decodable {
    let rank: Int
    let score: Int
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
    let totalPossible: Int

    var id: String { entryId }

    enum CodingKeys: String, CodingKey {
        case rank
        case entryId
        case entryNumber
        case userId
        case displayName
        case score
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
        totalPossible = try c.decode(Int.self, forKey: .totalPossible)
    }

    init(rank: Int, entryId: String, entryNumber: Int, userId: String?, displayName: String, score: Int, totalPossible: Int) {
        self.rank = rank
        self.entryId = entryId
        self.entryNumber = entryNumber
        self.userId = userId
        self.displayName = displayName
        self.score = score
        self.totalPossible = totalPossible
    }
}
