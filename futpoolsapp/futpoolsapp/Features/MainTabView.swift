//
//  MainTabView.swift
//  futpoolsapp
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Pools", systemImage: "trophy.fill")
                }
                .tag(0)

            MyEntriesView()
                .tabItem {
                    Label("My Entries", systemImage: "ticket.fill")
                }
                .tag(1)

            ProfileView()
                .tabItem {
                    Label("Account", systemImage: "person.crop.circle.fill")
                }
                .tag(2)
        }
        .tint(Color.appPrimary)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(Color.appSurface)
            appearance.shadowColor = UIColor(Color.black.opacity(0.4))
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
            UITabBar.appearance().unselectedItemTintColor = UIColor(Color.appTextMuted)
            UINavigationBar.appearance().barTintColor = UIColor(Color.appBackground)
            UINavigationBar.appearance().titleTextAttributes = [.foregroundColor: UIColor.white]
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
