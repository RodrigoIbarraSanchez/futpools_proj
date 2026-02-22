//
//  QuinielaPickView.swift
//  futpoolsapp
//

import SwiftUI

struct QuinielaPickView: View {
    let quiniela: Quiniela
    @Environment(\.dismiss) private var dismiss
    @State private var picks: [Int: String] = [:]
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSuccessAlert = false

    private let client = APIClient.shared

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Pick 1 (home), X (draw) or 2 (away) for each match")
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                        .padding(.horizontal)

                    ForEach(quiniela.fixtures) { fixture in
                        QuinielaPickRow(
                            fixture: fixture,
                            selectedPick: Binding(
                                get: { picks[fixture.fixtureId] ?? "" },
                                set: { picks[fixture.fixtureId] = $0 }
                            )
                        )
                        .padding(.horizontal)
                    }

                    if let msg = errorMessage {
                        Text(msg)
                            .font(AppFont.caption())
                            .foregroundColor(.appLiveRed)
                            .padding(.horizontal)
                    }

                    PrimaryButton(isLoading ? "Submitting..." : "Submit Picks", style: .green) {
                        submit()
                    }
                    .disabled(!isComplete || isLoading)
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.md)
                }
                .padding(.vertical)
            }
            .navigationTitle("Make Picks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .overlay {
            if showSuccessAlert {
                PicksSavedOverlay(onDismiss: {
                    showSuccessAlert = false
                    dismiss()
                })
            }
        }
    }

    private var isComplete: Bool {
        quiniela.fixtures.allSatisfy { f in
            let p = picks[f.fixtureId] ?? ""
            return ["1", "X", "2"].contains(p)
        }
    }

    private func submit() {
        errorMessage = nil
        let payload = QuinielaEntryRequest(
            picks: quiniela.fixtures.compactMap { f in
                guard let p = picks[f.fixtureId], ["1", "X", "2"].contains(p) else { return nil }
                return QuinielaPick(fixtureId: f.fixtureId, pick: p)
            }
        )
        Task {
            isLoading = true
            do {
                let token = KeychainHelper.getToken()
                guard let token else {
                    print("[Quiniela] Submit blocked — missing auth token")
                    errorMessage = "Please sign in to submit picks."
                    isLoading = false
                    return
                }
                print("[Quiniela] Submitting picks quiniela=\(quiniela.id) count=\(payload.picks.count)")
                let entry: QuinielaEntry = try await client.request(
                    method: "POST",
                    path: "/quinielas/\(quiniela.id)/entries",
                    body: payload,
                    token: token
                )
                print("[Quiniela] Entry saved id=\(entry.id) picks=\(entry.picks.count)")
                showSuccessAlert = true
            } catch {
                print("[Quiniela] Submit error: \(error)")
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

private struct QuinielaPickRow: View {
    let fixture: QuinielaFixture
    @Binding var selectedPick: String

    var body: some View {
        MatchCard {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    TeamMini(name: fixture.homeTeam, logoURL: fixture.homeLogo)
                    Spacer()
                    Text("VS")
                        .font(AppFont.overline())
                        .foregroundColor(.appTextSecondary)
                    Spacer()
                    TeamMini(name: fixture.awayTeam, logoURL: fixture.awayLogo)
                }
                HStack(spacing: AppSpacing.sm) {
                    PickButton(label: "1", pick: "1", selected: selectedPick == "1", useGameFeel: true) { selectedPick = "1" }
                    PickButton(label: "X", pick: "X", selected: selectedPick == "X", useGameFeel: true) { selectedPick = "X" }
                    PickButton(label: "2", pick: "2", selected: selectedPick == "2", useGameFeel: true) { selectedPick = "2" }
                }
            }
        }
    }
}

// MARK: - Picks saved celebration overlay
private struct PicksSavedOverlay: View {
    let onDismiss: () -> Void
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()
            ConfettiView(particleCount: 70, duration: 3, isActive: true)
            VStack(spacing: AppSpacing.lg) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.appGold, Color.appGoldSoft],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .scaleEffect(appeared ? 1 : 0.3)
                    .opacity(appeared ? 1 : 0)
                Text("¡Quiniela enviada!")
                    .font(AppFont.title())
                    .foregroundColor(.appTextPrimary)
                Text("Your picks were saved successfully.")
                    .font(AppFont.body())
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.center)
                PrimaryButton("OK", style: .green, action: onDismiss)
                    .padding(.horizontal, AppSpacing.xl)
                    .padding(.top, AppSpacing.sm)
            }
            .padding(AppSpacing.xl)
        }
        .sensoryFeedback(.success, trigger: appeared)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                appeared = true
            }
        }
    }
}

private struct TeamMini: View {
    let name: String
    let logoURL: String?

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            ZStack {
                Circle()
                    .fill(Color.appSurfaceAlt)
                    .frame(width: 28, height: 28)
                if let logoURL, let url = URL(string: logoURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFit()
                    } placeholder: {
                        Text(String(name.prefix(1)))
                            .font(AppFont.caption())
                            .foregroundColor(.appTextPrimary)
                    }
                    .frame(width: 18, height: 18)
                } else {
                    Text(String(name.prefix(1)))
                        .font(AppFont.caption())
                        .foregroundColor(.appTextPrimary)
                }
            }
            Text(name)
                .font(AppFont.caption())
                .foregroundColor(.appTextPrimary)
                .lineLimit(1)
        }
    }
}
