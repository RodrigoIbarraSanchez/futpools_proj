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
    @State private var username = ""
    @State private var isLoading = false
    @State private var touchedName = false
    @State private var touchedUsername = false
    @State private var touchedEmail = false
    @State private var touchedPassword = false
    @FocusState private var focused: Bool?

    private var trimmedName: String { displayName.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedUsername: String { username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var nameError: String? {
        if trimmedName.isEmpty { return "El nombre es obligatorio" }
        if trimmedName.count < 2 { return "El nombre debe tener al menos 2 caracteres" }
        return nil
    }

    private var usernameError: String? {
        if trimmedUsername.isEmpty { return "El nombre de usuario es obligatorio" }
        let pattern = "^[a-z0-9_.]{3,20}$"
        if trimmedUsername.range(of: pattern, options: .regularExpression) == nil {
            return "Usuario inválido (3-20 chars, letras/números/._)"
        }
        return nil
    }

    private var emailError: String? {
        if trimmedEmail.isEmpty { return "El email es obligatorio" }
        let pattern = "^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        if trimmedEmail.range(of: pattern, options: .regularExpression) == nil {
            return "Ingresa un email válido"
        }
        return nil
    }

    private var passwordError: String? {
        if password.isEmpty { return "La contraseña es obligatoria" }
        if password.count < 6 { return "Mínimo 6 caracteres" }
        return nil
    }

    private var canSubmit: Bool {
        !isLoading && nameError == nil && usernameError == nil && emailError == nil && passwordError == nil
    }

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
                        VStack(alignment: .leading, spacing: 6) {
                            TextField("Nombre", text: $displayName)
                                .textContentType(.name)
                                .appTextFieldStyle()
                                .onChange(of: displayName) { _ in touchedName = true }
                            if touchedName, let nameError {
                                Text(nameError).font(AppFont.caption()).foregroundColor(.appLiveRed)
                            }
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            TextField("Nombre de usuario", text: $username)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                                .textContentType(.username)
                                .appTextFieldStyle()
                                .onChange(of: username) { _ in touchedUsername = true }
                            if touchedUsername, let usernameError {
                                Text(usernameError).font(AppFont.caption()).foregroundColor(.appLiveRed)
                            }
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            TextField("Email", text: $email)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .focused($focused, equals: true)
                                .appTextFieldStyle()
                                .onChange(of: email) { _ in touchedEmail = true }
                            if touchedEmail, let emailError {
                                Text(emailError).font(AppFont.caption()).foregroundColor(.appLiveRed)
                            }
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            SecureField("Contraseña (mín. 6)", text: $password)
                                .textContentType(.newPassword)
                                .focused($focused, equals: false)
                                .appTextFieldStyle()
                                .onChange(of: password) { _ in touchedPassword = true }
                            if touchedPassword, let passwordError {
                                Text(passwordError).font(AppFont.caption()).foregroundColor(.appLiveRed)
                            }
                        }
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
                            await auth.register(
                                email: trimmedEmail,
                                password: password,
                                username: trimmedUsername,
                                displayName: trimmedName
                            )
                            isLoading = false
                        }
                    }
                    .disabled(!canSubmit)
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
