//
//  APIClient.swift
//  futpoolsapp
//

import Foundation

enum APIError: Error {
    case invalidURL
    case noData
    case decoding(Error)
    case server(String)
    case status(Int)
}

final class APIClient {
    static let shared = APIClient()
    private let baseURL: String
    private let session: URLSession

    init(baseURL: String = "http://localhost:3000", session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func request<T: Decodable>(
        method: String = "GET",
        path: String,
        body: Encodable? = nil,
        token: String? = nil
    ) async throws -> T {
        print("[API] Request \(method) \(path)")
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.noData }
        if http.statusCode >= 400 {
            let msg = String(data: data, encoding: .utf8) ?? ""
            print("[API] Error \(http.statusCode) \(method) \(path) — \(msg.prefix(300))")
            throw APIError.server(msg)
        }
        print("[API] Response \(http.statusCode) \(method) \(path)")
        let decoder = JSONDecoder()
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            print("[API] Decode error \(method) \(path): \(error)")
            if let raw = String(data: data, encoding: .utf8) {
                print("[API] Raw response (first 500 chars): \(raw.prefix(500))")
            }
            throw APIError.decoding(error)
        }
    }

    func requestVoid(
        method: String = "GET",
        path: String,
        body: Encodable? = nil,
        token: String? = nil
    ) async throws {
        let _: EmptyResponse? = try await request(method: method, path: path, body: body, token: token) as EmptyResponse?
    }

    struct EmptyResponse: Decodable {}
}
