//
//  MakeQuinielaView.swift
//  futpoolsapp
//

import SwiftUI

struct MakeQuinielaView: View {
    let matchday: Matchday
    let matches: [Match]
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = MakeQuinielaViewModel()
    @StateObject private var liveVM = LiveMatchdayViewModel()
    @State private var picks: [String: String] = [:]
    @State private var showSuccessAlert = false

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Elige 1 (local), X (empate) o 2 (visitante) para cada partido")
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                        .padding(.horizontal)

                    ForEach(matches) { match in
                        let live = liveVM.liveMatches.first { $0.matchId == match.id }
                        MatchPickRow(
                            match: match,
                            live: live,
                            selectedPick: Binding(
                                get: { picks[match.id] ?? "" },
                                set: { picks[match.id] = $0 }
                            )
                        )
                    }
                    .padding(.horizontal)

                    if let msg = vm.errorMessage {
                        Text(msg)
                            .font(AppFont.caption())
                            .foregroundColor(.appLiveRed)
                            .padding(.horizontal)
                    }

                    PrimaryButton(vm.isLoading ? "Enviando..." : "Enviar quiniela", style: .green) {
                        let payload = matches.compactMap { m -> MatchPickPayload? in
                            guard let pick = picks[m.id], ["1", "X", "2"].contains(pick) else { return nil }
                            return MatchPickPayload(matchId: m.id, pick: pick)
                        }
                        print("[Quiniela] Usuario tocó Enviar quiniela — matchday: \(matchday.id), picks: \(payload.count)")
                        Task {
                            let success = await vm.submit(matchdayId: matchday.id, picks: payload)
                            if success {
                                print("[Quiniela] Guardado correcto — mostrando alerta")
                                showSuccessAlert = true
                            } else {
                                print("[Quiniela] Error al guardar — \(vm.errorMessage ?? "desconocido")")
                            }
                        }
                    }
                    .disabled(!isComplete || vm.isLoading)
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.md)
                }
                .padding(.vertical)
            }
            .navigationTitle("Mi quiniela")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .alert("Quiniela guardada", isPresented: $showSuccessAlert) {
            Button("OK") {
                print("[Quiniela] Usuario cerró alerta — volviendo atrás")
                showSuccessAlert = false
                dismiss()
            }
        } message: {
            Text("Tu quiniela se guardó correctamente. Puedes verla en Mis entradas.")
        }
        .onAppear {
            vm.reset()
            print("[Quiniela] Pantalla Mi quiniela mostrada — \(matches.count) partidos")
            liveVM.start(matchdayId: matchday.id)
        }
        .onDisappear {
            liveVM.stop()
        }
    }

    private var isComplete: Bool {
        matches.allSatisfy { picks[$0.id] != nil && ["1", "X", "2"].contains(picks[$0.id]!) }
    }
}

struct MatchPickRow: View {
    let match: Match
    let live: LiveMatch?
    @Binding var selectedPick: String

    var body: some View {
        MatchCard {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    TeamMini(name: match.homeTeam, logoURL: live?.logos.home)
                    Spacer()
                    Text("VS")
                        .font(AppFont.overline())
                        .foregroundColor(.appTextSecondary)
                    Spacer()
                    TeamMini(name: match.awayTeam, logoURL: live?.logos.away)
                }
                HStack(spacing: AppSpacing.sm) {
                    PickButton(label: "1", pick: "1", selected: selectedPick == "1") { selectedPick = "1" }
                    PickButton(label: "X", pick: "X", selected: selectedPick == "X") { selectedPick = "X" }
                    PickButton(label: "2", pick: "2", selected: selectedPick == "2") { selectedPick = "2" }
                }
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

struct PickButton: View {
    let label: String
    let pick: String
    let selected: Bool
    var useGameFeel: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppFont.headline())
                .foregroundColor(selected ? .white : .appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.sm)
                .background(
                    selected
                        ? LinearGradient(
                            colors: [Color.appPrimary, Color.appAccent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        : LinearGradient(
                            colors: [Color.appSurface, Color.appSurfaceAlt],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.button)
                        .stroke(selected ? Color.white.opacity(0.2) : Color.appStroke.opacity(0.5), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.button))
        }
        .buttonStyle(PickButtonStyle(useGameFeel: useGameFeel))
    }
}

private struct PickButtonStyle: ButtonStyle {
    var useGameFeel: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(useGameFeel && configuration.isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.35, dampingFraction: 0.6), value: configuration.isPressed)
            .sensoryFeedback(.impact(weight: .light), trigger: useGameFeel ? configuration.isPressed : false)
    }
}

#Preview {
    NavigationStack {
        MakeQuinielaView(
            matchday: Matchday(id: "1", league: nil, name: "Jornada 1", startDate: "", endDate: "", status: "open", matches: nil),
            matches: [
                Match(id: "m1", matchday: nil, homeTeam: "América", awayTeam: "Chivas", scheduledAt: "", result: nil),
                Match(id: "m2", matchday: nil, homeTeam: "Cruz Azul", awayTeam: "Pumas", scheduledAt: "", result: nil),
            ]
        )
    }
    .preferredColorScheme(.dark)
}
