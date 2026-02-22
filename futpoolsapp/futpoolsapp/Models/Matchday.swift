//
//  Matchday.swift
//  futpoolsapp
//

import Foundation

struct Matchday: Codable, Identifiable {
    let id: String
    let league: LeagueRef?
    let name: String
    let startDate: String
    let endDate: String
    let status: String
    var matches: [Match]?

    struct LeagueRef: Codable {
        let id: String?
        let name: String?
        let code: String?

        enum CodingKeys: String, CodingKey {
            case id = "_id"
            case name
            case code
        }
    }

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case league
        case name
        case startDate
        case endDate
        case status
        case matches
    }
}
