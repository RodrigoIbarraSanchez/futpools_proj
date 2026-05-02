//
//  OnboardingScreens.swift
//  futpoolsapp
//
//  11-screen onboarding REDESIGN — pixel-faithful port of the
//  Claude Design HTML prototype (futpools-onboarding/project/
//  FutPools Onboarding.html). Same layout pattern on every screen:
//
//      ┌── header (eyebrow + title + subtitle) ──┐
//      │                                          │
//      │  body (flex:1, justify center)           │
//      │                                          │
//      └── footer (primary button anchored) ──────┘
//
//  Copy goes through `L("...")` (NSLocalizedString with explicit
//  bundle) so the in-app EN/ES toggle works mid-session — see
//  BundleLanguageOverride.swift for the rationale.
//

import SwiftUI
import Combine

// MARK: - Screen 1: Welcome

struct OnbWelcomeScreen: View {
    @ObservedObject var state: OnboardingState
    let onLogin: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 28) {
                Spacer(minLength: 12)
                VStack(spacing: 18) {
                    OnbBrandMark(size: 12)
                    ZStack {
                        Circle()
                            .fill(RadialGradient(
                                colors: [Color.arenaGold.opacity(0.32), .clear],
                                center: .center,
                                startRadius: 0, endRadius: 120
                            ))
                            .frame(width: 240, height: 240)
                            .blur(radius: 8)
                        Image("PrizeAmazonGift")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 200, height: 200)
                    }
                }
                VStack(spacing: 12) {
                    Text(L("WIN REAL PRIZES BY PREDICTING FOOTBALL"))
                        .font(ArenaFont.display(size: 26, weight: .heavy))
                        .tracking(2.1)
                        .lineSpacing(2)
                        .foregroundColor(.arenaGold)
                        .shadow(color: .arenaGold.opacity(0.35), radius: 24)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                    Text(L("Pools with friends. No spreadsheets. Nobody to chase for money."))
                        .font(ArenaFont.body(size: 14))
                        .foregroundColor(.arenaTextDim)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 300)
                }
                HStack(spacing: 8) {
                    OnbBadge(text: L("Free to play"))
                    OnbBadge(text: L("Live scoring"))
                    OnbBadge(text: L("Real prizes"))
                }
                Spacer(minLength: 0)
            }
            VStack(spacing: 12) {
                OnbPrimaryButton(label: L("GET STARTED")) { state.advance() }
                Button(action: onLogin) {
                    Text(L("I already have an account"))
                        .font(ArenaFont.mono(size: 11, weight: .bold))
                        .tracking(1.4)
                        .foregroundColor(.arenaTextDim)
                        .padding(8)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }
}

// MARK: - Screen 2: Goal (multi-select cards)

