//
//  RegisterView.swift
//  futpoolsapp
//

import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var isLoading = false
    @FocusState private var focused: Bool?

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(spacing: AppSpacing.xl) {
                    VStack(spacing: AppSpacing.sm) {
                        Text("Crear cuenta")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundColor(.appTextPrimary)
                        Text("Regístrate para participar")
                            .font(AppFont.body())
                            .foregroundColor(.appTextSecondary)
                    }
                    .padding(.top, AppSpacing.xl)

                    VStack(spacing: AppSpacing.md) {
                        TextField("Nombre (opcional)", text: $displayName)
                            .textContentType(.name)
                            .appTextFieldStyle()

                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .focused($focused, equals: true)
                            .appTextFieldStyle()

                        SecureField("Contraseña (mín. 6)", text: $password)
                            .textContentType(.newPassword)
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

                    PrimaryButton("Registrarse", style: .green) {
                        focused = nil
                        Task {
                            isLoading = true
                            await auth.register(email: email, password: password, displayName: displayName.isEmpty ? nil : displayName)
                            isLoading = false
                        }
                    }
                    .disabled(isLoading || email.isEmpty || password.count < 6)
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.sm)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        RegisterView()
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
