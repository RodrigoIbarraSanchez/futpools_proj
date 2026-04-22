//
//  AdminCreateEventView.swift
//  futpoolsapp
//
//  Admin-only sheet to create a Platform Event — a platform-funded pool with a
//  minParticipants floor. Reuses the `CreatePoolViewModel` for fixture search
//  and basket so the UX is consistent with user-created pools; adds prize +
//  participants fields and POSTs to `/admin/pools/platform-event`.
//

import SwiftUI

struct AdminCreateEventView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = CreatePoolViewModel()
    @State private var name = ""
    @State private var prizeCoins: String = "10000"
    @State private var minParticipants: String = "20"
    @State private var entryCostCoins: String = "0"
    @State private var submitting = false
    @State private var errorText: String?
    @State private var createdPool: Quiniela?
    @State private var showingPicker = false

    private let client = APIClient.shared

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (Int(prizeCoins) ?? 0) > 0
            && (Int(minParticipants) ?? 0) >= 1
            && !vm.selectedFixtures.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        nameSection
                        prizeSection
                        fixturesSection
                        if let err = errorText {
                            Text(err)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaDanger)
                                .padding(.horizontal, 16)
                        }
                    }
                    .padding(.top, 14)
                    .padding(.bottom, 140)
                }

                VStack {
                    Spacer()
                    ArcadeButton(
                        title: submitting ? "CREATING…" : "▶ CREATE EVENT",
                        size: .lg,
                        fullWidth: true,
                        disabled: !canSubmit || submitting
                    ) {
                        Task { await submit() }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 28)
                    .background(
                        LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom)
                            .frame(height: 80)
                    )
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("PLATFORM EVENT")
                        .font(ArenaFont.display(size: 13, weight: .black))
                        .tracking(3)
                        .foregroundColor(.arenaText)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.arenaTextDim)
                }
            }
            .sheet(isPresented: $showingPicker) {
                FixturePickerSheet(vm: vm)
            }
            .sheet(item: $createdPool) { pool in
                EventCreatedSheet(pool: pool) { dismiss() }
            }
        }
    }

    // MARK: Sections

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ NAME")
                .font(ArenaFont.display(size: 10, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaTextMuted)
                .padding(.horizontal, 16)
            TextField("", text: $name, prompt: Text("e.g. WEEKEND MILLION").foregroundColor(.arenaTextDim))
                .font(ArenaFont.mono(size: 14))
                .foregroundColor(.arenaText)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color.arenaBg2)
                .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
                .padding(.horizontal, 16)
                .textInputAutocapitalization(.characters)
        }
    }

    private var prizeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ ECONOMY")
                .font(ArenaFont.display(size: 10, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaTextMuted)
                .padding(.horizontal, 16)

            HStack(spacing: 8) {
                numberField(label: "PRIZE (COINS)", text: $prizeCoins, accent: .arenaGold)
                numberField(label: "MIN PLAYERS", text: $minParticipants, accent: .arenaPrimary)
            }
            .padding(.horizontal, 16)

            numberField(label: "ENTRY COST (0 = FREE)", text: $entryCostCoins, accent: .arenaAccent)
                .padding(.horizontal, 16)

            Text("Below MIN PLAYERS at first kickoff → prize dissolves + entries refunded.")
                .font(ArenaFont.mono(size: 10))
                .foregroundColor(.arenaTextDim)
                .padding(.horizontal, 16)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func numberField(label: String, text: Binding<String>, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.5)
                .foregroundColor(.arenaTextMuted)
            TextField("", text: text)
                .font(ArenaFont.mono(size: 14, weight: .bold))
                .foregroundColor(accent)
                .keyboardType(.numberPad)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color.arenaBg2)
                .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
        }
    }

    private var fixturesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("◆ FIXTURES (\(vm.selectedFixtures.count))")
                    .font(ArenaFont.display(size: 10, weight: .bold))
                    .tracking(3)
                    .foregroundColor(.arenaTextMuted)
                Spacer()
                Button {
                    showingPicker = true
                } label: {
                    Text(vm.selectedFixtures.isEmpty ? "+ ADD" : "+ EDIT")
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(.arenaPrimary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)

            if vm.selectedFixtures.isEmpty {
                Text("Pick fixtures from the League/Team picker.")
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
                    .padding(.horizontal, 16)
            } else {
                VStack(spacing: 6) {
                    ForEach(vm.selectedFixtures, id: \.fixtureId) { fx in
                        HStack {
                            Text("\(fx.teams.home.name ?? "?") vs \(fx.teams.away.name ?? "?")")
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaText)
                                .lineLimit(1)
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.arenaSurface)
                        .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: Submit

    // Local request body. Named `EventBody` (not `Body`) so it does not shadow
    // SwiftUI's `View.Body` typealias — doing so would fail the View protocol.
    private struct EventBody: Encodable {
        let name: String
        let platformPrizeCoins: Int
        let minParticipants: Int
        let entryCostCoins: Int
        let fixtures: [QuinielaCreateFixture]
    }

    private func submit() async {
        errorText = nil
        guard let token = KeychainHelper.getToken() else {
            errorText = "You're not signed in."
            return
        }
        let prize = Int(prizeCoins) ?? 0
        let min = Int(minParticipants) ?? 1
        let cost = Int(entryCostCoins) ?? 0
        let picks = vm.selectedFixtures.filter { $0.isPickable }
        guard !picks.isEmpty else {
            errorText = "Add at least one upcoming or live fixture"
            return
        }

        let body = EventBody(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            platformPrizeCoins: prize,
            minParticipants: min,
            entryCostCoins: cost,
            fixtures: picks.map { fx in
                QuinielaCreateFixture(
                    fixtureId: fx.fixtureId,
                    leagueId: fx.league?.id,
                    leagueName: fx.league?.name,
                    homeTeamId: fx.teams.home.id,
                    awayTeamId: fx.teams.away.id,
                    homeTeam: fx.teams.home.name ?? "Home",
                    awayTeam: fx.teams.away.name ?? "Away",
                    homeLogo: fx.teams.home.logo,
                    awayLogo: fx.teams.away.logo,
                    kickoff: fx.date ?? ISO8601DateFormatter().string(from: fx.kickoffDate ?? Date())
                )
            }
        )

        submitting = true
        defer { submitting = false }
        do {
            let pool: Quiniela = try await client.request(
                method: "POST",
                path: "/admin/pools/platform-event",
                body: body,
                token: token
            )
            createdPool = pool
        } catch {
            if case APIError.server(let msg) = error {
                errorText = msg
            } else {
                errorText = error.localizedDescription
            }
        }
    }
}

// MARK: Created confirmation

private struct EventCreatedSheet: View {
    let pool: Quiniela
    let onClose: () -> Void

    var body: some View {
        ZStack {
            Color.arenaBg.ignoresSafeArea()
            VStack(spacing: 18) {
                Text("✓")
                    .font(.system(size: 56, weight: .black))
                    .foregroundColor(.arenaPrimary)
                Text("EVENT CREATED")
                    .font(ArenaFont.display(size: 20, weight: .black))
                    .tracking(3)
                    .foregroundColor(.arenaText)
                Text(pool.name)
                    .font(ArenaFont.mono(size: 12))
                    .foregroundColor(.arenaTextMuted)
                if let code = pool.inviteCode {
                    Text(code)
                        .font(ArenaFont.display(size: 28, weight: .heavy))
                        .tracking(4)
                        .foregroundColor(.arenaGold)
                        .padding(.top, 6)
                }
                ArcadeButton(title: "DONE", size: .lg, fullWidth: true) {
                    onClose()
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
            }
            .padding(24)
        }
    }
}