struct OnbGoalScreen: View {
    @ObservedObject var state: OnboardingState

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 24) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 02 — \(L("Pick all that apply."))",
                    title: L("WHAT BRINGS YOU TO FUTPOOLS?"),
                    size: .lg
                )
                VStack(spacing: 10) {
                    ForEach(OnboardingGoalChoice.allCases) { g in
                        rowFilled(
                            emoji: g.emoji,
                            label: g.label,
                            active: state.goals.contains(g),
                            toggle: {
                                if state.goals.contains(g) { state.goals.remove(g) }
                                else { state.goals.insert(g) }
                            }
                        )
                    }
                }
                .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            footer
        }
    }

    @ViewBuilder
    private var footer: some View {
        VStack {
            OnbPrimaryButton(label: L("NEXT"), disabled: state.goals.isEmpty) {
                state.advance()
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 28)
    }

    private func rowFilled(emoji: String, label: String, active: Bool, toggle: @escaping () -> Void) -> some View {
        Button(action: toggle) {
            HStack(spacing: 14) {
                Text(emoji).font(.system(size: 24))
                Text(label)
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .tracking(0.5)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer()
                if active {
                    ZStack {
                        Circle().fill(Color.arenaOnPrimary).frame(width: 22, height: 22)
                        Text("✓")
                            .font(.system(size: 13, weight: .black))
                            .foregroundColor(.arenaPrimary)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HudCornerCutShape(cut: 8).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
            .shadow(color: active ? .arenaPrimary.opacity(0.25) : .clear, radius: 16)
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Screen 3: Pain points (HUD checkbox list)

struct OnbPainScreen: View {
    @ObservedObject var state: OnboardingState

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 24) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 03 — \(L("Tap everything that hits home."))",
                    title: L("WHAT FRUSTRATES YOU ABOUT POOLS TODAY?"),
                    size: .md
                )
                VStack(spacing: 8) {
                    ForEach(OnboardingPain.allCases) { p in
                        rowChecklist(
                            emoji: p.emoji,
                            label: p.label,
                            active: state.pains.contains(p),
                            toggle: {
                                if state.pains.contains(p) { state.pains.remove(p) }
                                else { state.pains.insert(p) }
                            }
                        )
                    }
                }
                .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            footer
        }
    }

    private var footer: some View {
        VStack {
            OnbPrimaryButton(label: L("NEXT")) { state.advance() }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 28)
    }

    private func rowChecklist(emoji: String, label: String, active: Bool, toggle: @escaping () -> Void) -> some View {
        Button(action: toggle) {
            HStack(spacing: 12) {
                Text(emoji).font(.system(size: 20))
                Text(label)
                    .font(ArenaFont.body(size: 13))
                    .foregroundColor(active ? .arenaText : .arenaTextDim)
                    .lineLimit(2)
                Spacer()
                ZStack {
                    HudCornerCutShape(cut: 4)
                        .stroke(active ? Color.arenaPrimary : Color.arenaStrokeStrong, lineWidth: 1.5)
                        .frame(width: 22, height: 22)
                    if active {
                        HudCornerCutShape(cut: 4)
                            .fill(Color.arenaPrimary)
                            .frame(width: 22, height: 22)
                        Text("✓")
                            .font(.system(size: 12, weight: .black))
                            .foregroundColor(.arenaOnPrimary)
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

// MARK: - Screen 4: Social proof (stats strip + 2 quote cards)

struct OnbSocialProofScreen: View {
    @ObservedObject var state: OnboardingState

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 22) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 04",
                    title: L("PLAYERS LIKE YOU ARE ALREADY IN"),
                    size: .md
                )
                HStack(spacing: 8) {
                    OnbStatCard(value: "47K", label: L("active players this week"))
                    OnbStatCard(value: "$12K", label: L("in prizes paid"))
                    OnbStatCard(value: "4.8★", label: L("avg rating"))
                }
                .padding(.horizontal, 24)
                VStack(spacing: 12) {
                    quoteCard(quote: L("social.q1"), author: L("social.a1"))
                    quoteCard(quote: L("social.q2"), author: L("social.a2"))
                    Text(L("Representative reviews. More on App Store."))
                        .font(ArenaFont.mono(size: 9))
                        .foregroundColor(.arenaTextFaint)
                        .padding(.top, 4)
                }
                .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            footer
        }
    }

    private var footer: some View {
        VStack {
            OnbPrimaryButton(label: L("NEXT")) { state.advance() }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 28)
    }

    private func quoteCard(quote: String, author: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("★★★★★")
                .font(.system(size: 13))
                .tracking(1.3)
                .foregroundColor(.arenaGold)
            Text(quote)
                .font(ArenaFont.body(size: 13))
                .foregroundColor(.arenaText)
                .lineSpacing(2)
            Text(author)
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(.arenaTextDim)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HudCornerCutShape(cut: 10).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 10).stroke(Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 10))
    }
}

// MARK: - Screen 5: Tinder swipe (stacked cards)

struct OnbTinderScreen: View {
    @ObservedObject var state: OnboardingState
    @State private var index: Int = 0
    @State private var dragOffset: CGSize = .zero

    private var statementKeys: [String] {
        ["tinder.1", "tinder.2", "tinder.3", "tinder.4"]
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 16) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 05 — \(String(format: "%02d / %02d", min(index + 1, statementKeys.count), statementKeys.count))",
                    title: L("WHICH ONE IS YOU?"),
                    subtitle: L("Swipe → if it's you. ← if not."),
                    size: .lg
                )
                ZStack {
                    if index < statementKeys.count - 2 {
                        cardSilhouette(offset: 8, rotation: -3, indent: 24)
                    }
                    if index < statementKeys.count - 1 {
                        cardSilhouette(offset: 4, rotation: 2, indent: 12)
                    }
                    if index < statementKeys.count {
                        topCard(text: L(statementKeys[index]))
                            .offset(x: dragOffset.width, y: dragOffset.height * 0.2)
                            .rotationEffect(.degrees(Double(dragOffset.width / 18)))
                            .gesture(
                                DragGesture()
                                    .onChanged { v in dragOffset = v.translation }
                                    .onEnded { v in handleSwipe(v.translation.width) }
                            )
                    } else {
                        Text("✓")
                            .font(.system(size: 64, weight: .bold))
                            .foregroundColor(.arenaPrimary)
                    }
                }
                .frame(height: 320)
                .padding(.horizontal, 24)
                actionRow
            }
            footer
        }
    }

    private func cardSilhouette(offset: CGFloat, rotation: Double, indent: CGFloat) -> some View {
        HudCornerCutShape(cut: 14)
            .fill(Color.arenaSurface)
            .overlay(HudCornerCutShape(cut: 14).stroke(Color.arenaStroke, lineWidth: 1))
            .padding(.horizontal, indent)
            .offset(y: offset)
            .rotationEffect(.degrees(rotation))
    }

    private func topCard(text: String) -> some View {
        VStack(spacing: 16) {
            Text("\u{201C}")
                .font(.system(size: 64, weight: .black))
                .foregroundColor(.arenaAccent)
                .padding(.top, -8)
            Text(text)
                .font(ArenaFont.display(size: 18, weight: .heavy))
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .foregroundColor(.arenaText)
            Text("\(index + 1) / \(statementKeys.count)")
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .tracking(1.8)
                .foregroundColor(.arenaTextDim)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(HudCornerCutShape(cut: 14).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 14).stroke(Color.arenaAccent.opacity(0.4), lineWidth: 1))
        .shadow(color: .arenaAccent.opacity(0.22), radius: 30)
        .clipShape(HudCornerCutShape(cut: 14))
    }

    private var actionRow: some View {
        HStack(spacing: 24) {
            actionButton(symbol: "✕", color: .arenaDanger, label: L("Not me")) {
                resolveSwipe(.dismiss)
            }
            actionButton(symbol: "✓", color: .arenaPrimary, label: L("That's me"), glow: true) {
                resolveSwipe(.agree)
            }
        }
        .padding(.top, 8)
    }

    private func actionButton(symbol: String, color: Color, label: String, glow: Bool = false, action: @escaping () -> Void) -> some View {
        VStack(spacing: 6) {
            Button(action: action) {
                Text(symbol)
                    .font(.system(size: 26, weight: .black))
                    .foregroundColor(color)
                    .frame(width: 64, height: 64)
                    .background(HudCornerCutShape(cut: 8).fill(Color.arenaSurface))
                    .overlay(HudCornerCutShape(cut: 8).stroke(color.opacity(0.6), lineWidth: 1))
                    .shadow(color: glow ? color.opacity(0.3) : .clear, radius: 16)
                    .clipShape(HudCornerCutShape(cut: 8))
            }
            .buttonStyle(.plain)
            .disabled(index >= statementKeys.count)
            Text(label.uppercased())
                .font(ArenaFont.mono(size: 9, weight: .bold))
                .tracking(1.6)
                .foregroundColor(glow ? color : .arenaTextMuted)
        }
    }

    @ViewBuilder
    private var footer: some View {
        if index >= statementKeys.count {
            VStack {
                OnbPrimaryButton(label: L("NEXT")) { state.advance() }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        } else {
            Spacer().frame(height: 28)
        }
    }

    private func handleSwipe(_ x: CGFloat) {
        if x > 80 { resolveSwipe(.agree) }
        else if x < -80 { resolveSwipe(.dismiss) }
        else { withAnimation { dragOffset = .zero } }
    }

    private func resolveSwipe(_ r: OnboardingTinderResponse) {
        guard index < statementKeys.count else { return }
        state.swipes.append(r)
        withAnimation(.easeOut(duration: 0.22)) {
            dragOffset = CGSize(width: r == .agree ? 500 : -500, height: 0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                index += 1
                dragOffset = .zero
            }
        }
    }
}

