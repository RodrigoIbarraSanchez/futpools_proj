//
//  LadderBackgroundRefresh.swift
//  futpoolsapp
//
//  Background delivery for prize_ladder local notifications. Wakes the app
//  periodically (BGAppRefreshTask), fetches the user's active prize_ladder
//  pools, and fires a localized notification if their live aciertos went up
//  since the last check — the same logic the foreground 30s poll uses, just
//  driven by the OS while the app is backgrounded.
//
//  Safety: `taskID` MUST match the `BGTaskSchedulerPermittedIdentifiers`
//  entry in Info.plist. Both the register and submit calls are guarded so a
//  misconfiguration degrades to "no background refresh" rather than a launch
//  crash (register returns false on a bad id; submit throws and is caught).
//

import Foundation
import BackgroundTasks

enum LadderBackgroundRefresh {
    /// Keep in sync with Info.plist → BGTaskSchedulerPermittedIdentifiers.
    static let taskID = "com.futpools.ladder.refresh"

    /// At most this many pools are checked per wake so we stay inside the
    /// short window the OS grants a refresh task.
    private static let maxPoolsPerRun = 10

    /// Register the launch handler. MUST be called before the app finishes
    /// launching (i.e. in the App's init). Returns silently if the id isn't
    /// permitted — never crashes.
    static func register() {
        let ok = BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskID,
            using: nil
        ) { task in
            handle(task as! BGAppRefreshTask)
        }
        if !ok {
            print("[LadderBGRefresh] register failed — check BGTaskSchedulerPermittedIdentifiers in Info.plist")
        }
    }

    /// Ask the OS to wake us again no sooner than ~15 minutes from now. The
    /// system decides the actual timing based on usage patterns. Safe to call
    /// repeatedly (e.g. on every background transition + after each run).
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // BGTaskSchedulerErrorDomain: not permitted, too many pending,
            // unavailable (Simulator/Low Power). Non-fatal.
            print("[LadderBGRefresh] schedule failed: \(error.localizedDescription)")
        }
    }

    // MARK: Handler

    private static func handle(_ task: BGAppRefreshTask) {
        // Chain the next refresh immediately so the cadence survives.
        schedule()

        let work = Task {
            await runCheck()
            task.setTaskCompleted(success: !Task.isCancelled)
        }
        task.expirationHandler = { work.cancel() }
    }

    /// Fetch the user's prize_ladder pools and fire notifications for any
    /// whose live aciertos increased. Shares the per-pool last-seen-score
    /// dedup with the foreground path via LadderNotificationService.
    /// MainActor-isolated so the L()-based notification copy is built on the
    /// main thread (network awaits still hop off-main under the hood).
    @MainActor
    static func runCheck() async {
        guard let token = KeychainHelper.getToken() else { return }
        let client = APIClient.shared

        guard let entries: [FailableQuinielaEntry] = try? await client.request(
            method: "GET",
            path: "/quinielas/entries/me",
            token: token
        ) else { return }

        // Unique ladder-pool ids, preserving order.
        var seen = Set<String>()
        var ladderPoolIds: [String] = []
        for wrapper in entries {
            guard let entry = wrapper.value, entry.quiniela.isPrizeLadder else { continue }
            let id = entry.quiniela.id
            if seen.insert(id).inserted { ladderPoolIds.append(id) }
        }

        for poolId in ladderPoolIds.prefix(maxPoolsPerRun) {
            if Task.isCancelled { return }
            guard let lb: LeaderboardResponse = try? await client.request(
                method: "GET",
                path: "/quinielas/\(poolId)/leaderboard",
                token: token
            ) else { continue }
            LadderNotificationService.notifyIfAcertoIncreased(
                poolId: poolId,
                ladder: lb.prizeLadder ?? [],
                userEntry: lb.userEntry
            )
        }
    }
}
