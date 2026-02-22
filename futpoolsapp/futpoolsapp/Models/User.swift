//
//  User.swift
//  futpoolsapp
//

import Foundation

struct User: Codable {
    let id: String
    let email: String
    let displayName: String?
    let isAdmin: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName
        case isAdmin
    }
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}