// MARK: - Screen 6: Personalised solution (mirror)

struct OnbSolutionScreen: View {
    @ObservedObject var state: OnboardingState

    private var resolvedPains: [OnboardingPain] {
        if state.pains.isEmpty {
            return [.manualScoring, .friendsDontPay, .excelChaos]
        }
        return Array(OnboardingPain.allCases.filter { state.pains.contains($0) }.prefix(4))
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 24) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 06 — \(L("For each thing you said:"))",
                    title: L("HERE'S HOW FUTPOOLS FIXES IT"),
                    size: .md,
                    titleColor: .arenaPrimary
                )
                VStack(spacing: 12) {
                    ForEach(resolvedPains) { p in
                        solutionCard(pain: p)
                    }
                }
                .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            VStack {
                OnbPrimaryButton(label: L("NEXT")) { state.advance() }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private func solutionCard(pain p: OnboardingPain) -> some View {
        let solutionKey: String = {
            switch p {
            case .manualScoring:    return "sol.manualScoring"
            case .friendsDontPay:   return "sol.friendsDontPay"
            case .smallPrizes:      return "sol.smallPrizes"
            case .excelChaos:       return "sol.excelChaos"
            case .missedDeadlines:  return "sol.missedDeadlines"
            case .honorOnly:        return "sol.honorOnly"
            }
        }()
        let solutionEmoji: String = {
            switch p {
            case .manualScoring:    return "⚡"
            case .friendsDontPay:   return "🎁"
            case .smallPrizes:      return "🏆"
            case .excelChaos:       return "🚀"
            case .missedDeadlines:  return "🔒"
            case .honorOnly:        return "💰"
            }
        }()
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(p.emoji).font(.system(size: 12))
                Text(p.label.uppercased())
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1)
                    .foregroundColor(.arenaTextDim)
                    .lineLimit(1)
            }
            .opacity(0.7)
            HStack(alignment: .top, spacing: 12) {
                Text(solutionEmoji)
                    .font(.system(size: 18))
                    .frame(width: 36, height: 36)
                    .background(HudCornerCutShape(cut: 5).fill(Color.arenaPrimary.opacity(0.12)))
                    .overlay(HudCornerCutShape(cut: 5).stroke(Color.arenaPrimary.opacity(0.4), lineWidth: 1))
                    .clipShape(HudCornerCutShape(cut: 5))
                Text(L(solutionKey))
                    .font(ArenaFont.display(size: 13, weight: .heavy))
                    .lineSpacing(2)
                    .foregroundColor(.arenaText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HudCornerCutShape(cut: 10).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 10).stroke(Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 10))
    }
}

