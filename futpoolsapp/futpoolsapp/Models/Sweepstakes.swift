//
//  Sweepstakes.swift
//  futpoolsapp
//
//  Mirrors the backend's /sweepstakes/* shape.
//

import Foundation

enum SweepstakesStatus: String, Codable {
    case open, drawing, settled, cancelled
}

struct Sweepstakes: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let prizeLabel: String
    let prizeUSD: Double?
    let entryCostTickets: Int
    let minEntries: Int
    /// ISO-8601 — parse via DateParser.parse().
    let entryOpensAt: String?
    let entryClosesAt: String?
    let status: SweepstakesStatus
    let allowedCountries: [String]?
    let winnerUserId: String?
    let didIWin: Bool?
    let settledAt: String?
    let createdAt: String?

    /// Populated only on the detail endpoint.
    let myEntries: Int?
    let totalEntries: Int?

    var entryClosesDate: Date? {
        guard let s = entryClosesAt else { return nil }
        return DateParser.parse(s)
    }

    var hasClosed: Bool {
        guard let d = entryClosesDate else { return false }
        return d <= Date()
    }
}

struct SweepstakesEnterResponse: Codable {
    let ok: Bool
    let entry: SweepstakesEntryStub?
    let tickets: Int?
}

struct SweepstakesEntryStub: Codable, Identifiable {
    let id: String
    let entryNumber: Int
    let ticketsSpent: Int
}

struct SweepstakesListResponse: Codable {
    let sweepstakes: [Sweepstakes]
}
