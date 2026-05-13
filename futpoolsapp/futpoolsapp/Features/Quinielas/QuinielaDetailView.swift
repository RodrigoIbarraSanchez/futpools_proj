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

    /// Localized display label. The rawValue stays in English so the case
    /// identifier remains stable — only the user-visible text translates.
    var label: String {
        switch self {
        case .fixtures: return String(localized: "FIXTURES")
        case .ranking:  return String(localized: "RANKING")
        }
    }
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
    // simple_version: balance/recharge gating removed — iOS is read-only.
    // Pool joining happens on web via Stripe Checkout.
    @State private var showRulesSheet = false
    @State private var showManageSheet = false
    // pendingRechargeAfterDismiss removed with the recharge flow.
    @State private var liveTimer: Timer?
    @State private var adminErrorMessage: String?
    @State private var isTogglingFeatured = false
    /// Picks (fixtureId → "1"|"X"|"2") for the current user, loaded once per
    /// detail open to power the LiveMatchView's "YOUR PICK" card.
    @State private var myPicks: [Int: String] = [:]

    private let client = APIClient.shared

    // simple_version: read-only view — no balance/entry-cost gating.
    // The "JOIN" CTA only appears when the user doesn't already have an
    // entry (loaded from /quinielas/:id/entries/me into entryCount).
    private var hasUserEntry: Bool { entryCount > 0 }
    private var isAdmin: Bool { auth.currentUser?.isAdmin == true }
    private var isOwner: Bool {
        guard let uid = auth.currentUser?.id, let by = quiniela.createdBy else { return false }
        return uid == by
    }
    private var canManage: Bool { isAdmin || isOwner }

    /// Mirrors the backend's `computePoolStatus === 'scheduled'` gate. True
    /// only when every fixture is still in the future AND no fixture reports
    /// a live/finished status. Used to gate participant-admin actions.
    private var isScheduled: Bool {
        guard !quiniela.fixtures.isEmpty else { return false }
        let now = Date()
        for fx in quiniela.fixtures {
            if let date = fx.kickoffDate, date <= now { return false }
            let short = (liveFixtures[fx.fixtureId]?.status.short ?? "").uppercased()
            if !short.isEmpty && short != "NS" { return false }
        }
        return true
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ArenaBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    if let realPrize = quiniela.realPrize {
                        realPrizeHero(realPrize)
                    } else {
                        prizeHero
                    }
                    tabStrip
                    tabContent
                    if quiniela.realPrize != nil {
                        realPrizeDisclaimers
                    }
                }
                .padding(.bottom, 140)
            }

            // Sticky CTA
            VStack(spacing: 0) {
                LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom)
                    .frame(height: 40)
                // simple_version: NO join CTA on iOS, ever. The view is
                // strictly read-only — pool participation is web-only via
                // Stripe. The previous "JOIN ON FUTPOOLS.COM" Safari
                // hand-off was visible while entries loaded (hasUserEntry
                // briefly false), and that's exactly what user feedback
                // flagged: 'por ningún motivo eso debe de pasar en la
                // iOS app'. The empty container keeps the layout stable
                // without rendering any button.
                EmptyView()
            }
        }
        .arenaTabBarHidden()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            // Share button is visible to anyone who can see the pool (needs an inviteCode).
            if let code = quiniela.inviteCode, let url = URL(string: "https://api.futpools.com/p/\(code)") {
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
                        // Same sheet, two modes: when the pool hasn't started
                        // it's the moderation surface (kick / delete entry).
                        // After kickoff the backend ships picks per entry and
                        // the sheet flips to "view predictions" — picks read-
                        // only, no destructive actions. Web parity in
                        // futpools_web/.../PoolDetail.jsx (canManage / canViewPicks).
                        if isScheduled {
                            Button {
                                showManageSheet = true
                            } label: {
                                Label("Manage participants", systemImage: "person.2.badge.gearshape")
                            }
                        } else if (quiniela.entriesCount ?? 0) > 0 {
                            Button {
                                showManageSheet = true
                            } label: {
                                Label("View predictions", systemImage: "eye")
                            }
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
        .sheet(isPresented: $showManageSheet) {
            ParticipantManageSheet(
                quinielaId: quiniela.id,
                token: auth.token,
                fixtures: quiniela.fixtures,
                liveFixtures: liveFixtures,
                onDismiss: { showManageSheet = false },
                onMutated: {
                    // Refresh leaderboard + entry count after kicks/deletes so
                    // the detail view matches the new state when the sheet closes.
                    loadEntryCount()
                    loadLeaderboard()
                }
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
        // simple_version: insufficient-balance + recharge sheets removed.
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
                Text("[ \(String(localized: "POOL")) · \(quiniela.id.prefix(6).uppercased()) ]")
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
                    Text(String(localized: "PRIZE POOL"))
                        .font(ArenaFont.mono(size: 9))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    Text(quiniela.prizePoolDisplay)
                        .font(ArenaFont.display(size: 26, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaGold)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(String(localized: "ENTRY"))
                        .font(ArenaFont.mono(size: 9))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    Text(quiniela.entryFeeDisplay)
                        .font(ArenaFont.mono(size: 18, weight: .bold))
                        .foregroundColor(.arenaText)
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
        }
        .padding(.horizontal, 16)
    }

    // MARK: Real-prize hero — replaces `prizeHero` when the pool
    //  carries a real-world prize. Shows the prize image as the hero,
    //  then label + USD value. The legal disclaimers (AMOE + Apple
    //  Guideline 5.3) live below the tab content as a sibling section
    //  so they're always visible without crowding the hero.

    private func realPrizeHero(_ prize: RealPrize) -> some View {
        HudFrame(
            cut: 14,
            fill: AnyShapeStyle(
                LinearGradient(
                    colors: [Color.arenaGold.opacity(0.18), Color.arenaBg2],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            ),
            glow: .arenaGold
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if let key = prize.imageKey, !key.isEmpty,
                   UIImage(named: key) != nil {
                    Image(key)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .frame(maxHeight: 180)
                        .shadow(color: .arenaGold.opacity(0.5), radius: 16, y: 4)
                }
                HStack(spacing: 12) {
                    Text("🏆")
                        .font(.system(size: 30))
                        .shadow(color: .arenaGold, radius: 10)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(String(localized: "REAL PRIZE"))
                            .font(ArenaFont.mono(size: 9))
                            .tracking(2)
                            .foregroundColor(.arenaTextMuted)
                        Text(prize.label)
                            .font(ArenaFont.display(size: 18, weight: .heavy))
                            .foregroundColor(.arenaGold)
                    }
                    Spacer()
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
        }
        .padding(.horizontal, 16)
    }

    /// AMOE + Apple disclaimers — required for legal compliance on
    /// any pool that pays a real-world prize. AMOE clarifies the
    /// "no purchase necessary" alternative; Apple Guideline 5.3
    /// requires the sponsor disclaimer on the same surface as the
    /// entry CTA.
    private var realPrizeDisclaimers: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(String(localized: "Free entry: 7 daily check-ins (one per day for a week) = 1 entry. No purchase required."))
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(.arenaTextDim)
                .multilineTextAlignment(.leading)
            Text(String(localized: "This sweepstakes is in no way sponsored, endorsed, administered by, or associated with Apple Inc."))
                .font(ArenaFont.mono(size: 8))
                .foregroundColor(.arenaTextFaint)
                .multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: Tabs

    private var tabStrip: some View {
        HStack(spacing: 4) {
            ForEach(ArenaPoolTab.allCases, id: \.self) { tab in
                Button { selectedTab = tab } label: {
                    Text(tab.label)
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
                        ArenaFixtureRow(
                            fixture: fx,
                            live: liveFixtures[fx.fixtureId],
                            userPick: myPicks[fx.fixtureId]
                        )
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
                // Live scores feed the leaderboard's `liveScore` per row, so
                // refresh the panel on the same tick. Web parity:
                // futpools_web/.../PoolDetail.jsx live-leaderboard effect.
                loadLeaderboard()
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
                        field(label: String(localized: "NAME")) {
                            TextField("", text: $name).arenaFieldStyle()
                        }
                        field(label: String(localized: "DESCRIPTION")) {
                            TextField("", text: $description, axis: .vertical)
                                .lineLimit(3...6)
                                .arenaFieldStyle()
                        }
                        HStack(spacing: 12) {
                            field(label: String(localized: "PRIZE")) {
                                TextField("", text: $prize).arenaFieldStyle()
                            }
                            field(label: String(localized: "ENTRY COST")) {
                                TextField("", text: $cost).arenaFieldStyle()
                            }
                        }

                        // Featured toggle
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(String(localized: "FEATURED"))
                                    .font(ArenaFont.mono(size: 10))
                                    .tracking(2)
                                    .foregroundColor(.arenaTextMuted)
                                Text(String(localized: "Pin to QUICK PLAY hero/carousel"))
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
            .navigationTitle(String(localized: "EDIT POOL"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Cancel")) { onDismiss() }
                        .foregroundColor(.arenaTextDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? String(localized: "Saving…") : String(localized: "Save")) { save() }
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
    /// User's pick for THIS fixture ("1" home win | "X" draw | "2" away win).
    /// Nil = user has no pick recorded for this fixture (read-only viewer
    /// or pre-entry). The chip on the right edge of the row surfaces it.
    var userPick: String? = nil

    private var isLive: Bool { live?.status.isLive == true }
    private var scoreString: String? {
        guard let live, live.score.home != nil || live.score.away != nil else { return nil }
        return "\(live.score.home ?? 0)–\(live.score.away ?? 0)"
    }

    /// Friendly label for the pick — abbreviated team name for 1/2,
    /// "EMPATE" for X. Mirrors the wording on the picker screen.
    private var pickLabel: String? {
        guard let p = userPick else { return nil }
        switch p {
        case "1": return String(fixture.homeTeam.prefix(3)).uppercased()
        case "2": return String(fixture.awayTeam.prefix(3)).uppercased()
        case "X": return String(localized: "DRAW")
        default:  return p
        }
    }

    var body: some View {
        HudFrame(cut: 14) {
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
                        Text(String(localized: "VS"))
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

                // User's pick — bottom row chip. Surfaces what the user
                // chose for this fixture so the pool view isn't a bare
                // schedule. Only renders when a pick exists; absent for
                // anonymous viewers / pre-entry browse.
                if let label = pickLabel, let p = userPick {
                    HStack(spacing: 6) {
                        Text(String(localized: "TU PICK"))
                            .font(ArenaFont.mono(size: 9, weight: .bold))
                            .tracking(1.4)
                            .foregroundColor(.arenaTextMuted)
                        HStack(spacing: 4) {
                            Text(p)
                                .font(ArenaFont.display(size: 12, weight: .heavy))
                                .foregroundColor(.arenaOnPrimary)
                                .frame(width: 18)
                            Text(label)
                                .font(ArenaFont.mono(size: 10, weight: .bold))
                                .tracking(0.6)
                                .foregroundColor(.arenaOnPrimary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(HudCornerCutShape(cut: 4).fill(Color.arenaPrimary))
                        .clipShape(HudCornerCutShape(cut: 4))
                        Spacer()
                    }
                    .padding(.top, 2)
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
    /// Drives the pulsing dot on the LIVE chip. State lives at panel scope
    /// so all chips/animations share the same tick instead of each pulse
    /// running its own clock.
    @State private var pulse = false

    private var hasLive: Bool {
        leaderboard?.hasLiveFixtures == true
    }

    private var totalPossible: Int {
        leaderboard?.totalPossible ?? 0
    }

    /// `totalPossible` is 0 until at least one fixture has started. We still
    /// show the participants (ordered by join number) so the panel doesn't
    /// look broken; the join-order banner explains the placeholder scores.
    private var awaitingFirstResult: Bool {
        totalPossible == 0
    }

    /// True when every fixture is settled with a real result (not live, not
    /// pre-kickoff). Triggers the gold "FINAL RESULTS" chip — the user gets
    /// a payoff signal that the table is now real.
    private var allSettled: Bool {
        guard !hasLive, totalPossible > 0,
              let rows = leaderboard?.leaderboard, !rows.isEmpty else { return false }
        return rows.allSatisfy { ($0.liveScore ?? $0.score) == $0.score }
    }

    /// Sort rows by the score the panel is actually displaying. Re-sorted
    /// locally because the backend's order from the previous poll may
    /// disagree with the current `liveScore` values during live mode.
    private var sortedRows: [LeaderboardEntry] {
        guard let rows = leaderboard?.leaderboard else { return [] }
        let live = hasLive
        return rows.sorted { a, b in
            let sa = a.displayScore(hasLive: live)
            let sb = b.displayScore(hasLive: live)
            if sa != sb { return sa > sb }
            return a.entryNumber < b.entryNumber
        }
    }

    /// Competition ranking (1, 1, 1, 4 — never dense). Tied scores share
    /// a label so the user doesn't read a fake hierarchy into a 1, 2, 3
    /// when all three players are sitting on 1/1.
    private var rankedRows: [(rank: Int, row: LeaderboardEntry)] {
        let rows = sortedRows
        var out: [(Int, LeaderboardEntry)] = []
        var lastScore: Int? = nil
        var lastRank = 0
        for (i, row) in rows.enumerated() {
            let s = row.displayScore(hasLive: hasLive)
            if s != lastScore {
                lastRank = i + 1
                lastScore = s
            }
            out.append((lastRank, row))
        }
        return out
    }

    /// True when at least two adjacent rows share a display rank — drives
    /// the small "TIES BROKEN BY JOIN ORDER" hint. We only want to show
    /// the helper when it's actually useful.
    private var hasTies: Bool {
        let ranks = rankedRows.map { $0.rank }
        for i in 1..<ranks.count {
            if ranks[i] == ranks[i - 1] { return true }
        }
        return false
    }

    /// Pillar style derived from display rank (so a 3-way tie at rank 1
    /// renders three identical gold pillars). Internal so the sibling
    /// PodiumColumn can read it without a separate free function.
    static func podiumStyle(forRank rank: Int) -> (tint: Color, height: CGFloat) {
        switch rank {
        case ...1:  return (.arenaGold, 100)
        case 2:     return (.arenaSilver, 70)
        default:    return (.arenaBronze, 55)
        }
    }

    var body: some View {
        HudFrame {
            VStack(spacing: 14) {
                HStack(spacing: 8) {
                    Text("◆ " + String(localized: "LEADERBOARD"))
                        .font(ArenaFont.display(size: 11, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaPrimary)
                    if hasLive {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.arenaDanger)
                                .frame(width: 6, height: 6)
                                .opacity(pulse ? 0.35 : 1)
                                .scaleEffect(pulse ? 0.7 : 1)
                                .shadow(color: .arenaDanger.opacity(0.7), radius: 4)
                            Text(String(localized: "LIVE"))
                                .font(ArenaFont.mono(size: 9, weight: .bold))
                                .tracking(1.5)
                                .foregroundColor(.arenaDanger)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(
                            HudCornerCutShape(cut: 4)
                                .fill(Color.arenaDanger.opacity(0.16))
                        )
                        .overlay(
                            HudCornerCutShape(cut: 4)
                                .stroke(Color.arenaDanger.opacity(0.55), lineWidth: 1)
                        )
                    }
                    if allSettled {
                        Text(String(localized: "FINAL RESULTS"))
                            .font(ArenaFont.mono(size: 9, weight: .bold))
                            .tracking(1.5)
                            .foregroundColor(.arenaGold)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                HudCornerCutShape(cut: 4)
                                    .fill(Color.arenaGold.opacity(0.16))
                            )
                            .overlay(
                                HudCornerCutShape(cut: 4)
                                    .stroke(Color.arenaGold.opacity(0.5), lineWidth: 1)
                            )
                    }
                    Spacer(minLength: 0)
                }
                if hasLive {
                    Text(String(localized: "LIVE POINTS · MAY CHANGE"))
                        .font(ArenaFont.mono(size: 9))
                        .tracking(1)
                        .foregroundColor(.arenaTextMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if hasTies {
                    Text(String(localized: "TIES BROKEN BY JOIN ORDER"))
                        .font(ArenaFont.mono(size: 9))
                        .tracking(1)
                        .foregroundColor(.arenaTextFaint)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if isLoading {
                    ProgressView().tint(.arenaPrimary)
                } else if !rankedRows.isEmpty {
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
                        if rankedRows.count >= 3 && !awaitingFirstResult {
                            HStack(alignment: .bottom, spacing: 8) {
                                PodiumColumn(position: 2, ranked: rankedRows[1], hasLive: hasLive)
                                PodiumColumn(position: 1, ranked: rankedRows[0], hasLive: hasLive)
                                PodiumColumn(position: 3, ranked: rankedRows[2], hasLive: hasLive)
                            }
                            .frame(height: 130)
                            Divider().background(Color.arenaStroke)
                        }

                        // Table. When results are pending show every row from rank 1;
                        // otherwise the top-3 are already on the podium, so skip them.
                        let tableSlice: [(rank: Int, row: LeaderboardEntry)] = awaitingFirstResult
                            ? rankedRows
                            : Array(rankedRows.dropFirst(3))
                        VStack(spacing: 0) {
                            ForEach(Array(tableSlice.enumerated()), id: \.element.row.entryId) { idx, item in
                                let row = item.row
                                let displayScore = row.displayScore(hasLive: hasLive)
                                let delta = row.liveDelta ?? 0
                                let rowIsLive = hasLive && delta > 0
                                HStack(spacing: 10) {
                                    Text("\(item.rank)")
                                        .font(ArenaFont.mono(size: 12, weight: .bold))
                                        .foregroundColor(.arenaTextDim)
                                        .frame(width: 24)
                                    Text(row.displayName)
                                        .font(ArenaFont.mono(size: 12))
                                        .foregroundColor(.arenaText)
                                        .lineLimit(1)
                                        .truncationMode(.tail)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    if rowIsLive {
                                        Text("+\(delta)")
                                            .font(ArenaFont.mono(size: 9, weight: .bold))
                                            .tracking(1)
                                            .foregroundColor(.arenaDanger)
                                            // Re-mount on delta change so the
                                            // transition fires every time the
                                            // user picks up a fresh live point.
                                            .id("delta-\(row.entryId)-\(delta)")
                                            .transition(.opacity.combined(with: .move(edge: .top)))
                                    }
                                    if awaitingFirstResult {
                                        Text("—")
                                            .font(ArenaFont.mono(size: 13, weight: .bold))
                                            .foregroundColor(.arenaTextDim)
                                    } else {
                                        Text("\(displayScore)/\(totalPossible)")
                                            .font(ArenaFont.mono(size: 13, weight: .bold))
                                            .foregroundColor(rowIsLive ? .arenaDanger : .arenaPrimary)
                                            .animation(.easeInOut(duration: 0.3), value: displayScore)
                                    }
                                }
                                .padding(.vertical, 6)
                                if idx < tableSlice.count - 1 {
                                    Rectangle().fill(Color.arenaStroke).frame(height: 1)
                                }
                            }
                        }
                        // Animate row reorders when the leaderboard tick lands
                        // a fresh sort. Spring is gentle enough that a swap
                        // doesn't feel disorienting on a small phone screen.
                        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: rankedRows.map { $0.row.entryId })
                    }
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "person.3.sequence.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.arenaTextDim)
                        Text(String(localized: "No entries yet"))
                            .font(ArenaFont.display(size: 13, weight: .heavy))
                            .tracking(2)
                            .foregroundColor(.arenaTextMuted)
                        Text(String(localized: "Be the first to join!"))
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
        .onAppear {
            // Drive the pulsing live dot. Cheap, runs only while the panel
            // is on screen.
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

private struct PodiumColumn: View {
    /// Visual column position (1=center, 2=left, 3=right). Drives nothing
    /// but layout — actual tint/height/label come from the display rank.
    let position: Int
    let ranked: (rank: Int, row: LeaderboardEntry)
    let hasLive: Bool

    private var row: LeaderboardEntry { ranked.row }
    private var displayScore: Int { row.displayScore(hasLive: hasLive) }
    private var isLive: Bool { hasLive && (row.liveDelta ?? 0) > 0 }

    private var style: (tint: Color, height: CGFloat) {
        ArenaLeaderboardPanel.podiumStyle(forRank: ranked.rank)
    }

    var body: some View {
        let tint = style.tint
        let height = style.height
        VStack(spacing: 6) {
            ZStack {
                RoundedRectangle(cornerRadius: 6).fill(tint.opacity(0.3))
                Text(String(row.displayName.prefix(1)).uppercased())
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .foregroundColor(.arenaOnPrimary)
            }
            .frame(width: 40, height: 40)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(tint, lineWidth: 2))
            .shadow(color: tint.opacity(0.8), radius: 8)

            // Long names get squeezed (`minimumScaleFactor`) before they
            // truncate, so a "Daniel Alexis Yoldi Sanchez" doesn't push
            // the column taller than its siblings and break alignment.
            Text(row.displayName)
                .font(ArenaFont.mono(size: 10, weight: .semibold))
                .foregroundColor(.arenaText)
                .lineLimit(1)
                .minimumScaleFactor(0.55)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity)
            Text("\(displayScore)/\(row.totalPossible)")
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(isLive ? .arenaDanger : tint)
                .animation(.easeInOut(duration: 0.3), value: displayScore)

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
                    // Show the *display* rank (so 3-way tie reads "1, 1, 1")
                    // not the visible column number.
                    Text("\(ranked.rank)")
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
                Text("◆ " + String(localized: "GAME RULES"))
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
                Text(String(localized: "INSUFFICIENT BALANCE"))
                    .font(ArenaFont.display(size: 20, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)

                Text(String(format: String(localized: "You need %1$@ to join. Your balance: %2$@."),
                            formatted(entryCost), formatted(currentBalance)))
                    .font(ArenaFont.body(size: 13))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                ArcadeButton(title: "▶ " + String(localized: "RECHARGE"), size: .lg, fullWidth: true, action: onRecharge)
                Button(String(localized: "CLOSE"), action: onDismiss)
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