// MARK: - Screen 7: League prefs (2x3 grid)

struct OnbPrefsScreen: View {
    @ObservedObject var state: OnboardingState
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 24) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 07",
                    title: L("WHAT FOOTBALL DO YOU FOLLOW?"),
                    subtitle: L("We'll filter the next step's matches."),
                    size: .md
                )
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(OnboardingLeague.allCases) { l in
                        leagueCell(l)
                    }
                }
                .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            VStack {
                OnbPrimaryButton(label: L("NEXT")) {
                    if state.leagues.isEmpty { state.leagues = [.ligaMX] }
                    state.advance()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private func leagueCell(_ l: OnboardingLeague) -> some View {
        let active = state.leagues.contains(l)
        let parts = l.label.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
        let flag = parts.first.map(String.init) ?? ""
        let name = parts.count > 1 ? String(parts[1]) : l.label
        return Button {
            if active { state.leagues.remove(l) } else { state.leagues.insert(l) }
        } label: {
            VStack(spacing: 8) {
                Text(flag).font(.system(size: 28))
                Text(name)
                    .font(ArenaFont.display(size: 12, weight: .heavy))
                    .tracking(0.5)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
            }
            .frame(maxWidth: .infinity, minHeight: 92)
            .padding(.vertical, 8)
            .background(HudCornerCutShape(cut: 8).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
            .shadow(color: active ? .arenaPrimary.opacity(0.25) : .clear, radius: 16)
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Screen 8: Processing (spinner with %)

struct OnbProcessingScreen: View {
    @ObservedObject var state: OnboardingState
    @State private var step = 0
    @State private var spin = false
    @State private var pct: Int = 8

    private let lines: [String] = [
        L("Filtering leagues you follow"),
        L("Loading upcoming matches"),
        L("Done"),
    ]

    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            ZStack {
                Circle()
                    .stroke(Color.arenaPrimary.opacity(0.12), lineWidth: 3)
                    .frame(width: 96, height: 96)
                Circle()
                    .trim(from: 0, to: 0.5)
                    .stroke(Color.arenaPrimary, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 96, height: 96)
                    .rotationEffect(.degrees(spin ? 360 : 0))
                    .shadow(color: .arenaPrimary.opacity(0.4), radius: 16)
                    .animation(.linear(duration: 1.2).repeatForever(autoreverses: false), value: spin)
                Text("\(pct)%")
                    .font(ArenaFont.display(size: 22, weight: .heavy))
                    .foregroundColor(.arenaPrimary)
                    .monospacedDigit()
            }
            Text(L("Personalizing your matches…"))
                .font(ArenaFont.display(size: 18, weight: .heavy))
                .tracking(1.1)
                .foregroundColor(.arenaText)
                .multilineTextAlignment(.center)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(0..<lines.count, id: \.self) { i in
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .stroke(i <= step ? Color.clear : Color.arenaTextFaint, lineWidth: 1.5)
                                .frame(width: 20, height: 20)
                            if i <= step {
                                Circle().fill(Color.arenaPrimary).frame(width: 20, height: 20)
                                Text("✓")
                                    .font(.system(size: 11, weight: .black))
                                    .foregroundColor(.arenaOnPrimary)
                            }
                        }
                        Text(lines[i] + (i == step + 1 ? "…" : ""))
                            .font(ArenaFont.mono(size: 12))
                            .foregroundColor(i <= step ? .arenaText : .arenaTextDim)
                            .opacity(i <= step + 1 ? 1 : 0.3)
                    }
                }
            }
            .padding(.horizontal, 32)
            Spacer()
        }
        .onAppear {
            spin = true
            // Animate the percentage from 8 → 100 over 1.6s while
            // the checklist ticks through.
            for i in 0..<lines.count {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5 * Double(i + 1)) {
                    withAnimation { step = i }
                }
            }
            for n in stride(from: 12, through: 100, by: 4) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05 * Double(n / 4)) {
                    pct = n
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.7) {
                state.advance()
            }
        }
    }
}

