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
    /// Defaults to today minus 25 years so the picker lands on a sensible
    /// adult age out of the gate (vs. 0001-01-01 or today). The wheel
    /// picker still opens on "today" — this is just the binding default.
    @State private var dob: Date = Calendar.current.date(byAdding: .year, value: -25, to: Date()) ?? Date()
    @State private var country: String = "MX"
    @State private var showCountryPicker: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, username, email, password }

    /// Computed age from `dob`. Used both to gate the submit button and
    /// to show the inline error if the user picks an under-18 date.
    private var ageYears: Int {
        Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
    }
    private var dobError: String? {
        if ageYears < 18 { return String(localized: "Must be 18 or older") }
        return nil
    }

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
            && dobError == nil && !country.isEmpty
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

                            // Age gate (Fase 5) — required for sweepstakes
                            // eligibility. iOS DatePicker handles localization
                            // of month/day order automatically.
                            VStack(alignment: .leading, spacing: 4) {
                                Text(String(localized: "DATE OF BIRTH"))
                                    .font(ArenaFont.mono(size: 10))
                                    .tracking(2)
                                    .foregroundColor(.arenaTextMuted)
                                DatePicker(
                                    "",
                                    selection: $dob,
                                    in: ...Date(),
                                    displayedComponents: .date
                                )
                                .labelsHidden()
                                .colorScheme(.dark)
                                .accentColor(.arenaPrimary)
                            }
                            if let err = dobError { errorLine(err) }

                            // Country picker — full ISO 3166-1 list with
                            // a search bar inside the sheet so any user
                            // worldwide can pick. Sweepstakes are still
                            // gated per-pool by `allowedCountries` on
                            // the backend, independent of registration.
                            VStack(alignment: .leading, spacing: 4) {
                                Text(String(localized: "COUNTRY"))
                                    .font(ArenaFont.mono(size: 10))
                                    .tracking(2)
                                    .foregroundColor(.arenaTextMuted)
                                Button {
                                    showCountryPicker = true
                                } label: {
                                    HStack(spacing: 12) {
                                        Text(CountryCatalog.flagEmoji(from: country))
                                            .font(.system(size: 22))
                                        Text(CountryCatalog.name(for: country))
                                            .font(ArenaFont.mono(size: 14))
                                            .foregroundColor(.arenaText)
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(.arenaTextDim)
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                                    .background(Color.arenaBg)
                                    .overlay(Rectangle().stroke(Color.arenaStroke, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }

                            if auth.errorMessage != nil {
                                serverErrorBanner
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
                                        displayName: trimmedName,
                                        dob: dob,
                                        countryCode: country
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
        .sheet(isPresented: $showCountryPicker) {
            CountryPickerSheet(selected: $country)
                .preferredColorScheme(.dark)
        }
    }

    private func errorLine(_ msg: String) -> some View {
        Text(msg)
            .font(ArenaFont.mono(size: 10))
            .foregroundColor(.arenaDanger)
            .padding(.leading, 2)
            .padding(.top, -8)
    }

    /// Visible red banner with icon — replaces the previous one-line
    /// gray text so the user can't miss why their submit was
    /// rejected. The copy maps known backend codes to localized
    /// friendly strings; unknown codes fall back to whatever message
    /// the server returned.
    private var serverErrorBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("!")
                .font(.system(size: 16, weight: .black))
                .foregroundColor(.arenaDanger)
                .frame(width: 22, height: 22)
                .background(HudCornerCutShape(cut: 4).fill(Color.arenaDanger.opacity(0.15)))
                .overlay(HudCornerCutShape(cut: 4).stroke(Color.arenaDanger.opacity(0.6), lineWidth: 1))
                .clipShape(HudCornerCutShape(cut: 4))
            Text(friendlyError)
                .font(ArenaFont.body(size: 13))
                .foregroundColor(.arenaText)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(HudCornerCutShape(cut: 6).fill(Color.arenaDanger.opacity(0.08)))
        .overlay(HudCornerCutShape(cut: 6).stroke(Color.arenaDanger.opacity(0.45), lineWidth: 1))
        .clipShape(HudCornerCutShape(cut: 6))
    }

    /// Map a stable backend `code` to a localized friendly message.
    /// Falls back to the raw backend message when the code isn't
    /// recognized (covers future backend additions without forcing
    /// an iOS update).
    private var friendlyError: String {
        switch auth.errorCode {
        case "EMAIL_EXISTS":
            return String(localized: "An account with this email already exists. Try signing in instead.")
        case "USERNAME_TAKEN":
            return String(localized: "That username is already taken. Pick another one.")
        case "INVALID_EMAIL":
            return String(localized: "That doesn't look like a valid email address.")
        case "WEAK_PASSWORD":
            return String(localized: "Password must be at least 6 characters.")
        case "INVALID_USERNAME":
            return String(localized: "Username must be 3–20 chars: letters, numbers, dot or underscore.")
        case "NAME_TOO_SHORT":
            return String(localized: "Name must be at least 2 characters.")
        case "INVALID_DOB":
            return String(localized: "Please pick a valid date of birth.")
        case "UNDERAGE":
            return String(localized: "You must be 18 or older to sign up.")
        case "SERVER_ERROR":
            return String(localized: "Couldn't create your account. Please try again in a moment.")
        default:
            return auth.errorMessage ?? String(localized: "Could not create your account.")
        }
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
