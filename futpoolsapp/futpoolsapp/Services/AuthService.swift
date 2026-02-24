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

    func register(email: String, password: String, username: String, displayName: String) async {
        errorMessage = nil
        struct Body: Encodable {
            let email: String
            let password: String
            let username: String
            let displayName: String
        }
        do {
            let res: AuthResponse = try await client.request(
                method: "POST",
                path: "/auth/register",
                body: Body(email: email, password: password, username: username, displayName: displayName)
            )
            KeychainHelper.saveToken(res.token)
            currentUser = res.user
            isAuthenticated = true
        } catch {
            handleError(error)
        }
    }

    func login(email: String, password: String) async {
        errorMessage = nil
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

    func clearError() {
        errorMessage = nil
    }

    /// Submit IAP signed transaction to backend; on success refreshes user (balance updated).
    func rechargeBalance(signedTransaction: String) async throws {
        struct Body: Encodable { let signedTransaction: String }
        struct Response: Decodable { let balance: Double? }
        let _: Response = try await client.request(
            method: "POST",
            path: "/users/me/balance/recharge",
            body: Body(signedTransaction: signedTransaction),
            token: token
        )
        await fetchUser()
    }

    /// Request a password reset code for the given email. Returns true if the request succeeded (we always return success for privacy).
    func forgotPassword(email: String) async -> Bool {
        errorMessage = nil
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
        errorMessage = nil
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
        if case .server(let msg) = error as? APIError {
            if let data = msg.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let message = json["message"] as? String {
                    errorMessage = message
                    return
                }
                if let errors = json["errors"] as? [[String: Any]],
                   let first = errors.first,
                   let msg = first["msg"] as? String {
                    errorMessage = msg
                    return
                }
            }
            errorMessage = msg
            return
        }
        errorMessage = error.localizedDescription
    }
}
