//
//  HomeView.swift
//  futpoolsapp
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = HomeViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        if let urlString = vm.bannerImageURL, let url = URL(string: urlString) {
                            BannerImageView(url: url)
                        }
                        if vm.isLoading && vm.quinielas.isEmpty {
                            LoadingStateView(
                                title: "Loading pools…",
                                subtitle: "Fetching fixtures and entry counts"
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.top, AppSpacing.xl)
                        } else if let err = vm.errorMessage {
                            Text(err)
                                .font(AppFont.body())
                                .foregroundColor(.appTextSecondary)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else if vm.quinielas.isEmpty {
                            EmptyQuinielasView(onRefresh: { vm.loadQuinielas() })
                                .frame(maxWidth: .infinity)
                                .padding(.top, AppSpacing.xl)
                        } else {
                            LazyVStack(spacing: AppSpacing.sm) {
                                ForEach(vm.quinielas) { q in
                                    NavigationLink {
                                        QuinielaDetailView(quiniela: q, onDeleted: { vm.loadQuinielas() })
                                            .environmentObject(auth)
                                    } label: {
                                        QuinielaCard(quiniela: q, liveFixtures: vm.liveFixtures)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                    .padding(.vertical)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 2) {
                        Text("Pools")
                            .font(AppFont.headline())
                            .foregroundColor(.appTextPrimary)
                        Text("Play")
                            .font(AppFont.overline())
                            .foregroundColor(.appTextMuted)
                    }
                }
            }
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
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
        }
    }
}

private struct BannerImageView: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            case .failure:
                Color.appSurfaceAlt
            case .empty:
                Color.appSurfaceAlt
            @unknown default:
                Color.appSurfaceAlt
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(3, contentMode: .fill)
        .clipped()
    }
}

private struct EmptyQuinielasView: View {
    var onRefresh: () -> Void

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 48))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.appGold.opacity(0.9), Color.appGoldSoft.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text("No pools right now")
                .font(AppFont.headline())
                .foregroundColor(.appTextPrimary)
            Text("Check back soon or we’ll notify you when new pools are available to play.")
                .font(AppFont.body())
                .foregroundColor(.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)
            Button(action: onRefresh) {
                Label("Refresh", systemImage: "arrow.clockwise")
                    .font(AppFont.caption().weight(.semibold))
                    .foregroundColor(.appPrimary)
            }
            .padding(.top, AppSpacing.sm)
        }
        .padding(AppSpacing.xl)
    }
}

struct QuinielaCard: View {
    let quiniela: Quiniela
    let liveFixtures: [Int: LiveFixture]

    private var dateRange: String {
        guard let start = quiniela.startDateValue else { return "—" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "en_US")
        if let end = quiniela.endDateValue {
            return "\(f.string(from: start)) - \(f.string(from: end))"
        }
        return f.string(from: start)
    }

    private var statusLabel: String {
        if isLive {
            return "LIVE"
        }
        let now = Date()
        if let end = quiniela.endDateValue, end < now {
            return "Closed"
        }
        if let start = quiniela.startDateValue, start > now {
            return "Upcoming"
        }
        return "Open"
    }

    private var statusColor: Color {
        switch statusLabel {
        case "LIVE":
            return Color.appLiveRed
        case "Closed":
            return Color.appSurfaceAlt
        case "Upcoming":
            return Color.appAccent
        default:
            return Color.appPrimary
        }
    }

    private var previewFixtures: [QuinielaFixture] {
        Array(quiniela.fixtures.prefix(2))
    }

    private var isLive: Bool {
        let liveCodes: Set<String> = ["LIVE", "1H", "2H", "HT", "ET", "BT", "P", "INT", "SUSP"]
        return quiniela.fixtures.contains { fixture in
            let status = liveFixtures[fixture.fixtureId]?.status.short ?? fixture.status
            guard let short = status?.uppercased(), !short.isEmpty else { return false }
            return liveCodes.contains(short)
        }
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: AppRadius.card)
                .fill(
                    LinearGradient(
                        colors: [Color.appSurface, Color.appSurfaceAlt],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.card)
                        .stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.14), Color.white.opacity(0.04)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
                .shadow(color: Color.appPrimary.opacity(0.1), radius: 16, x: 0, y: 0)
                .shadow(color: Color.black.opacity(0.4), radius: 18, x: 0, y: 12)

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(quiniela.name)
                        .font(AppFont.headline())
                        .foregroundColor(.appTextPrimary)
                    Spacer()
                    Text(statusLabel)
                        .font(AppFont.overline())
                        .foregroundColor(statusLabel == "Closed" ? .appTextSecondary : .black)
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(statusColor))
                }

                Text(dateRange)
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)

                let columns = [GridItem(.flexible(), spacing: AppSpacing.sm), GridItem(.flexible(), spacing: AppSpacing.sm)]
                LazyVGrid(columns: columns, spacing: AppSpacing.sm) {
                    PoolStatTile(label: "Prize", value: quiniela.prize, icon: "trophy.fill", accent: .appGold)
                    PoolStatTile(label: "Entry", value: quiniela.cost, icon: "ticket.fill")
                    PoolStatTile(label: "Fixtures", value: "\(quiniela.fixtures.count)", icon: "sportscourt.fill")
                    PoolStatTile(label: "Entries", value: "\(quiniela.entriesCount ?? 0)", icon: "person.3.fill")
                }

                if !previewFixtures.isEmpty {
                    Divider()
                        .background(Color.white.opacity(0.08))
                    VStack(spacing: AppSpacing.xs) {
                        ForEach(previewFixtures) { fixture in
                            FixturePreviewRow(fixture: fixture, live: liveFixtures[fixture.fixtureId])
                        }
                        if quiniela.fixtures.count > previewFixtures.count {
                            Text("+ \(quiniela.fixtures.count - previewFixtures.count) more fixtures")
                                .font(AppFont.caption())
                                .foregroundColor(.appTextSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.md)
            .overlay(
                HStack {
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.appTextSecondary)
                }
                .padding(.trailing, AppSpacing.sm)
            )
        }
    }
}

