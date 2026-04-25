//
//  RegisterView.swift
//  futpoolsapp
//
//  Mirrors LoginView visually — same Arena HUD treatment (background, brand
//  wordmark, HudFrame with brackets, ArenaField, ArcadeButton, Arena typography
//  + colors). Previously used the default SwiftUI styling which stood out next
//  to the login screen.
//

import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var username = ""
    @State private var isLoading = false
    @State private var touchedName = false
    @State private var touchedUsername = false
    @State private var touchedEmail = false
    @State private var touchedPassword = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, username, email, password }

    private var trimmedName: String { displayName.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedUsername: String { username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var nameError: String? {
        if trimmedName.isEmpty { return String(localized: "Name is required") }
        if trimmedName.count < 2 { return String(localized: "Name must be at least 2 characters") }
        return nil
    }

    private var usernameError: String? {
        if trimmedUsername.isEmpty { return String(localized: "Username is required") }
        let pattern = "^[a-z0-9_.]{3,20}$"
        if trimmedUsername.range(of: pattern, options: .regularExpression) == nil {
            return String(localized: "Invalid username (3-20, letters/numbers/._)")
        }
        return nil
    }

    private var emailError: String? {
        if trimmedEmail.isEmpty { return String(localized: "Email is required") }
        let pattern = "^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        if trimmedEmail.range(of: pattern, options: .regularExpression) == nil {
            return String(localized: "Enter a valid email")
        }
        return nil
    }

    private var passwordError: String? {
        if password.isEmpty { return String(localized: "Password is required") }
        if password.count < 6 { return String(localized: "At least 6 characters") }
        return nil
    }

    private var canSubmit: Bool {
        !isLoading && nameError == nil && usernameError == nil
            && emailError == nil && passwordError == nil
    }

    var body: some View {
        ZStack {
            ArenaBackground(showGridFloor: true, scanlineIntensity: 0.25)

            ScrollView {
                VStack(spacing: 26) {
                    // BRAND wordmark — verbatim so "POOLS" never leaks through
                    // localization to "QUINIELAS".
                    VStack(spacing: 6) {
                        HStack(spacing: 0) {
                            Text(verbatim: "FUT")
                                .font(ArenaFont.brand(size: 40))
                                .tracking(6)
                                .foregroundColor(.arenaText)
                            Text(verbatim: "POOLS")
                                .font(ArenaFont.brand(size: 40))
                                .tracking(6)
                                .foregroundColor(.arenaPrimary)
                                .shadow(color: .arenaPrimary.opacity(0.85), radius: 14)
                        }
                        Text("· " + String(localized: "ARENA") + " ·")
                            .font(ArenaFont.mono(size: 11))
                            .tracking(4)
                            .foregroundColor(.arenaTextDim)
                    }
                    .padding(.top, 60)

                    // Form card — same HudFrame + brackets as Login, for
                    // visual consistency across the auth flow.
                    HudFrame(
                        cut: 18,
                        glow: .arenaPrimary,
                        brackets: true
                    ) {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("▶ " + String(localized: "CREATE ACCOUNT"))
                                .font(ArenaFont.display(size: 13, weight: .heavy))
                                .tracking(3)
                                .foregroundColor(.arenaPrimary)

                            ArenaRegField(
                                label: String(localized: "NAME"),
                                text: $displayName,
                                contentType: .name,
                                keyboard: .default,
                                disableAutocapitalize: false,
                                isSecure: false,
                                isFocused: focusedField == .name,
                                onFocus: { focusedField = .name }
                            )
                            .onChange(of: displayName) { _ in touchedName = true }
                            if touchedName, let err = nameError { errorLine(err) }

                            ArenaRegField(
                                label: String(localized: "USERNAME"),
                                text: $username,
                                contentType: .username,
                                keyboard: .default,
                                disableAutocapitalize: true,
                                isSecure: false,
                                isFocused: focusedField == .username,
                                onFocus: { focusedField = .username }
                            )
                            .onChange(of: username) { _ in touchedUsername = true }
                            if touchedUsername, let err = usernameError { errorLine(err) }

                            ArenaRegField(
                                label: String(localized: "EMAIL"),
                                text: $email,
                                contentType: .emailAddress,
                                keyboard: .emailAddress,
                                disableAutocapitalize: true,
                                isSecure: false,
                                isFocused: focusedField == .email,
                                onFocus: { focusedField = .email }
                            )
                            .onChange(of: email) { _ in touchedEmail = true }
                            if touchedEmail, let err = emailError { errorLine(err) }

                            ArenaRegField(
                                label: String(localized: "PASSWORD"),
                                text: $password,
                                contentType: .newPassword,
                                keyboard: .default,
                                disableAutocapitalize: true,
                                isSecure: true,
                                isFocused: focusedField == .password,
                                onFocus: { focusedField = .password }
                            )
                            .onChange(of: password) { _ in touchedPassword = true }
                            if touchedPassword, let err = passwordError { errorLine(err) }

                            if let msg = auth.errorMessage {
                                Text(msg)
                                    .font(ArenaFont.mono(size: 11))
                                    .foregroundColor(.arenaDanger)
                                    .multilineTextAlignment(.leading)
                                    .padding(.top, 2)
                            }

                            ArcadeButton(
                                title: isLoading
                                    ? String(localized: "LOADING…")
                                    : String(localized: "▶ REGISTER"),
                                size: .lg,
                                fullWidth: true,
                                disabled: !canSubmit
                            ) {
                                focusedField = nil
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
                            .padding(.top, 4)
                        }
                        .padding(22)
                    }
                    .padding(.horizontal, 20)

                    // Back-to-login hint — mirror of the CREATE ACCOUNT hint
                    // on the login screen.
                    HStack(spacing: 6) {
                        Text(String(localized: "HAVE AN ACCOUNT?"))
                            .font(ArenaFont.mono(size: 11))
                            .tracking(1)
                            .foregroundColor(.arenaTextMuted)
                        Button {
                            dismiss()
                        } label: {
                            Text(String(localized: "← SIGN IN"))
                                .font(ArenaFont.display(size: 12, weight: .bold))
                                .tracking(2)
                                .foregroundColor(.arenaPrimary)
                        }
                    }
                    .padding(.top, 6)

                    Spacer(minLength: 40)

                    Text(String(localized: "© 2026 FUTPOOLS · PRESS START"))
                        .font(ArenaFont.mono(size: 9))
                        .tracking(3)
                        .foregroundColor(.arenaTextFaint)
                        .padding(.bottom, 20)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    private func errorLine(_ msg: String) -> some View {
        Text(msg)
            .font(ArenaFont.mono(size: 10))
            .foregroundColor(.arenaDanger)
            .padding(.leading, 2)
            .padding(.top, -8)
    }
}

// MARK: - Field (Arena-styled)

/// Local copy of the ArenaField used in LoginView — scoped private here so
/// we don't have to touch LoginView to expose the type. Shares the same
/// visual treatment (label above, stroke-only input, focus ring in primary).
private struct ArenaRegField: View {
    let label: String
    @Binding var text: String
    var contentType: UITextContentType?
    var keyboard: UIKeyboardType = .default
    /// Separate Bool prop instead of deriving from autocap — SwiftUI's
    /// TextInputAutocapitalization isn't Equatable, so `== .never` fails.
    var disableAutocapitalize: Bool = false
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
                        .textContentType(contentType)
                } else {
                    TextField("", text: $text)
                        .textContentType(contentType)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(disableAutocapitalize ? .never : .sentences)
                        .autocorrectionDisabled(disableAutocapitalize)
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

#Preview {
    NavigationStack {
        RegisterView()
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
