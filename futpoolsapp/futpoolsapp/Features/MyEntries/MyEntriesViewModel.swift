//
//  MyEntriesViewModel.swift
//  futpoolsapp
//

import Foundation
import Combine

@MainActor
final class MyEntriesViewModel: ObservableObject {
    @Published var entries: [QuinielaEntry] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var liveFixtures: [Int: LiveFixture] = [:]

    private let client = APIClient.shared
    private var timer: Timer?

    func load() {
        isLoading = true
        errorMessage = nil
        print("[Mis entradas] Cargando participaciones...")
        Task {
            do {
                let token = KeychainHelper.getToken()
                if token == nil {
                    print("[Mis entradas] No hay token — usuario no autenticado")
                    errorMessage = "Please sign in to see your entries."
                    isLoading = false
                    return
                }
                // Decode each entry in isolation so a single broken row
                // (e.g. `quiniela: null` for an entry whose pool was deleted)
                // doesn't kill the whole list. Failed rows are silently dropped.
                let raw: [FailableQuinielaEntry] = try await client.request(
                    path: "/quinielas/entries/me", token: token
                )
                let dropped = raw.count - raw.compactMap({ $0.value }).count
                if dropped > 0 {
                    print("[Mis entradas] Descartadas \(dropped) entrada(s) con quiniela nula")
                }
                entries = raw.compactMap { $0.value }
                print("[Mis entradas] Cargadas \(entries.count) quiniela(s)")
                await refreshLiveFixtures()
                isLoading = false
            } catch {
                print("[Mis entradas] Error: \(error)")
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }

    func startLiveUpdates(interval: TimeInterval = 30) {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { await self?.refreshLiveFixtures() }
        }
    }

    func stopLiveUpdates() {
        timer?.invalidate()
        timer = nil
    }

    private func fixtureIds() -> [Int] {
        let ids = entries.flatMap { $0.quiniela.fixtures.map(\.fixtureId) }
        return Array(Set(ids))
    }

    private func chunks<T>(_ array: [T], size: Int) -> [[T]] {
        guard size > 0 else { return [] }
        return stride(from: 0, to: array.count, by: size).map {
            Array(array[$0..<min($0 + size, array.count)])
        }
    }

    private func shouldSkipPoll() -> Bool {
        let anyLive = liveFixtures.values.contains { $0.status.isLive == true }
        if anyLive { return false }
        let now = Date()
        let windowStart = now.addingTimeInterval(-3 * 3600)
        let windowEnd = now.addingTimeInterval(60 * 60)
        let inWindow = entries.flatMap { $0.quiniela.fixtures }
            .compactMap { $0.kickoffDate }
            .contains { $0 >= windowStart && $0 <= windowEnd }
        return !inWindow
    }

    private func refreshLiveFixtures() async {
        let ids = fixtureIds()
        guard !ids.isEmpty else { return }
        if shouldSkipPoll() { return }
        var map: [Int: LiveFixture] = [:]
        do {
            for part in chunks(ids, size: 50) {
                let data: [LiveFixture] = try await client.request(
                    method: "GET",
                    path: "/football/fixtures?ids=\(part.map(String.init).joined(separator: ","))"
                )
                data.forEach { f in
                    if let id = f.fixtureId {
                        map[id] = f
                    }
                }
            }
            liveFixtures = map
        } catch {
            // ignore for now
        }
    }
}
