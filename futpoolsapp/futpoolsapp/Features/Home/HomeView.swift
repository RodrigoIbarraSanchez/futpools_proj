//
//  HomeView.swift
//  futpoolsapp
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = HomeViewModel()
    @State private var activeFilter: String = "all"
    @State private var showJoinByCode = false
    @State private var joinedPool: Quiniela?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                ArenaBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        ArenaHeader(
                            coins: auth.currentUser?.balanceValue ?? 0,
                            onJoinCode: { showJoinByCode = true }
                        )
                            .padding(.horizontal, 16)
                            .padding(.top, 6)

                        if let urlString = vm.bannerImageURL,
                           let url = URL(string: urlString) {
                            ArenaBanner(url: url)
                                .padding(.horizontal, 16)
                        }

                        if quickPlayPools.count > 1 {
                            FeaturedCarousel(pools: quickPlayPools, liveFixtures: vm.liveFixtures)
                        } else if let only = quickPlayPools.first {
                            QuickPlaySection(quiniela: only, liveFixtures: vm.liveFixtures)
                                .padding(.horizontal, 16)
                        }

                        ChallengesTeaserCard()
                            .padding(.horizontal, 16)

                        ArenaFilterStrip(
                            active: $activeFilter,
                            allCount: vm.quinielas.count,
                            openCount: openQuinielas.count,
                            liveCount: liveQuinielas.count,
                            closedCount: closedQuinielas.count,
                            mineCount: myPoolsCount
                        )
                        .padding(.horizontal, 16)

                        if vm.isLoading && vm.quinielas.isEmpty {
                            ArenaLoadingState(title: "LOADING POOLS…", subtitle: "Fetching fixtures and entry counts")
                                .padding(.top, 24)
                        } else if let err = vm.errorMessage {
                            Text(err)
                                .font(ArenaFont.body(size: 13))
                                .foregroundColor(.arenaTextDim)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else if vm.quinielas.isEmpty {
                            EmptyArenaState(onRefresh: { vm.loadQuinielas() })
                                .padding(.horizontal, 16)
                                .padding(.top, 24)
                        } else if !morePoolsList.isEmpty {
                            Text("◆ ACTIVE POOLS")
                                .font(ArenaFont.display(size: 10, weight: .bold))
                                .tracking(3)
                                .foregroundColor(.arenaTextMuted)
                                .padding(.horizontal, 16)
                                .padding(.top, 4)

                            LazyVStack(spacing: 10) {
                                ForEach(morePoolsList) { q in
                                    NavigationLink {
                                        QuinielaDetailView(quiniela: q, onDeleted: { vm.loadQuinielas() })
                                            .environmentObject(auth)
                                    } label: {
                                        ArenaPoolCard(quiniela: q, liveFixtures: vm.liveFixtures)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                    }
                    .padding(.vertical, 14)
                    .padding(.bottom, 100)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .onAppear {
                vm.loadQuinielas()
                vm.startLiveUpdates()
            }
            .onDisappear {
                vm.stopLiveUpdates()
            }
            .refreshable {
                vm.loadQuinielas()
            }
            .sheet(isPresented: $showJoinByCode) {
                JoinByCodeView { pool in
                    // Push the pool detail after the sheet finishes dismissing;
                    // doing it too eagerly conflicts with SwiftUI's sheet
                    // animation and the push silently drops.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        joinedPool = pool
                    }
                }
                .preferredColorScheme(.dark)
            }
            .navigationDestination(isPresented: Binding(
                get: { joinedPool != nil },
                set: { if !$0 { joinedPool = nil } }
            )) {
                if let pool = joinedPool {
                    QuinielaDetailView(quiniela: pool)
                }
            }
        }
    }

    // ── Disjoint pool buckets (LIVE + OPEN + CLOSED = ALL) ────────────────

    private func hasLiveFixture(_ q: Quiniela) -> Bool {
        q.fixtures.contains { vm.liveFixtures[$0.fixtureId]?.status.isLive == true }
    }

    private func isClosed(_ q: Quiniela) -> Bool {
        if q.status == "completed" { return true }
        if let end = q.endDateValue, end < Date() { return true }
        return false
    }

    private var liveQuinielas: [Quiniela] {
        vm.quinielas.filter { hasLiveFixture($0) }
    }

    private var closedQuinielas: [Quiniela] {
        vm.quinielas.filter { !hasLiveFixture($0) && isClosed($0) }
    }

    private var openQuinielas: [Quiniela] {
        vm.quinielas.filter { !hasLiveFixture($0) && !isClosed($0) }
    }

    /// Pools created by the logged-in user (independent of LIVE/OPEN/CLOSED bucket).
    private var myQuinielas: [Quiniela] {
        guard let uid = auth.currentUser?.id else { return [] }
        return vm.quinielas.filter { ($0.createdBy ?? "") == uid }
    }
    private var myPoolsCount: Int { myQuinielas.count }

    private var filteredQuinielas: [Quiniela] {
        switch activeFilter {
        case "live":   return liveQuinielas
        case "open":   return openQuinielas
        case "closed": return closedQuinielas
        case "mine":   return myQuinielas
        default:       return vm.quinielas
        }
    }

    /// Pools eligible for the QUICK PLAY hero. Private user-created pools are
    /// excluded — the hero is for admin-curated or public pools only. This also
    /// prevents your own "Test" private pool from showing up as featured.
    private var publicPools: [Quiniela] {
        vm.quinielas.filter { ($0.visibility ?? "public") != "private" }
    }

    /// Pools the admin pinned via "Mark as featured". Takes precedence over auto.
    private var adminFeaturedPools: [Quiniela] {
        publicPools.filter { $0.featured == true }
    }

    /// Fallback when no pool is admin-featured:
    ///   1. a pool with a live fixture (most urgent)
    ///   2. otherwise the open pool closest to starting
    ///   3. otherwise `nil` — hero section is hidden
    private var autoFeatured: Quiniela? {
        let publicIds = Set(publicPools.map { $0.id })
        if let live = liveQuinielas.first(where: { publicIds.contains($0.id) }) { return live }
        return openQuinielas
            .filter { publicIds.contains($0.id) }
            .sorted { ($0.startDateValue ?? .distantFuture) < ($1.startDateValue ?? .distantFuture) }
            .first
    }

    /// What the QUICK PLAY section renders (single hero if 1, carousel if >1, hidden if empty).
    private var quickPlayPools: [Quiniela] {
        if !adminFeaturedPools.isEmpty { return adminFeaturedPools }
        return [autoFeatured].compactMap { $0 }
    }

    /// "Active pools" list with anything already shown in QUICK PLAY removed.
    private var morePoolsList: [Quiniela] {
        let shownIds = Set(quickPlayPools.map { $0.id })
        return filteredQuinielas.filter { !shownIds.contains($0.id) }
    }
}

