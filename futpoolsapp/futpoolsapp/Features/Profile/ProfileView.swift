//
//  ProfileView.swift
//  futpoolsapp
//
//  The profile surface is the primary showcase for FutPools Rank — tier, rating,
//  stats, achievements — sitting above the legacy balance + created-pools rows.
//  Designed to feel like a trophy case, not a settings page.
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var auth: AuthService
    @State private var showEditName = false
    @State private var showSettings = false
    // simple_version: showRechargeSheet/showAdmin/myPools gone — coin shop,
    // admin dashboard, and "my created pools" removed from iOS. Pool
    // creation is web-only (admin /admin/pools/new); payouts are web-only.

    @State private var rankSummary: UserRankSummary?
    @State private var loadingRank = false

    private let client = APIClient.shared

    private var displayName: String {
        if let n = auth.currentUser?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !n.isEmpty { return n }
        return auth.currentUser?.email ?? "Player"
    }

    private var username: String {
        if let u = auth.currentUser?.username, !u.isEmpty { return u }
        if let local = auth.currentUser?.email.components(separatedBy: "@").first { return local }
        return "player"
    }

    private var unlockedCodes: Set<String> {
        Set((rankSummary?.achievements ?? []).map { $0.code })
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()

                ScrollView {
                    VStack(spacing: 16) {
                        hero
                        rankSection
                        achievementsSection
                        signOutSection
                    }
                    .padding(.top, 18)
                    .padding(.bottom, 120)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Text("⚙")
                            .font(ArenaFont.display(size: 16, weight: .bold))
                            .foregroundColor(.arenaPrimary)
                    }
                }
            }
            .sheet(isPresented: $showEditName) {
                ArenaEditNameSheet(
                    current: auth.currentUser?.displayName ?? "",
                    onSave: { newName in
                        Task { await auth.updateDisplayName(newName) }
                        showEditName = false
                    },
                    onDismiss: { showEditName = false }
                )
                .environmentObject(auth)
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .task { await refreshAll() }
            .refreshable { await refreshAll() }
        }
    }

    // MARK: - Refresh

    private func refreshAll() async {
        await loadRank()
    }

    // MARK: - Rank

    @ViewBuilder
    private var rankSection: some View {
        VStack(spacing: 10) {
            RankHeroCard(summary: rankSummary)
            RankStatsGrid(summary: rankSummary)
            NavigationLink {
                GlobalLeaderboardView()
                    .environmentObject(auth)
            } label: {
                HStack(spacing: 8) {
                    Text("◆")
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                    Text(String(localized: "VIEW GLOBAL LEADERBOARD"))
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaText)
                    Spacer(minLength: 0)
                    Text("›")
                        .font(ArenaFont.display(size: 16, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    ZStack {
                        HudCornerCutShape(cut: 10).fill(Color.arenaSurface)
                        HudCornerCutShape(cut: 10).stroke(Color.arenaStroke, lineWidth: 1)
                    }
                )
                .clipShape(HudCornerCutShape(cut: 10))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
    }

    private func loadRank() async {
        guard let t = auth.token else { return }
        loadingRank = true
        defer { loadingRank = false }
        do {
            let s: UserRankSummary = try await client.request(
                method: "GET",
                path: "/leaderboard/me",
                token: t
            )
            rankSummary = s
        } catch {
            // Leave previous summary; UI will show the "NO RATING YET" empty state
            // if rankSummary is nil.
        }
    }

    // MARK: - Achievements

    @ViewBuilder
    private var achievementsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ " + String(localized: "ACHIEVEMENTS"))
                .font(ArenaFont.display(size: 10, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaTextMuted)
            AchievementsGridView(unlockedCodes: unlockedCodes)
        }
        .padding(.horizontal, 16)
    }

    // simple_version: adminSection / myCreatedPoolsSection / loadMyPools
    // removed. Pool creation and admin tools are web-only now.

    // MARK: - Hero / sign out

    private var hero: some View {
        VStack(spacing: 12) {
            HudCornerCutShape(cut: 14)
                .fill(Color.arenaSurfaceAlt)
                .overlay(
                    HudCornerCutShape(cut: 14)
                        .stroke(Color.arenaStrokeStrong, lineWidth: 1)
                )
                .frame(width: 76, height: 76)
                .overlay(
                    Text(initials(displayName))
                        .font(ArenaFont.display(size: 30, weight: .heavy))
                        .foregroundColor(.arenaText)
                )
                .clipShape(HudCornerCutShape(cut: 14))

            VStack(spacing: 2) {
                Text(displayName)
                    .font(ArenaFont.display(size: 20, weight: .heavy))
                    .foregroundColor(.arenaText)
                HStack(spacing: 4) {
                    Text("@\(username)")
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaTextMuted)
                    Button {
                        showEditName = true
                    } label: {
                        Text("✎")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.arenaPrimary)
                    }
                    .buttonStyle(.plain)
                }
                if let email = auth.currentUser?.email {
                    Text(email)
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaTextDim)
                        .padding(.top, 4)
                }
            }
        }
        .padding(.horizontal, 16)
    }

    // simple_version: balanceCard removed — no coin economy.

    private var signOutSection: some View {
        ArcadeButton(title: String(localized: "SIGN OUT"), variant: .surface, fullWidth: true) {
            auth.logout()
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func initials(_ n: String) -> String {
        n.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

}

private struct ArenaEditNameSheet: View {
    @EnvironmentObject var auth: AuthService
    @State private var name: String
    @FocusState private var focused: Bool

    let onSave: (String) -> Void
    let onDismiss: () -> Void

    init(current: String, onSave: @escaping (String) -> Void, onDismiss: @escaping () -> Void) {
        _name = State(initialValue: current)
        self.onSave = onSave
        self.onDismiss = onDismiss
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.arenaBg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 10) {
                    Text("DISPLAY NAME")
                        .font(ArenaFont.mono(size: 10))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    TextField("", text: $name)
                        .font(ArenaFont.mono(size: 14))
                        .foregroundColor(.arenaText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.arenaBg2)
                        .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
                        .focused($focused)
                    Spacer()
                }
                .padding(20)
                .padding(.top, 20)
            }
            .navigationTitle(String(localized: "EDIT NAME"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Cancel")) { onDismiss() }
                        .foregroundColor(.arenaTextDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "Save")) { onSave(name) }
                        .fontWeight(.semibold)
                        .foregroundColor(.arenaPrimary)
                }
            }
            .onAppear { focused = true }
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
