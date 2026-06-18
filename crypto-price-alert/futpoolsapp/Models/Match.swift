//
//  Match.swift
//  futpoolsapp
//

import Foundation

struct Match: Codable, Identifiable {
    let id: String
    let matchday: String?
    let homeTeam: String
    let awayTeam: String
    let scheduledAt: String
    let result: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case matchday
        case homeTeam
        case awayTeam
        case scheduledAt
        case result
    }

    var scheduledDate: Date? {
        ISO8601DateFormatter().date(from: scheduledAt)
            ?? ISO8601DateFormatter().date(from: scheduledAt.replacingOccurrences(of: "Z", with: "+00:00"))
    }

    var formattedDate: String {
        guard let d = scheduledDate else { return scheduledAt }
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        f.locale = Locale(identifier: "es_MX")
        return f.string(from: d)
    }
}
