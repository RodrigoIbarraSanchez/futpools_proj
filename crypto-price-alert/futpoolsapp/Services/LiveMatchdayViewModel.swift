//
//  LiveMatchdayViewModel.swift
//  futpoolsapp
//

import Foundation
import Combine

@MainActor
final class LiveMatchdayViewModel: ObservableObject {
    @Published var liveMatches: [LiveMatch] = []
    @Published var errorMessage: String?

    private let client = APIClient.shared
    private var timer: Timer?
    private var currentMatchdayId: String?

    func start(matchdayId: String, interval: TimeInterval = 30) {
        currentMatchdayId = matchdayId
        print("[Live] start polling matchday=\(matchdayId) every \(Int(interval))s")
        Task { await fetch(matchdayId: matchdayId) }
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self = self, let id = self.currentMatchdayId else { return }
            Task { await self.fetch(matchdayId: id) }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        print("[Live] stop polling")
    }

    func fetch(matchdayId: String) async {
        errorMessage = nil
        do {
            let data: [LiveMatch] = try await client.request(path: "/football/matchday/\(matchdayId)")
            liveMatches = data
            let withLogos = data.filter { ($0.logos.home ?? "").isEmpty == false || ($0.logos.away ?? "").isEmpty == false }.count
            print("[Live] matchday=\(matchdayId) fixtures=\(data.count) logos=\(withLogos)")
            if let first = data.first {
                print("[Live] sample logos home=\(first.logos.home ?? "nil") away=\(first.logos.away ?? "nil")")
            }
        } catch {
            errorMessage = error.localizedDescription
            print("[Live] error matchday=\(matchdayId) \(error.localizedDescription)")
        }
    }
}
