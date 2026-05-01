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
            ZStack(alignment: .top) {
                ArenaBackground()
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                topBar
            }
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
        case .goal:
            OnbGoalScreen(state: state).transition(.opacity)
        case .pain:
            OnbPainScreen(state: state).transition(.opacity)
        case .social:
            OnbSocialProofScreen(state: state).transition(.opacity)
        case .tinder:
            OnbTinderScreen(state: state).transition(.opacity)
        case .solution:
            OnbSolutionScreen(state: state).transition(.opacity)
        case .prefs:
            OnbPrefsScreen(state: state).transition(.opacity)
        case .processing:
            OnbProcessingScreen(state: state).transition(.opacity)
        case .demo:
            OnbDemoScreen(state: state).transition(.opacity)
        case .value:
            OnbValueDeliveryScreen(
                state: state,
                fixturesByID: [:],
                onShare: {
                    let txt = String(localized: "I'm playing my first futpools mini-pool. Pick yours: https://futpools.com")
                    shareSheet = ShareItem(text: txt)
                }
            )
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
            ProgressView(value: state.step.progress)
                .progressViewStyle(.linear)
                .tint(.arenaPrimary)
                .frame(maxWidth: .infinity)
            if state.step != .gate {
                Button {
                    state.jumpToGate()
                } label: {
                    Text(String(localized: "Skip"))
                        .font(ArenaFont.mono(size: 11, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(.arenaTextDim)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(HudCornerCutShape(cut: 5).fill(Color.arenaSurface.opacity(0.6)))
                        .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaStroke, lineWidth: 1))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
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
