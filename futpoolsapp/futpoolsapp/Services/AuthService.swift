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

    func register(email: String, password: String, displayName: String?) async {
        errorMessage = nil
        struct Body: Encodable {
            let email: String
            let password: String
            let displayName: String?
        }
        do {
            let res: AuthResponse = try await client.request(
                method: "POST",
                path: "/auth/register",
                body: Body(email: email, password: password, displayName: displayName ?? "")
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
