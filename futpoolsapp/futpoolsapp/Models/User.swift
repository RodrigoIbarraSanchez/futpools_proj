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

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case username
        case displayName
        case isAdmin
        case balance
    }

    var balanceValue: Double { balance ?? 0 }
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}
