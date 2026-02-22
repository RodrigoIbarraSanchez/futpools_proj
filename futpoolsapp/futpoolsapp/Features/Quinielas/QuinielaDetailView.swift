//
//  QuinielaDetailView.swift
//  futpoolsapp
//

import SwiftUI

private enum PoolDetailTab: String, CaseIterable {
    case overview = "Overview"
    case fixtures = "Fixtures"
    case leaderboard = "Leaderboard"
}

struct QuinielaDetailView: View {
    @State var quiniela: Quiniela
    var onDeleted: (() -> Void)?
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: PoolDetailTab = .overview
    @State private var showPickView = false
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false
    @State private var entryCount = 0
    @State private var latestEntryNumber: Int?
    @State private var latestEntryDate: String?
    @State private var isEntryLoading = false
    @State private var entryError: String?
    @State private var liveFixtures: [Int: LiveFixture] = [:]
    @State private var liveLoading = false
    @State private var liveTimer: Timer?
    @State private var leaderboard: LeaderboardResponse?
    @State private var leaderboardLoading = false
    private let client = APIClient.shared

    private var isAdmin: Bool { auth.currentUser?.isAdmin == true }

    private var dateRange: String {
        guard let start = quiniela.startDateValue else { return "—" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "en_US")
        if let end = quiniela.endDateValue {
            return "\(f.string(from: start)) - \(f.string(from: end))"
        }
        return f.string(from: start)
    }

    private var overviewContent: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            if let desc = quiniela.description, !desc.isEmpty {
                Text(desc)
                    .font(AppFont.body())
                    .foregroundColor(.appTextSecondary)
            }
            HStack(spacing: AppSpacing.sm) {
                Pill(label: "Prize: \(quiniela.prize)")
                Pill(label: "Entry: \(quiniela.cost)")
                Pill(label: "Fixtures: \(quiniela.fixtures.count)")
                if let latestEntryNumber {
                    Pill(label: "Entry #\(latestEntryNumber)")
                }
            }
            if let latestEntryDate {
                Text("Last entry: \(latestEntryDate)")
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)
            }
            PrimaryButton(joinButtonLabel, style: .green) {
                showPickView = true
            }
            .disabled(!canJoin)
            .padding(.top, AppSpacing.sm)
            if !canJoin {
                Text("This pool has already started. New entries are locked.")
                    .font(AppFont.caption())
                    .foregroundColor(.appLiveRed)
            }
            if entryCount > 0 {
                Text("You already have \(entryCount) entr\(entryCount == 1 ? "y" : "ies") in this pool.")
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)
            }
            if let entryError {
                Text(entryError)
                    .font(AppFont.caption())
                    .foregroundColor(.appLiveRed)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal)
    }

    private var fixturesContent: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text("Fixtures")
                    .font(AppFont.headline())
                    .foregroundColor(.appTextPrimary)
                Spacer()
                if liveLoading {
                    Text("Updating live scores…")
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                }
            }
            .padding(.horizontal)

            ForEach(quiniela.fixtures) { f in
                FixtureCard(fixture: f, live: liveFixtures[f.fixtureId])
                    .padding(.horizontal)
            }
        }
    }

    private var leaderboardContent: some View {
        LeaderboardView(
            leaderboard: leaderboard,
            isLoading: leaderboardLoading,
            quinielaId: quiniela.id,
            token: KeychainHelper.getToken()
        )
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text(quiniela.name)
                            .font(AppFont.title())
                            .foregroundColor(.appTextPrimary)
                        Text(dateRange)
                            .font(AppFont.caption())
                            .foregroundColor(.appTextSecondary)
                    }
                    .padding(.horizontal)

                    Picker("Section", selection: $selectedTab) {
                        ForEach(PoolDetailTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    Group {
                        switch selectedTab {
                        case .overview:
                            overviewContent
                        case .fixtures:
                            fixturesContent
                        case .leaderboard:
                            leaderboardContent
                        }
                    }
                    .animation(.none, value: selectedTab)
                }
                .padding(.vertical)
            }
            .navigationTitle("Pool")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                if isAdmin {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            Button {
                                showEditSheet = true
                            } label: {
                                Label("Edit pool", systemImage: "pencil")
                            }
                            Button(role: .destructive) {
                                showDeleteConfirm = true
                            } label: {
                                Label("Delete pool", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
            .navigationDestination(isPresented: $showPickView) {
                QuinielaPickView(quiniela: quiniela)
            }
            .sheet(isPresented: $showEditSheet) {
                EditQuinielaSheet(
                    quiniela: quiniela,
                    onSave: { updated in
                        quiniela = updated
                        showEditSheet = false
                    },
                    onDismiss: { showEditSheet = false }
                )
            }
            .confirmationDialog("Delete pool?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    performDelete()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently delete \"\(quiniela.name)\" and all its entries. This cannot be undone.")
            }
            .onAppear {
                loadEntryCount()
                loadLiveFixtures()
                loadLeaderboard()
                startLivePolling()
            }
            .onDisappear {
                stopLivePolling()
            }
            .onChange(of: showPickView) { _, newValue in
                if newValue == false {
                    loadEntryCount()
                    loadLeaderboard()
                }
            }
        }
    }

    private var joinButtonLabel: String {
        entryCount > 0 ? "Create Another Entry" : "Join & Pick"
    }

    private var canJoin: Bool {
        guard !quiniela.fixtures.isEmpty else { return false }
        let now = Date()
        for fixture in quiniela.fixtures {
            if let live = liveFixtures[fixture.fixtureId] {
                if live.status.isLive == true { return false }
                if let short = live.status.short?.uppercased(),
                   short != "NS",
                   short != "TBD",
                   short != "PST" {
                    return false
                }
                if let date = live.scheduledDate, date <= now {
                    return false
                }
            } else if let date = fixture.kickoffDate {
                if date <= now { return false }
            }
        }
        return true
    }

    private func loadEntryCount() {
        Task {
            isEntryLoading = true
            entryError = nil
            guard let token = KeychainHelper.getToken() else {
                isEntryLoading = false
                return
            }
            do {
                let entries: [QuinielaEntry] = try await client.request(
                    method: "GET",
                    path: "/quinielas/\(quiniela.id)/entries/me",
                    token: token
                )
                entryCount = entries.count
                if let first = entries.first {
                    latestEntryNumber = first.entryNumber ?? entries.count
                    latestEntryDate = formatEntryDate(first.createdAtValue)
                } else {
                    latestEntryNumber = nil
                    latestEntryDate = nil
                }
            } catch {
                entryError = "Could not load entry history."
            }
            isEntryLoading = false
        }
    }

    private func formatEntryDate(_ date: Date?) -> String? {
        guard let date else { return nil }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "en_US")
        return f.string(from: date)
    }

    private func loadLeaderboard() {
        Task {
            leaderboardLoading = true
            do {
                let data: LeaderboardResponse = try await client.request(
                    method: "GET",
                    path: "/quinielas/\(quiniela.id)/leaderboard",
                    token: KeychainHelper.getToken()
                )
                leaderboard = data
            } catch {
                leaderboard = nil
            }
            leaderboardLoading = false
        }
    }

    private func loadLiveFixtures() {
        Task {
            let ids = quiniela.fixtures.compactMap { $0.fixtureId }
            guard !ids.isEmpty else { return }
            liveLoading = true
            do {
                let data: [LiveFixture] = try await client.request(
                    method: "GET",
                    path: "/football/fixtures?ids=\(ids.map(String.init).joined(separator: ","))"
                )
                var map: [Int: LiveFixture] = [:]
                data.forEach { f in
                    if let id = f.fixtureId {
                        map[id] = f
                    }
                }
                liveFixtures = map
            } catch {
                // ignore for now
            }
            liveLoading = false
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
        isDeleting = true
        Task {
            do {
                try await client.requestVoid(method: "DELETE", path: "/quinielas/\(quiniela.id)", token: token)
                await MainActor.run {
                    onDeleted?()
                    dismiss()
                }
            } catch {
                // could set error state
            }
            await MainActor.run { isDeleting = false }
        }
    }
}

