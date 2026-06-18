//
//  Prediction.swift
//  futpoolsapp
//

import Foundation

struct Prediction: Decodable, Identifiable {
    let id: String
    let user: String?
    let matchday: MatchdayRef?
    let matches: [MatchPick]
    let createdAt: String?

    struct MatchdayRef: Decodable {
        let id: String?
        let name: String?
        let startDate: String?
        let endDate: String?
        let status: String?
        let league: LeagueRef?

        enum CodingKeys: String, CodingKey {
            case id = "_id"
            case name
            case startDate
            case endDate
            case status
            case league
        }

        struct LeagueRef: Decodable {
            let name: String?
            let code: String?

            init(from decoder: Decoder) throws {
                if let _ = try? decoder.singleValueContainer().decode(String.self) {
                    name = nil
                    code = nil
                    return
                }
                let container = try decoder.container(keyedBy: CodingKeys.self)
                name = try container.decodeIfPresent(String.self, forKey: .name)
                code = try container.decodeIfPresent(String.self, forKey: .code)
            }

            private enum CodingKeys: String, CodingKey {
                case name
                case code
            }
        }
    }

    struct MatchPick: Codable {
        let matchId: MatchRef?
        let pick: String

        enum CodingKeys: String, CodingKey {
            case matchId
            case pick
        }

        struct MatchRef: Codable {
            let id: String?
            let homeTeam: String?
            let awayTeam: String?
            let scheduledAt: String?
            let result: String?

            enum CodingKeys: String, CodingKey {
                case id = "_id"
                case homeTeam
                case awayTeam
                case scheduledAt
                case result
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case user
        case matchday
        case matches
        case createdAt
    }
}

struct CreatePredictionRequest: Encodable {
    let matchday: String
    let matches: [MatchPickPayload]
}

struct MatchPickPayload: Encodable {
    let matchId: String
    let pick: String
}
