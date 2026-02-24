//
//  LoginView.swift
//  futpoolsapp
//

import SwiftUI

/// Set to true when email provider is configured in production to enable forgot-password flow.
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
            AppBackground()
            ScrollView {
                VStack(spacing: AppSpacing.xl) {
                    VStack(spacing: AppSpacing.sm) {
                        Text("Quinielas")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundColor(.appTextPrimary)
                        Text("Inicia sesión para jugar")
                            .font(AppFont.body())
                            .foregroundColor(.appTextSecondary)
                    }
                    .padding(.top, AppSpacing.xl * 2)

                    VStack(spacing: AppSpacing.md) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .focused($focused, equals: true)
                            .appTextFieldStyle()

                        SecureField("Contraseña", text: $password)
                            .textContentType(.password)
                            .focused($focused, equals: false)
                            .appTextFieldStyle()
                    }
                    .padding(.horizontal)

                    if let msg = auth.errorMessage {
                        Text(msg)
                            .font(AppFont.caption())
                            .foregroundColor(.appLiveRed)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    PrimaryButton("Entrar", style: .purple) {
                        focused = nil
                        print("[Auth] Iniciando sesión — email: \(email)")
                        Task {
                            isLoading = true
                            await auth.login(email: email, password: password)
                            isLoading = false
                            if auth.isAuthenticated { print("[Auth] Login OK") }
                        }
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.sm)

                    Group {
                        if isPasswordRecoveryEnabled {
                            NavigationLink {
                                ForgotPasswordView()
                            } label: {
                                Text("Forgot password?")
                                    .font(AppFont.body())
                                    .foregroundColor(.appTextSecondary)
                            }
                        } else {
                            Button {
                                showComingSoon = true
                            } label: {
                                Text("Forgot password?")
                                    .font(AppFont.body())
                                    .foregroundColor(.appTextSecondary)
                            }
                        }
                    }
                    .padding(.top, AppSpacing.xs)

                    NavigationLink {
                        RegisterView()
                    } label: {
                        Text("¿No tienes cuenta? Regístrate")
                            .font(AppFont.body())
                            .foregroundColor(.appPrimary)
                    }
                    .padding(.top)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showComingSoon) {
            ComingSoonPasswordRecoverySheet(onDismiss: { showComingSoon = false })
        }
    }
}

// MARK: - Coming soon modal (hide when isPasswordRecoveryEnabled = true and email provider is connected)
private struct ComingSoonPasswordRecoverySheet: View {
    var onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: AppSpacing.lg) {
                Text("Coming soon")
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .foregroundColor(.appTextPrimary)
                Text("Password recovery will be available soon. We'll notify you when it's ready.")
                    .font(AppFont.body())
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                PrimaryButton("Done", style: .purple, action: onDismiss)
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.sm)
            }
            .padding(AppSpacing.xl)
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
