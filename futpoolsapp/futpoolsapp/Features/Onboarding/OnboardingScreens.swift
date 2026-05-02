//
//  OnboardingScreens.swift
//  futpoolsapp
//
//  11 screens implementing the adamlyttleapps onboarding-questionnaire
//  skill blueprint, mapped to futpools (see memory/onboarding_blueprint).
//
//  Each screen is a stateless View that reads + mutates the shared
//  `OnboardingState`. Navigation lives in `OnboardingView`. All copy
//  goes through `String(localized:)` so it switches with the in-app
//  language picker.
//

import SwiftUI
import Combine

// MARK: - Screen 1: Welcome

struct OnbWelcomeScreen: View {
    @ObservedObject var state: OnboardingState
    let onLogin: () -> Void

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 24)
            Image("PrizeAmazonGift")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxHeight: 200)
                .shadow(color: .arenaGold.opacity(0.5), radius: 24, y: 6)
                .padding(.horizontal, 24)
            VStack(spacing: 10) {
                Text(String(localized: "WIN REAL PRIZES BY PREDICTING FOOTBALL"))
                    .font(ArenaFont.display(size: 26, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaGold)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Text(String(localized: "Pools with friends. No spreadsheets. Nobody to chase for money."))
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
                    action: { state.advance() }
                )
                Button(action: onLogin) {
                    Text(String(localized: "I already have an account"))
                        .font(ArenaFont.mono(size: 11, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(.arenaTextDim)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 12)
        }
        .padding(.top, 30)
    }
}

// MARK: - Screen 2: Goal question (single-select)

