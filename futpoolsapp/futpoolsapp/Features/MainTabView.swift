//
//  MainTabView.swift
//  futpoolsapp
//
//  simple_version: scores-first iOS app. Three tabs (SCORES · POOLS · PROFILE),
//  no creation FAB — pool participation lives entirely in the web app.
//  iOS users see live scores for their favorite teams/leagues + a read-only
//  view of pools they joined via futpools.com.
//

import SwiftUI

enum ArenaTab: String, CaseIterable, Identifiable {
    case scores, pools, profile
    var id: String { rawValue }

    /// Resolved label — goes through `String(localized:)` so Spanish users see
    /// "MARCADORES / QUINIELAS / PERFIL" instead of the English keys. Static
    /// strings bypass SwiftUI's automatic Text localization.
    var label: String {
        switch self {
        case .scores:  return String(localized: "SCORES")
        case .pools:   return String(localized: "POOLS")
        case .profile: return String(localized: "PROFILE")
        }
    }

    var icon: String {
        switch self {
        case .scores:  return "▶"
        case .pools:   return "◆"
        case .profile: return "◉"
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var auth: AuthService
    @State private var selected: ArenaTab = .scores
    @State private var tabBarHidden: Bool = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selected {
                case .scores:  LiveScoresPlaceholder()
                case .pools:   MyPoolsView()
                case .profile: ProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            ArenaTabBar(selected: $selected)
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
                .opacity(tabBarHidden ? 0 : 1)
                .offset(y: tabBarHidden ? 120 : 0)
                .animation(.easeInOut(duration: 0.2), value: tabBarHidden)
        }
        .background(Color.arenaBg.ignoresSafeArea())
        .onPreferenceChange(ArenaTabBarHiddenKey.self) { tabBarHidden = $0 }
    }
}

/// Phase 5 will swap this for the real LiveScoresView. Empty state for now
/// so the tab is wired but doesn't crash if a user taps it before Phase 5
/// ships.
struct LiveScoresPlaceholder: View {
    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("▶")
                .font(ArenaFont.display(size: 56, weight: .heavy))
                .foregroundColor(.arenaPrimary)
            Text("LIVE SCORES")
                .font(ArenaFont.display(size: 22, weight: .heavy))
                .tracking(3)
            Text(String(localized: "Coming next."))
                .font(ArenaFont.body(size: 13))
                .foregroundColor(.arenaTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ArenaTabBar: View {
    @Binding var selected: ArenaTab

    var body: some View {
        HStack(spacing: 4) {
            ForEach(ArenaTab.allCases) { tab in
                ArenaTabButton(tab: tab, isActive: selected == tab) {
                    if selected != tab {
                        withAnimation(.easeOut(duration: 0.15)) { selected = tab }
                    }
                }
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
