//
//  CreatePoolView.swift
//  futpoolsapp
//
//  Any authenticated user can create a pool. Fixtures are picked by searching
//  for a league or team (dashboard-style) and adding matches one by one.
//

import SwiftUI

struct CreatePoolView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AuthService
    @StateObject private var vm = CreatePoolViewModel()
    @State private var createdPool: Quiniela?
    @State private var showingPicker = false

    private var isAdmin: Bool { auth.currentUser?.isAdmin == true }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        basicsSection
                        visibilitySection
                        fixturesSection
                        if let err = vm.errorMessage {
                            Text(err)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaDanger)
                                .padding(.horizontal, 16)
                        }
                    }
                    .padding(.vertical, 14)
                    .padding(.bottom, 140)
                }

                VStack {
                    Spacer()
                    ArcadeButton(
                        title: vm.isSubmitting ? "CREATING…" : "▶ CREATE POOL",
                        size: .lg,
                        fullWidth: true,
                        disabled: !vm.canSubmit || vm.isSubmitting
                    ) {
                        Task {
                            if let pool = await vm.submit() {
                                createdPool = pool
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 28)
                    .background(
                        LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom)
                            .frame(height: 80)
                    )
                }
            }
            .navigationTitle("CREATE POOL")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.arenaTextDim)
                }
            }
            .sheet(isPresented: $showingPicker) {
                FixturePickerSheet(vm: vm)
                    .preferredColorScheme(.dark)
            }
            .sheet(item: $createdPool) { pool in
                SharePoolSheet(pool: pool) {
                    createdPool = nil
                    dismiss()
                }
            }
        }
    }

    // MARK: Sections

    private var basicsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "BASICS")
            labelField("NAME") {
                TextField("La vaquita del mundial", text: $vm.draftName)
                    .createPoolFieldStyle()
            }
            labelField("PRIZE LABEL (optional)") {
                TextField("el perdedor paga la pizza", text: $vm.draftPrizeLabel)
                    .createPoolFieldStyle()
            }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var visibilitySection: some View {
        // Non-admins can only create private pools, so we hide the selector
        // entirely and show a subtle note instead of teasing a button they
        // can't tap.
        if isAdmin {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "VISIBILITY")
                HStack(spacing: 6) {
                    visibilityPill("PRIVATE", "private", subtitle: "Only people with the code")
                    visibilityPill("PUBLIC",  "public",  subtitle: "Show in everyone's Home")
                }
            }
            .padding(.horizontal, 16)
        } else {
            HStack(spacing: 6) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.arenaTextDim)
                Text("PRIVATE POOL — share by invite code")
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
            }
            .padding(.horizontal, 16)
            .onAppear {
                if vm.draftVisibility != "private" { vm.draftVisibility = "private" }
            }
        }
    }

    private func visibilityPill(_ label: String, _ value: String, subtitle: String) -> some View {
        let active = vm.draftVisibility == value
        return Button {
            vm.draftVisibility = value
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
                Text(subtitle)
                    .font(ArenaFont.mono(size: 9))
                    .tracking(0.5)
                    .foregroundColor(active ? .arenaOnPrimary.opacity(0.8) : .arenaTextMuted)
                    .multilineTextAlignment(.leading)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HudCornerCutShape(cut: 8).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }

    private var fixturesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionHeader(title: "FIXTURES")
                Spacer()
                if !vm.selectedFixtures.isEmpty {
                    Text("\(vm.selectedFixtures.count) SELECTED")
                        .font(ArenaFont.mono(size: 10))
                        .tracking(1.5)
                        .foregroundColor(.arenaAccent)
                }
            }

            if vm.selectedFixtures.isEmpty {
                emptyBasket
            } else {
                VStack(spacing: 6) {
                    ForEach(vm.selectedFixtures) { fx in
                        basketRow(fx)
                    }
                }
                addMoreButton
            }
        }
        .padding(.horizontal, 16)
    }

    private var emptyBasket: some View {
        Button { showingPicker = true } label: {
            VStack(spacing: 10) {
                Image(systemName: "plus.magnifyingglass")
                    .font(.system(size: 26, weight: .light))
                    .foregroundColor(.arenaPrimary)
                Text("ADD FIXTURES")
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaPrimary)
                Text("Search any league or team — add games one by one")
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextMuted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
            .padding(.horizontal, 16)
            .background(HudCornerCutShape(cut: 10).fill(Color.arenaSurface.opacity(0.5)))
            .overlay(
                HudCornerCutShape(cut: 10)
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundColor(.arenaPrimary.opacity(0.5))
            )
        }
        .buttonStyle(.plain)
    }

    private var addMoreButton: some View {
        Button { showingPicker = true } label: {
            HStack(spacing: 6) {
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                Text("ADD MORE FIXTURES")
                    .font(ArenaFont.display(size: 11, weight: .heavy))
                    .tracking(2)
            }
            .foregroundColor(.arenaPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .overlay(
                HudCornerCutShape(cut: 6)
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundColor(.arenaPrimary.opacity(0.6))
            )
        }
        .buttonStyle(.plain)
    }

    private func basketRow(_ fx: PickerFixture) -> some View {
        HStack(spacing: 10) {
            TeamCrestArena(
                name: fx.teams.home.name ?? "?",
                color: .arenaAccent,
                size: 32,
                logoURL: fx.teams.home.logo
            )
            VStack(alignment: .leading, spacing: 2) {
                Text("\(fx.teams.home.name ?? "?") vs \(fx.teams.away.name ?? "?")")
                    .font(ArenaFont.display(size: 12, weight: .bold))
                    .foregroundColor(.arenaText)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(fx.kickoffLabel)
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                    if let leagueName = fx.league?.name {
                        Text("· \(leagueName)")
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextDim)
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
            TeamCrestArena(
                name: fx.teams.away.name ?? "?",
                color: .arenaHot,
                size: 32,
                logoURL: fx.teams.away.logo
            )
            Button {
                vm.removeFixture(fx)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.arenaTextDim)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(Color.arenaSurfaceAlt))
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 6))
    }

    @ViewBuilder
    private func labelField<Content: View>(_ label: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ArenaFont.mono(size: 10))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            content()
        }
    }
}

private struct SectionHeader: View {
    let title: String
    var body: some View {
        Text("◆ \(title)")
            .font(ArenaFont.display(size: 11, weight: .bold))
            .tracking(3)
            .foregroundColor(.arenaPrimary)
    }
}

private extension View {
    func createPoolFieldStyle() -> some View {
        self
            .font(ArenaFont.mono(size: 14))
            .foregroundColor(.arenaText)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.arenaBg2)
            .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
    }
}

#Preview {
    CreatePoolView()
        .preferredColorScheme(.dark)
}
