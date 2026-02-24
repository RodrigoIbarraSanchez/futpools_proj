//
//  MatchCard.swift
//  futpoolsapp
//

import SwiftUI

struct MatchCard<Content: View>: View {
    let content: Content
    var compact: Bool = false

    init(compact: Bool = false, @ViewBuilder content: () -> Content) {
        self.compact = compact
        self.content = content()
    }

    private var horizontalPadding: CGFloat { compact ? AppSpacing.sm : AppSpacing.md }
    private var verticalPadding: CGFloat { compact ? AppSpacing.xs : AppSpacing.sm }
    private var cornerRadius: CGFloat { compact ? 10 : AppRadius.card }
    private var shadowRadius: CGFloat { compact ? 6 : 12 }
    private var shadowY: CGFloat { compact ? 4 : 10 }

    var body: some View {
        content
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalPadding)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    LinearGradient(
                        colors: [Color.appPitchDeep, Color.appPitch],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    PitchLines()
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    LinearGradient(
                        colors: [Color.appPrimary.opacity(0.08), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.16), Color.appStroke.opacity(0.45)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .shadow(color: Color.appAccent.opacity(0.1), radius: shadowRadius, x: 0, y: 0)
            .shadow(color: Color.black.opacity(compact ? 0.3 : 0.45), radius: compact ? 8 : 16, x: 0, y: shadowY)
    }
}

private struct PitchLines: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let midX = rect.midX
        p.move(to: CGPoint(x: midX, y: rect.minY + 8))
        p.addLine(to: CGPoint(x: midX, y: rect.maxY - 8))

        let circleRadius = min(rect.width, rect.height) * 0.18
        p.addEllipse(
            in: CGRect(
                x: rect.midX - circleRadius,
                y: rect.midY - circleRadius,
                width: circleRadius * 2,
                height: circleRadius * 2
            )
        )
        return p
    }
}

// MARK: - FixtureCard (shared with HomeView & QuinielaDetailView)

struct FixtureCard: View {
    let fixture: QuinielaFixture
    let live: LiveFixture?
    var compact: Bool = false

    private var shortStatus: String {
        (live?.status.short ?? fixture.status ?? "NS").uppercased()
    }

    private var isLiveMatch: Bool {
        live?.status.isLive == true
    }

    private var isFinalMatch: Bool {
        ["FT", "AET", "PEN"].contains(shortStatus)
    }

    private var hasScore: Bool {
        guard let live else { return false }
        return live.score.home != nil || live.score.away != nil
    }

    /// Kickoff time has passed (match likely finished even if API didn't return result).
    private var kickoffIsPast: Bool {
        guard let date = fixture.kickoffDate else { return false }
        return date < Date()
    }

    /// Show "Final" and placeholder when match time passed but we have no result (e.g. API error).
    private var treatAsFinishedWithoutScore: Bool {
        kickoffIsPast && !hasScore
    }

