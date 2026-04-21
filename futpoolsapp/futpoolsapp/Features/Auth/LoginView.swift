//
//  LoginView.swift
//  futpoolsapp
//

import SwiftUI

private let isPasswordRecoveryEnabled = false

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var showComingSoon = false
    @FocusState private var focused: Bool?

    var body: some View {
        ZStack {
            ArenaBackground(showGridFloor: true, scanlineIntensity: 0.25)

            ScrollView {
                VStack(spacing: 26) {
                    // Logo lockup
                    VStack(spacing: 6) {
                        HStack(spacing: 0) {
                            Text("FUT")
                                .font(ArenaFont.display(size: 44, weight: .heavy))
                                .tracking(6)
                                .foregroundColor(.arenaText)
                            Text("POOLS")
                                .font(ArenaFont.display(size: 44, weight: .heavy))
                                .tracking(6)
                                .foregroundColor(.arenaPrimary)
                                .shadow(color: .arenaPrimary.opacity(0.85), radius: 14)
                        }
                        Text("· ARENA v2.0 ·")
                            .font(ArenaFont.mono(size: 11))
                            .tracking(4)
                            .foregroundColor(.arenaTextDim)
                    }
                    .padding(.top, 80)

                    // Form card
                    HudFrame(
                        cut: 18,
                        glow: .arenaPrimary,
                        brackets: true
                    ) {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("▶ INSERT COIN TO CONTINUE")
                                .font(ArenaFont.display(size: 13, weight: .heavy))
                                .tracking(3)
                                .foregroundColor(.arenaPrimary)

                            ArenaField(
                                label: "EMAIL",
                                text: $email,
                                isSecure: false,
                                isFocused: focused == true,
                                onFocus: { focused = true }
                            )
                            ArenaField(
                                label: "PASSWORD",
                                text: $password,
                                isSecure: true,
                                isFocused: focused == false,
                                onFocus: { focused = false }
                            )

                            if let msg = auth.errorMessage {
                                Text(msg)
                                    .font(ArenaFont.mono(size: 11))
                                    .foregroundColor(.arenaDanger)
                                    .multilineTextAlignment(.leading)
                                    .padding(.top, 2)
                            }

                            ArcadeButton(
                                title: isLoading ? "LOADING…" : "▶ START MATCH",
                                size: .lg,
                                fullWidth: true,
                                disabled: isLoading || email.isEmpty || password.isEmpty
                            ) {
                                focused = nil
                                Task {
                                    isLoading = true
                                    await auth.login(email: email, password: password)
                                    isLoading = false
                                }
                            }
                            .padding(.top, 4)
                        }
                        .padding(22)
                    }
                    .padding(.horizontal, 20)

                    // Secondary links
                    VStack(spacing: 10) {
                        HStack(spacing: 6) {
                            Text("NEW PLAYER?")
                                .font(ArenaFont.mono(size: 11))
                                .tracking(1)
                                .foregroundColor(.arenaTextMuted)
                            NavigationLink {
                                RegisterView()
                            } label: {
                                Text("CREATE ACCOUNT →")
                                    .font(ArenaFont.display(size: 12, weight: .bold))
                                    .tracking(2)
                                    .foregroundColor(.arenaPrimary)
                            }
                        }

                        Group {
                            if isPasswordRecoveryEnabled {
                                NavigationLink {
                                    ForgotPasswordView()
                                } label: {
                                    Text("FORGOT PASSWORD?")
                                        .font(ArenaFont.mono(size: 10))
                                        .tracking(1)
                                        .foregroundColor(.arenaTextDim)
                                }
                            } else {
                                Button {
                                    showComingSoon = true
                                } label: {
                                    Text("FORGOT PASSWORD?")
                                        .font(ArenaFont.mono(size: 10))
                                        .tracking(1)
                                        .foregroundColor(.arenaTextDim)
                                }
                            }
                        }
                    }
                    .padding(.top, 6)

                    Spacer(minLength: 40)

                    Text("© 2026 FUTPOOLS · PRESS START")
                        .font(ArenaFont.mono(size: 9))
                        .tracking(3)
                        .foregroundColor(.arenaTextFaint)
                        .padding(.bottom, 20)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(isPresented: $showComingSoon) {
            ComingSoonPasswordRecoverySheet(onDismiss: { showComingSoon = false })
        }
    }
}

// MARK: - Field

private struct ArenaField: View {
    let label: String
    @Binding var text: String
    var isSecure: Bool
    var isFocused: Bool
    var onFocus: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ArenaFont.mono(size: 10))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            Group {
                if isSecure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }
            }
            .font(ArenaFont.mono(size: 14))
            .foregroundColor(.arenaText)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.arenaBg)
            .overlay(
                Rectangle()
                    .stroke(isFocused ? Color.arenaPrimary.opacity(0.5) : Color.arenaStroke, lineWidth: 1)
            )
            .onTapGesture { onFocus() }
        }
    }
}

// MARK: - Coming soon sheet

private struct ComingSoonPasswordRecoverySheet: View {
    var onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.arenaBg.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("COMING SOON")
                    .font(ArenaFont.display(size: 22, weight: .heavy))
                    .tracking(3)
                    .foregroundColor(.arenaText)
                Text("Password recovery will be available soon.")
                    .font(ArenaFont.body(size: 14))
                    .foregroundColor(.arenaTextDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                ArcadeButton(title: "DONE", size: .md, fullWidth: true) {
                    onDismiss()
                }
                .padding(.horizontal)
            }
            .padding(32)
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    NavigationStack {
        LoginView()
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
