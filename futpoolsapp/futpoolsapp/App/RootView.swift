//
//  RootView.swift
//  futpoolsapp
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var inviteRouter: InviteRouter

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                NavigationStack {
                    LoginView()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.isAuthenticated)
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
    }
}

#Preview {
    RootView()
        .environmentObject(AuthService())
        .environmentObject(InviteRouter())
        .preferredColorScheme(.dark)
}
