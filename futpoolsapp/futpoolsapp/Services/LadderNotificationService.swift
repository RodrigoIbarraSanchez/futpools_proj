//
//  LadderNotificationService.swift
//  futpoolsapp
//
//  Local notifications for prize_ladder pools. When the player's live
//  aciertos tick up (detected on each leaderboard refresh while the app
//  is active), we fire a localized local notification. Copy is built with
//  `L(...)` so it honors the in-app language toggle (ES/EN), matching the
//  web counterpart in futpools_web/src/lib/ladderNotify.js.
//
//  NOTE: delivery is foreground/active-session only (piggybacks on the
//  detail view's existing 30s polling). True background delivery would
//  need a BGAppRefreshTask (permitted identifier in Info.plist) or remote
//  push — out of scope here per the product decision (local-only).
//

import Foundation
import UserNotifications

enum LadderNotificationService {
    private static let defaults = UserDefaults.standard
    private static func storageKey(_ poolId: String) -> String { "fp_ladder_score_\(poolId)" }

    /// Call after each leaderboard refresh for a prize_ladder pool. Fires a
    /// localized notification when the user's live aciertos increase.
    /// Idempotent via a per-pool last-seen score in UserDefaults: the first
    /// observation only seeds the baseline (no notification).
    @MainActor
    static func notifyIfAcertoIncreased(poolId: String, ladder: [PrizeTier], userEntry: UserLeaderboardEntry?) {
        guard let userEntry else { return }
        let score = userEntry.liveScore ?? userEntry.score
        let key = storageKey(poolId)
        let hasBaseline = defaults.object(forKey: key) != nil
        let previous = defaults.integer(forKey: key)
        defaults.set(score, forKey: key)

        guard hasBaseline, score > previous else { return }
        guard let message = message(forAciertos: score, ladder: ladder) else { return }
        fire(title: message.title, body: message.body, poolId: poolId)
    }

    // MARK: Copy

    @MainActor
    private static func message(forAciertos n: Int, ladder: [PrizeTier]) -> (title: String, body: String)? {
        let prize = PrizeLadder.prize(for: n, in: ladder)
        if prize > 0 {
            let label = PrizeLadder.currentTier(for: n, in: ladder).map(tierLabel) ?? PrizeLadder.formatMXN(prize)
            return (
                L("New prize unlocked!"),
                String(format: L("You nailed your last pick! You have %lld correct, your current prize is: %@"), n, label)
            )
        }
        if let next = PrizeLadder.nextPrizeTier(for: n, in: ladder) {
            return (
                L("Keep going!"),
                String(format: L("You need %lld more correct to reach %@"), next.needed, tierLabel(next.tier))
            )
        }
        return nil
    }

    /// "$700 (10 aciertos)" — localized, built with L() so it tracks the
    /// in-app language at fire time.
    @MainActor
    private static func tierLabel(_ tier: PrizeTier) -> String {
        let word = L("aciertos_word")
        let range = tier.min == tier.max ? "\(tier.min) \(word)" : "\(tier.min)–\(tier.max) \(word)"
        return "\(PrizeLadder.formatMXN(tier.prizeMXN)) (\(range))"
    }

    // MARK: Delivery

    private static func fire(title: String, body: String, poolId: String) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional else { return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            // nil trigger → deliver immediately.
            let request = UNNotificationRequest(
                identifier: "ladder-\(poolId)-\(UUID().uuidString)",
                content: content,
                trigger: nil
            )
            center.add(request)
        }
    }
}
