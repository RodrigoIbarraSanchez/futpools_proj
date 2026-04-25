//
//  MainTabView.swift
//  futpoolsapp
//
//  Arena 4-tab bottom nav — custom rendering (not UIKit TabView) to match the HUD look.
//

import SwiftUI

enum ArenaTab: String, CaseIterable, Identifiable {
    case pools, entries, shop, profile
    var id: String { rawValue }

    /// Resolved label — goes through `String(localized:)` so Spanish users see
    /// "QUINIELAS / PARTICIPACIONES / TIENDA / PERFIL" instead of the English
    /// keys. Static strings bypass SwiftUI's automatic Text localization.
    var label: String {
        switch self {
        case .pools:   return String(localized: "POOLS")
        case .entries: return String(localized: "ENTRIES")
        case .shop:    return String(localized: "SHOP")
        case .profile: return String(localized: "PROFILE")
        }
    }

    var icon: String {
        switch self {
        case .pools:   return "◆"
        case .entries: return "▤"
        case .shop:    return "$"
        case .profile: return "◉"
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var auth: AuthService
    @State private var selected: ArenaTab = .pools
    @State private var tabBarHidden: Bool = false
    @State private var showCreate = false

    /// Binds the celebration sheet to the AuthService flag. SwiftUI `sheet`
    /// needs a Bool binding, so we translate nil/non-nil ↔ false/true and
    /// wire the dismiss path through `acknowledgeSignupBonus()`.
    private var showSignupBonus: Binding<Bool> {
        Binding(
            get: { auth.pendingSignupBonus != nil },
            set: { newValue in
                if !newValue { auth.acknowledgeSignupBonus() }
            }
        )
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selected {
                case .pools:   HomeView()
                case .entries: MyEntriesView()
                case .shop:    RechargeView()
                case .profile: ProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            ArenaTabBar(selected: $selected, onCreate: { showCreate = true })
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
                .opacity(tabBarHidden ? 0 : 1)
                .offset(y: tabBarHidden ? 120 : 0)
                .animation(.easeInOut(duration: 0.2), value: tabBarHidden)
        }
        .background(Color.arenaBg.ignoresSafeArea())
        .onPreferenceChange(ArenaTabBarHiddenKey.self) { tabBarHidden = $0 }
        .fullScreenCover(isPresented: $showCreate) {
            CreatePoolView()
        }
        .fullScreenCover(isPresented: showSignupBonus) {
            SignupBonusCelebrationSheet(
                amount: auth.pendingSignupBonus ?? 0,
                onDismiss: { auth.acknowledgeSignupBonus() }
            )
        }
    }
}

struct ArenaTabBar: View {
    @Binding var selected: ArenaTab
    var onCreate: () -> Void

    /// Tabs are split around a center "create" action so the FAB lives inside
    /// the bar itself (common pattern — Strava, Instagram, Twitter).
    private var leftTabs:  [ArenaTab] { [.pools,   .entries] }
    private var rightTabs: [ArenaTab] { [.shop,    .profile] }

    var body: some View {
        ZStack {
            HStack(spacing: 4) {
                ForEach(leftTabs) { tab in
                    tabButton(tab)
                }
                // Placeholder keeps spacing balanced — the real "+" sits on top
                // as an overlay so we can lift it above the bar.
                Color.clear.frame(maxWidth: .infinity).frame(height: 44)
                ForEach(rightTabs) { tab in
                    tabButton(tab)
                }
            }
            .padding(6)
            .background(
                HudCornerCutShape(cut: 14)
                    .fill(Color.arenaSurface)
                    .overlay(
                        HudCornerCutShape(cut: 14)
                            .stroke(Color.arenaStroke, lineWidth: 1)
                    )
            )
            .clipShape(HudCornerCutShape(cut: 14))
            .shadow(color: .black.opacity(0.5), radius: 12, y: 4)

            // Elevated center create button. Lives in the same ZStack so its
            // hit area stays aligned even as the bar width changes.
            Button(action: onCreate) {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .black))
                    .foregroundColor(.arenaOnPrimary)
                    .frame(width: 56, height: 56)
                    .background(
                        HudCornerCutShape(cut: 14)
                            .fill(Color.arenaPrimary)
                    )
                    .overlay(
                        HudCornerCutShape(cut: 14)
                            .stroke(Color.arenaBg, lineWidth: 3)
                    )
                    .clipShape(HudCornerCutShape(cut: 14))
                    .shadow(color: .arenaPrimary.opacity(0.55), radius: 12, y: 2)
            }
            .buttonStyle(.plain)
            .offset(y: -22) // lift above the bar
            .accessibilityLabel(Text(String(localized: "Create pool")))
        }
    }

    private func tabButton(_ tab: ArenaTab) -> some View {
        ArenaTabButton(tab: tab, isActive: selected == tab) {
            if selected != tab {
                withAnimation(.easeOut(duration: 0.15)) { selected = tab }
            }
        }
    }
}

private struct ArenaTabButton: View {
    let tab: ArenaTab
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(tab.icon)
                    .font(ArenaFont.display(size: 16, weight: .heavy))
                Text(tab.label)
                    .font(ArenaFont.display(size: 9, weight: .bold))
                    .tracking(1.5)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .foregroundColor(isActive ? .arenaPrimary : .arenaTextMuted)
            .background(activeBackground)
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var activeBackground: some View {
        if isActive {
            ZStack(alignment: .top) {
                HudCornerCutShape(cut: 8)
                    .fill(Color.arenaPrimary.opacity(0.12))
                Rectangle()
                    .fill(Color.arenaPrimary)
                    .frame(height: 2)
                    .shadow(color: .arenaPrimary, radius: 6)
                    .padding(.horizontal, 16)
            }
        } else {
            Color.clear
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
