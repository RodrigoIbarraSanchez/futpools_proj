//
//  futpoolsappApp.swift
//  futpoolsapp
//

import SwiftUI

@main
struct futpoolsappApp: App {
    @StateObject private var auth = AuthService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .preferredColorScheme(.dark)
        }
    }
}
