//
//  OnboardingScreens.swift
//  futpoolsapp
//
//  11-screen onboarding REDESIGN — pixel-faithful port of the
//  Claude Design HTML prototype (futpools-onboarding/project/
//  FutPools Onboarding.html).
//
//  Layout pattern (matches the design's `ScreenLayout`):
//
//      ┌── header (intrinsic, anchored top) ──────┐
//      │                                          │
//      │  body (.frame max .infinity, alignment   │
//      │   .center → vertically centered in the   │
//      │   remaining space — same as flex:1 +     │
//      │   justify-content:center in the HTML)    │
//      │                                          │
//      └── footer (intrinsic, anchored bottom) ───┘
//
//  Copy goes through `L("...")` (NSLocalizedString with explicit
//  bundle) so the in-app EN/ES toggle works mid-session.
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
                // Hero: brand mark + animated football glow. Replaces the
                // legacy Amazon gift card image — that visual implied the
                // app pays out real prizes, which a scores app does not,
                // and would have triggered Apple Guideline 2.3.1 review.
                VStack(spacing: 22) {
                    OnbBrandMark(size: 12)
                    ZStack {
                        Circle()
                            .fill(RadialGradient(
                                colors: [Color.arenaPrimary.opacity(0.45), .clear],
                                center: .center, startRadius: 0, endRadius: 130
                            ))
                            .frame(width: 240, height: 240)
                            .blur(radius: 14)
                        Text("⚽")
                            .font(.system(size: 110))
                            .shadow(color: .arenaPrimary.opacity(0.55), radius: 30)
                    }
                }
                VStack(spacing: 12) {
                    Text(L("LIVE FUTBOL EN TU BOLSILLO"))
                        .font(ArenaFont.display(size: 26, weight: .heavy))
                        .tracking(2)
                        .lineSpacing(2)
                        .foregroundColor(.arenaText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                    Text(L("Marcadores en vivo, alertas de tus equipos y tus quinielas a un tap."))
                        .font(ArenaFont.body(size: 14))
                        .foregroundColor(.arenaTextDim)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 300)
                }
                HStack(spacing: 8) {
                    OnbBadge(text: L("Live scores"))
                    OnbBadge(text: L("Push alerts"))
                    OnbBadge(text: L("World Cup"))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(.horizontal, 24)

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
            // Header (anchored to top of body area)
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 02 — \(L("Pick all that apply."))",
                title: L("WHAT BRINGS YOU TO FUTPOOLS?"),
                size: .lg
            )
            .padding(.top, 24)

            // Body — options vertically centered in remaining space
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
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(.horizontal, 24)

            // Footer
            OnbPrimaryButton(label: L("NEXT"), disabled: state.goals.isEmpty) {
                state.advance()
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 28)
        }
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
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 03 — \(L("Tap everything that hits home."))",
                title: L("WHAT FRUSTRATES YOU ABOUT POOLS TODAY?"),
                size: .md
            )
            .padding(.top, 24)

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
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(.horizontal, 24)

            OnbPrimaryButton(label: L("NEXT")) { state.advance() }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 28)
        }
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
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 04",
                title: L("PLAYERS LIKE YOU ARE ALREADY IN"),
                size: .md
            )
            .padding(.top, 24)

            // Stats strip sits just under the title (small gap, not centered)
            HStack(spacing: 8) {
                OnbStatCard(value: "47K", label: L("active players this week"))
                OnbStatCard(value: "$12K", label: L("in prizes paid"))
                OnbStatCard(value: "4.8★", label: L("avg rating"))
            }
            .padding(.horizontal, 24)
            .padding(.top, 22)

            // Body — 5 quote cards. Wrapped in a ScrollView so small
            // devices don't clip; GeometryReader+minHeight pushes the
            // stack to fill the available area so when the cards fit
            // without scrolling they end up vertically centered between
            // the stats strip and the NEXT button (matches the rest of
            // the onboarding's "centered body" rule).
            GeometryReader { proxy in
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        quoteCard(quote: L("social.q1"), author: L("social.a1"))
                        quoteCard(quote: L("social.q2"), author: L("social.a2"))
                        quoteCard(quote: L("social.q3"), author: L("social.a3"))
                        quoteCard(quote: L("social.q4"), author: L("social.a4"))
                        quoteCard(quote: L("social.q5"), author: L("social.a5"))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: proxy.size.height, alignment: .center)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                }
            }

            OnbPrimaryButton(label: L("NEXT")) { state.advance() }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 28)
        }
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
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 05 — \(String(format: "%02d / %02d", min(index + 1, statementKeys.count), statementKeys.count))",
                title: L("WHICH ONE IS YOU?"),
                subtitle: L("Swipe → if it's you. ← if not."),
                size: .lg
            )
            .padding(.top, 24)

            // Body — cards centered in remaining space
            VStack(spacing: 18) {
                ZStack {
                    if index < statementKeys.count - 2 {
                        cardSilhouette(offset: 8, rotation: -3, indent: 24)
                    }
                    if index < statementKeys.count - 1 {
                        cardSilhouette(offset: 4, rotation: 2, indent: 12)
                    }
                    // No terminal "✓" state — last swipe auto-advances to
                    // the next onboarding step (resolveSwipe handles it).
                    if index < statementKeys.count {
                        topCard(text: L(statementKeys[index]))
                            .offset(x: dragOffset.width, y: dragOffset.height * 0.2)
                            .rotationEffect(.degrees(Double(dragOffset.width / 18)))
                            .gesture(
                                DragGesture()
                                    .onChanged { v in dragOffset = v.translation }
                                    .onEnded { v in handleSwipe(v.translation.width) }
                            )
                    }
                }
                .frame(height: 320)
                .padding(.horizontal, 24)
                actionRow
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)

            // Bottom safe-area padding (footer NEXT button removed —
            // last swipe auto-advances).
            Spacer().frame(height: 28)
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

    private func handleSwipe(_ x: CGFloat) {
        if x > 80 { resolveSwipe(.agree) }
        else if x < -80 { resolveSwipe(.dismiss) }
        else { withAnimation { dragOffset = .zero } }
    }

    private func resolveSwipe(_ r: OnboardingTinderResponse) {
        guard index < statementKeys.count else { return }
        state.swipes.append(r)
        let isLast = index == statementKeys.count - 1
        withAnimation(.easeOut(duration: 0.22)) {
            dragOffset = CGSize(width: r == .agree ? 500 : -500, height: 0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            if isLast {
                // Skip the dead-end "✓ + NEXT" terminal screen — once the
                // user has answered every statement, advance to the next
                // onboarding step automatically. Better UX: no extra tap
                // for a state that has no decision to make.
                state.advance()
            } else {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                    index += 1
                    dragOffset = .zero
                }
            }
        }
    }
}

