//
//  QuinielaPickView.swift
//  futpoolsapp
//

import SwiftUI

struct QuinielaPickView: View {
    let quiniela: Quiniela
    /// Optional existing entry to edit. When nil, the view creates a new
    /// entry (POST). When non-nil, we hydrate picks from it and save via
    /// PUT `/quinielas/:id/entries/:entryId`.
    let entryToEdit: QuinielaEntry?
    @Environment(\.dismiss) private var dismiss

    @State private var picks: [Int: String] = [:]
    @State private var focused: Int?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSuccess = false

    private let client = APIClient.shared

    init(quiniela: Quiniela, entryToEdit: QuinielaEntry? = nil) {
        self.quiniela = quiniela
        self.entryToEdit = entryToEdit
        // Seed picks from the edit target so the UI paints with prior
        // choices highlighted instead of flashing empty rows first.
        var seed: [Int: String] = [:]
        if let entry = entryToEdit {
            for p in entry.picks { seed[p.fixtureId] = p.pick }
        }
        _picks = State(initialValue: seed)
    }

    private var isEditing: Bool { entryToEdit != nil }
    private var count: Int { picks.filter { ["1", "X", "2"].contains($0.value) }.count }
    private var total: Int { quiniela.fixtures.count }
    private var complete: Bool { count == total && total > 0 }

    var body: some View {
        ZStack(alignment: .bottom) {
            ArenaBackground()

            ScrollView {
                VStack(spacing: 14) {
                    header
                    progressHeader

                    VStack(spacing: 8) {
                        ForEach(Array(quiniela.fixtures.enumerated()), id: \.offset) { index, fx in
                            ArenaPickRow(
                                fixture: fx,
                                index: index,
                                pick: Binding(
                                    get: { picks[fx.fixtureId] ?? "" },
                                    set: { picks[fx.fixtureId] = $0 }
                                ),
                                focused: focused == fx.fixtureId,
                                onFocus: { focused = fx.fixtureId },
                                onPick: { value in
                                    picks[fx.fixtureId] = value
                                    if index + 1 < quiniela.fixtures.count {
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                                            focused = quiniela.fixtures[index + 1].fixtureId
                                        }
                                    }
                                }
                            )
                        }
                    }
                    .padding(.horizontal, 16)

                    if let msg = errorMessage {
                        Text(msg)
                            .font(ArenaFont.mono(size: 11))
                            .foregroundColor(.arenaDanger)
                            .padding(.horizontal, 16)
                    }
                }
                .padding(.top, 14)
                .padding(.bottom, 140)
            }

            VStack(spacing: 0) {
                LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom).frame(height: 40)
                ArcadeButton(
                    title: submitTitle,
                    size: .lg,
                    fullWidth: true,
                    disabled: !complete || isLoading
                ) { submit() }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
                .background(Color.arenaBg)
            }
        }
        .arenaTabBarHidden()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .overlay {
            if showSuccess {
                PicksLockedOverlay {
                    showSuccess = false
                    dismiss()
                }
            }
        }
    }

    private var submitTitle: String {
        if isLoading { return String(localized: "SUBMITTING…") }
        if complete {
            return isEditing ? String(localized: "▶ SAVE CHANGES") : String(localized: "▶ SUBMIT PICKS")
        }
        return String(format: String(localized: "COMPLETE ALL (%d LEFT)"), total - count)
    }

    private var header: some View {
        // Back chevron comes from the native NavigationStack toolbar — no duplicate here.
        HStack {
            Spacer()
            Text(isEditing ? String(localized: "EDIT YOUR PICKS") : String(localized: "MAKE YOUR PICKS"))
                .font(ArenaFont.display(size: 12, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaText)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private var progressHeader: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("◆ PROGRESS · \(count)/\(total)")
                    .font(ArenaFont.mono(size: 9))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextMuted)
                XpBar(value: Double(count), max: Double(max(total, 1)), color: complete ? .arenaPrimary : .arenaAccent, segments: max(total, 1), height: 6)
            }
            HudChip(text: complete ? "READY" : "\(total - count) LEFT", color: complete ? .arenaPrimary : .arenaTextMuted)
        }
        .padding(.horizontal, 16)
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
                guard let token = KeychainHelper.getToken() else {
                    errorMessage = "Please sign in to submit picks."
                    isLoading = false
                    return
                }
                if let editing = entryToEdit {
                    let _: QuinielaEntry = try await client.request(
                        method: "PUT",
                        path: "/quinielas/\(quiniela.id)/entries/\(editing.id)",
                        body: payload,
                        token: token
                    )
                } else {
                    let _: QuinielaEntry = try await client.request(
                        method: "POST",
                        path: "/quinielas/\(quiniela.id)/entries",
                        body: payload,
                        token: token
                    )
                }
                showSuccess = true
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

