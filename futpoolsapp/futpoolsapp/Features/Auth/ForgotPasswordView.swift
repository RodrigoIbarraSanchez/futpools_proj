//
//  ForgotPasswordView.swift
//  futpoolsapp
//

import SwiftUI

struct ForgotPasswordView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email = ""
    @State private var isLoading = false
    @State private var didSend = false
    @FocusState private var isEmailFocused: Bool

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(spacing: AppSpacing.xl) {
                    VStack(spacing: AppSpacing.sm) {
                        Text("Forgot password?")
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(.appTextPrimary)
                        Text("Enter your email and we'll send you a 6-digit code to reset your password.")
                            .font(AppFont.body())
                            .foregroundColor(.appTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, AppSpacing.xl)

                    if didSend {
                        Text("If an account exists with this email, you will receive a recovery code shortly. Check your inbox and enter the code on the next screen.")
                            .font(AppFont.caption())
                            .foregroundColor(.appPrimary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    } else {
                        VStack(spacing: AppSpacing.md) {
                            TextField("Email", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .focused($isEmailFocused)
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

                        PrimaryButton("Send code", style: .purple) {
                            isEmailFocused = false
                            Task {
                                isLoading = true
                                let ok = await auth.forgotPassword(email: email)
                                isLoading = false
                                if ok { didSend = true }
                            }
                        }
                        .disabled(isLoading || email.isEmpty)
                        .padding(.horizontal)
                        .padding(.top, AppSpacing.sm)
                    }

                    if didSend {
                        NavigationLink {
                            ResetPasswordView(email: email)
                        } label: {
                            Text("Enter code and new password")
                                .font(AppFont.body())
                                .foregroundColor(.appPrimary)
                        }
                        .padding(.top)
                    }
                }
            }
        }
        .navigationTitle("Recover password")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        ForgotPasswordView()
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
