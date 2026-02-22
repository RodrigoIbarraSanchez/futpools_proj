//
//  LoginView.swift
//  futpoolsapp
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
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
    }
}

#Preview {
    NavigationStack {
        LoginView()
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