// MARK: - Header (title + real coin balance)

private struct ArenaHeader: View {
    let coins: Double
    var onJoinCode: (() -> Void)?

    var body: some View {
        HStack(spacing: 10) {
            Text("POOLS")
                .font(ArenaFont.display(size: 24, weight: .heavy))
                .tracking(3)
                .foregroundColor(.arenaText)
            Spacer()
            if let onJoinCode {
                Button(action: onJoinCode) {
                    Image(systemName: "ticket.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                        .frame(width: 32, height: 32)
                        .background(HudCornerCutShape(cut: 6).fill(Color.arenaPrimary.opacity(0.14)))
                        .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaPrimary.opacity(0.35), lineWidth: 1))
                        .clipShape(HudCornerCutShape(cut: 6))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(NSLocalizedString("Join with code", comment: ""))
            }
            CoinBadge(value: coins)
        }
    }
}

private struct CoinBadge: View {
    let value: Double

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [.arenaGold, Color(hex: "B88A1F")],
                        center: UnitPoint(x: 0.35, y: 0.35),
                        startRadius: 0,
                        endRadius: 8
                    )
                )
                .frame(width: 14, height: 14)
                .shadow(color: .arenaGold.opacity(0.5), radius: 3)
            Text(formatted(value))
                .font(ArenaFont.mono(size: 13, weight: .bold))
                .foregroundColor(.arenaGold)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaGold.opacity(0.13)))
        .clipShape(HudCornerCutShape(cut: 6))
    }

    private func formatted(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? "\(Int(v))"
    }
}

