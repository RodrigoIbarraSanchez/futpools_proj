//
//  MakeQuinielaViewModel.swift
//  futpoolsapp
//

import Foundation
import Combine

@MainActor
final class MakeQuinielaViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = APIClient.shared

    func reset() {
        errorMessage = nil
        isLoading = false
    }

    func submit(matchdayId: String, picks: [MatchPickPayload]) async -> Bool {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        let token = KeychainHelper.getToken()
        if token == nil {
            print("[Quiniela] ERROR: No hay token — el usuario no está autenticado")
            errorMessage = "Sesión expirada. Vuelve a iniciar sesión."
            return false
        }
        print("[Quiniela] Enviando POST /predictions — matchday: \(matchdayId), picks: \(picks.count)")
        do {
            let body = CreatePredictionRequest(matchday: matchdayId, matches: picks)
            let created: Prediction = try await client.request(
                method: "POST",
                path: "/predictions",
                body: body,
                token: token
            )
            print("[Quiniela] Respuesta OK — predicción id: \(created.id)")
            return true
        } catch {
            print("[Quiniela] Request falló: \(error)")
            if case .server(let msg) = error as? APIError {
                print("[Quiniela] Respuesta del servidor: \(msg.prefix(200))")
                if let data = msg.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    errorMessage = message
                    return false
                }
            }
            errorMessage = error.localizedDescription
            return false
        }
    }
}
