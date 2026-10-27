import Foundation

struct SubmissionResult: Decodable, Equatable {
    let gameId: String
    let gameName: String
    let emoji: String
    let display: String
    let puzzleDate: String
    let verified: Bool

    /// Banner text, e.g. "🌀 Wend 0:15 saved ✓".
    var savedText: String { "\(emoji) \(gameName) \(display) saved ✓" }
}

struct User: Decodable, Equatable {
    let id: Int
    let username: String
}

enum DailiesError: Error, Equatable {
    case notSignedIn(String)
    case duplicate(String)
    case rejected(String)
    case server(String)
    case network(String)

    /// Server messages are written for users and shown verbatim.
    var message: String {
        switch self {
        case .notSignedIn(let m), .duplicate(let m), .rejected(let m), .server(let m), .network(let m): m
        }
    }
}

/// Native submissions go through URLSession with the device's bearer token, never through
/// a web view (JS is suspended when a view is offscreen or the app is backgrounded).
actor DailiesAPI {
    static let shared = DailiesAPI()

    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 15
        config.httpCookieStorage = nil // bearer only; the web view owns the cookie session
        return URLSession(configuration: config)
    }()

    private struct SubmissionBody: Decodable { let submission: SubmissionResult }
    private struct MeBody: Decodable { let user: User }
    private struct ErrorBody: Decodable { let error: String }

    func submit(text: String) async throws -> SubmissionResult {
        let data = try await send("/api/submissions", method: "POST", json: ["text": text])
        return try decode(SubmissionBody.self, data).submission
    }

    func me() async throws -> User {
        try decode(MeBody.self, try await send("/api/auth/me")).user
    }

    /// Best-effort revoke of a token that is being replaced or signed out.
    func revoke(_ stored: StoredToken) async {
        guard let id = stored.tokenId, let server = Server(rawValue: stored.server) else { return }
        _ = try? await send("/api/auth/tokens/\(id)", method: "DELETE", token: stored.token, server: server)
    }

    private func currentToken() throws -> String {
        guard let stored = Keychain.load(), stored.server == Server.current.rawValue else {
            throw DailiesError.notSignedIn("Open The Dailies and sign in first.")
        }
        return stored.token
    }

    private func send(
        _ path: String, method: String = "GET", json: [String: String]? = nil,
        token: String? = nil, server: Server = Server.current
    ) async throws -> Data {
        var req = URLRequest(url: server.baseURL.appending(path: path))
        req.httpMethod = method
        req.setValue("Bearer \(try token ?? currentToken())", forHTTPHeaderField: "Authorization")
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw DailiesError.network("Couldn't reach The Dailies. Check your connection and try again.")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if (200..<300).contains(status) { return data }

        let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
        switch status {
        case 401: throw DailiesError.notSignedIn(message ?? "Open The Dailies and sign in first.")
        case 409: throw DailiesError.duplicate(message ?? "That score is already saved.")
        case 400: throw DailiesError.rejected(message ?? "That share wasn't recognized.")
        default: throw DailiesError.server(message ?? "Something went wrong on our end (\(status)).")
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw DailiesError.server("Unexpected response from The Dailies.")
        }
    }
}