// MARK: - Screen 9: Demo (predict 3 fixtures)

struct OnbDemoScreen: View {
    @ObservedObject var state: OnboardingState
    @StateObject private var vm = OnbDemoViewModel()

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 14) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 09",
                    title: L("TRY YOUR FIRST POOL"),
                    subtitle: L("Pick 3 matches. Best score wins."),
                    size: .md
                )
                progressDots
                if vm.isLoading {
                    Spacer()
                    ProgressView().tint(.arenaPrimary)
                    Spacer()
                } else if let fx = vm.currentFixture {
                    fixtureCard(fx).padding(.horizontal, 24)
                }
                Spacer(minLength: 0)
            }
            VStack {
                OnbPrimaryButton(
                    label: vm.didFinish ? L("SEE YOUR PICKS") : L("NEXT"),
                    disabled: !vm.didFinish
                ) {
                    state.demoPicks = vm.picksOut
                    state.advance()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
        .task { await vm.load(leagues: Array(state.leagues)) }
    }

    private var progressDots: some View {
        HStack(spacing: 8) {
            ForEach(0..<vm.totalCount, id: \.self) { i in
                Capsule()
                    .fill(i < vm.completedCount + (i == vm.currentIndex ? 1 : 0) ? Color.arenaPrimary : Color.white.opacity(0.1))
                    .frame(width: i == vm.currentIndex ? 28 : 8, height: 4)
                    .shadow(color: i == vm.currentIndex ? .arenaPrimary.opacity(0.6) : .clear, radius: 6)
                    .animation(.easeInOut(duration: 0.2), value: vm.currentIndex)
            }
        }
    }

    private func fixtureCard(_ fx: OnbDemoFixture) -> some View {
        VStack(spacing: 14) {
            HStack {
                Text((fx.leagueName ?? "").uppercased())
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.8)
                    .foregroundColor(.arenaAccent)
                Spacer()
                Text("\(L("MATCH")) \(String(format: "%02d / %02d", vm.currentIndex + 1, vm.totalCount))")
                    .font(ArenaFont.mono(size: 9, weight: .bold))
                    .tracking(1.6)
                    .foregroundColor(.arenaTextMuted)
            }
            HStack(spacing: 12) {
                teamBlock(name: fx.homeTeam, logo: fx.homeLogo, gradientA: .arenaGold, gradientB: .arenaBronze)
                Text("VS")
                    .font(ArenaFont.display(size: 14, weight: .heavy))
                    .tracking(1.4)
                    .foregroundColor(.arenaTextDim)
                teamBlock(name: fx.awayTeam, logo: fx.awayLogo, gradientA: .arenaPrimary, gradientB: .arenaAccent)
            }
            VStack(spacing: 2) {
                Text(fx.kickoffShort)
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextDim)
                Text(L("Tap your prediction").uppercased())
                    .font(ArenaFont.mono(size: 9))
                    .tracking(1)
                    .foregroundColor(.arenaTextMuted)
            }
            HStack(spacing: 8) {
                pickButton(label: L("1 LOCAL"), code: "1")
                pickButton(label: L("X DRAW"), code: "X")
                pickButton(label: L("2 AWAY"), code: "2")
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(HudCornerCutShape(cut: 14).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 14).stroke(Color.arenaAccent.opacity(0.3), lineWidth: 1))
        .shadow(color: .arenaAccent.opacity(0.16), radius: 24)
        .clipShape(HudCornerCutShape(cut: 14))
    }

    private func teamBlock(name: String, logo: String?, gradientA: Color, gradientB: Color) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [gradientA, gradientB], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 56, height: 56)
                if let url = logo.flatMap({ URL(string: $0) }) {
                    AsyncImage(url: url) { img in
                        img.resizable().scaledToFit()
                    } placeholder: {
                        Text(initials(from: name))
                            .font(ArenaFont.display(size: 16, weight: .black))
                            .foregroundColor(.arenaOnPrimary)
                    }
                    .frame(width: 44, height: 44)
                } else {
                    Text(initials(from: name))
                        .font(ArenaFont.display(size: 16, weight: .black))
                        .foregroundColor(.arenaOnPrimary)
                }
            }
            Text(name)
                .font(ArenaFont.display(size: 12, weight: .heavy))
                .multilineTextAlignment(.center)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundColor(.arenaText)
        }
        .frame(maxWidth: .infinity)
    }

    private func initials(from name: String) -> String {
        String(name.prefix(3)).uppercased()
    }

    private func pickButton(label: String, code: String) -> some View {
        let active = vm.currentFixture.map { vm.picks[$0.fixtureId] == code } ?? false
        return Button {
            vm.pick(code)
        } label: {
            Text(label)
                .font(ArenaFont.display(size: 11, weight: .heavy))
                .tracking(1.4)
                .foregroundColor(active ? .arenaOnPrimary : .arenaText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(HudCornerCutShape(cut: 5).fill(active ? Color.arenaPrimary : Color.arenaSurfaceAlt))
                .overlay(HudCornerCutShape(cut: 5).stroke(active ? Color.arenaPrimary : Color.arenaPrimary.opacity(0.4), lineWidth: 1))
                .shadow(color: active ? .arenaPrimary.opacity(0.4) : .clear, radius: 12)
                .clipShape(HudCornerCutShape(cut: 5))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Demo VM + fixture model

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

private struct PublicFixturePayload: Decodable {
    let fixtureId: Int
    let date: String?
    let status: String?
    let league: LeagueBlock?
    let teams: TeamsBlock
    struct LeagueBlock: Decodable { let id: Int?; let name: String?; let logo: String? }
    struct TeamsBlock: Decodable {
        struct Team: Decodable { let id: Int?; let name: String?; let logo: String? }
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
        OnbDemoFixture(fixtureId: -1, homeTeam: "América", awayTeam: "Chivas",   homeLogo: nil, awayLogo: nil, kickoff: nil, leagueName: "Liga MX"),
        OnbDemoFixture(fixtureId: -2, homeTeam: "Real Madrid", awayTeam: "Atlético", homeLogo: nil, awayLogo: nil, kickoff: nil, leagueName: "LaLiga"),
        OnbDemoFixture(fixtureId: -3, homeTeam: "Barcelona", awayTeam: "Valencia",  homeLogo: nil, awayLogo: nil, kickoff: nil, leagueName: "LaLiga"),
    ]
}

// MARK: - Screen 10: Value delivery / viral moment

struct OnbValueDeliveryScreen: View {
    @ObservedObject var state: OnboardingState
    let fixturesByID: [Int: OnbDemoFixture]
    let onShare: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 22) {
                Spacer(minLength: 8)
                OnbTitleBlock(
                    eyebrow: "\(L("Step")) 10",
                    title: L("YOUR MINI-POOL IS READY"),
                    subtitle: String(format: L("value.subtitle"), state.demoPicks.count),
                    size: .md,
                    titleColor: .arenaPrimary
                )
                summaryCard
                    .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            VStack(spacing: 12) {
                OnbPrimaryButton(label: L("SAVE & COMPETE")) { state.advance() }
                Button(action: onShare) {
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 12, weight: .bold))
                        Text(L("Share with friends"))
                            .font(ArenaFont.mono(size: 11, weight: .bold))
                            .tracking(1.4)
                    }
                    .foregroundColor(.arenaTextDim)
                    .padding(8)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(L("YOUR FIRST POOL"))
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(1.8)
                    .foregroundColor(.arenaGold)
                Spacer()
                Text("2H 14M")
                    .font(ArenaFont.mono(size: 9))
                    .foregroundColor(.arenaTextMuted)
            }
            Divider().background(Color.arenaStroke)
            ForEach(state.demoPicks) { p in
                pickRow(p)
            }
            Divider().background(Color.arenaStroke)
            HStack {
                Text(L("Score").uppercased())
                    .font(ArenaFont.mono(size: 10))
                    .tracking(1.4)
                    .foregroundColor(.arenaTextDim)
                Spacer()
                Text("0 / \(state.demoPicks.count)")
                    .font(ArenaFont.display(size: 18, weight: .heavy))
                    .foregroundColor(.arenaGold)
            }
        }
        .padding(16)
        .background(HudCornerCutShape(cut: 14).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 14).stroke(Color.arenaGold.opacity(0.3), lineWidth: 1))
        .shadow(color: .arenaGold.opacity(0.18), radius: 28)
        .clipShape(HudCornerCutShape(cut: 14))
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
                .frame(width: 32, height: 26)
                .background(HudCornerCutShape(cut: 5).fill(Color.arenaPrimary.opacity(0.18)))
                .clipShape(HudCornerCutShape(cut: 5))
        }
    }
}