private struct ArenaPickRow: View {
    let fixture: QuinielaFixture
    let index: Int
    @Binding var pick: String
    let focused: Bool
    let onFocus: () -> Void
    let onPick: (String) -> Void

    @State private var animateIn = false

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("#\(String(format: "%02d", index + 1))")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaPrimary)
                Text(kickoffShort)
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextMuted)
                Spacer()
            }

            HStack(spacing: 10) {
                VStack(spacing: 4) {
                    TeamCrestArena(
                        name: fixture.homeTeam,
                        color: ArenaTeamColor.color(for: fixture.homeTeam),
                        size: 34,
                        logoURL: fixture.homeLogo
                    )
                    Text(String(fixture.homeTeam.prefix(3)).uppercased())
                        .font(ArenaFont.display(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundColor(.arenaText)
                }
                .frame(maxWidth: .infinity)

                Text("VS")
                    .font(ArenaFont.display(size: 10, weight: .bold))
                    .tracking(2)
                    .foregroundColor(.arenaTextMuted)

                VStack(spacing: 4) {
                    TeamCrestArena(
                        name: fixture.awayTeam,
                        color: ArenaTeamColor.color(for: fixture.awayTeam),
                        size: 34,
                        logoURL: fixture.awayLogo
                    )
                    Text(String(fixture.awayTeam.prefix(3)).uppercased())
                        .font(ArenaFont.display(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundColor(.arenaText)
                }
                .frame(maxWidth: .infinity)
            }

            HStack(spacing: 6) {
                PickOption(label: "1", sublabel: String(fixture.homeTeam.prefix(3)).uppercased(), isSelected: pick == "1") { onPick("1") }
                PickOption(label: "X", sublabel: "DRAW", isSelected: pick == "X") { onPick("X") }
                PickOption(label: "2", sublabel: String(fixture.awayTeam.prefix(3)).uppercased(), isSelected: pick == "2") { onPick("2") }
            }
        }
        .padding(12)
        .background(
            HudCornerCutShape(cut: 8)
                .fill(focused ? Color.arenaPrimary.opacity(0.05) : Color.arenaSurface)
        )
        .overlay(
            HudCornerCutShape(cut: 8)
                .stroke(focused ? Color.arenaPrimary.opacity(0.4) : Color.arenaStroke, lineWidth: 1)
        )
        .clipShape(HudCornerCutShape(cut: 8))
        .onTapGesture { onFocus() }
        .opacity(animateIn ? 1 : 0)
        .offset(y: animateIn ? 0 : 12)
        .onAppear {
            withAnimation(.easeOut(duration: 0.35).delay(Double(index) * 0.05)) {
                animateIn = true
            }
        }
    }

    private var kickoffShort: String {
        guard let d = fixture.kickoffDate else { return "" }
        let f = DateFormatter(); f.dateFormat = "EEE HH:mm"; f.locale = Locale(identifier: "en_US")
        return f.string(from: d).uppercased()
    }
}

private struct PickOption: View {
    let label: String
    let sublabel: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(label)
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .foregroundColor(isSelected ? .arenaOnPrimary : .arenaTextDim)
                Text(sublabel)
                    .font(ArenaFont.mono(size: 8))
                    .tracking(1)
                    .foregroundColor(isSelected ? .arenaOnPrimary.opacity(0.75) : .arenaTextMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 6)
            .background(
                HudCornerCutShape(cut: 8)
                    .fill(isSelected ? Color.arenaPrimary : Color.arenaBg2)
            )
            .overlay(
                HudCornerCutShape(cut: 8)
                    .stroke(isSelected ? Color.arenaPrimary : .clear, lineWidth: 2)
            )
            .clipShape(HudCornerCutShape(cut: 8))
            .shadow(color: isSelected ? .arenaPrimary.opacity(0.6) : .clear, radius: 10)
        }
        .buttonStyle(.plain)
    }
}

private struct PicksLockedOverlay: View {
    let onDismiss: () -> Void
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.85).ignoresSafeArea()
            VStack(spacing: 14) {
                Text("🏆")
                    .font(.system(size: 72))
                    .shadow(color: .arenaPrimary, radius: 20)
                    .scaleEffect(appeared ? 1 : 0.3)
                    .opacity(appeared ? 1 : 0)
                Text("PICKS LOCKED!")
                    .font(ArenaFont.display(size: 28, weight: .black))
                    .tracking(3)
                    .foregroundColor(.arenaPrimary)
                Text("¡Buena suerte, jugador!")
                    .font(ArenaFont.body(size: 13))
                    .foregroundColor(.arenaTextDim)
                ArcadeButton(title: "▶ CONTINUE", action: onDismiss)
                    .padding(.top, 10)
            }
            .padding(28)
        }
        .sensoryFeedback(.success, trigger: appeared)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                appeared = true
            }
        }
    }
}
