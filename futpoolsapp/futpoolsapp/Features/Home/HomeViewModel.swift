//
//  HomeViewModel.swift
//  futpoolsapp
//

import Foundation
import Combine

struct AppSettings: Decodable {
    let bannerImageURL: String?
}

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var quinielas: [Quiniela] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var liveFixtures: [Int: LiveFixture] = [:]
    @Published var bannerImageURL: String?

    private let client = APIClient.shared
    private var timer: Timer?

    func loadQuinielas() {
        isLoading = true
        errorMessage = nil
        print("[Home] Loading quinielas...")
        Task {
            await loadSettings()
            do {
                quinielas = try await client.request(path: "/quinielas") as [Quiniela]
                print("[Home] Quinielas loaded: \(quinielas.count)")
                await refreshLiveFixtures()
                isLoading = false
            } catch {
                print("[Home] Quinielas error: \(error)")
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }

    func loadSettings() async {
        do {
            let settings: AppSettings = try await client.request(path: "/settings")
            bannerImageURL = settings.bannerImageURL.flatMap { $0.isEmpty ? nil : $0 }
        } catch {
            bannerImageURL = nil
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
        let ids = quinielas.flatMap { $0.fixtures.map(\.fixtureId) }
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
