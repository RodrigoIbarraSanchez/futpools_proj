//
//  LeaderboardView.swift
//  futpoolsapp
//

import SwiftUI

private let topCount = 5
private let pageSize = 50

struct LeaderboardView: View {
    let leaderboard: LeaderboardResponse?
    let isLoading: Bool
    var quinielaId: String?
    var token: String?
    @State private var showFullLeaderboard = false

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Leaderboard")
                        .font(AppFont.headline())
                        .foregroundColor(.appTextPrimary)
                    Text(NSLocalizedString("Score: correct predictions per finished match", comment: "Leaderboard subtitle"))
                        .font(.system(size: 11))
                        .foregroundColor(.appTextSecondary)
                }
                Spacer()
                if let lb = leaderboard, lb.totalCount > 0 {
                    Text("\(lb.totalCount) participant\(lb.totalCount == 1 ? "" : "s")")
                        .font(AppFont.overline())
                        .foregroundColor(.appTextSecondary)
                }
                if isLoading {
                    ProgressView()
                        .tint(.appTextSecondary)
                        .scaleEffect(0.9)
                }
            }
            .padding(.horizontal)

            if isLoading && leaderboard == nil {
                HStack {
                    Spacer()
                    Text("Loading…")
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                    Spacer()
                }
                .padding(.vertical, AppSpacing.md)
            } else if let lb = leaderboard {
                if lb.leaderboard.isEmpty {
                    Text("No participants yet. Be the first to join.")
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                        .padding(.vertical, AppSpacing.sm)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(lb.leaderboard.enumerated()), id: \.element.id) { index, row in
                            LeaderboardRowView(entry: row, isHighlight: false, index: index)
                            if row.id != lb.leaderboard.last?.id {
                                Divider()
                                    .background(Color.white.opacity(0.06))
                                    .padding(.leading, 24 + AppSpacing.sm)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, AppSpacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.appSurfaceAlt.opacity(0.6))
                    )
                    .padding(.horizontal)

                    if let user = lb.userEntry, !lb.leaderboard.contains(where: { $0.rank == user.rank }) {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: "person.fill")
                                .font(.system(size: 12))
                                .foregroundColor(.appPrimary)
                            Text("You: #\(user.rank) of \(lb.totalCount) — \(user.score)/\(user.totalPossible)")
                                .font(AppFont.caption())
                                .foregroundColor(.appTextSecondary)
                        }
                        .padding(.horizontal)
                        .padding(.top, AppSpacing.xs)
                    }

                    if lb.totalCount > topCount, let qId = quinielaId {
                        Button {
                            showFullLeaderboard = true
                        } label: {
                            HStack {
                                Text("See full leaderboard")
                                    .font(AppFont.caption().weight(.semibold))
                                    .foregroundColor(.appPrimary)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(.appPrimary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, AppSpacing.sm)
                        }
                        .buttonStyle(.plain)
                        .padding(.top, AppSpacing.xs)
                        .sheet(isPresented: $showFullLeaderboard) {
                            FullLeaderboardSheet(quinielaId: qId, token: token)
                        }
                    }
                }
            }
        }
    }
}

private struct LeaderboardRowView: View {
    let entry: LeaderboardEntry
    var isHighlight: Bool = false
    var index: Int = 0
    @State private var appeared = false

    private var medalColor: Color? {
        switch entry.rank {
        case 1: return .appGold
        case 2: return .appSilver
        case 3: return .appBronze
        default: return nil
        }
    }