private struct FixturePreviewRow: View {
    let fixture: QuinielaFixture
    let live: LiveFixture?

    private var scoreText: String? {
        guard let live else { return nil }
        if live.score.home == nil && live.score.away == nil { return nil }
        return "\(live.score.home ?? 0) : \(live.score.away ?? 0)"
    }

    private var statusMeta: (text: String, isLive: Bool, isFinal: Bool)? {
        let short = (live?.status.short ?? fixture.status)?.uppercased()
        guard let short, !short.isEmpty else { return nil }
        let isLive = live?.status.isLive == true
        let isFinal = ["FT", "AET", "PEN"].contains(short)
        let text = isLive ? "LIVE" : (isFinal ? "FINAL" : short)
        return (text, isLive, isFinal)
    }

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            TeamMiniPreview(name: fixture.homeTeam, logoURL: fixture.homeLogo)
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

            VStack(spacing: 4) {
                if let meta = statusMeta {
                    MatchStatusBadge(text: meta.text, isLive: meta.isLive, isFinal: meta.isFinal)
                }
                Text("VS")
                    .font(AppFont.overline())
                    .foregroundColor(.appTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.appSurface.opacity(0.9))
                    )
                if let score = scoreText {
                    Text(score)
                        .font(AppFont.caption().weight(.semibold))
                        .foregroundColor(.appTextPrimary)
                }
            }
            .frame(minWidth: 56)
            .layoutPriority(2)

            TeamMiniPreview(name: fixture.awayTeam, logoURL: fixture.awayLogo, alignRight: true)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .layoutPriority(1)
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.appSurfaceAlt.opacity(0.7))
        )
    }
}

private struct TeamMiniPreview: View {
    let name: String
    let logoURL: String?
    var alignRight: Bool = false

    var body: some View {
        HStack(spacing: AppSpacing.xs) {
            if alignRight {
                Spacer(minLength: 0)
                Text(name)
                    .font(AppFont.caption())
                    .foregroundColor(.appTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                TeamMiniLogo(name: name, logoURL: logoURL)
            } else {
                TeamMiniLogo(name: name, logoURL: logoURL)
                Text(name)
                    .font(AppFont.caption())
                    .foregroundColor(.appTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
            }
        }
    }
}

private struct TeamMiniLogo: View {
    let name: String
    let logoURL: String?

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.appSurface)
                .frame(width: 18, height: 18)
            if let logoURL, let url = URL(string: logoURL) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Text(String(name.prefix(1)))
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.appTextPrimary)
                }
                .frame(width: 12, height: 12)
            } else {
                Text(String(name.prefix(1)))
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(.appTextPrimary)
            }
        }
    }
}

private struct PoolStatTile: View {
    let label: String
    let value: String
    let icon: String
    var accent: Color? = nil

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            ZStack {
                Circle()
                    .fill(Color.appSurfaceAlt)
                    .frame(width: 24, height: 24)
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(accent ?? .appTextSecondary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(AppFont.overline())
                    .foregroundColor(.appTextMuted)
                Text(value)
                    .font(AppFont.caption().weight(.semibold))
                    .foregroundColor(accent ?? .appTextPrimary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, AppSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.appSurfaceAlt.opacity(0.7))
        )
    }
}

private struct LoadingStateView: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            ProgressView()
                .tint(.appPrimary)
                .scaleEffect(1.1)
            Text(title)
                .font(AppFont.headline())
                .foregroundColor(.appTextPrimary)
            Text(subtitle)
                .font(AppFont.caption())
                .foregroundColor(.appTextSecondary)
        }
    }
}

#Preview {
    HomeView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