// MARK: - Featured Carousel (admin-marked pools, paged horizontal swipe)

private struct FeaturedCarousel: View {
    let pools: [Quiniela]
    let liveFixtures: [Int: LiveFixture]
    @State private var index = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("◆ FEATURED")
                    .font(ArenaFont.display(size: 10, weight: .bold))
                    .tracking(3)
                    .foregroundColor(.arenaPrimary)
                Spacer()
                Text("\(index + 1) / \(pools.count)")
                    .font(ArenaFont.mono(size: 10))
                    .foregroundColor(.arenaTextMuted)
            }
            .padding(.horizontal, 16)

            TabView(selection: $index) {
                ForEach(Array(pools.enumerated()), id: \.element.id) { i, pool in
                    QuickPlaySection(quiniela: pool, liveFixtures: liveFixtures)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 30) // room for the page-dots
                        .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .frame(minHeight: 320)
        }
    }
}

// MARK: - Banner (optional)

private struct ArenaBanner: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            default:
                Color.arenaSurfaceAlt
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(3, contentMode: .fill)
        .clipShape(HudCornerCutShape(cut: 14))
    }
}

// MARK: - Quick play

private struct QuickPlaySection: View {
    let quiniela: Quiniela
    let liveFixtures: [Int: LiveFixture]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ QUICK PLAY")
                .font(ArenaFont.display(size: 10, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaPrimary)

            HudFrame(
                cut: 22,
                fill: AnyShapeStyle(
                    LinearGradient(
                        colors: [Color.arenaSurface, Color.arenaSurfaceAlt, Color.arenaPrimary.opacity(0.13)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                ),
                glow: .arenaPrimary
            ) {
                ZStack(alignment: .trailing) {
                    Rectangle()
                        .fill(Color.arenaPrimary)
                        .frame(width: 3)
                        .shadow(color: .arenaPrimary, radius: 8)
                        .frame(maxHeight: .infinity)

                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            if derivedStatus.showDot {
                                LiveDot(color: derivedStatus.color, size: 6)
                            }
                            Text(derivedStatus.label)
                                .font(ArenaFont.display(size: 10, weight: .heavy))
                                .tracking(2)
                                .foregroundColor(derivedStatus.color)
                            Spacer()
                            if let entries = quiniela.entriesCount {
                                // Use the localized "%lld PLAYERS" key — was
                                // hardcoded Spanish "JUGADORES" which leaked
                                // into EN builds.
                                Text(String(format: String(localized: "%lld PLAYERS"), entries))
                                    .font(ArenaFont.mono(size: 10))
                                    .foregroundColor(.arenaTextMuted)
                            }
                        }

                        Text(quiniela.name.uppercased())
                            .font(ArenaFont.display(size: 22, weight: .heavy))
                            .tracking(1)
                            .foregroundColor(.arenaText)
                            .lineLimit(2)

                        HStack(spacing: 18) {
                            ArenaStatInline(label: "PRIZE POOL", value: quiniela.prize, color: .arenaPrimary)
                            ArenaStatInline(label: "ENTRY",      value: quiniela.cost,  color: .arenaAccent)
                            ArenaStatInline(label: "FIXTURES",   value: "\(quiniela.fixtures.count)", color: .arenaGold)
                        }

                        NavigationLink {
                            QuinielaDetailView(quiniela: quiniela)
                        } label: {
                            HStack {
                                Text("▶ \(Text(isLive ? LocalizedStringKey("RESUME") : LocalizedStringKey("OPEN")))")
                                    .font(ArenaFont.display(size: 13, weight: .heavy))
                                    .tracking(2)
                                    .foregroundColor(.arenaOnPrimary)
                                    .padding(.vertical, 10)
                                    .padding(.horizontal, 18)
                                    .background(HudCornerCutShape(cut: 8).fill(Color.arenaPrimary))
                                    .clipShape(HudCornerCutShape(cut: 8))
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(16)
                }
            }
        }
    }

    private var isLive: Bool {
        quiniela.fixtures.contains { fx in liveFixtures[fx.fixtureId]?.status.isLive == true }
    }

    /// Derived live/upcoming/finished state — "LIVE NOW" only when a fixture is
    /// actually in progress; "UP NEXT" when an upcoming fixture exists; otherwise
    /// the pool is treated as finished and the red dot is suppressed.
    private var derivedStatus: (label: String, color: Color, showDot: Bool) {
        if isLive { return ("LIVE NOW", .arenaDanger, true) }
        let hasUpcoming = quiniela.fixtures.contains { fx in
            fx.kickoffDate.map { $0 > Date() } ?? false
        }
        if hasUpcoming { return ("UP NEXT", .arenaAccent, false) }
        return ("FINISHED", .arenaTextMuted, false)
    }
}

// MARK: - Filter strip

/// Four disjoint status buckets (ALL = LIVE ⊔ OPEN ⊔ CLOSED) plus a MINE
/// view that filters pools created by the logged-in user.
private struct ArenaFilterStrip: View {
    @Binding var active: String
    let allCount: Int
    let openCount: Int
    let liveCount: Int
    let closedCount: Int
    let mineCount: Int

    private var items: [(String, String, Color?)] {
        [
            ("all",    "ALL \(allCount)",       nil),
            ("mine",   "MINE \(mineCount)",     Color.arenaHot),
            ("open",   "OPEN \(openCount)",     Color.arenaPrimary),
            ("live",   "LIVE \(liveCount)",     Color.arenaDanger),
            ("closed", "CLOSED \(closedCount)", Color.arenaTextMuted),
        ]
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(items, id: \.0) { id, label, color in
                    let isActive = active == id
                    Button {
                        active = id
                    } label: {
                        Text(label)
                            .font(ArenaFont.display(size: 11, weight: .bold))
                            .tracking(2)
                            .foregroundColor(isActive ? .arenaOnPrimary : .arenaTextDim)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                HudCornerCutShape(cut: 6)
                                    .fill(isActive ? (color ?? .arenaPrimary) : Color.arenaSurfaceAlt)
                            )
                            .clipShape(HudCornerCutShape(cut: 6))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Pool card (POOL HEAT meter removed — invented metric)

struct ArenaPoolCard: View {
    let quiniela: Quiniela
    let liveFixtures: [Int: LiveFixture]

    private var status: (label: String, color: Color) {
        switch quiniela.status {
        case "live":      return ("LIVE", .arenaDanger)
        case "completed": return ("CLOSED", .arenaTextMuted)
        default:
            if hasLive { return ("LIVE", .arenaDanger) }
            if let end = quiniela.endDateValue, end < Date() { return ("CLOSED", .arenaTextMuted) }
            if let start = quiniela.startDateValue, start > Date() { return ("UPCOMING", .arenaAccent) }
            return ("OPEN", .arenaPrimary)
        }
    }

    private var hasLive: Bool {
        quiniela.fixtures.contains { fx in
            liveFixtures[fx.fixtureId]?.status.isLive == true
        }
    }

    private var subtitle: String {
        if hasLive { return "LIVE · EN JUEGO" }
        guard let start = quiniela.startDateValue else { return "—" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale.current
        return f.string(from: start)
    }

    var body: some View {
        HudFrame(cut: 14, glow: status.color == .arenaDanger ? .arenaDanger : nil) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(quiniela.name.uppercased())
                        .font(ArenaFont.display(size: 15, weight: .heavy))
                        .tracking(1.2)
                        .foregroundColor(.arenaText)
                        .lineLimit(1)
                    Spacer()
                    HudChip(
                        text: status.label,
                        color: status.color,
                        showLiveDot: status.label == "LIVE"
                    )
                }

                Text(subtitle.uppercased())
                    .font(ArenaFont.mono(size: 10))
                    .tracking(0.5)
                    .foregroundColor(.arenaTextDim)

                HStack(spacing: 8) {
                    ArenaStatTile(label: "POT",     value: quiniela.prize, color: .arenaGold)
                    ArenaStatTile(label: "ENTRY",   value: quiniela.cost,  color: .arenaText)
                    ArenaStatTile(label: "PLAYERS", value: "\(quiniela.entriesCount ?? 0)", color: .arenaAccent)
                }

                if !quiniela.fixtures.isEmpty {
                    VStack(spacing: 2) {
                        ForEach(quiniela.fixtures.prefix(2)) { fx in
                            fixtureMiniRow(fx)
                        }
                    }
                    .padding(8)
                    .background(HudCornerCutShape(cut: 8).fill(Color.arenaBg2))
                    .clipShape(HudCornerCutShape(cut: 8))
                }
            }
            .padding(14)
        }
    }

    @ViewBuilder
    private func fixtureMiniRow(_ fx: QuinielaFixture) -> some View {
        // Symmetric layout: each team is a tight [crest + name] group flanking
        // a center column that holds either the live score or the kickoff time.
        // The previous row ([crest][text][Spacer][crest][score]) let the away
        // crest drift away from its name and jammed the score out to the edge
        // — worse, row width shifted when the center text grew from "21:06"
        // to "0-1 37'", making stacked rows visually misaligned.
        let live = liveFixtures[fx.fixtureId]
        let isLive = live?.status.isLive == true
        let centerText: String = {
            if let live, isLive {
                let home = live.score.home ?? 0
                let away = live.score.away ?? 0
                if let min = live.status.elapsed {
                    return "\(home)-\(away) \(min)'"
                }
                return "\(home)-\(away)"
            }
            if let date = fx.kickoffDate {
                return shortTime(date)
            }
            return "—"
        }()

        HStack(spacing: 6) {
            TeamCrestArena(
                name: fx.homeTeam,
                color: ArenaTeamColor.color(for: fx.homeTeam),
                size: 22,
                logoURL: fx.homeLogo
            )
            Text(shortName(fx.homeTeam))
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(.arenaText)

            Spacer(minLength: 6)

            Text(centerText)
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(isLive ? .arenaDanger : .arenaTextMuted)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)

            Spacer(minLength: 6)

            Text(shortName(fx.awayTeam))
                .font(ArenaFont.mono(size: 10, weight: .bold))
                .foregroundColor(.arenaText)
            TeamCrestArena(
                name: fx.awayTeam,
                color: ArenaTeamColor.color(for: fx.awayTeam),
                size: 22,
                logoURL: fx.awayLogo
            )
        }
    }

    private func shortName(_ n: String) -> String { String(n.prefix(3)).uppercased() }

    private func shortTime(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }
}

// MARK: - Helpers

private struct ArenaLoadingState: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 10) {
            ProgressView().tint(.arenaPrimary).scaleEffect(1.1)
            Text(title)
                .font(ArenaFont.display(size: 13, weight: .bold))
                .tracking(2)
                .foregroundColor(.arenaText)
            Text(subtitle)
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaTextDim)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct EmptyArenaState: View {
    var onRefresh: () -> Void

    var body: some View {
        HudFrame {
            VStack(spacing: 14) {
                Text("🏆")
                    .font(.system(size: 44))
                    .shadow(color: .arenaGold.opacity(0.8), radius: 12)
                Text("NO POOLS RIGHT NOW")
                    .font(ArenaFont.display(size: 14, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(.arenaText)
                Text("Check back soon or we'll notify you when new pools are available.")
                    .font(ArenaFont.body(size: 12))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                ArcadeButton(title: String(localized: "REFRESH"), size: .sm, action: onRefresh)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }
}

#Preview {
    HomeView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
