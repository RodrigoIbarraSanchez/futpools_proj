//
//  League.swift
//  futpoolsapp
//

import Foundation

struct League: Codable {
    let id: String
    let name: String
    let code: String
    let country: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case code
        case country
    }
}
