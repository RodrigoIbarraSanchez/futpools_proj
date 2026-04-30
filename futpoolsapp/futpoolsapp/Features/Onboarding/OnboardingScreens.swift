//
//  OnboardingScreens.swift
//  futpoolsapp
//
//  The six pre-login onboarding screens. Each one is a stateless View
//  that takes its `next` / `select` callbacks from `OnboardingView`,
//  so all flow + persistence lives in the parent.
//
//  Copy is "wins, not features" — leads with what the user gets, not
//  what the app does. Headlines use ArenaFont.display tracked-out for
//  the arcade aesthetic; supporting copy uses ArenaFont.mono.
//

import SwiftUI

// MARK: - Goal selection (persisted to @AppStorage("onboardingGoal"))

enum OnboardingGoal: String, CaseIterable, Identifiable {
    case friends, prizes, fun
    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .friends: return "👥"
        case .prizes:  return "🏆"
        case .fun:     return "⚽"
        }
    }
    var label: String {
        switch self {
        case .friends: return String(localized: "WITH MY FRIENDS")
        case .prizes:  return String(localized: "TO WIN REAL PRIZES")
        case .fun:     return String(localized: "FOR FUN AND STREAKS")
        }
    }
}

// MARK: - Screen 1: Welcome / hero

struct OnboardingWelcomeScreen: View {
    let onStart: () -> Void
    let onLogin: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 30)
            Image("PrizeAmazonGift")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxHeight: 220)
                .shadow(color: .arenaGold.opacity(0.55), radius: 24, y: 6)
                .padding(.horizontal, 24)
            VStack(spacing: 12) {
                Text(String(localized: "WIN REAL PRIZES"))
                    .font(ArenaFont.display(size: 32, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaGold)
                    .multilineTextAlignment(.center)
                Text(String(localized: "Predict football. The highest score wins the prize."))
                    .font(ArenaFont.body(size: 14))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            Spacer()
            VStack(spacing: 12) {
                ArcadeButton(
                    title: "▶ " + String(localized: "GET STARTED"),
                    size: .lg,
                    fullWidth: true,
                    action: onStart
                )
                Button(action: onLogin) {
                    Text(String(localized: "I already have an account"))
                        .font(ArenaFont.mono(size: 11, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(.arenaTextDim)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 8)
        }
        .padding(.top, 60)
    }
}

// MARK: - Screen 2: Pain points

struct OnboardingPainPointsScreen: View {
    let onNext: () -> Void

    private struct Pain: Identifiable {
        let id = UUID()
        let emoji: String
        let title: String
        let detail: String
    }

    private var pains: [Pain] {
        [
            Pain(emoji: "📱",
                 title: String(localized: "Pools in WhatsApp groups"),
                 detail: String(localized: "that always end in arguments")),
            Pain(emoji: "📊",
                 title: String(localized: "Spreadsheets by hand"),
                 detail: String(localized: "to keep track of everyone's picks")),
            Pain(emoji: "💸",
                 title: String(localized: "Chasing your friends"),
                 detail: String(localized: "to actually pay what they owe")),
        ]
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 40)
            Text(String(localized: "SOUND FAMILIAR?"))
                .font(ArenaFont.display(size: 26, weight: .black))
                .tracking(3)
                .foregroundColor(.arenaText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            VStack(spacing: 12) {
                ForEach(pains) { p in painRow(p) }
            }
            .padding(.horizontal, 20)
            Spacer()
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: onNext
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }

    private func painRow(_ p: Pain) -> some View {
        HudFrame(cut: 10) {
            HStack(alignment: .top, spacing: 14) {
                Text(p.emoji)
                    .font(.system(size: 28))
                VStack(alignment: .leading, spacing: 4) {
                    Text(p.title)
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .tracking(0.5)
                        .foregroundColor(.arenaText)
                    Text(p.detail)
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaTextDim)
                }
                Spacer()
                Text("✕")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.arenaDanger.opacity(0.8))
            }
            .padding(14)
        }
    }
}

// MARK: - Screen 3: Wins carousel (3 cards)

struct OnboardingWinsCarouselScreen: View {
    let onNext: () -> Void
    @State private var page = 0

    private struct Win: Identifiable {
        let id = UUID()
        let emoji: String
        let title: String
        let detail: String
        let color: Color
    }

