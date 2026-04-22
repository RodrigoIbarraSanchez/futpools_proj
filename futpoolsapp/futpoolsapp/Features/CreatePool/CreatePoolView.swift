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

    /// Single-line hint describing why CREATE is disabled. nil = ready to go.
    /// Order matters: we report the first missing step so the user knows what
    /// to fix next rather than getting a laundry list.
    private var canSubmitHint: String? {
        if vm.draftName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return String(localized: "Add a name to continue")
        }
        if vm.selectedFixtures.isEmpty {
            return String(localized: "Pick at least one match")
        }
        if vm.draftPrizeCoins == 0 && vm.draftEntryCostCoins == 0 {
            return String(localized: "Pick a sponsor prize or coins entry")
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        basicsSection
                        entryTypeSection
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

                VStack(spacing: 8) {
                    Spacer()
                    if let hint = canSubmitHint {
                        // Explain why the CTA is disabled instead of leaving
                        // the user to guess. Single most-blocking reason is
                        // shown to avoid a wall of text.
                        Text(hint)
                            .font(ArenaFont.mono(size: 10, weight: .bold))
                            .tracking(1.2)
                            .foregroundColor(.arenaTextDim)
                            .padding(.horizontal, 20)
                            .multilineTextAlignment(.center)
                    }
                    ArcadeButton(
                        // ArcadeButton takes a raw String, so localize here
                        // at the call site — otherwise the key leaks as-is
                        // to the rendered button.
                        title: vm.isSubmitting
                            ? String(localized: "CREATING…")
                            : String(localized: "▶ CREATE POOL"),
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
                    // `Button(LocalizedStringKey, action:)` auto-localizes.
                    Button(String(localized: "Cancel")) { dismiss() }
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
            // Free-text message the creator leaves for participants — replaces
            // the old PRIZE LABEL field. The prize itself is now real coins
            // set in ENTRY TYPE, so a separate label would be redundant.
            labelField("MESSAGE (optional)") {
                TextField("¡Que gane el mejor! 🏆", text: $vm.draftDescription, axis: .vertical)
                    .lineLimit(2...4)
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

    // MARK: Entry type (v3 — Sponsor default + peer Coins as secondary)

    /// Named preset tiers — 3 levels per industry norm (vs our earlier 5-6
    /// which triggered analysis paralysis). Labels are semantic so users
    /// pick by intent ("am I casual or high stakes?") instead of reading
    /// raw coin amounts and comparing in their head.
    private struct PricePreset {
        let amount: Int
        let tierKey: LocalizedStringKey
    }
    /// Sponsor prize presets (creator-funded). Creator pays amount × 1.1
    /// upfront, winner receives the exact amount. Matches backend whitelist.
    private static let sponsorPrizePresets: [PricePreset] = [
        .init(amount: 50,   tierKey: "CASUAL"),
        .init(amount: 250,  tierKey: "STANDARD"),
        .init(amount: 1000, tierKey: "HIGH STAKES"),
    ]
    /// Peer-pay entry cost presets (everyone pays same fixed amount).
    private static let peerEntryPresets: [PricePreset] = [
        .init(amount: 25,  tierKey: "CASUAL"),
        .init(amount: 100, tierKey: "STANDARD"),
        .init(amount: 500, tierKey: "HIGH STAKES"),
    ]

    private enum WizardMode { case sponsor, coins }
    private var currentMode: WizardMode {
        vm.draftEntryCostCoins > 0 ? .coins : .sponsor
    }

    private var entryTypeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "ENTRY TYPE")

            HStack(spacing: 6) {
                entryTypePill(
                    label: "SPONSOR PRIZE",
                    subtitle: "You pay, friends play free",
                    active: currentMode == .sponsor
                ) {
                    // Seed with the smallest preset so brand-new users (100
                    // signup coins) can afford it (55-coin total cost).
                    if vm.draftPrizeCoins == 0 { vm.setSponsorPrize(50) }
                }
                entryTypePill(
                    label: "COINS ENTRY",
                    subtitle: "Everyone pays the same",
                    active: currentMode == .coins
                ) {
                    if vm.draftEntryCostCoins == 0 { vm.setPeerEntryCost(25) }
                }
            }

            if currentMode == .sponsor {
                sponsorPrizeDetail
            } else {
                peerEntryDetail
            }
        }
        .padding(.horizontal, 16)
    }

    /// Sponsor prize picker: chips + live cost preview ("Total you pay: X").
    private var sponsorPrizeDetail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PRIZE AMOUNT")
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.5)
                .foregroundColor(.arenaTextMuted)

            HStack(spacing: 6) {
                ForEach(Self.sponsorPrizePresets, id: \.amount) { preset in
                    presetChip(
                        amount: preset.amount,
                        tierKey: preset.tierKey,
                        active: vm.draftPrizeCoins == preset.amount,
                        accent: .arenaPrimary
                    ) {
                        vm.setSponsorPrize(preset.amount)
                    }
                }
            }

            let total = Int(ceil(Double(vm.draftPrizeCoins) * 1.1))
            let fee = total - vm.draftPrizeCoins
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("TOTAL YOU PAY")
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(.arenaTextMuted)
                    // "%lld COINS" key lets ES render "100 MONEDAS" cleanly.
                    Text("\(total) COINS")
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .foregroundColor(.arenaGold)
                    Spacer(minLength: 0)
                }
                // Positional specifiers (%1$lld / %2$lld) let translators flip
                // order if the grammar of another locale needs it.
                Text("\(vm.draftPrizeCoins) prize + \(fee) platform fee. If pool doesn't reach min players, you get a full refund.")
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 4)
        }
        .padding(.top, 4)
    }

    /// Peer pay picker: identical to previous v2 experience.
    private var peerEntryDetail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ENTRY COST")
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.5)
                .foregroundColor(.arenaTextMuted)
            HStack(spacing: 6) {
                ForEach(Self.peerEntryPresets, id: \.amount) { preset in
                    presetChip(
                        amount: preset.amount,
                        tierKey: preset.tierKey,
                        active: vm.draftEntryCostCoins == preset.amount,
                        accent: .arenaGold
                    ) {
                        vm.setPeerEntryCost(preset.amount)
                    }
                }
            }
            Text("Minimum 2 players. 10% platform rake — winner takes the rest of the pot.")
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(.arenaTextDim)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 4)
    }

    private func entryTypePill(label: LocalizedStringKey, subtitle: LocalizedStringKey, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
                Text(subtitle)
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(active ? .arenaOnPrimary.opacity(0.85) : .arenaTextMuted)
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

    /// Reusable preset chip — used by both prize and entry-cost pickers. Color
    /// accent differentiates them (primary/green for sponsor, gold for peer).
    /// Tier label (CASUAL/STANDARD/HIGH STAKES) sits above the amount so the
    /// user picks by intent rather than comparing raw numbers.
    private func presetChip(
        amount: Int,
        tierKey: LocalizedStringKey,
        active: Bool,
        accent: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(tierKey)
                    .font(ArenaFont.mono(size: 8, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(active ? .arenaOnPrimary.opacity(0.9) : .arenaTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("\(amount)")
                    .font(ArenaFont.display(size: 18, weight: .black))
                    .foregroundColor(active ? .arenaOnPrimary : accent)
                Text("COINS")
                    .font(ArenaFont.mono(size: 8, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(active ? .arenaOnPrimary.opacity(0.8) : .arenaTextMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 4)
            .background(HudCornerCutShape(cut: 6).fill(active ? accent : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 6).stroke(active ? accent : Color.arenaStroke, lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 6))
        }
        .buttonStyle(.plain)
    }

    private func visibilityPill(_ label: LocalizedStringKey, _ value: String, subtitle: LocalizedStringKey) -> some View {
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
    private func labelField<Content: View>(_ label: LocalizedStringKey, @ViewBuilder _ content: () -> Content) -> some View {
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
    // Use LocalizedStringKey so SwiftUI auto-translates the value from
    // Localizable.strings. With `String`, Text shows the key verbatim
    // because only string literals are resolved against the .strings table.
    let title: LocalizedStringKey
    var body: some View {
        HStack(spacing: 6) {
            Text(verbatim: "◆")
            Text(title)
        }
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
