//
//  OnboardingView.swift
//  futpoolsapp
//
//  Pre-login onboarding: 6 paged screens that sell wins (premios reales,
//  retos 1V1, tickets gratis) and gate signup. Shown ONCE per install
//  via @AppStorage("hasSeenOnboarding"). Skip/login shortcut both mark
//  the flag so the user never sees these screens twice.
//

import SwiftUI

private let kHasSeenOnboardingKey = "hasSeenOnboarding"
private let kOnboardingGoalKey = "onboardingGoal"

struct OnboardingView: View {
    @AppStorage(kHasSeenOnboardingKey) private var hasSeenOnboarding = false
    @AppStorage(kOnboardingGoalKey) private var onboardingGoal = ""
    @State private var page: Int = 0
    @State private var goalSelection: OnboardingGoal?
    @State private var presentLogin = false
    @State private var presentSignup = false

    private let totalPages = 6

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                pages
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                if page < totalPages - 1 {
                    skipButton
                }
            }
            .navigationDestination(isPresented: $presentSignup) {
                RegisterView()
            }
            .navigationDestination(isPresented: $presentLogin) {
                LoginView()
            }
        }
        .onChange(of: goalSelection) { _, newValue in
            if let g = newValue { onboardingGoal = g.rawValue }
        }
    }

    @ViewBuilder
    private var pages: some View {
        switch page {
        case 0:
            OnboardingWelcomeScreen(
                onStart: { advance() },
                onLogin: { goLogin() }
            )
            .transition(.opacity)
        case 1:
            OnboardingPainPointsScreen(onNext: { advance() })
                .transition(.opacity)
        case 2:
            OnboardingWinsCarouselScreen(onNext: { advance() })
                .transition(.opacity)
        case 3:
            OnboardingSocialProofScreen(onNext: { advance() })
                .transition(.opacity)
        case 4:
            OnboardingGoalAskScreen(
                selected: $goalSelection,
                onSelect: { _ in
                    // Auto-advance after selection — feels snappier than
                    // showing a NEXT button below already-tapped pills.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                        withAnimation { advance() }
                    }
                }
            )
            .transition(.opacity)
        default:
            OnboardingAccountGateScreen(
                onSignup: {
                    hasSeenOnboarding = true
                    presentSignup = true
                },
                onLogin: {
                    hasSeenOnboarding = true
                    presentLogin = true
                }
            )
            .transition(.opacity)
            .onAppear { hasSeenOnboarding = true }
        }
    }

    private var skipButton: some View {
        VStack {
            HStack {
                Spacer()
                Button {
                    withAnimation { page = totalPages - 1 }
                } label: {
                    Text(String(localized: "Skip"))
                        .font(ArenaFont.mono(size: 11, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(.arenaTextDim)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            HudCornerCutShape(cut: 5)
                                .fill(Color.arenaSurface.opacity(0.6))
                        )
                        .overlay(
                            HudCornerCutShape(cut: 5)
                                .stroke(Color.arenaStroke, lineWidth: 1)
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            Spacer()
        }
    }

    private func advance() {
        withAnimation(.easeInOut(duration: 0.2)) {
            page = min(page + 1, totalPages - 1)
        }
    }

    private func goLogin() {
        hasSeenOnboarding = true
        presentLogin = true
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