    private var wins: [Win] {
        [
            Win(emoji: "🏆",
                title: String(localized: "REAL PRIZES EVERY WEEK"),
                detail: String(localized: "Pools with Amazon gift cards. Best score takes it home."),
                color: .arenaGold),
            Win(emoji: "⚔",
                title: String(localized: "GO 1 vs 1"),
                detail: String(localized: "Bet coins head-to-head on any match. You pick the stake."),
                color: .arenaHot),
            Win(emoji: "🎟",
                title: String(localized: "FREE TICKETS DAILY"),
                detail: String(localized: "1 click on the Daily Pick = 1 Ticket. 7 = 1 entry. No purchase."),
                color: .arenaAccent),
        ]
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 40)
            TabView(selection: $page) {
                ForEach(Array(wins.enumerated()), id: \.element.id) { idx, win in
                    winCard(win)
                        .tag(idx)
                        .padding(.horizontal, 20)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .never))
            .frame(maxWidth: .infinity)
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: onNext
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }

    private func winCard(_ w: Win) -> some View {
        HudFrame(cut: 14, glow: w.color) {
            VStack(spacing: 18) {
                Text(w.emoji)
                    .font(.system(size: 84))
                    .shadow(color: w.color.opacity(0.6), radius: 18)
                Text(w.title)
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(w.color)
                    .multilineTextAlignment(.center)
                Text(w.detail)
                    .font(ArenaFont.body(size: 14))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }
            .padding(28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Screen 4: Social proof

struct OnboardingSocialProofScreen: View {
    let onNext: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 40)
            Text(String(localized: "JOIN THE GRID"))
                .font(ArenaFont.display(size: 24, weight: .black))
                .tracking(3)
                .foregroundColor(.arenaText)
            VStack(spacing: 14) {
                statBlock(value: "+200", label: String(localized: "Active players this week"), color: .arenaPrimary)
                statBlock(value: "$3,500 MXN", label: String(localized: "Paid out in gift cards"), color: .arenaGold)
                statBlock(value: "4.8 ★", label: String(localized: "Average player rating"), color: .arenaAccent)
            }
            .padding(.horizontal, 20)
            Text(String(localized: "Numbers updated at launch."))
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(.arenaTextFaint)
                .padding(.top, 4)
            Spacer()
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: onNext
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }

    private func statBlock(value: String, label: String, color: Color) -> some View {
        HudFrame(cut: 10, glow: color) {
            VStack(spacing: 4) {
                Text(value)
                    .font(ArenaFont.display(size: 32, weight: .black))
                    .foregroundColor(color)
                Text(label.uppercased())
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.5)
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
            }
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Screen 5: Goal ask

struct OnboardingGoalAskScreen: View {
    @Binding var selected: OnboardingGoal?
    let onSelect: (OnboardingGoal) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 40)
            VStack(spacing: 8) {
                Text(String(localized: "HOW DO YOU SEE YOURSELF PLAYING?"))
                    .font(ArenaFont.display(size: 20, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Text(String(localized: "Pick one — there's no wrong answer."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            VStack(spacing: 12) {
                ForEach(OnboardingGoal.allCases) { g in
                    goalButton(g)
                }
            }
            .padding(.horizontal, 20)
            Spacer()
        }
    }

    private func goalButton(_ g: OnboardingGoal) -> some View {
        let isSelected = selected == g
        return Button {
            selected = g
            onSelect(g)
        } label: {
            HStack(spacing: 14) {
                Text(g.emoji)
                    .font(.system(size: 28))
                Text(g.label)
                    .font(ArenaFont.display(size: 14, weight: .heavy))
                    .tracking(1.5)
                    .foregroundColor(isSelected ? .arenaOnPrimary : .arenaText)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.arenaOnPrimary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                HudCornerCutShape(cut: 8)
                    .fill(isSelected ? Color.arenaPrimary : Color.arenaSurface)
            )
            .overlay(
                HudCornerCutShape(cut: 8)
                    .stroke(isSelected ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1)
            )
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Screen 6: Account gate

struct OnboardingAccountGateScreen: View {
    let onSignup: () -> Void
    let onLogin: () -> Void

    private var bullets: [String] {
        [
            String(localized: "✓ No credit card · No commitment"),
            String(localized: "✓ 100 welcome coins"),
            String(localized: "✓ Cancel anytime"),
        ]
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 40)
            Text("🎮")
                .font(.system(size: 72))
                .shadow(color: .arenaPrimary.opacity(0.6), radius: 20)
            VStack(spacing: 10) {
                Text(String(localized: "CLAIM YOUR SPOT"))
                    .font(ArenaFont.display(size: 28, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text(String(localized: "One tap and you're in."))
                    .font(ArenaFont.body(size: 14))
                    .foregroundColor(.arenaTextDim)
            }
            Spacer()
            VStack(alignment: .leading, spacing: 8) {
                ForEach(bullets, id: \.self) { b in
                    Text(b)
                        .font(ArenaFont.mono(size: 11))
                        .foregroundColor(.arenaTextDim)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 28)
            VStack(spacing: 12) {
                ArcadeButton(
                    title: "▶ " + String(localized: "CREATE FREE ACCOUNT"),
                    variant: .primary,
                    size: .lg,
                    fullWidth: true,
                    action: onSignup
                )
                ArcadeButton(
                    title: String(localized: "I ALREADY HAVE AN ACCOUNT"),
                    variant: .ghost,
                    size: .lg,
                    fullWidth: true,
                    action: onLogin
                )
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }
}
