//
//  DailyPickCard.swift
//  futpoolsapp
//
//  Embedded in HomeView — shows today's featured fixture + the user's
//  prediction state. Predicting awards +1 Ticket immediately. If the user
//  guesses correctly when the fixture finishes, +1 bonus Ticket arrives
//  via the backend's settlement worker.
//

import SwiftUI
import Combine

struct DailyPickCard: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = DailyPickViewModel()

    var body: some View {
        // The card stays mounted even when there's no Daily Pick today
        // (rare — only when no priority-league fixture exists). We render
        // a quiet "vuelve mañana" state instead of hiding completely so
        // users learn the surface exists.
        Group {
            if vm.isLoading && vm.dailyPick == nil {
                loadingState
            } else if let dp = vm.dailyPick {
                cardBody(dp)
            } else {
                emptyState
            }
        }
        .task { await vm.load(token: auth.token) }
    }

    // MARK: — Card states

    private var loadingState: some View {
        HudFrame {
            HStack {
                ProgressView().tint(.arenaPrimary)
                Text(String(localized: "LOADING…"))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
                Spacer()
            }
            .padding(14)
        }
    }

    private var emptyState: some View {
        HudFrame {
            VStack(alignment: .leading, spacing: 4) {
                Text("⚽ " + String(localized: "DAILY PICK"))
                    .font(ArenaFont.display(size: 11, weight: .bold))
                    .tracking(2)
                    .foregroundColor(.arenaAccent)
                Text(String(localized: "No featured match today. Come back tomorrow."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextMuted)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func cardBody(_ dp: DailyPick) -> some View {
        HudFrame(glow: vm.prediction == nil ? .arenaAccent : nil) {
            VStack(alignment: .leading, spacing: 12) {
                header(dp)
                fixtureRow(dp)
                actionArea(dp)
                if let err = vm.errorMessage {
                    Text(err)
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaDanger)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func header(_ dp: DailyPick) -> some View {
        HStack(spacing: 8) {
            Text("⚽ " + String(localized: "DAILY PICK"))
                .font(ArenaFont.display(size: 11, weight: .bold))
                .tracking(2)
                .foregroundColor(.arenaAccent)
            Spacer()
            // Reward chip — communicates the value proposition at a glance.
            HStack(spacing: 4) {
                Image(systemName: "ticket.fill")
                    .font(.system(size: 9, weight: .bold))
                Text("+1")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
            }
            .foregroundColor(.arenaAccent)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(HudCornerCutShape(cut: 4).fill(Color.arenaAccent.opacity(0.13)))
            .overlay(HudCornerCutShape(cut: 4).stroke(Color.arenaAccent.opacity(0.3), lineWidth: 1))
        }
    }

    private func fixtureRow(_ dp: DailyPick) -> some View {
        HStack(spacing: 12) {
            VStack(spacing: 4) {
                TeamCrestArena(
                    name: dp.fixture.homeTeam,
                    color: ArenaTeamColor.color(for: dp.fixture.homeTeam),
                    size: 36,
                    logoURL: dp.fixture.homeLogo
                )
                Text(dp.fixture.homeTeam)
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextDim)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: 2) {
                Text("VS")
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .tracking(1)
                    .foregroundColor(.arenaTextMuted)
                Text(kickoffLabel(dp))
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaAccent)
                if let league = dp.fixture.leagueName, !league.isEmpty {
                    Text(league)
                        .font(ArenaFont.mono(size: 8))
                        .foregroundColor(.arenaTextDim)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: 4) {
                TeamCrestArena(
                    name: dp.fixture.awayTeam,
                    color: ArenaTeamColor.color(for: dp.fixture.awayTeam),
                    size: 36,
                    logoURL: dp.fixture.awayLogo
                )
                Text(dp.fixture.awayTeam)
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextDim)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private func actionArea(_ dp: DailyPick) -> some View {
        if let pred = vm.prediction {
            // Already predicted — show the locked pick + bonus state.
            predictedState(dp: dp, prediction: pred)
        } else if dp.fixture.hasStarted {
            // Missed window — kickoff already happened.
            Text(String(localized: "Kickoff already happened. Come back tomorrow."))
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextMuted)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 8)
        } else {
            // Open prediction state — three pick buttons.
            VStack(alignment: .leading, spacing: 6) {
                Text(String(localized: "Predict & earn 1 Ticket"))
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1)
                    .foregroundColor(.arenaTextMuted)
                HStack(spacing: 6) {
                    pickButton("1", subtitle: String(localized: "HOME"), action: { submit("1") })
                    pickButton("X", subtitle: String(localized: "DRAW"), action: { submit("X") })
                    pickButton("2", subtitle: String(localized: "AWAY"), action: { submit("2") })
                }
            }
        }
    }

    @ViewBuilder
    private func predictedState(dp: DailyPick, prediction: DailyPickPrediction) -> some View {
        let isSettled = dp.isSettled
        let userWon = isSettled && dp.finalResult == prediction.pick

        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(String(localized: "Your pick"))
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1)
                    .foregroundColor(.arenaTextMuted)
                Text(prediction.pick)
                    .font(ArenaFont.display(size: 18, weight: .black))
                    .foregroundColor(.arenaAccent)
                    .frame(width: 32, height: 28)
                    .background(HudCornerCutShape(cut: 4).fill(Color.arenaAccent.opacity(0.13)))
                Spacer()
                if isSettled {
                    if userWon {
                        Text("🏆 +1 " + String(localized: "BONUS"))
                            .font(ArenaFont.mono(size: 10, weight: .bold))
                            .foregroundColor(.arenaPrimary)
                    } else {
                        Text(String(localized: "MISSED"))
                            .font(ArenaFont.mono(size: 10, weight: .bold))
                            .foregroundColor(.arenaDanger)
                    }
                } else {
                    Text(String(localized: "WAITING FOR FT"))
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .foregroundColor(.arenaTextDim)
                }
            }
        }
    }

    private func pickButton(_ key: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(key)
                    .font(ArenaFont.display(size: 16, weight: .black))
                    .foregroundColor(vm.isSubmitting ? .arenaTextDim : .arenaText)
                Text(subtitle)
                    .font(ArenaFont.mono(size: 8))
                    .foregroundColor(.arenaTextMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(HudCornerCutShape(cut: 5).fill(Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaAccent.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(vm.isSubmitting)
    }

    // MARK: — Helpers

    private func submit(_ pick: String) {
        Task {
            await vm.submit(pick: pick, token: auth.token)
            // Refresh user balance so the dual-balance header reflects the +1.
            await auth.fetchUser()
        }
    }

    private func kickoffLabel(_ dp: DailyPick) -> String {
        guard let d = dp.fixture.kickoffDate else { return "" }
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }
}

// MARK: — VM

@MainActor
final class DailyPickViewModel: ObservableObject {
    @Published var dailyPick: DailyPick?
    @Published var prediction: DailyPickPrediction?
    @Published var isLoading = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    private let client = APIClient.shared

    func load(token: String?) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let res: DailyPickResponse = try await client.request(
                method: "GET",
                path: "/daily-pick/today",
                token: token
            )
            dailyPick = res.dailyPick
            prediction = res.prediction
        } catch {
            // Quiet — Daily Pick is best-effort. The card just shows empty
            // state if the fetch fails (likely no network).
        }
    }

    func submit(pick: String, token: String?) async {
        guard !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            struct Body: Encodable { let pick: String }
            let res: DailyPickResponse = try await client.request(
                method: "POST",
                path: "/daily-pick/today/predict",
                body: Body(pick: pick),
                token: token
            )
            if let dp = res.dailyPick { dailyPick = dp }
            prediction = res.prediction
        } catch {
            let desc = error.localizedDescription
            if desc.contains("DUPLICATE_PREDICTION") {
                // Two-tap race — refetch to surface the predicted state.
                await load(token: token)
            } else if desc.contains("FIXTURE_STARTED") {
                errorMessage = String(localized: "Kickoff already happened. Come back tomorrow.")
                await load(token: token)
            } else if desc.contains("INVALID_PICK") {
                errorMessage = String(localized: "Invalid pick.")
            } else {
                errorMessage = desc
            }
        }
    }
}