// MARK: - Edit Quiniela Sheet (Admin)
private struct EditQuinielaSheet: View {
    let quiniela: Quiniela
    @State private var name: String
    @State private var description: String
    @State private var prize: String
    @State private var cost: String
    @State private var saving = false
    @State private var errorMessage: String?
    let onSave: (Quiniela) -> Void
    let onDismiss: () -> Void
    private let client = APIClient.shared

    init(quiniela: Quiniela, onSave: @escaping (Quiniela) -> Void, onDismiss: @escaping () -> Void) {
        self.quiniela = quiniela
        _name = State(initialValue: quiniela.name)
        _description = State(initialValue: quiniela.description ?? "")
        _prize = State(initialValue: quiniela.prize)
        _cost = State(initialValue: quiniela.cost)
        self.onSave = onSave
        self.onDismiss = onDismiss
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: AppSpacing.lg) {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("Name")
                            .font(AppFont.caption())
                            .foregroundColor(.appTextSecondary)
                        TextField("Pool name", text: $name)
                            .font(AppFont.body())
                            .appTextFieldStyle()
                        Text("Description")
                            .font(AppFont.caption())
                            .foregroundColor(.appTextSecondary)
                        TextField("Description", text: $description, axis: .vertical)
                            .font(AppFont.body())
                            .appTextFieldStyle()
                            .lineLimit(3...6)
                        HStack(spacing: AppSpacing.md) {
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text("Prize")
                                    .font(AppFont.caption())
                                    .foregroundColor(.appTextSecondary)
                                TextField("e.g. $5,000", text: $prize)
                                    .font(AppFont.body())
                                    .appTextFieldStyle()
                            }
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text("Cost")
                                    .font(AppFont.caption())
                                    .foregroundColor(.appTextSecondary)
                                TextField("e.g. $5", text: $cost)
                                    .font(AppFont.body())
                                    .appTextFieldStyle()
                            }
                        }
                    }
                    .padding(.horizontal)
                    if let errorMessage {
                        Text(errorMessage)
                            .font(AppFont.caption())
                            .foregroundColor(.appLiveRed)
                            .padding(.horizontal)
                    }
                    Spacer()
                }
                .padding(.top, AppSpacing.lg)
            }
            .navigationTitle("Edit pool")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { performSave() }
                        .fontWeight(.semibold)
                        .foregroundColor(.appPrimary)
                        .disabled(saving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || prize.isEmpty || cost.isEmpty)
                }
            }
        }
    }

    private func performSave() {
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
                    currency: quiniela.currency
                )
                let updated: Quiniela = try await client.request(
                    method: "PUT",
                    path: "/quinielas/\(quiniela.id)",
                    body: body,
                    token: token
                )
                await MainActor.run {
                    onSave(updated)
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Could not save. Try again."
                }
            }
            await MainActor.run { saving = false }
        }
    }
}

