//
//  OnboardingView.swift
//  futpoolsapp
//
//  Skill v2 — 11-screen onboarding container. Drives the
//  OnboardingState through Welcome → Goal → Pain → Social → Tinder →
//  Solution → Prefs → Processing → Demo → Value → AccountGate.
//
//  Persists captured state (goal/pain/leagues/picks) to UserDefaults
//  on exit so post-signup screens can use it.
//

import SwiftUI

struct OnboardingView: View {
    @StateObject private var state = OnboardingState()
    @AppStorage("app_language") private var appLanguage = ""
    @State private var presentLogin = false
    @State private var presentSignup = false
    @State private var shareSheet: ShareItem?

    private var demoFixturesByID: [Int: OnbDemoFixture] {
        // Snapshot the picks → fixture map for the value delivery
        // screen. Pulled from a temporary VM the demo screen owns,
        // but for the value screen we just match by id from picks
        // since the fixture metadata is bundled into each pick row
        // through the demoVM.
        [:]
    }

    var body: some View {
        NavigationStack {
            ZStack {
                // Background fills the whole screen (under everything)
                OnbBackground()
                // Foreground stack — topBar takes its intrinsic
                // height first, content fills the remaining space
                // below. (Previously this was a ZStack with topBar
                // overlaid on top of content, which caused the
                // header/eyebrow to render under the progress bar
                // and language toggle.)
                // Single wrapper so the horizontal gutter applies uniformly
                // to BOTH the topBar and every onboarding sub-view. Sub-views
                // can opt out with negative margin if a hero ever needs full
                // bleed; default keeps progress bar, language toggle, titles,
                // CTAs and chips off the device edge.
                VStack(spacing: 0) {
                    topBar
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .padding(.horizontal, 24)
            }
            // Bundle.main returns localized strings via the override
            // installed by AppLanguage.setLanguage. SwiftUI doesn't
            // re-evaluate Text() bodies on its own when the bundle
            // changes — bumping .id() here forces the entire
            // onboarding tree to rebuild, picking up the new
            // language without an app restart.
            .id(appLanguage)
            .navigationDestination(isPresented: $presentSignup) {
                RegisterView()
            }
            .navigationDestination(isPresented: $presentLogin) {
                LoginView()
            }
            .sheet(item: $shareSheet) { item in
                ActivityViewController(activityItems: [item.text])
            }
        }
    }

    // MARK: - Routing

    @ViewBuilder
    private var content: some View {
        switch state.step {
        case .welcome:
            OnbWelcomeScreen(state: state, onLogin: { goLogin() })
                .transition(.opacity)
        case .teams:
            OnbPrefsScreen(state: state, mode: .teamsOnly)
                .transition(.opacity)
        case .leagues:
            OnbPrefsScreen(state: state, mode: .leaguesOnly)
                .transition(.opacity)
        case .notifications:
            OnbNotificationsScreen(state: state)
                .transition(.opacity)
        case .gate:
            OnbAccountGateScreen(
                state: state,
                onSignup: { goSignup() },
                onLogin: { goLogin() }
            )
            .transition(.opacity)
        }
    }

    // MARK: - Top bar (progress + skip)

    private var topBar: some View {
        HStack(spacing: 12) {
            OnbBackButton(disabled: state.step == .welcome) {
                state.back()
            }
            OnbStepIndicator(
                current: state.step.rawValue + 1,
                total: OnboardingState.Step.allCases.count
            )
            .frame(maxWidth: .infinity)
            languageToggle
        }
        // Horizontal gutter is owned by the parent VStack so the rule lives
        // in a single place — only top spacing is set here.
        .padding(.top, 8)
    }

    /// Tiny EN/ES segmented control — written into @AppStorage and
    /// applied immediately via AppLanguage so the Bundle override
    /// switches mid-onboarding. The .id(appLanguage) on the root
    /// rebuilds the tree so every Text re-resolves against the new
    /// language without an app restart.
    private var languageToggle: some View {
        HStack(spacing: 0) {
            languagePill(code: "en", label: "EN")
            languagePill(code: "es", label: "ES")
        }
        .background(HudCornerCutShape(cut: 5).fill(Color.white.opacity(0.04)))
        .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 5))
    }

    private func languagePill(code: String, label: String) -> some View {
        let active = (appLanguage.isEmpty && code == fallbackCode) || appLanguage == code
        return Button {
            appLanguage = code
            AppLanguage.setLanguage(code)
        } label: {
            Text(label)
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .tracking(1.4)
                .foregroundColor(active ? .arenaOnPrimary : .arenaTextDim)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(active ? Color.arenaPrimary : Color.clear)
        }
        .buttonStyle(.plain)
    }

    /// Used to highlight whichever pill matches the device language
    /// when the user hasn't picked one yet — so the toggle never
    /// looks "neither side selected".
    private var fallbackCode: String {
        let pref = Locale.preferredLanguages.first?.lowercased() ?? "en"
        return pref.hasPrefix("es") ? "es" : "en"
    }

    // MARK: - Actions

    private func goSignup() {
        state.persist()
        presentSignup = true
    }
    private func goLogin() {
        state.persist()
        presentLogin = true
    }
}

// MARK: - Share sheet helpers

private struct ShareItem: Identifiable {
    let id = UUID()
    let text: String
}

private struct ActivityViewController: UIViewControllerRepresentable {
    let activityItems: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    OnboardingView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