    private var liveClockText: String? {
        guard isLiveMatch else { return nil }
        let min = live?.status.elapsed.map { "\($0)'" } ?? ""
        let period = shortStatus.isEmpty ? "LIVE" : shortStatus
        return ["LIVE", min, period].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var kickoffText: String {
        if let live, let d = live.scheduledDate {
            return formatDate(d)
        }
        guard let d = fixture.kickoffDate else { return fixture.kickoff }
        return formatDate(d)
    }

    private var metaText: String {
        if let liveClockText { return liveClockText }
        if isFinalMatch || treatAsFinishedWithoutScore { return NSLocalizedString("Final", comment: "") }
        if shortStatus == "NS" || shortStatus == "TBD" { return kickoffText }
        return shortStatus
    }

    /// Center content: score, "—" when finished but no result, or "vs" when upcoming.
    private var centerScoreOrPlaceholder: String? {
        if hasScore { return nil }
        if treatAsFinishedWithoutScore { return "—" }
        return nil
    }

    var body: some View {
        MatchCard(compact: compact) {
            VStack(spacing: compact ? 4 : AppSpacing.sm) {
                if !compact {
                    HStack {
                        Text(fixture.leagueName ?? "League")
                            .font(AppFont.overline())
                            .foregroundColor(.appTextSecondary)
                        Spacer()
                    }
                }

                HStack(spacing: 0) {
                    VStack(spacing: compact ? 4 : 8) {
                        TeamCrest(name: fixture.homeTeam, logo: live?.logos?.home ?? fixture.homeLogo, compact: compact)
                        Text(fixture.homeTeam)
                            .font(.system(size: compact ? 10 : 13, weight: .semibold, design: .rounded))
                            .foregroundColor(.appTextPrimary)
                            .lineLimit(compact ? 1 : 2)
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)

                    VStack(spacing: compact ? 2 : 6) {
                        HStack(spacing: compact ? 3 : 5) {
                            if isLiveMatch {
                                Circle()
                                    .fill(Color.appLiveRed)
                                    .frame(width: compact ? 4 : 6, height: compact ? 4 : 6)
                            }
                            Text(metaText)
                                .font(.system(size: compact ? 9 : 11, weight: .bold, design: .rounded))
                                .foregroundColor(isLiveMatch ? .appLiveRed : .appTextSecondary)
                                .lineLimit(1)
                        }

                        if hasScore {
                            HStack(spacing: compact ? 4 : 8) {
                                Text("\(live?.score.home ?? 0)")
                                    .font(.system(size: compact ? 18 : 32, weight: .heavy, design: .rounded))
                                    .foregroundColor(.appTextPrimary)
                                    .monospacedDigit()
                                Text("–")
                                    .font(.system(size: compact ? 14 : 22, weight: .regular, design: .rounded))
                                    .foregroundColor(.appTextSecondary)
                                Text("\(live?.score.away ?? 0)")
                                    .font(.system(size: compact ? 18 : 32, weight: .heavy, design: .rounded))
                                    .foregroundColor(.appTextPrimary)
                                    .monospacedDigit()
                            }
                        } else if let placeholder = centerScoreOrPlaceholder {
                            Text(placeholder)
                                .font(.system(size: compact ? 18 : 28, weight: .semibold, design: .rounded))
                                .foregroundColor(.appTextSecondary)
                        } else {
                            Text("vs")
                                .font(.system(size: compact ? 11 : 15, weight: .medium, design: .rounded))
                                .foregroundColor(.appTextMuted)
                                .padding(.vertical, compact ? 0 : 4)
                        }
                    }
                    .frame(minWidth: compact ? 64 : 104)

                    VStack(spacing: compact ? 4 : 8) {
                        TeamCrest(name: fixture.awayTeam, logo: live?.logos?.away ?? fixture.awayLogo, compact: compact)
                        Text(fixture.awayTeam)
                            .font(.system(size: compact ? 10 : 13, weight: .semibold, design: .rounded))
                            .foregroundColor(.appTextPrimary)
                            .lineLimit(compact ? 1 : 2)
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(minHeight: compact ? 76 : 148)
        }
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale.current
        f.dateStyle = .none
        f.timeStyle = .short
        return f.string(from: date)
    }
}

struct TeamCrest: View {
    let name: String
    let logo: String?
    var compact: Bool = false

    private var circleSize: CGFloat { compact ? 36 : 58 }
    private var imageSize: CGFloat { compact ? 22 : 38 }
    private var initialsFont: CGFloat { compact ? 10 : 16 }

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.appSurfaceAlt, Color.appSurface],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: circleSize, height: circleSize)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(compact ? 0.2 : 0.3), radius: compact ? 4 : 8, x: 0, y: compact ? 2 : 4)

            if let logo, let url = URL(string: logo) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        Text(initials(name))
                            .font(.system(size: initialsFont, weight: .bold, design: .rounded))
                            .foregroundColor(.appTextPrimary)
                    }
                }
                .frame(width: imageSize, height: imageSize)
            } else {
                Text(initials(name))
                    .font(.system(size: initialsFont, weight: .bold, design: .rounded))
                    .foregroundColor(.appTextPrimary)
            }
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        let first = parts.first?.prefix(1) ?? ""
        let second = parts.dropFirst().first?.prefix(1) ?? ""
        return (first + second).uppercased()
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        MatchCard {
            Text("América vs Chivas")
                .foregroundColor(.white)
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