// MARK: - Screen 6: Personalised solution (mirror)

struct OnbSolutionScreen: View {
    @ObservedObject var state: OnboardingState

    private struct ResolvedSolution: Identifiable {
        let pain: OnboardingPain
        let matched: Bool
        var id: OnboardingPain { pain }
    }

    /// Always returns exactly `displayCount` cards so the screen never
    /// looks hollow (1 lonely card looked broken). Strategy:
    ///   • Matched pains (the ones the user swiped right on) come first
    ///     with a "PARA TI" badge — keeps the personalization signal.
    ///   • Remaining slots fill with the rest of the pains in canonical
    ///     order, no badge — they read as additional value.
    /// Result: 0 swipes → 4 generic benefits, full-looking screen.
    /// 1-3 swipes → matched on top, padded below. 4+ swipes → all 4 badged.
    private var resolvedSolutions: [ResolvedSolution] {
        let displayCount = 4
        let matched   = OnboardingPain.allCases.filter {  state.pains.contains($0) }
        let unmatched = OnboardingPain.allCases.filter { !state.pains.contains($0) }
        let combined =
            matched.map   { ResolvedSolution(pain: $0, matched: true) } +
            unmatched.map { ResolvedSolution(pain: $0, matched: false) }
        return Array(combined.prefix(displayCount))
    }

