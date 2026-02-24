//
//  QuinielaDetailView.swift
//  futpoolsapp
//

import SwiftUI

private enum PoolDetailTab: String, CaseIterable {
    case overview = "Overview"
    case fixtures = "Fixtures"
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
    @State private var showInsufficientBalanceSheet = false
    @State private var showRechargeSheet = false
    @State private var pendingRechargeAfterDismiss = false
    private let client = APIClient.shared

    private var userBalance: Double { auth.currentUser?.balanceValue ?? 0 }
    private var entryCost: Double { quiniela.entryCostValue }
    private var hasEnoughBalance: Bool { userBalance >= entryCost }

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
                if canJoin && !hasEnoughBalance {
                    showInsufficientBalanceSheet = true
                } else if canJoin {
                    showPickView = true
                }
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
                            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                                overviewContent
                                leaderboardContent
                            }
                        case .fixtures:
                            fixturesContent
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
            .sheet(isPresented: $showInsufficientBalanceSheet) {
                InsufficientBalanceSheet(
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
                RechargeView()
                    .environmentObject(auth)
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
                    Task { await auth.fetchUser() }
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

// MARK: - Insufficient balance sheet (Recharge flow will be added in next step)
private struct InsufficientBalanceSheet: View {
    let entryCost: Double
    let currentBalance: Double
    var onRecharge: () -> Void
    var onDismiss: () -> Void

    private func format(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private var messageText: String {
        String(format: String(localized: "You need %@ to join this pool. Your balance: %@."), format(entryCost), format(currentBalance))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: AppSpacing.lg) {
                    Text("Insufficient balance")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundColor(.appTextPrimary)
                    Text(messageText)
                        .font(AppFont.body())
                        .foregroundColor(.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    VStack(spacing: AppSpacing.sm) {
                        PrimaryButton("Recharge", style: .green, action: onRecharge)
                        Button("Close", action: onDismiss)
                            .font(AppFont.body())
                            .foregroundColor(.appTextSecondary)
                    }
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.sm)
                }
                .padding(AppSpacing.xl)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: onDismiss)
                        .foregroundColor(.appTextSecondary)
                }
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
        entriesCount: 0,
        status: "scheduled"
    ))
    .environmentObject(AuthService())
    .preferredColorScheme(.dark)
}
