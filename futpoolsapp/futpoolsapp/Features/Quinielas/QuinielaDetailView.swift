//
//  QuinielaDetailView.swift
//  futpoolsapp
//

import SwiftUI

private enum ArenaPoolTab: String, CaseIterable {
    case fixtures = "FIXTURES"
    case ranking  = "RANKING"
    // `rules` lives in a modal now (triggered by a "?" button next to share)
    // — a full tab was overkill for reference content users peek at once.
}

struct QuinielaDetailView: View {
    @State var quiniela: Quiniela
    var onDeleted: (() -> Void)?
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab: ArenaPoolTab = .fixtures
    @State private var showPickView = false
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var entryCount = 0
    @State private var latestEntryNumber: Int?
    @State private var latestEntryDate: String?
    @State private var liveFixtures: [Int: LiveFixture] = [:]
    @State private var leaderboard: LeaderboardResponse?
    @State private var leaderboardLoading = false
    @State private var showInsufficientBalanceSheet = false
    @State private var showRechargeSheet = false
    @State private var showRulesSheet = false
    @State private var pendingRechargeAfterDismiss = false
    @State private var liveTimer: Timer?
    @State private var adminErrorMessage: String?
    @State private var isTogglingFeatured = false
    /// Picks (fixtureId → "1"|"X"|"2") for the current user, loaded once per
    /// detail open to power the LiveMatchView's "YOUR PICK" card.
    @State private var myPicks: [Int: String] = [:]

    private let client = APIClient.shared

    private var userBalance: Double { auth.currentUser?.balanceValue ?? 0 }
    private var entryCost: Double { quiniela.entryCostValue }
    private var hasEnoughBalance: Bool { userBalance >= entryCost }
    private var isAdmin: Bool { auth.currentUser?.isAdmin == true }
    private var isOwner: Bool {
        guard let uid = auth.currentUser?.id, let by = quiniela.createdBy else { return false }
        return uid == by
    }
    private var canManage: Bool { isAdmin || isOwner }

    var body: some View {
        ZStack(alignment: .bottom) {
            ArenaBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    prizeHero
                    tabStrip
                    tabContent
                }
                .padding(.bottom, 140)
            }

