//
//  RootView.swift
//  futpoolsapp
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthService

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
    }
}

#Preview {
    RootView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