    var body: some View {
        VStack(spacing: 0) {
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 06",
                title: L("HERE'S HOW FUTPOOLS FIXES IT"),
                size: .md,
                titleColor: .arenaPrimary
            )
            .padding(.top, 24)

            VStack(spacing: 12) {
                ForEach(resolvedSolutions) { item in
                    solutionCard(pain: item.pain, matched: item.matched)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(.horizontal, 24)

            OnbPrimaryButton(label: L("NEXT")) { state.advance() }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 28)
        }
    }

    private func solutionCard(pain p: OnboardingPain, matched: Bool) -> some View {
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
            // Header row: emoji + pain label + optional PARA TI badge.
            // Label is allowed to wrap to 2 lines (was truncated with "…"
            // for any pain whose Spanish label was longer than ~25 chars).
            // Aligning to .top keeps the emoji and badge stuck to the
            // first line when the label wraps.
            HStack(alignment: .top, spacing: 8) {
                Text(p.emoji)
                    .font(.system(size: 12))
                    .padding(.top, 1)
                Text(p.label.uppercased())
                    .font(ArenaFont.mono(size: 10))
                    .tracking(0.6)
                    .foregroundColor(.arenaTextDim)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if matched {
                    Text(L("FOR YOU"))
                        .font(ArenaFont.mono(size: 9, weight: .bold))
                        .tracking(1.4)
                        .foregroundColor(.arenaPrimary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(HudCornerCutShape(cut: 3).fill(Color.arenaPrimary.opacity(0.14)))
                        .overlay(HudCornerCutShape(cut: 3).stroke(Color.arenaPrimary.opacity(0.5), lineWidth: 1))
                        .clipShape(HudCornerCutShape(cut: 3))
                        .fixedSize()
                }
            }
            .opacity(matched ? 1 : 0.7)
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
        .overlay(
            HudCornerCutShape(cut: 10)
                .stroke(matched ? Color.arenaPrimary.opacity(0.5) : Color.arenaStroke,
                        lineWidth: 1)
        )
        .clipShape(HudCornerCutShape(cut: 10))
    }
}

// MARK: - Screen 7: Teams + leagues prefs (debounced API search)

@MainActor
final class OnbPrefsSearchVM: ObservableObject {
    @Published var query: String = ""
    @Published var teamResults: [PickerTeam] = []
    @Published var leagueResults: [PickerLeague] = []
    @Published var isSearching = false

    private let client = APIClient.shared
    private var task: Task<Void, Never>?

    /// Debounce 350ms then hit /football/{teams,leagues}/search in
    /// parallel. Mirrors CreatePoolViewModel.runSearch — same backend
    /// contract, same dedup pattern (cancel in-flight on every keystroke).
    func onQueryChange() {
        task?.cancel()
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else {
            teamResults = []
            leagueResults = []
            isSearching = false
            return
        }
        task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
            await self?.run(query: q)
        }
    }

    private func run(query: String) async {
        isSearching = true
        defer { isSearching = false }
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        do {
            async let teamsCall: [PickerTeam] = client.request(
                method: "GET",
                path: "/football/teams/search?query=\(encoded)"
            )
            async let leaguesCall: [PickerLeague] = client.request(
                method: "GET",
                path: "/football/leagues/search?query=\(encoded)"
            )
            let (teams, leagues) = try await (teamsCall, leaguesCall)
            self.teamResults = Array(teams.prefix(20))
            self.leagueResults = Array(leagues.prefix(10))
        } catch {
            self.teamResults = []
            self.leagueResults = []
        }
    }
}

