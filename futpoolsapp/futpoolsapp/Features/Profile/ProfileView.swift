//
//  ProfileView.swift
//  futpoolsapp
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var auth: AuthService
    @State private var showEditName = false
    @State private var showSettings = false
    @State private var showRechargeSheet = false
    @State private var myPools: [Quiniela] = []
    @State private var loadingMyPools = false
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

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()

                ScrollView {
                    VStack(spacing: 16) {
                        hero
                        balanceCard
                        myCreatedPoolsSection
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
            .sheet(isPresented: $showRechargeSheet) {
                RechargeView().environmentObject(auth)
            }
            .task { await loadMyPools() }
        }
    }

    // MARK: - My created pools

    @ViewBuilder
    private var myCreatedPoolsSection: some View {
        if loadingMyPools {
            HStack(spacing: 10) {
                ProgressView().tint(.arenaPrimary)
                Text("LOADING MY POOLS…")
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
            }
            .padding(.horizontal, 16)
        } else if !myPools.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("◆ MY CREATED POOLS")
                    .font(ArenaFont.display(size: 10, weight: .bold))
                    .tracking(3)
                    .foregroundColor(.arenaTextMuted)
                VStack(spacing: 8) {
                    ForEach(myPools) { pool in
                        NavigationLink {
                            QuinielaDetailView(quiniela: pool)
                                .environmentObject(auth)
                        } label: {
                            MyPoolRow(pool: pool)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func loadMyPools() async {
        guard let token = KeychainHelper.getToken() else { return }
        loadingMyPools = true
        defer { loadingMyPools = false }
        do {
            myPools = try await client.request(
                method: "GET",
                path: "/quinielas/mine/created",
                token: token
            )
        } catch {
            // Keep the section hidden on failure.
            myPools = []
        }
    }

    private var hero: some View {
        VStack(spacing: 12) {
            // Simple neutral avatar with initials — no magenta mock
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

    private var balanceCard: some View {
        Button {
            showRechargeSheet = true
        } label: {
            HudFrame(
                cut: 14,
                fill: AnyShapeStyle(
                    LinearGradient(
                        colors: [Color.arenaGold.opacity(0.18), Color.arenaSurface],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
            ) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [.arenaGold, Color(hex: "B88A1F")],
                                center: UnitPoint(x: 0.35, y: 0.35),
                                startRadius: 0,
                                endRadius: 20
                            )
                        )
                        .frame(width: 36, height: 36)
                        .shadow(color: .arenaGold.opacity(0.6), radius: 8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("BALANCE")
                            .font(ArenaFont.mono(size: 9))
                            .tracking(1.5)
                            .foregroundColor(.arenaTextMuted)
                        Text(formatted(auth.currentUser?.balanceValue ?? 0) + " COINS")
                            .font(ArenaFont.display(size: 22, weight: .heavy))
                            .tracking(0.5)
                            .foregroundColor(.arenaGold)
                    }
                    Spacer()
                    ArcadeButton(title: "+ TOP UP", variant: .accent, size: .sm) {
                        showRechargeSheet = true
                    }
                }
                .padding(14)
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
    }

    private var signOutSection: some View {
        ArcadeButton(title: "SIGN OUT", variant: .surface, fullWidth: true) {
            auth.logout()
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func initials(_ n: String) -> String {
        n.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

    private func formatted(_ value: Double) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: value)) ?? "\(Int(value))"
    }
}

private struct MyPoolRow: View {
    let pool: Quiniela

    var body: some View {
        HudFrame {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(pool.name.uppercased())
                        .font(ArenaFont.display(size: 13, weight: .bold))
                        .tracking(0.5)
                        .foregroundColor(.arenaText)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        if let code = pool.inviteCode {
                            Text(code)
                                .font(ArenaFont.mono(size: 10, weight: .bold))
                                .tracking(1.5)
                                .foregroundColor(.arenaPrimary)
                        }
                        if let vis = pool.visibility {
                            Text("· \(vis.uppercased())")
                                .font(ArenaFont.mono(size: 9))
                                .foregroundColor(.arenaTextMuted)
                        }
                        if let count = pool.entriesCount {
                            Text("· \(count) PLAYERS")
                                .font(ArenaFont.mono(size: 9))
                                .foregroundColor(.arenaTextMuted)
                        }
                    }
                }
                Spacer()
                Text("›")
                    .font(ArenaFont.display(size: 18, weight: .bold))
                    .foregroundColor(.arenaTextMuted)
            }
            .padding(12)
        }
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
            .navigationTitle("EDIT NAME")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                        .foregroundColor(.arenaTextDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(name) }
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
