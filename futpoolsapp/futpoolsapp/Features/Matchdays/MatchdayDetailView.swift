//
//  MatchdayDetailView.swift
//  futpoolsapp
//

import SwiftUI

struct MatchdayDetailView: View {
    let matchday: Matchday
    @State private var matchdayWithMatches: Matchday?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var navigateToQuiniela = false
    @StateObject private var liveVM = LiveMatchdayViewModel()
    private let client = APIClient.shared

    var matches: [Match] {
        matchdayWithMatches?.matches ?? []
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    if isLoading {
                        ProgressView()
                            .tint(.appPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, AppSpacing.xl)
                    } else if let err = errorMessage {
                        Text(err)
                            .font(AppFont.body())
                            .foregroundColor(.appTextSecondary)
                            .padding()
                    } else {
                        Text("\(matchday.league?.name ?? "Liga") · \(matchday.name)")
                            .font(AppFont.caption())
                            .foregroundColor(.appTextSecondary)
                            .padding(.horizontal)

                        ForEach(matches, id: \.id) { match in
                            let live = liveVM.liveMatches.first { $0.matchId == match.id }
                            MatchRow(match: match, live: live)
                        }
                        .padding(.horizontal)

                        if !matches.isEmpty && (matchdayWithMatches?.status == "open" || matchdayWithMatches?.status == "upcoming") {
                            PrimaryButton("Hacer mi quiniela", style: .green) {
                                navigateToQuiniela = true
                            }
                            .padding(.horizontal)
                            .padding(.top, AppSpacing.md)
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle(matchday.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(isPresented: $navigateToQuiniela) {
                if let md = matchdayWithMatches, !matches.isEmpty {
                    MakeQuinielaView(matchday: md, matches: matches)
                }
            }
            .onAppear {
                loadMatchday()
                liveVM.start(matchdayId: matchday.id)
            }
            .onDisappear {
                liveVM.stop()
            }
        }
    }

    private func loadMatchday() {
        Task {
            do {
                let token = KeychainHelper.getToken()
                let md: Matchday = try await client.request(path: "/matchdays/\(matchday.id)", token: token)
                matchdayWithMatches = md
                isLoading = false
            } catch {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }
}

struct MatchRow: View {
    let match: Match
    let live: LiveMatch?
    @State private var glow = false

    private var kickoffText: String {
        guard let d = (live?.scheduledDate ?? match.scheduledDate) else { return match.scheduledAt }
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_MX")
        f.dateFormat = "EEE d MMM · HH:mm"
        return f.string(from: d)
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        let first = parts.first?.first.map(String.init) ?? ""
        let second = parts.dropFirst().first?.first.map(String.init) ?? ""
        return (first + second).uppercased()
    }

    var body: some View {
        MatchCard {
            VStack(spacing: AppSpacing.sm) {
                HStack(spacing: AppSpacing.sm) {
                    if let leagueName = live?.league?.name {
                        Text(leagueName.uppercased())
                            .font(AppFont.overline())
                            .foregroundColor(.appTextSecondary)
                    }
                    Spacer()
                    if let status = live?.status, let short = status.short {
                        StatusPill(
                            text: status.isLive == true ? "LIVE" : short,
                            highlight: status.isLive == true
                        )
                    } else {
                        StatusPill(text: "Kickoff", highlight: false)
                    }
                }

                HStack(alignment: .center, spacing: AppSpacing.sm) {
                    TeamBlock(
                        name: match.homeTeam,
                        initials: initials(match.homeTeam),
                        logoURL: live?.logos.home,
                        alignment: .leading,
                        large: false
                    )

                    ScoreBlock(
                        home: live?.score.home,
                        away: live?.score.away,
                        isLive: live?.status.isLive == true,
                        elapsed: live?.status.elapsed
                    )

                    TeamBlock(
                        name: match.awayTeam,
                        initials: initials(match.awayTeam),
                        logoURL: live?.logos.away,
                        alignment: .trailing,
                        large: false
                    )
                }

                HStack {
                    Text(kickoffText)
                        .font(AppFont.caption().monospacedDigit())
                        .foregroundColor(.appTextSecondary)
                    Spacer()
                    if let short = live?.status.short, short == "FT" {
                        StatusPill(text: "Final", highlight: false)
                    }
                }
                .font(AppFont.caption())
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.card)
                .stroke(
                    Color.appPrimary.opacity(live?.status.isLive == true ? (glow ? 0.7 : 0.25) : 0),
                    lineWidth: live?.status.isLive == true ? 1.5 : 0
                )
        )
        .shadow(color: Color.appPrimary.opacity(live?.status.isLive == true ? (glow ? 0.55 : 0.2) : 0), radius: 20, x: 0, y: 0)
        .onAppear {
            if live?.status.isLive == true {
                withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                    glow = true
                }
            }
        }
    }
}

private struct TeamBlock: View {
    let name: String
    let initials: String
    let logoURL: String?
    let alignment: HorizontalAlignment
    let large: Bool

    var body: some View {
        VStack(alignment: alignment, spacing: AppSpacing.sm) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.appSurfaceAlt, Color.appSurface],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: large ? 60 : 40, height: large ? 60 : 40)
                    .overlay(
                        Circle()
                            .stroke(Color.appStroke.opacity(0.7), lineWidth: 1)
                    )
                if let logoURL, let url = URL(string: logoURL) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .scaledToFit()
                            .frame(width: large ? 40 : 26, height: large ? 40 : 26)
                    } placeholder: {
                        Text(initials)
                            .font(AppFont.caption().weight(.semibold))
                            .foregroundColor(.appTextPrimary)
                    }
                } else {
                    Text(initials)
                        .font(AppFont.caption().weight(.semibold))
                        .foregroundColor(.appTextPrimary)
                }
            }
            Text(name)
                .font(AppFont.headline())
                .foregroundColor(.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}

private struct ScoreBlock: View {
    let home: Int?
    let away: Int?
    let isLive: Bool
    let elapsed: Int?

    var body: some View {
        VStack(spacing: AppSpacing.xs) {
            if home != nil || away != nil {
                Text("\(home ?? 0) : \(away ?? 0)")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(.appTextPrimary)
                    .monospacedDigit()
            } else {
                Text("VS")
                    .font(AppFont.overline())
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [Color.appPrimary, Color.appAccent],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
            }
            if isLive, let elapsed {
                Text("\(elapsed)'")
                    .font(AppFont.caption())
                    .foregroundColor(.appTextSecondary)
            }
        }
        .frame(width: 72)
        .padding(.vertical, AppSpacing.xs)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.button)
                .fill(Color.black.opacity(0.25))
        )
    }
}

private struct StatusPill: View {
    let text: String
    let highlight: Bool

    var body: some View {
        Text(text.uppercased())
            .font(AppFont.overline())
            .foregroundColor(highlight ? .black : .appTextSecondary)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xs)
            .background(
                Capsule()
                    .fill(highlight ? Color.appPrimary : Color.appSurfaceAlt)
            )
    }
}

#Preview {
    NavigationStack {
        MatchdayDetailView(matchday: Matchday(
            id: "1",
            league: nil,
            name: "Jornada 1",
            startDate: "2025-02-01T00:00:00.000Z",
            endDate: "2025-02-07T00:00:00.000Z",
            status: "open",
            matches: nil
        ))
    }
    .preferredColorScheme(.dark)
}
