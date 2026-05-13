//
//  RootView.swift
//  futpoolsapp
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var inviteRouter: InviteRouter
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else if !hasSeenOnboarding {
                // First-launch onboarding (6-screen wins-first flow).
                // Marks `hasSeenOnboarding = true` once the user
                // reaches the Account gate or taps Skip — after that
                // the app falls through to LoginView like before.
                OnboardingView()
            } else {
                NavigationStack {
                    LoginView()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.isAuthenticated)
        .animation(.easeInOut(duration: 0.2), value: hasSeenOnboarding)
        // Present a pool detail sheet when a deep link resolves an invite code.
        .sheet(
            isPresented: Binding(
                get: { inviteRouter.pendingPool != nil },
                set: { if !$0 { inviteRouter.clear() } }
            )
        ) {
            if let pool = inviteRouter.pendingPool {
                NavigationStack {
                    QuinielaDetailView(quiniela: pool)
                        .environmentObject(auth)
                }
            }
        }
        // simple_version: challenge deep links removed — 1v1 is gone.
    }
}

#Preview {
    RootView()
        .environmentObject(AuthService())
        .environmentObject(InviteRouter())
        .preferredColorScheme(.dark)
}