            // Sticky CTA
            VStack(spacing: 0) {
                LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom)
                    .frame(height: 40)
                ArcadeButton(
                    title: canJoin
                        ? String(format: NSLocalizedString("▶ MAKE PICKS · %@", comment: ""), quiniela.cost)
                        : NSLocalizedString("POOL LOCKED", comment: ""),
                    size: .lg,
                    fullWidth: true,
                    disabled: !canJoin
                ) {
                    if canJoin && !hasEnoughBalance {
                        showInsufficientBalanceSheet = true
                    } else if canJoin {
                        showPickView = true
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
                .background(Color.arenaBg)
            }
        }
        .arenaTabBarHidden()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            // Share button is visible to anyone who can see the pool (needs an inviteCode).
            if let code = quiniela.inviteCode, let url = URL(string: "futpools://p/\(code)") {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundColor(.arenaText)
                    }
                }
            }
            // Rules moved from a tab to a modal — sits next to share so it's
            // reachable at any time without hijacking a whole tab slot.
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showRulesSheet = true
                } label: {
                    Image(systemName: "questionmark.circle")
                        .foregroundColor(.arenaText)
                }
                .accessibilityLabel(Text("GAME RULES"))
            }
            if canManage {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            showEditSheet = true
                        } label: {
                            Label("Edit pool", systemImage: "pencil")
                        }
                        if isAdmin {
                            Button {
                                toggleFeatured()
                            } label: {
                                Label(
                                    quiniela.featured == true ? "Remove from featured" : "Mark as featured",
                                    systemImage: quiniela.featured == true ? "star.slash.fill" : "star.fill"
                                )
                            }
                            .disabled(isTogglingFeatured)
                        }
                        Button(role: .destructive) { showDeleteConfirm = true } label: { Label("Delete pool", systemImage: "trash") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.arenaText)
                    }
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            EditQuinielaSheet(
                quiniela: quiniela,
                onSave: { updated in
                    quiniela = updated
                    showEditSheet = false
                    onDeleted?()
                },
                onDismiss: { showEditSheet = false },
                onError: { msg in adminErrorMessage = msg }
            )
        }
        .sheet(isPresented: $showRulesSheet) {
            NavigationStack {
                ZStack {
                    ArenaBackground()
                    ScrollView {
                        ArenaRulesPanel(quiniela: quiniela)
                            .padding(16)
                    }
                }
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(String(localized: "Close")) { showRulesSheet = false }
                            .foregroundColor(.arenaTextDim)
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .alert(
            "Update failed",
            isPresented: Binding(
                get: { adminErrorMessage != nil },
                set: { if !$0 { adminErrorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { adminErrorMessage = nil }
        } message: {
            Text(adminErrorMessage ?? "")
        }
        .navigationDestination(isPresented: $showPickView) {
            QuinielaPickView(quiniela: quiniela)
        }
        .sheet(isPresented: $showInsufficientBalanceSheet) {
            ArenaInsufficientBalanceSheet(
                entryCost: entryCost,
                currentBalance: userBalance,
                onRecharge: {
                    pendingRechargeAfterDismiss = true
                    showInsufficientBalanceSheet = false
                },
                onDismiss: { showInsufficientBalanceSheet = false }
            )
        }
        .onChange(of: showInsufficientBalanceSheet) { _, newValue in
            if !newValue && pendingRechargeAfterDismiss {
                pendingRechargeAfterDismiss = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    showRechargeSheet = true
                }
            }
        }
        .sheet(isPresented: $showRechargeSheet) {
            RechargeView().environmentObject(auth)
        }
        .confirmationDialog("Delete pool?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { performDelete() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently delete \"\(quiniela.name)\" and all its entries.")
        }
        .onAppear {
            loadEntryCount()
            loadLiveFixtures(force: true)
            loadLeaderboard()
            loadMyPicks()
            startLivePolling()
        }
        .onDisappear { stopLivePolling() }
        .onChange(of: showPickView) { _, newValue in
            if newValue == false {
                loadEntryCount()
                loadLeaderboard()
                loadMyPicks()
                Task { await auth.fetchUser() }
            }
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Spacer()
                Text("[ POOL · \(quiniela.id.prefix(6).uppercased()) ]")
                    .font(ArenaFont.mono(size: 10))
                    .tracking(2)
                    .foregroundColor(.arenaTextMuted)
                Spacer()
            }

            Text(quiniela.name.uppercased())
                .font(ArenaFont.display(size: 24, weight: .heavy))
                .tracking(1)
                .foregroundColor(.arenaText)

            if let by = quiniela.createdByUsername {
                Text(String(format: NSLocalizedString("CREATED BY @%@", comment: "pool creator"), by.uppercased()))
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
            }

            // v3: show the creator's free-text message (replaces the legacy
            // prizeLabel). Speech-bubble glyph makes the intent obvious — this
            // is a note to participants, not a prize statement.
            if let msg = quiniela.description, !msg.isEmpty {
                Text("💬 \(msg)")
                    .font(ArenaFont.body(size: 12))
                    .foregroundColor(.arenaText)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }

            HStack(spacing: 8) {
                if derivedStatus.showDot {
                    LiveDot(color: derivedStatus.color, size: 6)
                }
                Text(derivedStatus.label)
                    .font(ArenaFont.mono(size: 11, weight: .bold))
                    .tracking(1)
                    .foregroundColor(derivedStatus.color)
                Spacer()
                if let n = quiniela.entriesCount {
                    Text(String(format: NSLocalizedString("%lld PLAYERS", comment: "player count"), n))
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextMuted)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
    }

    /// Derives a live/upcoming/finished status from the actual fixture states, not
    /// just the pool's `status` field. Prevents "LIVE NOW" being shown when every
    /// match has already ended.
    private var derivedStatus: (label: String, color: Color, showDot: Bool) {
        let now = Date()

        let hasActualLive = quiniela.fixtures.contains { fx in
            liveFixtures[fx.fixtureId]?.status.isLive == true
        }
        if hasActualLive {
            return (NSLocalizedString("LIVE NOW", comment: ""), .arenaDanger, true)
        }

        let upcomingDates = quiniela.fixtures.compactMap { fx -> Date? in
            if let live = liveFixtures[fx.fixtureId],
               let short = live.status.short?.uppercased(),
               ["FT", "AET", "PEN"].contains(short) {
                return nil // finished
            }
            if let date = fx.kickoffDate, date > now { return date }
            return nil
        }
        if let next = upcomingDates.min() {
            let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short
            f.locale = Locale.current
            let label = String(format: NSLocalizedString("OPENS · %@", comment: "next kickoff"),
                               f.string(from: next).uppercased())
            return (label, .arenaAccent, false)
        }

        return (NSLocalizedString("POOL FINISHED", comment: ""), .arenaTextMuted, false)
    }

    // MARK: Prize hero

    private var prizeHero: some View {
        HudFrame(
            cut: 14,
            fill: AnyShapeStyle(
                LinearGradient(
                    colors: [Color.arenaGold.opacity(0.2), Color.arenaBg2],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            ),
            glow: .arenaGold
        ) {
            HStack(spacing: 16) {
                Text("🏆")
                    .font(.system(size: 34))
                    .shadow(color: .arenaGold, radius: 10)
                VStack(alignment: .leading, spacing: 4) {
                    Text("PRIZE POOL")
                        .font(ArenaFont.mono(size: 9))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    Text(quiniela.prize)
                        .font(ArenaFont.display(size: 26, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaGold)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("ENTRY")
                        .font(ArenaFont.mono(size: 9))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    Text(quiniela.cost)
                        .font(ArenaFont.mono(size: 18, weight: .bold))
                        .foregroundColor(.arenaText)
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
        }
        .padding(.horizontal, 16)
    }

    // MARK: Tabs

    private var tabStrip: some View {
        HStack(spacing: 4) {
            ForEach(ArenaPoolTab.allCases, id: \.self) { tab in
                Button { selectedTab = tab } label: {
                    Text(tab.rawValue)
                        .font(ArenaFont.display(size: 11, weight: .bold))
                        .tracking(2)
                        .foregroundColor(selectedTab == tab ? .arenaOnPrimary : .arenaTextDim)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(
                            HudCornerCutShape(cut: 8)
                                .fill(selectedTab == tab ? Color.arenaPrimary : Color.arenaSurfaceAlt)
                        )
                        .clipShape(HudCornerCutShape(cut: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .fixtures:
            VStack(spacing: 8) {
                ForEach(quiniela.fixtures) { fx in
                    NavigationLink {
                        LiveMatchView(fixture: fx, userPick: myPicks[fx.fixtureId])
                    } label: {
                        ArenaFixtureRow(fixture: fx, live: liveFixtures[fx.fixtureId])
                            .padding(.horizontal, 16)
                    }
                    .buttonStyle(.plain)
                }
                if latestEntryNumber != nil {
                    HStack {
                        Text(entryStatusLine)
                            .font(ArenaFont.mono(size: 10))
                            .foregroundColor(.arenaTextDim)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                }
            }

        case .ranking:
            ArenaLeaderboardPanel(leaderboard: leaderboard, isLoading: leaderboardLoading)
                .padding(.horizontal, 16)
        }
    }

    private var entryStatusLine: String {
        let n = entryCount
        let latest = latestEntryNumber.map { "#\($0)" } ?? ""
        let date = latestEntryDate ?? ""
        let entries = n == 1 ? "entry" : "entries"
        return "You have \(n) \(entries) \(latest) · \(date)".trimmingCharacters(in: .whitespaces)
    }

    // MARK: Logic

    private var canJoin: Bool {
        guard !quiniela.fixtures.isEmpty else { return false }
        let now = Date()
        for fixture in quiniela.fixtures {
            if let live = liveFixtures[fixture.fixtureId] {
                if live.status.isLive == true { return false }
                if let short = live.status.short?.uppercased(),
                   !["NS", "TBD", "PST"].contains(short) {
                    return false
                }
                if let date = live.scheduledDate, date <= now { return false }
            } else if let date = fixture.kickoffDate, date <= now {
                return false
            }
        }
        return true
    }

    private func loadEntryCount() {
        Task {
            guard let token = KeychainHelper.getToken() else { return }
            do {
                let entries: [QuinielaEntry] = try await client.request(
                    method: "GET",
                    path: "/quinielas/\(quiniela.id)/entries/me",
                    token: token
                )
                entryCount = entries.count
                if let first = entries.first {
                    latestEntryNumber = first.entryNumber ?? entries.count
                    let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short
                    latestEntryDate = first.createdAtValue.map(f.string(from:))
                }
            } catch {}
        }
    }

    /// Picks of the user's latest entry — used by the LiveMatchView's
    /// "YOUR PICK" card. Picks from older entries are ignored to keep the
    /// detail predictable when the user has multiple entries.
    private func loadMyPicks() {
        Task {
            guard let token = KeychainHelper.getToken() else { return }
            do {
                let entries: [QuinielaEntry] = try await client.request(
                    method: "GET",
                    path: "/quinielas/\(quiniela.id)/entries/me",
                    token: token
                )
                let latest = entries
                    .sorted { ($0.entryNumber ?? 0) > ($1.entryNumber ?? 0) }
                    .first
                var map: [Int: String] = [:]
                for p in latest?.picks ?? [] { map[p.fixtureId] = p.pick }
                myPicks = map
            } catch {}
        }
    }

    private func loadLeaderboard() {
        Task {
            leaderboardLoading = true
            leaderboard = try? await client.request(
                method: "GET",
                path: "/quinielas/\(quiniela.id)/leaderboard",
                token: KeychainHelper.getToken()
            )
            leaderboardLoading = false
        }
    }

    /// Skip polls when this pool has no live match and no kickoff inside the
    /// ±3h window — keeps the detail screen quiet when the pool is "settled"
    /// or days away from kickoff.
    private func shouldSkipLivePoll() -> Bool {
        let anyLive = liveFixtures.values.contains { $0.status.isLive == true }
        if anyLive { return false }
        let now = Date()
        let windowStart = now.addingTimeInterval(-3 * 3600)
        let windowEnd = now.addingTimeInterval(60 * 60)
        let inWindow = quiniela.fixtures
            .compactMap { $0.kickoffDate }
            .contains { $0 >= windowStart && $0 <= windowEnd }
        return !inWindow
    }

    private func loadLiveFixtures(force: Bool = false) {
        Task {
            let ids = quiniela.fixtures.map { $0.fixtureId }
            guard !ids.isEmpty else { return }
            if !force && shouldSkipLivePoll() { return }
            do {
                let data: [LiveFixture] = try await client.request(
                    method: "GET",
                    path: "/football/fixtures?ids=\(ids.map(String.init).joined(separator: ","))"
                )
                var map: [Int: LiveFixture] = [:]
                for f in data { if let id = f.fixtureId { map[id] = f } }
                liveFixtures = map
            } catch {}
        }
    }

    private func startLivePolling() {
        liveTimer?.invalidate()
        liveTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            loadLiveFixtures()
        }
    }

    private func stopLivePolling() {
        liveTimer?.invalidate()
        liveTimer = nil
    }

    private func performDelete() {
        guard let token = KeychainHelper.getToken() else { return }
        Task {
            try? await client.requestVoid(method: "DELETE", path: "/quinielas/\(quiniela.id)", token: token)
            await MainActor.run {
                onDeleted?()
                dismiss()
            }
        }
    }

    private func toggleFeatured() {
        guard let token = KeychainHelper.getToken() else {
            adminErrorMessage = "You're not signed in."
            return
        }
        let newValue = !(quiniela.featured == true)
        isTogglingFeatured = true
        Task {
            do {
                let updated: Quiniela = try await client.request(
                    method: "PUT",
                    path: "/quinielas/\(quiniela.id)",
                    body: QuinielaFeaturedRequest(featured: newValue),
                    token: token
                )
                await MainActor.run {
                    quiniela = updated
                    isTogglingFeatured = false
                    if (updated.featured ?? false) != newValue {
                        // Backend accepted the call but didn't store/return `featured`.
                        adminErrorMessage = "Server saved the pool but did not persist the 'featured' field. Make sure the backend's Quiniela schema and PUT /quinielas/:id handler accept & return `featured`."
                    } else {
                        onDeleted?() // tell Home to refetch the list
                    }
                }
            } catch {
                print("[QuinielaDetail] toggleFeatured error: \(error)")
                await MainActor.run {
                    isTogglingFeatured = false
                    adminErrorMessage = "Could not toggle featured: \(error.localizedDescription)"
                }
            }
        }
    }
}

// MARK: - Edit Quiniela sheet (admin)

private struct EditQuinielaSheet: View {
    let quiniela: Quiniela
    let onSave: (Quiniela) -> Void
    let onDismiss: () -> Void
    let onError: (String) -> Void

    @State private var name: String
    @State private var description: String
    @State private var prize: String
    @State private var cost: String
    @State private var featured: Bool
    @State private var saving = false
    @State private var errorMessage: String?

    private let client = APIClient.shared

    init(
        quiniela: Quiniela,
        onSave: @escaping (Quiniela) -> Void,
        onDismiss: @escaping () -> Void,
        onError: @escaping (String) -> Void
    ) {
        self.quiniela = quiniela
        self.onSave = onSave
        self.onDismiss = onDismiss
        self.onError = onError
        _name = State(initialValue: quiniela.name)
        _description = State(initialValue: quiniela.description ?? "")
        _prize = State(initialValue: quiniela.prize)
        _cost = State(initialValue: quiniela.cost)
        _featured = State(initialValue: quiniela.featured ?? false)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.arenaBg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        field(label: "NAME") {
                            TextField("", text: $name).arenaFieldStyle()
                        }
                        field(label: "DESCRIPTION") {
                            TextField("", text: $description, axis: .vertical)
                                .lineLimit(3...6)
                                .arenaFieldStyle()
                        }
                        HStack(spacing: 12) {
                            field(label: "PRIZE") {
                                TextField("", text: $prize).arenaFieldStyle()
                            }
                            field(label: "ENTRY COST") {
                                TextField("", text: $cost).arenaFieldStyle()
                            }
                        }

                        // Featured toggle
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("FEATURED")
                                    .font(ArenaFont.mono(size: 10))
                                    .tracking(2)
                                    .foregroundColor(.arenaTextMuted)
                                Text("Pin to QUICK PLAY hero/carousel")
                                    .font(ArenaFont.body(size: 12))
                                    .foregroundColor(.arenaTextDim)
                            }
                            Spacer()
                            Toggle("", isOn: $featured)
                                .labelsHidden()
                                .tint(.arenaPrimary)
                        }
                        .padding(.vertical, 6)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaDanger)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("EDIT POOL")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                        .foregroundColor(.arenaTextDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { save() }
                        .fontWeight(.semibold)
                        .foregroundColor(.arenaPrimary)
                        .disabled(saving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || prize.isEmpty || cost.isEmpty)
                }
            }
        }
    }

    @ViewBuilder
    private func field(label: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ArenaFont.mono(size: 10))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() {
        guard let token = KeychainHelper.getToken() else { return }
        saving = true
        errorMessage = nil
        Task {
            do {
                let body = QuinielaUpdateRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    description: description.isEmpty ? nil : description,
                    prize: prize.trimmingCharacters(in: .whitespacesAndNewlines),
                    cost: cost.trimmingCharacters(in: .whitespacesAndNewlines),
                    currency: quiniela.currency,
                    featured: featured
                )
                let updated: Quiniela = try await client.request(
                    method: "PUT",
                    path: "/quinielas/\(quiniela.id)",
                    body: body,
                    token: token
                )
                await MainActor.run {
                    saving = false
                    onSave(updated)
                }
            } catch {
                print("[EditQuiniela] save error: \(error)")
                await MainActor.run {
                    saving = false
                    errorMessage = "Could not save: \(error.localizedDescription)"
                    onError("Could not save pool edits. See logs for details.")
                }
            }
        }
    }
}

private extension View {
    /// Minimal Arena-styled text input look reused inside the edit sheet.
    func arenaFieldStyle() -> some View {
        self
            .font(ArenaFont.mono(size: 14))
            .foregroundColor(.arenaText)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.arenaBg2)
            .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
    }
}

// MARK: - Small components

struct ArenaFixtureRow: View {
    let fixture: QuinielaFixture
    let live: LiveFixture?

    private var isLive: Bool { live?.status.isLive == true }
    private var scoreString: String? {
        guard let live, live.score.home != nil || live.score.away != nil else { return nil }
        return "\(live.score.home ?? 0)–\(live.score.away ?? 0)"
    }

    var body: some View {
        HudFrame(cut: 14, glow: isLive ? .arenaDanger : nil) {
            VStack(spacing: 10) {
                HStack {
                    Text(kickoffShort)
                        .font(ArenaFont.mono(size: 9))
                        .tracking(1.5)
                        .foregroundColor(.arenaTextMuted)
                    Spacer()
                    if isLive, let elapsed = live?.status.elapsed {
                        HStack(spacing: 4) {
                            LiveDot(color: .arenaDanger, size: 5)
                            Text("\(elapsed)'")
                                .font(ArenaFont.mono(size: 10, weight: .bold))
                                .tracking(1)
                                .foregroundColor(.arenaDanger)
                        }
                    }
                }

                HStack(spacing: 10) {
                    HStack(spacing: 8) {
                        TeamCrestArena(
                            name: fixture.homeTeam,
                            color: ArenaTeamColor.color(for: fixture.homeTeam),
                            size: 32,
                            logoURL: fixture.homeLogo
                        )
                        Text(String(fixture.homeTeam.prefix(3)).uppercased())
                            .font(ArenaFont.display(size: 13, weight: .bold))
                            .tracking(0.5)
                            .foregroundColor(.arenaText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if let scoreString {
                        Text(scoreString)
                            .font(ArenaFont.mono(size: 22, weight: .bold))
                            .foregroundColor(.arenaText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 4)
                            .background(HudCornerCutShape(cut: 8).fill(Color.arenaBg2))
                            .clipShape(HudCornerCutShape(cut: 8))
                            .shadow(color: .arenaDanger.opacity(isLive ? 0.7 : 0), radius: 6)
                    } else {
                        Text("VS")
                            .font(ArenaFont.display(size: 10, weight: .bold))
                            .tracking(2)
                            .foregroundColor(.arenaTextMuted)
                    }

                    HStack(spacing: 8) {
                        Text(String(fixture.awayTeam.prefix(3)).uppercased())
                            .font(ArenaFont.display(size: 13, weight: .bold))
                            .tracking(0.5)
                            .foregroundColor(.arenaText)
                        TeamCrestArena(
                            name: fixture.awayTeam,
                            color: ArenaTeamColor.color(for: fixture.awayTeam),
                            size: 32,
                            logoURL: fixture.awayLogo
                        )
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .padding(12)
        }
    }

    private var kickoffShort: String {
        guard let d = fixture.kickoffDate else { return "" }
        let f = DateFormatter(); f.dateFormat = "EEE HH:mm"
        return f.string(from: d).uppercased()
    }
}

struct ArenaLeaderboardPanel: View {
    let leaderboard: LeaderboardResponse?
    let isLoading: Bool

    /// `totalPossible` is 0 until at least one fixture has a final result. We
    /// still show the participants (ordered by join number) so the leaderboard
    /// doesn't look broken; a small note explains why scores are blank.
    private var awaitingFirstResult: Bool {
        (leaderboard?.leaderboard.first?.totalPossible ?? 0) == 0
    }

    var body: some View {
        HudFrame {
            VStack(spacing: 14) {
                HStack(spacing: 0) {
                    Text("◆ LEADERBOARD")
                        .font(ArenaFont.display(size: 11, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaPrimary)
                    Spacer(minLength: 0)
                }

                if isLoading {
                    ProgressView().tint(.arenaPrimary)
                } else if let lb = leaderboard, let entries = leaderboardEntries(lb), !entries.isEmpty {
                    if awaitingFirstResult {
                        Text(NSLocalizedString("RANKED BY JOIN ORDER · RESULTS PENDING", comment: ""))
                            .font(ArenaFont.mono(size: 9, weight: .bold))
                            .tracking(1.5)
                            .foregroundColor(.arenaAccent)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    VStack(spacing: 14) {
                        // Podium (top 3). Skipped while results are pending so
                        // we don't imply a "winner" that's really just whoever
                        // joined first.
                        if entries.count >= 3 && !awaitingFirstResult {
                            HStack(alignment: .bottom, spacing: 8) {
                                PodiumColumn(rank: 2, name: entries[1].name, score: entries[1].score, total: entries[1].total, height: 70, tint: .arenaSilver)
                                PodiumColumn(rank: 1, name: entries[0].name, score: entries[0].score, total: entries[0].total, height: 100, tint: .arenaGold)
                                PodiumColumn(rank: 3, name: entries[2].name, score: entries[2].score, total: entries[2].total, height: 55, tint: .arenaBronze)
                            }
                            .frame(height: 130)
                            Divider().background(Color.arenaStroke)
                        }

                        // Table. When results are pending show every row from rank 1;
                        // otherwise the top-3 are already on the podium, so skip them.
                        let tableRows = awaitingFirstResult ? Array(entries.enumerated()) : Array(entries.dropFirst(3).enumerated())
                        let baseRank  = awaitingFirstResult ? 1 : 4
                        VStack(spacing: 0) {
                            ForEach(tableRows, id: \.offset) { idx, row in
                                HStack(spacing: 10) {
                                    Text("\(idx + baseRank)")
                                        .font(ArenaFont.mono(size: 12, weight: .bold))
                                        .foregroundColor(.arenaTextDim)
                                        .frame(width: 24)
                                    Text(row.name)
                                        .font(ArenaFont.mono(size: 12))
                                        .foregroundColor(.arenaText)
                                    Spacer()
                                    if awaitingFirstResult {
                                        Text("—")
                                            .font(ArenaFont.mono(size: 13, weight: .bold))
                                            .foregroundColor(.arenaTextDim)
                                    } else {
                                        Text("\(row.score)/\(row.total)")
                                            .font(ArenaFont.mono(size: 13, weight: .bold))
                                            .foregroundColor(.arenaPrimary)
                                    }
                                }
                                .padding(.vertical, 6)
                                if idx < tableRows.count - 1 {
                                    Rectangle().fill(Color.arenaStroke).frame(height: 1)
                                }
                            }
                        }
                    }
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "person.3.sequence.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.arenaTextDim)
                        Text("No entries yet")
                            .font(ArenaFont.display(size: 13, weight: .heavy))
                            .tracking(2)
                            .foregroundColor(.arenaTextMuted)
                        Text("Be the first to join!")
                            .font(ArenaFont.mono(size: 10))
                            .foregroundColor(.arenaTextDim)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(14)
        }
    }

    private struct LBRow {
        let name: String
        let score: Int
        let total: Int
    }

    private func leaderboardEntries(_ lb: LeaderboardResponse) -> [LBRow]? {
        let rows = lb.leaderboard
        guard !rows.isEmpty else { return nil }
        return rows.map { r in
            LBRow(name: r.displayName, score: r.score, total: r.totalPossible)
        }
    }
}

private struct PodiumColumn: View {
    let rank: Int
    let name: String
    let score: Int
    let total: Int
    let height: CGFloat
    let tint: Color

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                RoundedRectangle(cornerRadius: 6).fill(tint.opacity(0.3))
                Text(String(name.prefix(1)).uppercased())
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .foregroundColor(.arenaOnPrimary)
            }
            .frame(width: 40, height: 40)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(tint, lineWidth: 2))
            .shadow(color: tint.opacity(0.8), radius: 8)

            Text(name)
                .font(ArenaFont.mono(size: 10, weight: .semibold))
                .foregroundColor(.arenaText)
                .lineLimit(1)
            Text("\(score)/\(total)")
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(tint)

            PodiumBlockShape(cut: 8)
                .fill(
                    LinearGradient(
                        colors: [tint, tint.opacity(0.4)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .overlay(
                    Text("\(rank)")
                        .font(ArenaFont.display(size: 22, weight: .black))
                        .foregroundColor(.arenaOnPrimary)
                        .padding(.top, 8),
                    alignment: .top
                )
        }
        .frame(maxWidth: .infinity)
    }
}

struct ArenaRulesPanel: View {
    /// Optional pool context — when provided, rule 04 is tailored to the
    /// pool's funding model (sponsored/peer/platform) instead of showing a
    /// generic blurb. Passing nil is fine for previews/tests.
    var quiniela: Quiniela? = nil

    var body: some View {
        HudFrame {
            VStack(alignment: .leading, spacing: 12) {
                Text("◆ GAME RULES")
                    .font(ArenaFont.display(size: 12, weight: .bold))
                    .tracking(2)
                    .foregroundColor(.arenaPrimary)

                let rules: [(String, String)] = [
                    ("01", NSLocalizedString("Pick 1 (home), X (draw) or 2 (away) for each match in the pool.", comment: "")),
                    ("02", NSLocalizedString("+1 point for every correct pick. All matches count the same.", comment: "")),
                    ("03", NSLocalizedString("Picks lock the moment the first match kicks off. No edits after that.", comment: "")),
                    ("04", prizeRule),
                    ("05", NSLocalizedString("Every pool you finish earns rating for your global rank and can unlock achievements.", comment: "")),
                ]

                ForEach(rules, id: \.0) { n, text in
                    HStack(alignment: .top, spacing: 10) {
                        Text(n)
                            .font(ArenaFont.mono(size: 12, weight: .bold))
                            .foregroundColor(.arenaPrimary)
                        Text(text)
                            .font(ArenaFont.body(size: 12))
                            .foregroundColor(.arenaTextDim)
                    }
                }
            }
            .padding(14)
        }
    }

    /// Picks the right prize-mechanic sentence based on the pool's funding.
    /// Winner-takes-all in all v3 models — no 60/30/10 split anywhere.
    private var prizeRule: String {
        let model = quiniela?.fundingModel ?? "none"
        let prize = quiniela?.platformPrizeCoins ?? 0
        let entry = quiniela?.entryCostCoins ?? 0
        let rake  = quiniela?.rakePercent ?? 10
        _ = (model, prize, entry, rake) // silence unused-warning on some paths below
        switch model {
        case "sponsored":
            if prize > 0 {
                return String(format: NSLocalizedString("The creator sponsored a %lld-coin prize. Winner takes it all — no split.", comment: ""), prize)
            }
            return NSLocalizedString("The creator sponsored the prize. Winner takes it all.", comment: "")
        case "peer":
            if entry > 0 {
                return String(format: NSLocalizedString("Every player pays %1$lld coins. Winner takes the full pot (minus a %2$lld%% platform fee).", comment: ""), entry, rake)
            }
            return NSLocalizedString("Winner takes the whole prize — no splits.", comment: "")
        case "platform":
            return NSLocalizedString("Platform-funded prize. Winner takes it all if the pool fills to the minimum.", comment: "")
        default:
            return NSLocalizedString("Winner takes the whole prize — no splits.", comment: "")
        }
    }
}

private struct ArenaInsufficientBalanceSheet: View {
    let entryCost: Double
    let currentBalance: Double
    var onRecharge: () -> Void
    var onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.arenaBg.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("INSUFFICIENT BALANCE")
                    .font(ArenaFont.display(size: 20, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)

                Text("You need \(formatted(entryCost)) to join. Your balance: \(formatted(currentBalance)).")
                    .font(ArenaFont.body(size: 13))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                ArcadeButton(title: "▶ RECHARGE", size: .lg, fullWidth: true, action: onRecharge)
                Button("CLOSE", action: onDismiss)
                    .font(ArenaFont.mono(size: 11))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextMuted)
            }
            .padding(28)
        }
        .presentationDetents([.medium])
    }

    private func formatted(_ v: Double) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal
        f.maximumFractionDigits = 2
        return f.string(from: NSNumber(value: v)) ?? "\(v)"
    }
}
