//
//  AuthService.swift
//  futpoolsapp
//

import Foundation
import Combine

@MainActor
final class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var errorMessage: String?
    /// Stable code from the backend (e.g. "EMAIL_EXISTS"). The UI
    /// uses this to localize the error and highlight the offending
    /// field. Cleared whenever a new auth call starts.
    @Published var errorCode: String?
    /// Field on the form the error refers to (e.g. "username").
    @Published var errorField: String?
    // simple_version: signup bonus flow removed (no coin economy). The
    // backend AuthResponse may still include signupBonus on master, but
    // the iOS UI no longer reads it.

    private let client = APIClient.shared

    init() {
        let token = KeychainHelper.getToken()
        isAuthenticated = token != nil
        if isAuthenticated {
            Task { await fetchUser() }
        }
    }

    var token: String? {
        KeychainHelper.getToken()
    }

    /// Backend computes `isAdmin` from its own ADMIN_EMAILS allowlist
    /// and ships it on the User payload, so we just trust that flag
    /// instead of duplicating the email list client-side. Backend
    /// re-checks on every admin route, so this is a UX gate only —
    /// not a security boundary.
    var isAdmin: Bool {
        currentUser?.isAdmin == true
    }

    func register(
        email: String,
        password: String,
        username: String,
        displayName: String,
        dob: Date,
        countryCode: String
    ) async {
        clearError()
        struct Body: Encodable {
            let email: String
            let password: String
            let username: String
            let displayName: String
            let dob: String       // ISO YYYY-MM-DD
            let countryCode: String
        }
        let dobIso: String = {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withFullDate]
            return f.string(from: dob)
        }()
        do {
            let res: AuthResponse = try await client.request(
                method: "POST",
                path: "/auth/register",
                body: Body(
                    email: email,
                    password: password,
                    username: username,
                    displayName: displayName,
                    dob: dobIso,
                    countryCode: countryCode
                )
            )
            KeychainHelper.saveToken(res.token)
            currentUser = res.user
            isAuthenticated = true
            await syncPendingOnboarding()
        } catch {
            handleError(error)
        }
    }

    func login(email: String, password: String) async {
        clearError()
        struct Body: Encodable {
            let email: String
            let password: String
        }
        do {
            let res: AuthResponse = try await client.request(
                method: "POST",
                path: "/auth/login",
                body: Body(email: email, password: password)
            )
            KeychainHelper.saveToken(res.token)
            currentUser = res.user
            isAuthenticated = true
            await fetchUser()
            await syncPendingOnboarding()
        } catch {
            handleError(error)
        }
    }

    func fetchUser() async {
        guard let t = token else { return }
        do {
            let user: User = try await client.request(method: "GET", path: "/users/me", token: t)
            currentUser = user
        } catch {
            logout()
        }
    }

    /// Push the answers captured during pre-signup onboarding (saved
    /// to UserDefaults by `OnboardingState.persist()`) up to the
    /// user's backend record. Best-effort — failure is silent so a
    /// transient network blip after signup doesn't trip up the user.
    /// Call after both register and login so the very first session
    /// after onboarding gets the data on the server side.
    func syncPendingOnboarding() async {
        guard let t = token else { return }
        let d = UserDefaults.standard
        let goals    = d.stringArray(forKey: "onboardingGoals") ?? []
        let pains    = d.stringArray(forKey: "onboardingPains") ?? []
        let popularLeagues = d.stringArray(forKey: "onboardingLeagues") ?? []
        let popularTeams   = d.stringArray(forKey: "onboardingTeams") ?? []
        // API-search-selected items get an "api:<id>" prefix so the
        // backend can disambiguate them from the curated enum rawValues
        // ("realMadrid", "ligaMX") that the popular-section taps emit.
        let customTeamIDs    = (d.array(forKey: "onboardingCustomTeamIDs")    as? [Int]) ?? []
        let customLeagueIDs  = (d.array(forKey: "onboardingCustomLeagueIDs")  as? [Int]) ?? []
        let teams   = popularTeams   + customTeamIDs.map   { "api:\($0)" }
        let leagues = popularLeagues + customLeagueIDs.map { "api:\($0)" }
        let picksData = d.data(forKey: "onboardingDemoPicks")
        struct PickPayload: Encodable {
            let fixtureId: Int
            let pick: String
        }
        struct Body: Encodable {
            let goals: [String]
            let pains: [String]
            let leagues: [String]
            let teams: [String]
            let demoPicks: [PickPayload]
        }
        struct PickStored: Decodable { let fixtureId: Int; let pick: String }
        let picks: [PickPayload] = {
            guard let data = picksData,
                  let stored = try? JSONDecoder().decode([PickStored].self, from: data) else { return [] }
            return stored.map { PickPayload(fixtureId: $0.fixtureId, pick: $0.pick) }
        }()
        // Skip the round-trip if the user signed up directly (never
        // ran the onboarding) — there's nothing to sync.
        guard !goals.isEmpty || !pains.isEmpty || !leagues.isEmpty || !teams.isEmpty || !picks.isEmpty else { return }
        struct Resp: Decodable { let ok: Bool }
        do {
            let _: Resp = try await client.request(
                method: "PUT",
                path: "/users/me/onboarding",
                body: Body(goals: goals, pains: pains, leagues: leagues, teams: teams, demoPicks: picks),
                token: t
            )
        } catch {
            // Silent — local state remains, can resync on next launch.
        }
    }

    func updateDisplayName(_ displayName: String) async {
        guard let t = token else { return }
        struct Body: Encodable {
            let displayName: String
        }
        do {
            let user: User = try await client.request(
                method: "PUT",
                path: "/users/me",
                body: Body(displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines)),
                token: t
            )
            currentUser = user
        } catch {
            handleError(error)
        }
    }

    func logout() {
        KeychainHelper.deleteToken()
        currentUser = nil
        isAuthenticated = false
    }

    // simple_version: rechargeBalance removed — no coin shop on iOS.
    // Stripe-paid pool entries happen on the web. iOS is read-only.

    /// Request a password reset code for the given email. Returns true if the request succeeded (we always return success for privacy).
    func forgotPassword(email: String) async -> Bool {
        clearError()
        struct Body: Encodable { let email: String }
        struct Response: Decodable { let message: String? }
        do {
            let _: Response = try await client.request(method: "POST", path: "/auth/forgot-password", body: Body(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()))
            return true
        } catch {
            handleError(error)
            return false
        }
    }

    /// Reset password with email + code from email. On success, signs the user in.
    func resetPassword(email: String, code: String, newPassword: String) async {
        clearError()
        struct Body: Encodable {
            let email: String
            let code: String
            let newPassword: String
        }
        do {
            let res: AuthResponse = try await client.request(
                method: "POST",
                path: "/auth/reset-password",
                body: Body(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), code: code.trimmingCharacters(in: .whitespacesAndNewlines), newPassword: newPassword)
            )
            KeychainHelper.saveToken(res.token)
            currentUser = res.user
            isAuthenticated = true
            await fetchUser()
        } catch {
            handleError(error)
        }
    }

    private func handleError(_ error: Error) {
        // Default — overridden below when we can extract structured
        // data from the server payload.
        errorMessage = error.localizedDescription
        errorCode = nil
        errorField = nil

        if case .server(let raw) = error as? APIError {
            errorMessage = raw  // safe fallback
            if let data = raw.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let m = json["message"] as? String { errorMessage = m }
                if let c = json["code"] as? String { errorCode = c }
                if let f = json["field"] as? String { errorField = f }
                // Legacy validator-array shape — pick the first error
                // and synthesize a code from its `path`.
                if errorCode == nil,
                   let errs = json["errors"] as? [[String: Any]],
                   let first = errs.first {
                    if let m = first["msg"] as? String { errorMessage = m }
                    if let path = first["path"] as? String {
                        errorField = path
                        errorCode = "INVALID_\(path.uppercased())"
                    }
                }
            }
        }
    }

    /// Clear all error state — used by Login/Register views when
    /// the user re-types in a field.
    func clearError() {
        errorMessage = nil
        errorCode = nil
        errorField = nil
    }
}
