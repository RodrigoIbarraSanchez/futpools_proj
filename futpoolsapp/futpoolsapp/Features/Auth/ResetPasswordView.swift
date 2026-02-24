//
//  ResetPasswordView.swift
//  futpoolsapp
//

import SwiftUI

struct ResetPasswordView: View {
    let email: String
    @EnvironmentObject var auth: AuthService
    @State private var code = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @FocusState private var focused: Field?

    enum Field { case code, newPassword, confirm }

    private var passwordsMatch: Bool {
        newPassword.isEmpty || confirmPassword.isEmpty || newPassword == confirmPassword
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(spacing: AppSpacing.xl) {
                    Text("Enter the 6-digit code we sent to \(email) and choose a new password.")
                        .font(AppFont.body())
                        .foregroundColor(.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                        .padding(.top, AppSpacing.lg)

                    VStack(spacing: AppSpacing.md) {
                        TextField("Code", text: $code)
                            .textContentType(.oneTimeCode)
                            .keyboardType(.numberPad)
                            .focused($focused, equals: .code)
                            .appTextFieldStyle()

                        SecureField("New password", text: $newPassword)
                            .textContentType(.newPassword)
                            .focused($focused, equals: .newPassword)
                            .appTextFieldStyle()

                        SecureField("Confirm password", text: $confirmPassword)
                            .textContentType(.newPassword)
                            .focused($focused, equals: .confirm)
                            .appTextFieldStyle()

                        if !passwordsMatch {
                            Text("Passwords don't match")
                                .font(AppFont.caption())
                                .foregroundColor(.appLiveRed)
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

                    PrimaryButton("Reset password", style: .green) {
                        focused = nil
                        guard newPassword == confirmPassword else { return }
                        Task {
                            isLoading = true
                            await auth.resetPassword(email: email, code: code, newPassword: newPassword)
                            isLoading = false
                        }
                    }
                    .disabled(isLoading || code.count != 6 || newPassword.count < 6 || !passwordsMatch)
                    .padding(.horizontal)
                    .padding(.top, AppSpacing.sm)
                }
            }
        }
        .navigationTitle("New password")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { auth.clearError() }
    }
}

#Preview {
    NavigationStack {
        ResetPasswordView(email: "user@example.com")
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
