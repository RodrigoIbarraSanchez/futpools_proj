//
//  AdminDashboardView.swift
//  futpoolsapp
//
//  Central surface for admin-only actions. Entry for Platform Event creation,
//  later will host user balance adjustments and the ledger viewer.
//

import SwiftUI

struct AdminDashboardView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: AuthService
    @State private var showCreateEvent = false

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        banner
                        createEventCard
                        Spacer(minLength: 40)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .padding(.bottom, 60)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(String(localized: "ADMIN"))
                        .font(ArenaFont.display(size: 13, weight: .black))
                        .tracking(3)
                        .foregroundColor(.arenaText)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Close")) { dismiss() }
                        .foregroundColor(.arenaTextDim)
                }
            }
            .sheet(isPresented: $showCreateEvent) {
                AdminCreateEventView()
                    .environmentObject(auth)
            }
        }
    }

    private var banner: some View {
        HudFrame(
            cut: 14,
            fill: AnyShapeStyle(
                LinearGradient(
                    colors: [
                        Color.arenaPrimary.opacity(0.18),
                        Color.arenaSurface,
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        ) {
            VStack(alignment: .leading, spacing: 6) {
                Text("◆ ADMIN CONSOLE")
                    .font(ArenaFont.mono(size: 10, weight: .bold))
                    .tracking(2.5)
                    .foregroundColor(.arenaPrimary)
                Text("Platform Events")
                    .font(ArenaFont.display(size: 22, weight: .black))
                    .foregroundColor(.arenaText)
                Text("Create sponsored pools with guaranteed prizes. Prize unlocks only when minimum participants is reached.")
                    .font(ArenaFont.mono(size: 11))
                    .foregroundColor(.arenaTextDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
        }
    }

    private var createEventCard: some View {
        Button {
            showCreateEvent = true
        } label: {
            HudFrame {
                HStack(spacing: 12) {
                    Text("⬢")
                        .font(ArenaFont.display(size: 22, weight: .heavy))
                        .foregroundColor(.arenaPrimary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CREATE PLATFORM EVENT")
                            .font(ArenaFont.display(size: 13, weight: .black))
                            .tracking(1.5)
                            .foregroundColor(.arenaText)
                        Text("Prize + min participants + fixtures")
                            .font(ArenaFont.mono(size: 10))
                            .foregroundColor(.arenaTextDim)
                    }
                    Spacer()
                    Text("›")
                        .font(ArenaFont.display(size: 18, weight: .bold))
                        .foregroundColor(.arenaPrimary)
                }
                .padding(14)
            }
        }
        .buttonStyle(.plain)
    }
}