struct OnbGoalScreen: View {
    @ObservedObject var state: OnboardingState

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 30)
            VStack(spacing: 8) {
                Text(String(localized: "WHAT BRINGS YOU TO FUTPOOLS?"))
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Text(String(localized: "Pick all that apply."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            VStack(spacing: 10) {
                ForEach(OnboardingGoalChoice.allCases) { g in
                    optionRow(g)
                }
            }
            .padding(.horizontal, 20)
            Spacer()
            if !state.goals.isEmpty {
                ArcadeButton(
                    title: "▶ " + String(localized: "NEXT"),
                    size: .lg,
                    fullWidth: true,
                    action: { state.advance() }
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: state.goals)
    }

    private func optionRow(_ g: OnboardingGoalChoice) -> some View {
        let active = state.goals.contains(g)
        return Button {
            if active { state.goals.remove(g) } else { state.goals.insert(g) }
        } label: {
            HStack(spacing: 14) {
                Text(g.emoji).font(.system(size: 26))
                Text(g.label)
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(1)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer()
                if active {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.arenaOnPrimary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HudCornerCutShape(cut: 8).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Screen 3: Pain points (multi-select)

struct OnbPainScreen: View {
    @ObservedObject var state: OnboardingState

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 30)
            VStack(spacing: 8) {
                Text(String(localized: "WHAT FRUSTRATES YOU ABOUT POOLS TODAY?"))
                    .font(ArenaFont.display(size: 20, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Text(String(localized: "Tap everything that hits home."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(OnboardingPain.allCases) { p in
                        painRow(p)
                    }
                }
                .padding(.horizontal, 20)
            }
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: { state.advance() }
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
        }
    }

    private func painRow(_ p: OnboardingPain) -> some View {
        let active = state.pains.contains(p)
        return Button {
            if active { state.pains.remove(p) } else { state.pains.insert(p) }
        } label: {
            HStack(spacing: 12) {
                Text(p.emoji).font(.system(size: 22))
                Text(p.label)
                    .font(ArenaFont.body(size: 13, weight: .regular))
                    .foregroundColor(active ? .arenaText : .arenaTextDim)
                    .lineLimit(2)
                Spacer()
                ZStack {
                    HudCornerCutShape(cut: 4)
                        .stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1.5)
                        .frame(width: 22, height: 22)
                    if active {
                        HudCornerCutShape(cut: 4)
                            .fill(Color.arenaPrimary)
                            .frame(width: 14, height: 14)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HudCornerCutShape(cut: 8).fill(Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary.opacity(0.55) : Color.arenaStroke, lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Screen 4: Social proof

struct OnbSocialProofScreen: View {
    @ObservedObject var state: OnboardingState

    private struct Quote: Identifiable {
        let id = UUID()
        let stars: Int
        let body: String
        let author: String
    }
    private var quotes: [Quote] {
        [
            Quote(stars: 5,
                  body: String(localized: "\"At last, no fights with my buddies over weekend points. I won a $250 gift card.\""),
                  author: String(localized: "— Carlos M., 32, runs his neighborhood pool")),
            Quote(stars: 5,
                  body: String(localized: "\"Daily Pick is my morning vice. 14-day streak going.\""),
                  author: String(localized: "— Laura S., 27, América fan")),
        ]
    }

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 30)
            Text(String(localized: "PLAYERS LIKE YOU ARE ALREADY IN"))
                .font(ArenaFont.display(size: 20, weight: .black))
                .tracking(2)
                .foregroundColor(.arenaText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            VStack(spacing: 12) {
                ForEach(quotes) { q in
                    quoteCard(q)
                }
            }
            .padding(.horizontal, 20)
            Spacer()
            Text(String(localized: "Representative reviews. More on App Store."))
                .font(ArenaFont.mono(size: 9))
                .foregroundColor(.arenaTextFaint)
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: { state.advance() }
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
        }
    }

    private func quoteCard(_ q: Quote) -> some View {
        HudFrame(cut: 10) {
            VStack(alignment: .leading, spacing: 8) {
                Text(String(repeating: "⭐", count: q.stars))
                    .font(.system(size: 14))
                Text(q.body)
                    .font(ArenaFont.body(size: 13))
                    .foregroundColor(.arenaText)
                Text(q.author)
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .foregroundColor(.arenaTextDim)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Screen 5: Tinder cards (4 swipe statements)

struct OnbTinderScreen: View {
    @ObservedObject var state: OnboardingState
    @State private var index: Int = 0
    @State private var dragOffset: CGSize = .zero

    private let statements: [String] = [
        String(localized: "I'm always the one who ends up building the bracket"),
        String(localized: "I've been chasing 3 pools that still owe me money"),
        String(localized: "My group wins $200 and nobody collects it"),
        String(localized: "I want to throw a quick prediction without joining a whole league"),
    ]

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 24)
            VStack(spacing: 6) {
                Text(String(localized: "WHICH ONE IS YOU?"))
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text(String(localized: "Swipe → if it's you. ← if not."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            ZStack {
                if index < statements.count {
                    cardView(statements[index])
                        .offset(x: dragOffset.width, y: dragOffset.height * 0.2)
                        .rotationEffect(.degrees(Double(dragOffset.width / 18)))
                        .gesture(
                            DragGesture()
                                .onChanged { value in dragOffset = value.translation }
                                .onEnded { value in handleSwipe(value.translation.width) }
                        )
                        .transition(.scale.combined(with: .opacity))
                } else {
                    Text("✓")
                        .font(.system(size: 64, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 24)
            HStack(spacing: 28) {
                Button { resolveSwipe(.dismiss) } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.arenaDanger)
                        .frame(width: 56, height: 56)
                        .background(HudCornerCutShape(cut: 8).fill(Color.arenaSurface))
                        .overlay(HudCornerCutShape(cut: 8).stroke(Color.arenaDanger.opacity(0.6), lineWidth: 1))
                }
                Button { resolveSwipe(.agree) } label: {
                    Image(systemName: "checkmark")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                        .frame(width: 56, height: 56)
                        .background(HudCornerCutShape(cut: 8).fill(Color.arenaSurface))
                        .overlay(HudCornerCutShape(cut: 8).stroke(Color.arenaPrimary.opacity(0.6), lineWidth: 1))
                }
            }
            .buttonStyle(.plain)
            // NEXT only appears once the user has swiped (or button-
            // tapped) through all 4 cards — keeps the screen
            // mandatory in line with the no-skip onboarding policy.
            if index >= statements.count {
                ArcadeButton(
                    title: "▶ " + String(localized: "NEXT"),
                    size: .lg,
                    fullWidth: true,
                    action: { state.advance() }
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    private func cardView(_ text: String) -> some View {
        HudFrame(cut: 14, glow: .arenaAccent) {
            VStack(spacing: 18) {
                Text("\u{201C}")
                    .font(.system(size: 60, weight: .black))
                    .foregroundColor(.arenaAccent)
                Text(text)
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.arenaText)
                Text("\(index + 1) / \(statements.count)")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(2)
                    .foregroundColor(.arenaTextDim)
            }
            .padding(28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func handleSwipe(_ x: CGFloat) {
        if x > 80 { resolveSwipe(.agree) }
        else if x < -80 { resolveSwipe(.dismiss) }
        else { withAnimation { dragOffset = .zero } }
    }

    private func resolveSwipe(_ r: OnboardingTinderResponse) {
        state.swipes.append(r)
        withAnimation(.easeOut(duration: 0.25)) {
            dragOffset = CGSize(width: r == .agree ? 500 : -500, height: 0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                index += 1
                dragOffset = .zero
            }
        }
    }
}

// MARK: - Screen 6: Personalised solution

struct OnbSolutionScreen: View {
    @ObservedObject var state: OnboardingState

    /// Falls back to the top 3 solutions when the user picked no
    /// pains, so the screen never shows an empty state.
    private var resolvedPains: [OnboardingPain] {
        if state.pains.isEmpty {
            return [.manualScoring, .friendsDontPay, .smallPrizes]
        }
        return OnboardingPain.allCases.filter { state.pains.contains($0) }
    }

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 24)
            VStack(spacing: 8) {
                Text(String(localized: "HERE'S HOW FUTPOOLS FIXES IT"))
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Text(String(localized: "For each thing you said:"))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(resolvedPains) { p in
                        solutionRow(pain: p)
                    }
                }
                .padding(.horizontal, 20)
            }
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: { state.advance() }
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
        }
    }

    private func solutionRow(pain p: OnboardingPain) -> some View {
        let s = p.solution
        return HudFrame(cut: 10) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(p.emoji).font(.system(size: 14))
                    Text(p.label)
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(.arenaTextDim)
                        .lineLimit(1)
                }
                HStack(alignment: .top, spacing: 10) {
                    Text(s.emoji).font(.system(size: 22))
                    Text(s.headline)
                        .font(ArenaFont.display(size: 13, weight: .heavy))
                        .foregroundColor(.arenaText)
                        .lineLimit(3)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Screen 7: Preferences (multi-select league grid)

struct OnbPrefsScreen: View {
    @ObservedObject var state: OnboardingState
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 30)
            VStack(spacing: 8) {
                Text(String(localized: "WHAT FOOTBALL DO YOU FOLLOW?"))
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                    .multilineTextAlignment(.center)
                Text(String(localized: "We'll filter the next step's matches."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(OnboardingLeague.allCases) { l in
                    leagueButton(l)
                }
            }
            .padding(.horizontal, 20)
            Spacer()
            ArcadeButton(
                title: "▶ " + String(localized: "NEXT"),
                size: .lg,
                fullWidth: true,
                action: {
                    if state.leagues.isEmpty { state.leagues = [.ligaMX] }
                    state.advance()
                }
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
        }
    }

    private func leagueButton(_ l: OnboardingLeague) -> some View {
        let active = state.leagues.contains(l)
        return Button {
            if active { state.leagues.remove(l) } else { state.leagues.insert(l) }
        } label: {
            VStack(spacing: 6) {
                Text(l.label)
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
            }
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity)
            .background(HudCornerCutShape(cut: 8).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Screen 8: Processing moment (1.5s auto-advance)

struct OnbProcessingScreen: View {
    @ObservedObject var state: OnboardingState
    @State private var step = 0
    private let lines: [String] = [
        String(localized: "Filtering leagues you follow"),
        String(localized: "Loading upcoming matches"),
        String(localized: "Done"),
    ]

    var body: some View {
        VStack(spacing: 26) {
            Spacer()
            ProgressView()
                .scaleEffect(2)
                .tint(.arenaPrimary)
            Text(String(localized: "Personalizing your matches…"))
                .font(ArenaFont.display(size: 16, weight: .heavy))
                .tracking(1.5)
                .foregroundColor(.arenaText)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(0..<lines.count, id: \.self) { i in
                    HStack(spacing: 10) {
                        Image(systemName: i <= step ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(i <= step ? .arenaPrimary : .arenaTextFaint)
                        Text(lines[i])
                            .font(ArenaFont.mono(size: 12))
                            .foregroundColor(i <= step ? .arenaText : .arenaTextDim)
                    }
                    .opacity(i <= step ? 1 : 0.3)
                }
            }
            Spacer()
        }
        .onAppear {
            for i in 0..<lines.count {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 * Double(i + 1)) {
                    withAnimation { step = i }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                state.advance()
            }
        }
    }
}

// MARK: - Screen 9: App demo (predict 3 fixtures)

struct OnbDemoScreen: View {
    @ObservedObject var state: OnboardingState
    @StateObject private var vm = OnbDemoViewModel()

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 24)
            VStack(spacing: 6) {
                Text(String(localized: "TRY YOUR FIRST POOL"))
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text(String(localized: "Pick 3 matches. Best score wins."))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            if vm.isLoading {
                Spacer()
                ProgressView().tint(.arenaPrimary)
                Spacer()
            } else if let fx = vm.currentFixture {
                fixtureCard(fx)
                    .padding(.horizontal, 18)
                progressLabel
            } else {
                Spacer()
                Text(String(localized: "✓ All picks locked in"))
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .foregroundColor(.arenaPrimary)
                Spacer()
            }
            Spacer(minLength: 8)
            if vm.didFinish {
                ArcadeButton(
                    title: "▶ " + String(localized: "SEE YOUR PICKS"),
                    size: .lg,
                    fullWidth: true,
                    action: {
                        state.demoPicks = vm.picksOut
                        state.advance()
                    }
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
            }
        }
        .task { await vm.load(leagues: Array(state.leagues)) }
    }

    private var progressLabel: some View {
        Text("\(vm.completedCount) / \(vm.totalCount)")
            .font(ArenaFont.mono(size: 12, weight: .bold))
            .tracking(1.5)
            .foregroundColor(.arenaTextDim)
    }

    private func fixtureCard(_ fx: OnbDemoFixture) -> some View {
        HudFrame(cut: 14, glow: .arenaAccent) {
            VStack(spacing: 14) {
                Text(String(format: String(localized: "MATCH %1$lld OF %2$lld"), vm.currentIndex + 1, vm.totalCount))
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(2)
                    .foregroundColor(.arenaTextMuted)
                HStack(spacing: 10) {
                    teamBlock(name: fx.homeTeam, logo: fx.homeLogo)
                    Text("vs")
                        .font(ArenaFont.display(size: 14, weight: .heavy))
                        .foregroundColor(.arenaTextDim)
                    teamBlock(name: fx.awayTeam, logo: fx.awayLogo)
                }
                Text(fx.kickoffShort)
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextDim)
                if let lg = fx.leagueName {
                    Text(lg.uppercased())
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.2)
                        .foregroundColor(.arenaAccent)
                }
                HStack(spacing: 8) {
                    pickButton(label: String(localized: "1 LOCAL"), code: "1")
                    pickButton(label: String(localized: "X DRAW"), code: "X")
                    pickButton(label: String(localized: "2 AWAY"), code: "2")
                }
                .padding(.top, 4)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }

    private func teamBlock(name: String, logo: String?) -> some View {
        VStack(spacing: 6) {
            if let urlString = logo, let url = URL(string: urlString) {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFit()
                } placeholder: {
                    Color.clear
                }
                .frame(width: 50, height: 50)
            }
            Text(name)
                .font(ArenaFont.display(size: 11, weight: .heavy))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .foregroundColor(.arenaText)
                .frame(maxWidth: .infinity)
        }
    }

    private func pickButton(label: String, code: String) -> some View {
        Button {
            vm.pick(code)
        } label: {
            Text(label)
                .font(ArenaFont.display(size: 11, weight: .heavy))
                .tracking(1.5)
                .foregroundColor(.arenaText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurfaceAlt))
                .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaPrimary.opacity(0.4), lineWidth: 1))
                .clipShape(HudCornerCutShape(cut: 6))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Demo view model + fixture model

struct OnbDemoFixture: Identifiable, Decodable {
    let fixtureId: Int
    let homeTeam: String
    let awayTeam: String
    let homeLogo: String?
    let awayLogo: String?
    let kickoff: String?
    let leagueName: String?

    var id: Int { fixtureId }

    var kickoffShort: String {
        guard let s = kickoff,
              let d = ISO8601DateFormatter().date(from: s)
                ?? {
                    let f = ISO8601DateFormatter()
                    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    return f.date(from: s)
                }() else { return "" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = .current
        return f.string(from: d)
    }
}

/// Public-endpoint payload uses `date` and nested `teams` shape; we
/// flatten it into `OnbDemoFixture` so the SwiftUI side stays simple.
private struct PublicFixturePayload: Decodable {
    let fixtureId: Int
    let date: String?
    let status: String?
    let league: LeagueBlock?
    let teams: TeamsBlock

    struct LeagueBlock: Decodable {
        let id: Int?
        let name: String?
        let logo: String?
    }
    struct TeamsBlock: Decodable {
        struct Team: Decodable {
            let id: Int?
            let name: String?
            let logo: String?
        }
        let home: Team
        let away: Team
    }
}

@MainActor
final class OnbDemoViewModel: ObservableObject {
    @Published var fixtures: [OnbDemoFixture] = []
    @Published var picks: [Int: String] = [:]
    @Published var currentIndex: Int = 0
    @Published var isLoading = false

    var totalCount: Int { fixtures.count }
    var completedCount: Int { picks.count }
    var didFinish: Bool { !fixtures.isEmpty && completedCount >= totalCount }
    var currentFixture: OnbDemoFixture? {
        guard currentIndex < fixtures.count else { return nil }
        return fixtures[currentIndex]
    }
    var picksOut: [OnboardingDemoPick] {
        fixtures.compactMap { fx in
            guard let p = picks[fx.fixtureId] else { return nil }
            return OnboardingDemoPick(fixtureId: fx.fixtureId, pick: p)
        }
    }

    func load(leagues: [OnboardingLeague]) async {
        guard fixtures.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        let ids = (leagues.isEmpty ? [.ligaMX] : leagues).map { String($0.apiFootballID) }.joined(separator: ",")
        do {
            let raw: [PublicFixturePayload] = try await APIClient.shared.request(
                method: "GET",
                path: "/public/fixtures/upcoming?leagueIds=\(ids)&limit=3"
            )
            fixtures = raw.map { p in
                OnbDemoFixture(
                    fixtureId: p.fixtureId,
                    homeTeam: p.teams.home.name ?? "Home",
                    awayTeam: p.teams.away.name ?? "Away",
                    homeLogo: p.teams.home.logo,
                    awayLogo: p.teams.away.logo,
                    kickoff: p.date,
                    leagueName: p.league?.name
                )
            }
        } catch {
            // Demo is non-critical — show a curated fallback so the
            // user can still complete the flow when offline / API down.
            fixtures = OnbDemoViewModel.fallbackFixtures
        }
    }

    func pick(_ code: String) {
        guard let fx = currentFixture else { return }
        picks[fx.fixtureId] = code
        if currentIndex < fixtures.count - 1 {
            withAnimation(.easeInOut(duration: 0.25)) { currentIndex += 1 }
        }
    }

    private static let fallbackFixtures: [OnbDemoFixture] = [
        OnbDemoFixture(fixtureId: -1, homeTeam: "Real Madrid", awayTeam: "Atlético", homeLogo: nil, awayLogo: nil, kickoff: nil, leagueName: "LaLiga"),
        OnbDemoFixture(fixtureId: -2, homeTeam: "Barcelona", awayTeam: "Valencia", homeLogo: nil, awayLogo: nil, kickoff: nil, leagueName: "LaLiga"),
        OnbDemoFixture(fixtureId: -3, homeTeam: "PSG", awayTeam: "Marseille", homeLogo: nil, awayLogo: nil, kickoff: nil, leagueName: "Ligue 1"),
    ]
}

// MARK: - Screen 10: Value delivery / viral moment

struct OnbValueDeliveryScreen: View {
    @ObservedObject var state: OnboardingState
    let fixturesByID: [Int: OnbDemoFixture]
    let onShare: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 24)
            VStack(spacing: 6) {
                Text(String(localized: "YOUR MINI-POOL IS READY"))
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaPrimary)
                Text(String(format: String(localized: "%lld picks. 0 / %lld until first kickoff."), state.demoPicks.count, state.demoPicks.count))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            HudFrame(cut: 14, glow: .arenaGold) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(String(localized: "YOUR FIRST POOL"))
                        .font(ArenaFont.mono(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(.arenaTextMuted)
                    Divider().background(Color.arenaStroke)
                    ForEach(state.demoPicks) { p in
                        pickRow(p)
                    }
                    Divider().background(Color.arenaStroke)
                    HStack {
                        Text(String(localized: "Score"))
                            .font(ArenaFont.mono(size: 10))
                            .foregroundColor(.arenaTextDim)
                        Spacer()
                        Text("0 / \(state.demoPicks.count)")
                            .font(ArenaFont.display(size: 14, weight: .heavy))
                            .foregroundColor(.arenaGold)
                    }
                }
                .padding(14)
            }
            .padding(.horizontal, 20)
            Spacer()
            VStack(spacing: 10) {
                ArcadeButton(
                    title: "▶ " + String(localized: "SAVE & COMPETE"),
                    variant: .primary,
                    size: .lg,
                    fullWidth: true,
                    action: { state.advance() }
                )
                Button(action: onShare) {
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.arrow.up")
                        Text(String(localized: "Share with friends"))
                    }
                    .font(ArenaFont.mono(size: 12, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(.arenaTextDim)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
        }
    }

    private func pickRow(_ p: OnboardingDemoPick) -> some View {
        let fx = fixturesByID[p.fixtureId]
        return HStack {
            Text(fx.map { "\($0.homeTeam) vs \($0.awayTeam)" } ?? "—")
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaText)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer()
            Text(p.pick)
                .font(ArenaFont.display(size: 14, weight: .heavy))
                .foregroundColor(.arenaPrimary)
                .frame(width: 28, height: 24)
                .background(HudCornerCutShape(cut: 4).fill(Color.arenaPrimary.opacity(0.18)))
        }
    }
}

// MARK: - Screen 11: Account gate

struct OnbAccountGateScreen: View {
    @ObservedObject var state: OnboardingState
    let onSignup: () -> Void
    let onLogin: () -> Void

    private var bullets: [String] {
        [
            String(localized: "✓ Your picks stay saved"),
            String(localized: "✓ 100 welcome coins"),
            String(localized: "✓ Access to weekly real-prize sweepstake"),
        ]
    }

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 24)
            Text("🎮")
                .font(.system(size: 64))
                .shadow(color: .arenaPrimary.opacity(0.6), radius: 18)
            VStack(spacing: 10) {
                Text(String(localized: "SAVE YOUR PICKS AND PLAY"))
                    .font(ArenaFont.display(size: 24, weight: .black))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                    .multilineTextAlignment(.center)
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
            VStack(spacing: 10) {
                ArcadeButton(
                    title: "▶ " + String(localized: "CREATE FREE ACCOUNT"),
                    variant: .primary,
                    size: .lg,
                    fullWidth: true,
                    action: { state.persist(); onSignup() }
                )
                ArcadeButton(
                    title: String(localized: "I ALREADY HAVE AN ACCOUNT"),
                    variant: .ghost,
                    size: .lg,
                    fullWidth: true,
                    action: { state.persist(); onLogin() }
                )
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
        }
    }
}
