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
                entries = try await client.request(path: "/quinielas/entries/me", token: token) as [QuinielaEntry]
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

    private func refreshLiveFixtures() async {
        let ids = fixtureIds()
        guard !ids.isEmpty else { return }
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