struct OnbPrefsScreen: View {
    @ObservedObject var state: OnboardingState
    @StateObject private var searchVM = OnbPrefsSearchVM()
    @FocusState private var searchFocused: Bool
    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    /// True when the user has typed enough to expect API results — keeps
    /// the conditional rendering predicate in one place.
    private var hasQuery: Bool {
        searchVM.query.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
    }

    /// Anything the user has selected (popular enum picks + custom API
    /// picks). Drives the "TUS SELECCIONES" pill row at the top so that
    /// when the user clears the search bar, the items they searched for
    /// and selected don't visually disappear.
    private var hasAnySelection: Bool {
        !state.teams.isEmpty || !state.leagues.isEmpty
            || !state.customTeams.isEmpty || !state.customLeagues.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 02",
                title: L("PICK YOUR TEAMS AND LEAGUES"),
                subtitle: L("Live scores and push alerts will follow these picks."),
                size: .md
            )
            .padding(.top, 24)

            searchField
                .padding(.horizontal, 24)
                .padding(.top, 14)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 16) {
                    if hasAnySelection {
                        selectionsSection
                    }
                    if hasQuery {
                        searchResultsSection
                    } else {
                        popularSections
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
            }
            .frame(maxHeight: .infinity)

            OnbPrimaryButton(label: L("NEXT")) {
                if !hasAnySelection {
                    // Default to World Cup since it kicks off in 30 days
                    // and is the relevant headline event right now.
                    state.leagues = [.worldCup]
                }
                state.advance()
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
    }

    // MARK: Sections

    /// Pinned at the top so search-and-clear doesn't visually nuke the
    /// user's picks. Shows every active selection as a chip with an [×]
    /// to drop it. Mixes popular + custom + teams + leagues into one row
    /// because from the user's POV they're all "things I follow".
    @ViewBuilder
    private var selectionsSection: some View {
        sectionHeader(L("YOUR SELECTIONS"))
        let selectedTeams = OnbTeam.allCases.filter { state.teams.contains($0) }
        let selectedLeagues = OnboardingLeague.allCases.filter { state.leagues.contains($0) }
        let customTeamList = Array(state.customTeams.values)
        let customLeagueList = Array(state.customLeagues.values)
        // Horizontal scroll keeps the layout simple (no custom wrapping
        // Layout protocol implementation) and matches how iOS users are
        // used to seeing tag rows.
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(selectedTeams) { t in
                    selectionPill(label: t.label, logo: t.logoURL) {
                        state.teams.remove(t)
                    }
                }
                ForEach(selectedLeagues) { l in
                    selectionPill(label: stripFlags(l.label), logo: l.logoURL) {
                        state.leagues.remove(l)
                    }
                }
                ForEach(customTeamList) { t in
                    selectionPill(label: t.name, logo: t.logo.flatMap(URL.init(string:))) {
                        state.customTeams.removeValue(forKey: t.id)
                    }
                }
                ForEach(customLeagueList) { l in
                    selectionPill(label: l.name, logo: l.logo.flatMap(URL.init(string:))) {
                        state.customLeagues.removeValue(forKey: l.id)
                    }
                }
            }
            .padding(.horizontal, 1)
        }
    }

    /// League labels are prefixed with country flag emojis (🇲🇽 Liga MX).
    /// In the compact selection pill the flag duplicates the logo, so we
    /// strip them.
    private func stripFlags(_ label: String) -> String {
        var out = label
        for prefix in ["🇲🇽 ", "🇪🇸 ", "🇬🇧 ", "🇺🇸 ", "🏆 ", "⚽ "] {
            if out.hasPrefix(prefix) { out.removeFirst(prefix.count) }
        }
        return out
    }

    /// Compact removable chip used in the selections row. Tap anywhere
    /// (label or x) to drop it — single tap target = simpler UX than
    /// separate chip + [×] hit boxes.
    private func selectionPill(label: String, logo: URL?, onRemove: @escaping () -> Void) -> some View {
        Button(action: onRemove) {
            HStack(spacing: 6) {
                if let url = logo {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFit()
                        default: Color.clear
                        }
                    }
                    .frame(width: 16, height: 16)
                }
                Text(label)
                    .font(ArenaFont.mono(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundColor(.arenaOnPrimary)
                    .lineLimit(1)
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundColor(.arenaOnPrimary.opacity(0.85))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(HudCornerCutShape(cut: 4).fill(Color.arenaPrimary))
            .clipShape(HudCornerCutShape(cut: 4))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var popularSections: some View {
        // ── World Cup featured row ─────────────────────────────────
        // The World Cup kicks off in ~30 days. Surface it standalone
        // above the rest so it's the first thing eyeballs land on,
        // wider than the regular grid cells for emphasis.
        sectionHeader(L("FEATURED"))
        worldCupFeatureCell

        sectionHeader(L("POPULAR TEAMS"))
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(OnbTeam.allCases) { t in teamCell(t) }
        }
        sectionHeader(L("OTHER LEAGUES"))
        LazyVGrid(columns: columns, spacing: 8) {
            // Skip World Cup here — it's already featured above.
            ForEach(OnboardingLeague.allCases.filter { $0 != .worldCup }) { l in
                leagueCell(l)
            }
        }
    }

    private var worldCupFeatureCell: some View {
        let active = state.leagues.contains(.worldCup)
        return Button {
            if active { state.leagues.remove(.worldCup) }
            else { state.leagues.insert(.worldCup) }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    if let url = OnboardingLeague.worldCup.logoURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFit()
                            default: Text("🏆").font(.system(size: 28))
                            }
                        }
                    } else {
                        Text("🏆").font(.system(size: 28))
                    }
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(L("WORLD CUP"))
                            .font(ArenaFont.display(size: 14, weight: .heavy))
                            .tracking(1.5)
                            .foregroundColor(active ? .arenaOnPrimary : .arenaText)
                        Text(L("STARTS SOON"))
                            .font(ArenaFont.mono(size: 8, weight: .bold))
                            .tracking(1.2)
                            .foregroundColor(.arenaOnPrimary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(HudCornerCutShape(cut: 3).fill(Color.arenaDanger))
                            .clipShape(HudCornerCutShape(cut: 3))
                    }
                    Text(L("Don't miss a single match of the tournament."))
                        .font(ArenaFont.mono(size: 10))
                        .foregroundColor(active ? .arenaOnPrimary.opacity(0.85) : .arenaTextDim)
                        .lineLimit(2)
                }
                Spacer()
                Image(systemName: active ? "checkmark.circle.fill" : "plus.circle")
                    .font(.system(size: 22))
                    .foregroundColor(active ? .arenaOnPrimary : .arenaPrimary)
            }
            .padding(14)
            .background(HudCornerCutShape(cut: 8).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 8).stroke(active ? Color.arenaPrimary : Color.arenaPrimary.opacity(0.4), lineWidth: 1))
            .clipShape(HudCornerCutShape(cut: 8))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var searchResultsSection: some View {
        if searchVM.isSearching && searchVM.teamResults.isEmpty && searchVM.leagueResults.isEmpty {
            HStack(spacing: 10) {
                ProgressView().tint(.arenaPrimary).scaleEffect(0.8)
                Text(L("Searching…"))
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
        } else if searchVM.teamResults.isEmpty && searchVM.leagueResults.isEmpty {
            emptyState
        } else {
            if !searchVM.teamResults.isEmpty {
                sectionHeader(L("TEAMS"))
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(searchVM.teamResults) { t in apiTeamCell(t) }
                }
            }
            if !searchVM.leagueResults.isEmpty {
                sectionHeader(L("LEAGUES"))
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(searchVM.leagueResults) { l in apiLeagueCell(l) }
                }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.arenaTextDim)
            TextField(L("Search teams or leagues"), text: $searchVM.query)
                .focused($searchFocused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .foregroundColor(.arenaText)
                .font(ArenaFont.body(size: 14))
                // onChange triggers the debounce → API call. Two-arg
                // closure syntax keeps us iOS 17+ which is the floor.
                .onChange(of: searchVM.query) { _, _ in
                    searchVM.onQueryChange()
                }
            if searchVM.isSearching {
                ProgressView().tint(.arenaPrimary).scaleEffect(0.7)
            }
            if !searchVM.query.isEmpty {
                Button {
                    searchVM.query = ""
                    searchVM.onQueryChange()
                    searchFocused = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.arenaTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaSurface))
        .overlay(HudCornerCutShape(cut: 6).stroke(searchFocused ? Color.arenaPrimary.opacity(0.6) : Color.arenaStroke, lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 6))
        .contentShape(Rectangle())
        .onTapGesture { searchFocused = true }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(ArenaFont.mono(size: 10, weight: .bold))
            .tracking(2)
            .foregroundColor(.arenaTextDim)
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Text(L("No matches"))
                .font(ArenaFont.display(size: 14, weight: .heavy))
                .foregroundColor(.arenaText)
            Text(L("Try a different team or league name."))
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaTextDim)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }

    /// Compact chip: logo on top, name below. Logo is loaded async from
    /// api-sports' media CDN (same source the rest of the app uses for
    /// team/league art). While loading or if the request fails we show a
    /// muted ⚽ fallback so the chip layout doesn't jump.
    private func chip(logoURL: URL?, label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    if let url = logoURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img):
                                img.resizable()
                                    .renderingMode(.original)
                                    .aspectRatio(contentMode: .fit)
                            default:
                                Text("⚽")
                                    .font(.system(size: 18))
                                    .opacity(0.5)
                            }
                        }
                    } else {
                        Text("⚽")
                            .font(.system(size: 18))
                            .opacity(0.5)
                    }
                }
                .frame(width: 28, height: 28)

                Text(label)
                    .font(ArenaFont.display(size: 10, weight: .heavy))
                    .tracking(0.3)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .foregroundColor(active ? .arenaOnPrimary : .arenaText)
            }
            .frame(maxWidth: .infinity, minHeight: 76)
            .padding(.horizontal, 6)
            .padding(.vertical, 8)
            .background(HudCornerCutShape(cut: 6).fill(active ? Color.arenaPrimary : Color.arenaSurface))
            .overlay(HudCornerCutShape(cut: 6).stroke(active ? Color.arenaPrimary : Color.arenaStroke, lineWidth: 1))
            .shadow(color: active ? .arenaPrimary.opacity(0.22) : .clear, radius: 10)
            .clipShape(HudCornerCutShape(cut: 6))
        }
        .buttonStyle(.plain)
    }

    private func teamCell(_ t: OnbTeam) -> some View {
        let active = state.teams.contains(t)
        return chip(logoURL: t.logoURL, label: t.label, active: active) {
            if active { state.teams.remove(t) } else { state.teams.insert(t) }
        }
    }

    private func leagueCell(_ l: OnboardingLeague) -> some View {
        let active = state.leagues.contains(l)
        // Drop the leading flag emoji from the league label so the logo
        // does the visual heavy lifting — keeps the chip consistent with
        // the team chips above.
        let parts = l.label.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
        let nameOnly = parts.count > 1 ? String(parts[1]) : l.label
        return chip(logoURL: l.logoURL, label: nameOnly, active: active) {
            if active { state.leagues.remove(l) } else { state.leagues.insert(l) }
        }
    }

    /// API search result cell for a team. Active state checks both the
    /// curated popular set (in case a search hit overlaps a popular team
    /// e.g. "Real Madrid") AND the custom dict — toggling either keeps
    /// the chip in sync.
    private func apiTeamCell(_ t: PickerTeam) -> some View {
        let inPopular = OnbTeam.allCases.first(where: { $0.apiFootballID == t.id })
        let active: Bool = {
            if let p = inPopular { return state.teams.contains(p) }
            return state.customTeams[t.id] != nil
        }()
        let logo = (t.logo.flatMap { URL(string: $0) })
            ?? URL(string: "https://media.api-sports.io/football/teams/\(t.id).png")
        return chip(logoURL: logo, label: t.name, active: active) {
            if let p = inPopular {
                if active { state.teams.remove(p) } else { state.teams.insert(p) }
            } else {
                if active { state.customTeams.removeValue(forKey: t.id) }
                else { state.customTeams[t.id] = t }
            }
        }
    }

    private func apiLeagueCell(_ l: PickerLeague) -> some View {
        let inPopular = OnboardingLeague.allCases.first(where: { $0.apiFootballID == l.id })
        let active: Bool = {
            if let p = inPopular { return state.leagues.contains(p) }
            return state.customLeagues[l.id] != nil
        }()
        let logo = (l.logo.flatMap { URL(string: $0) })
            ?? URL(string: "https://media.api-sports.io/football/leagues/\(l.id).png")
        return chip(logoURL: logo, label: l.name, active: active) {
            if let p = inPopular {
                if active { state.leagues.remove(p) } else { state.leagues.insert(p) }
            } else {
                if active { state.customLeagues.removeValue(forKey: l.id) }
                else { state.customLeagues[l.id] = l }
            }
        }
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
        // Whole screen is one body — content centered vertically.
        VStack(spacing: 32) {
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
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.bottom, 28)
        .onAppear {
            spin = true
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
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 09",
                title: L("TRY YOUR FIRST POOL"),
                subtitle: L("Pick 3 matches. Best score wins."),
                size: .md
            )
            .padding(.top, 24)

            // Progress dots sit just under the title
            progressDots
                .padding(.top, 14)

            // Body — fixture card centered in remaining space
            Group {
                if vm.isLoading {
                    ProgressView().tint(.arenaPrimary)
                } else if let fx = vm.currentFixture {
                    fixtureCard(fx)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(.horizontal, 24)

            OnbPrimaryButton(
                label: vm.didFinish ? L("SEE YOUR PICKS") : L("NEXT"),
                disabled: !vm.didFinish
            ) {
                state.demoPicks = vm.picksOut
                state.advance()
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
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
            OnbTitleBlock(
                eyebrow: "\(L("Step")) 10",
                title: L("YOUR MINI-POOL IS READY"),
                subtitle: String(format: L("value.subtitle"), state.demoPicks.count),
                size: .md,
                titleColor: .arenaPrimary
            )
            .padding(.top, 24)

            summaryCard
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                .padding(.horizontal, 24)

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

    /// Scores-app value props. The legacy bullets ("Your picks stay
    /// saved", "100 welcome coins", "Access to weekly real-prize
    /// sweepstake") all referenced systems that don't exist in
    /// simple_version (no picks on iOS, no coins, no sweepstakes).
    private var bullets: [String] {
        [
            L("Tus equipos favoritos siempre contigo"),
            L("Alertas de goles y resultados al instante"),
            L("Sincroniza tus quinielas desde futpools.com"),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 28) {
                heroIcon
                VStack(spacing: 10) {
                    Text(L("ÚLTIMO PASO"))
                        .font(ArenaFont.display(size: 24, weight: .heavy))
                        .tracking(1.4)
                        .foregroundColor(.arenaText)
                        .multilineTextAlignment(.center)
                    Text(L("Crea tu cuenta para guardar tus preferencias."))
                        .font(ArenaFont.body(size: 14))
                        .foregroundColor(.arenaTextDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                }
                bulletCard
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(.horizontal, 24)

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