    private var medalIcon: String? {
        switch entry.rank {
        case 1: return "crown.fill"
        case 2: return "medal.fill"
        case 3: return "medal.fill"
        default: return nil
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            Group {
                if let color = medalColor, let icon = medalIcon {
                    Image(systemName: icon)
                        .font(.system(size: entry.rank == 1 ? 18 : 14))
                        .foregroundColor(color)
                        .shadow(color: entry.rank == 1 ? Color.appGold.opacity(0.5) : .clear, radius: 6)
                } else {
                    Text("\(entry.rank)")
                        .font(AppFont.caption().weight(.bold))
                        .foregroundColor(.appTextSecondary)
                }
            }
            .frame(width: 24, alignment: .leading)
            Text(entry.displayName)
                .font(AppFont.caption())
                .foregroundColor(.appTextPrimary)
                .lineLimit(1)
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 0) {
                Text(NSLocalizedString("Aciertos", comment: "Correct predictions count label"))
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.appTextSecondary)
                Text("\(entry.score)/\(entry.totalPossible)")
                    .font(AppFont.caption().weight(.semibold))
                    .foregroundColor(entry.rank <= 3 ? (medalColor ?? .appPrimary) : .appPrimary)
            }
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, AppSpacing.xs)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(entry.rank <= 3 ? (medalColor?.opacity(0.18) ?? Color.appPrimary.opacity(0.12)) : (isHighlight ? Color.appPrimary.opacity(0.08) : Color.clear))
        )
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 8)
        .onAppear {
            withAnimation(.easeOut(duration: 0.35).delay(Double(index) * 0.05)) {
                appeared = true
            }
        }
    }
}

struct FullLeaderboardSheet: View {
    let quinielaId: String
    let token: String?
    @Environment(\.dismiss) private var dismiss
    @State private var entries: [LeaderboardEntry] = []
    @State private var totalCount = 0
    @State private var totalPossible = 0
    @State private var userEntry: UserLeaderboardEntry?
    @State private var offset = 0
    @State private var isLoading = false
    @State private var loadingMore = false
    private let client = APIClient.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                if entries.isEmpty && !isLoading {
                    Text("No participants.")
                        .font(AppFont.body())
                        .foregroundColor(.appTextSecondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        if let user = userEntry, !entries.contains(where: { $0.rank == user.rank }) {
                            Section {
                                LeaderboardRowView(
                                    entry: LeaderboardEntry(
                                        rank: user.rank,
                                        entryId: "me",
                                        entryNumber: 0,
                                        userId: nil,
                                        displayName: user.displayName,
                                        score: user.score,
                                        totalPossible: user.totalPossible
                                    ),
                                    isHighlight: true
                                )
                            } header: {
                                Text("Your position")
                                    .font(AppFont.overline())
                                    .foregroundColor(.appTextSecondary)
                            }
                        }
                        Section {
                            ForEach(Array(entries.enumerated()), id: \.element.id) { index, row in
                                LeaderboardRowView(entry: row, isHighlight: false, index: index)
                            }
                            if offset < totalCount, totalCount > pageSize {
                                HStack {
                                    Spacer()
                                    if loadingMore {
                                        ProgressView()
                                            .tint(.appPrimary)
                                    } else {
                                        Button("Load more") {
                                            loadMore()
                                        }
                                        .font(AppFont.caption().weight(.semibold))
                                        .foregroundColor(.appPrimary)
                                    }
                                    Spacer()
                                }
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                            }
                        } header: {
                            Text("\(totalCount) participants · \(totalPossible) fixtures")
                                .font(AppFont.overline())
                                .foregroundColor(.appTextSecondary)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Leaderboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundColor(.appPrimary)
                }
            }
            .onAppear {
                loadFirstPage()
            }
        }
    }

    private func loadFirstPage() {
        guard !isLoading else { return }
        isLoading = true
        Task {
            await fetchPage(offset: 0, limit: pageSize, append: false)
            isLoading = false
        }
    }

    private func loadMore() {
        guard !loadingMore else { return }
        loadingMore = true
        Task {
            await fetchPage(offset: offset, limit: pageSize, append: true)
            loadingMore = false
        }
    }

    private func fetchPage(offset off: Int, limit: Int, append: Bool) async {
        do {
            let path = "/quinielas/\(quinielaId)/leaderboard?offset=\(off)&limit=\(limit)"
            let data: LeaderboardResponse = try await client.request(
                method: "GET",
                path: path,
                token: token
            )
            await MainActor.run {
                if append {
                    entries.append(contentsOf: data.leaderboard)
                } else {
                    entries = data.leaderboard
                    userEntry = data.userEntry
                }
                totalCount = data.totalCount
                totalPossible = data.totalPossible
                offset = entries.count
            }
        } catch {
            await MainActor.run {
                if !append { entries = [] }
            }
        }
    }
}