// MARK: - Screen 11: Account gate (hero icon)

struct OnbAccountGateScreen: View {
    @ObservedObject var state: OnboardingState
    let onSignup: () -> Void
    let onLogin: () -> Void

    private var bullets: [String] {
        [
            L("Your picks stay saved"),
            L("100 welcome coins"),
            L("Access to weekly real-prize sweepstake"),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 28) {
                Spacer(minLength: 12)
                heroIcon
                VStack(spacing: 10) {
                    Text(L("SAVE YOUR PICKS AND PLAY"))
                        .font(ArenaFont.display(size: 24, weight: .heavy))
                        .tracking(1.4)
                        .foregroundColor(.arenaText)
                        .multilineTextAlignment(.center)
                    Text(L("One tap and you're in."))
                        .font(ArenaFont.body(size: 14))
                        .foregroundColor(.arenaTextDim)
                }
                bulletCard
                    .padding(.horizontal, 24)
                Spacer(minLength: 0)
            }
            VStack(spacing: 12) {
                OnbPrimaryButton(label: L("CREATE FREE ACCOUNT")) {
                    state.persist(); onSignup()
                }
                OnbPrimaryButton(label: L("I ALREADY HAVE AN ACCOUNT"), variant: .ghost) {
                    state.persist(); onLogin()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private var heroIcon: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Color.arenaPrimary.opacity(0.4), .clear],
                    center: .center, startRadius: 0, endRadius: 90
                ))
                .frame(width: 160, height: 160)
                .blur(radius: 12)
            HudCornerCutShape(cut: 14)
                .fill(LinearGradient(colors: [.arenaPrimary, .arenaAccent], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 96, height: 96)
                .shadow(color: .arenaPrimary.opacity(0.6), radius: 40)
            Image(systemName: "person.fill")
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(Color(red: 0.024, green: 0.063, blue: 0.094))
        }
    }

    private var bulletCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(bullets, id: \.self) { b in
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Color.arenaPrimary).frame(width: 18, height: 18)
                        Text("✓")
                            .font(.system(size: 11, weight: .black))
                            .foregroundColor(.arenaOnPrimary)
                    }
                    Text(b)
                        .font(ArenaFont.body(size: 13))
                        .foregroundColor(.arenaText)
                    Spacer()
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HudCornerCutShape(cut: 8).fill(Color.arenaPrimary.opacity(0.04)))
        .overlay(HudCornerCutShape(cut: 8).stroke(Color.arenaPrimary.opacity(0.18), lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 8))
    }
}
