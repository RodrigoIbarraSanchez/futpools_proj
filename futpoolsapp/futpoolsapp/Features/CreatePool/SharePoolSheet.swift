//
//  SharePoolSheet.swift
//  futpoolsapp
//

import SwiftUI

struct SharePoolSheet: View {
    let pool: Quiniela
    let onDone: () -> Void

    @State private var copied = false

    private var shareURL: URL? {
        guard let code = pool.inviteCode else { return nil }
        return URL(string: "futpools://p/\(code)")
    }

    var body: some View {
        ZStack {
            Color.arenaBg.ignoresSafeArea()

            VStack(spacing: 20) {
                Spacer()

                Text("🏆")
                    .font(.system(size: 60))
                    .shadow(color: .arenaPrimary.opacity(0.7), radius: 16)

                Text("POOL CREATED!")
                    .font(ArenaFont.display(size: 26, weight: .black))
                    .tracking(3)
                    .foregroundColor(.arenaPrimary)

                Text(pool.name.uppercased())
                    .font(ArenaFont.display(size: 16, weight: .bold))
                    .tracking(1)
                    .foregroundColor(.arenaText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                // Invite code card
                HudFrame(glow: .arenaPrimary) {
                    VStack(spacing: 6) {
                        Text("INVITE CODE")
                            .font(ArenaFont.mono(size: 10))
                            .tracking(2)
                            .foregroundColor(.arenaTextMuted)
                        Text(pool.inviteCode ?? "—")
                            .font(ArenaFont.display(size: 32, weight: .black))
                            .tracking(6)
                            .foregroundColor(.arenaPrimary)
                        Button {
                            UIPasteboard.general.string = pool.inviteCode
                            copied = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { copied = false }
                        } label: {
                            Text(copied
                                 ? String(localized: "COPIED ✓")
                                 : String(localized: "TAP TO COPY"))
                                .font(ArenaFont.mono(size: 10))
                                .tracking(1.5)
                                .foregroundColor(copied ? .arenaPrimary : .arenaAccent)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)

                // Share link button
                if let url = shareURL {
                    ShareLink(item: url) {
                        Text("▶ SHARE LINK")
                            .font(ArenaFont.display(size: 14, weight: .heavy))
                            .tracking(2)
                            .foregroundColor(.arenaOnPrimary)
                            .padding(.vertical, 14)
                            .padding(.horizontal, 24)
                            .frame(maxWidth: .infinity)
                            .background(HudCornerCutShape(cut: 8).fill(Color.arenaPrimary))
                            .clipShape(HudCornerCutShape(cut: 8))
                            .shadow(color: .arenaPrimary.opacity(0.4), radius: 14)
                    }
                    .padding(.horizontal, 24)
                }

                Spacer()

                Button("DONE") { onDone() }
                    .font(ArenaFont.display(size: 12, weight: .bold))
                    .tracking(2)
                    .foregroundColor(.arenaTextDim)
                    .padding(.bottom, 16)
            }
        }
        .presentationDetents([.large])
        .interactiveDismissDisabled(false)
    }
}
