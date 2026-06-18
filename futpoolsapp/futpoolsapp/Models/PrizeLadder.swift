//
//  PrizeLadder.swift
//  futpoolsapp
//
//  Prize-ladder model + helpers for the `prize_ladder` pool type, where
//  each participant wins a fixed prize based on their number of correct
//  picks ("aciertos"). Mirrors futpools_backend/src/lib/prizeLadder.js
//  and futpools_web/src/lib/prizeLadder.js — keep the three in sync.
//

import Foundation

/// One rung of a prize ladder: "if your correct-pick count is in
/// [min, max], you win prizeMXN pesos". Ranges are NOT assumed monotonic
/// (the 0-aciertos consolation sits below the 1–7 dead zone).
struct PrizeTier: Decodable, Identifiable, Equatable {
    let min: Int
    let max: Int
    let prizeMXN: Int
    let label: String?

    var id: String { "\(min)-\(max)" }

    enum CodingKeys: String, CodingKey { case min, max, prizeMXN, label }

    init(min: Int, max: Int, prizeMXN: Int, label: String? = nil) {
        self.min = min
        self.max = max
        self.prizeMXN = prizeMXN
        self.label = label
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        min = try c.decodeIfPresent(Int.self, forKey: .min) ?? 0
        max = try c.decodeIfPresent(Int.self, forKey: .max) ?? 0
        prizeMXN = try c.decodeIfPresent(Int.self, forKey: .prizeMXN) ?? 0
        label = try c.decodeIfPresent(String.self, forKey: .label)
    }
}

enum PrizeLadder {
    /// Prize (MXN) for a given number of correct picks; 0 if no tier matches.
    static func prize(for correct: Int, in ladder: [PrizeTier]) -> Int {
        for tier in ladder where correct >= tier.min && correct <= tier.max {
            return tier.prizeMXN
        }
        return 0
    }

    /// The tier the player currently sits in (for highlighting).
    static func currentTier(for correct: Int, in ladder: [PrizeTier]) -> PrizeTier? {
        ladder.first { correct >= $0.min && correct <= $0.max }
    }

    /// Closest *paying* tier above the current correct count — what the
    /// player is chasing. Returns (tier, needed) or nil if nothing higher.
    static func nextPrizeTier(for correct: Int, in ladder: [PrizeTier]) -> (tier: PrizeTier, needed: Int)? {
        var best: PrizeTier?
        for tier in ladder where tier.prizeMXN > 0 && tier.min > correct {
            if best == nil || tier.min < best!.min { best = tier }
        }
        guard let best else { return nil }
        return (best, best.min - correct)
    }

    /// "$3,000" formatting with thousands separators.
    static func formatMXN(_ amount: Int) -> String {
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        fmt.groupingSeparator = ","
        let n = fmt.string(from: NSNumber(value: amount)) ?? "\(amount)"
        return "$\(n)"
    }

    /// Localized "10 aciertos" / "1–7 aciertos" range label.
    static func rangeLabel(_ tier: PrizeTier) -> String {
        let word = String(localized: "aciertos_word")
        return tier.min == tier.max
            ? "\(tier.min) \(word)"
            : "\(tier.min)–\(tier.max) \(word)"
    }

    /// Full prize label used in notifications, e.g. "$700 (10 aciertos)".
    static func prizeLabel(_ tier: PrizeTier) -> String {
        "\(formatMXN(tier.prizeMXN)) (\(rangeLabel(tier)))"
    }
}
