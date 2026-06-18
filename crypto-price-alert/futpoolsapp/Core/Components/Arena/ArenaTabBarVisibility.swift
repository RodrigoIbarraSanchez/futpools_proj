//
//  ArenaTabBarVisibility.swift
//  futpoolsapp
//
//  Preference-key plumbing so pushed detail screens can hide the custom Arena tab bar,
//  freeing space for sticky bottom CTAs without rearchitecting navigation.
//

import SwiftUI

struct ArenaTabBarHiddenKey: PreferenceKey {
    static let defaultValue: Bool = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) {
        value = value || nextValue()
    }
}

extension View {
    /// Hide (or show) the Arena bottom tab bar while this view is on screen.
    func arenaTabBarHidden(_ hidden: Bool = true) -> some View {
        preference(key: ArenaTabBarHiddenKey.self, value: hidden)
    }
}