private struct Pill: View {
    let label: String

    var body: some View {
        Text(label)
            .font(AppFont.caption())
            .foregroundColor(.appTextSecondary)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xs)
            .background(
                Capsule().fill(Color.appSurfaceAlt)
            )
    }
}

private struct FixtureCard: View {
    let fixture: QuinielaFixture
    let live: LiveFixture?

    private var kickoffText: String {
        if let live, let d = live.scheduledDate {
            return formatDate(d)
        }
        guard let d = fixture.kickoffDate else { return fixture.kickoff }
        return formatDate(d)
    }

    private var scoreText: String? {
        guard let live else { return nil }
        if live.score.home == nil && live.score.away == nil { return nil }
        return "\(live.score.home ?? 0) : \(live.score.away ?? 0)"
    }

    private var statusText: String? {
        let short = live?.status.short ?? fixture.status
        return short?.uppercased()
    }

    var body: some View {
        MatchCard {
            ZStack {
                VStack(spacing: 0) {
                    HStack {
                        Text(fixture.leagueName ?? "League")
                            .font(AppFont.overline())
                            .foregroundColor(.appTextSecondary)
                        Spacer()
                        if let status = statusText, !status.isEmpty {
                            Text(status)
                                .font(AppFont.overline())
                                .foregroundColor(.appTextSecondary)
                                .padding(.horizontal, AppSpacing.sm)
                                .padding(.vertical, AppSpacing.xs)
                                .background(Capsule().fill(Color.appSurfaceAlt))
                        }
                    }
                    Spacer(minLength: AppSpacing.md)
                    HStack {
                        Text(kickoffText)
                            .font(AppFont.caption())
                            .foregroundColor(.appTextSecondary)
                        Spacer()
                        if let score = scoreText {
                            Text(score)
                                .font(AppFont.caption().weight(.semibold))
                                .foregroundColor(.appTextPrimary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                ZStack {
                    HStack(spacing: AppSpacing.md) {
                        TeamColumn(
                            name: fixture.homeTeam,
                            logo: live?.logos?.home ?? fixture.homeLogo,
                            alignment: .leading
                        )
                        Spacer(minLength: 36)
                        TeamColumn(
                            name: fixture.awayTeam,
                            logo: live?.logos?.away ?? fixture.awayLogo,
                            alignment: .trailing
                        )
                    }
                    .frame(maxWidth: .infinity)

                    Text("VS")
                        .font(AppFont.overline())
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [Color.appPrimary, Color.appAccent],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                        )
                }
            }
            .frame(minHeight: 120)
        }
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "en_US")
        return f.string(from: date)
    }
}

private struct TeamColumn: View {
    let name: String
    let logo: String?
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: AppSpacing.xs) {
            TeamLogo(name: name, logo: logo)
            Text(name)
                .font(AppFont.caption())
                .foregroundColor(.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}

private struct TeamLogo: View {
    let name: String
    let logo: String?

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.appSurfaceAlt)
                .frame(width: 22, height: 22)
            if let logo, let url = URL(string: logo) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Text(String(name.prefix(1)))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.appTextPrimary)
                }
                .frame(width: 14, height: 14)
            } else {
                Text(String(name.prefix(1)))
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.appTextPrimary)
            }
        }
    }
}

#Preview {
    QuinielaDetailView(quiniela: Quiniela(
        id: "1",
        name: "Week 1 Special",
        description: "Premier League opening set.",
        prize: "$5,000",
        cost: "$5",
        currency: "USD",
        startDate: "2026-02-07T18:00:00Z",
        endDate: "2026-02-09T18:00:00Z",
        fixtures: [],
        entriesCount: 0
    ))
    .environmentObject(AuthService())
    .preferredColorScheme(.dark)
}
