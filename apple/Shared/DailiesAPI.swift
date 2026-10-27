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

// MARK: models for the native screens (shapes match server/submissions.js and server/prefs.js)

struct Game: Decodable, Identifiable, Hashable {
    struct Paid: Decodable, Hashable {
        struct Deal: Decodable, Hashable {
            let label: String
            let url: String?
        }
        let what: String
        let deals: [Deal]
    }
    let id: String
    let category: String?
    let name: String
    let emoji: String
    let color: String
    let url: String
    let metricLabel: String
    let better: String
    let manual: Bool?
    let note: String?
    let paid: Paid?

    var playURL: URL? { URL(string: url) }
    var acceptsManual: Bool { manual ?? false }
}

/// A group of games on Today (NYT, LinkedIn, Geography, ...), each with its own crown.
struct GameCategory: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let symbol: String
}

/// How points are worked out: each game's results worth 100, 50 and 0 points, in words.
struct ScoringTable: Decodable {
    struct Row: Decodable, Identifiable {
        let id: String
        let name: String
        let emoji: String
        let category: String
        let perfect: String
        let par: String
        let zero: String
    }
    let games: [Row]
    let categories: [GameCategory]
}

struct BoardEntry: Decodable, Identifiable, Hashable {
    let userId: Int
    let username: String
    let display: String
    let rank: Int
    let points: Int
    let verified: Bool
    let submissionId: Int
    var id: Int { submissionId }
}

struct Board: Decodable {
    struct GameBoard: Decodable {
        let gameId: String
        let entries: [BoardEntry]
    }
    struct CrownEntry: Decodable, Identifiable, Hashable {
        let userId: Int
        let username: String
        let points: Int
        let games: Int
        /// Shared when points and games are both tied (older servers don't send it).
        let rank: Int?
        var id: Int { userId }
    }
    let date: String
    let today: String
    let boards: [GameBoard]
    let crown: [CrownEntry]
    /// Each category's crown from just its games (only categories someone played).
    let categoryCrowns: [String: [CrownEntry]]?
    let circleSize: Int
}

struct Prefs: Codable, Equatable {
    var order: [String] = []
    var favorites: [String] = []
    var categoryOrder: [String] = []
    /// Collapsed groups: category ids, or "favorites".
    var collapsed: [String] = []

    init() {}

    // an older server sends only order and favorites
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        order = try c.decodeIfPresent([String].self, forKey: .order) ?? []
        favorites = try c.decodeIfPresent([String].self, forKey: .favorites) ?? []
        categoryOrder = try c.decodeIfPresent([String].self, forKey: .categoryOrder) ?? []
        collapsed = try c.decodeIfPresent([String].self, forKey: .collapsed) ?? []
    }
}

/// The feed: one card per player per day (server/feed.js).
struct Feed: Decodable {
    struct Kudos: Decodable, Hashable {
        struct Giver: Decodable, Hashable { let userId: Int; let username: String }
        var count: Int
        var givers: [Giver]
        var mine: Bool
    }
    struct Played: Decodable, Identifiable, Hashable {
        let submissionId: Int
        let gameId: String
        let gameName: String
        let emoji: String
        let color: String
        let display: String
        let points: Int
        let verified: Bool
        let pb: Bool
        let createdAt: String
        /// The pasted share text (nil for typed-in scores).
        let rawText: String?
        var id: Int { submissionId }
    }
    struct Card: Decodable, Identifiable, Hashable {
        let userId: Int
        let username: String
        let date: String
        let points: Int
        let streak: Int
        let lastActivity: String
        /// The player chose their highlight (otherwise it's their top-points game).
        let picked: Bool
        let highlightId: Int
        /// The highlight first, then the rest by points.
        let games: [Played]
        var kudos: Kudos
        var id: String { "\(userId)-\(date)" }
    }
    struct Highlight: Decodable, Identifiable, Hashable {
        let userId: Int
        let username: String
        let date: String
        let gameName: String
        let emoji: String
        let display: String
        let pb: Bool
        var id: Int { userId }
        var cardId: String { "\(userId)-\(date)" }
    }
    struct Notice: Decodable, Hashable {
        let date: String
        let usernames: [String]
    }
    let today: String
    var cards: [Card]
    let highlights: [Highlight]
    /// Friends with nothing posted today (older servers don't send it).
    let waiting: [String]?
    let notices: [Notice]
    var nextBefore: String?
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
    private struct GamesBody: Decodable { let games: [Game]; let categories: [GameCategory]? }
    private struct TokenBody: Decodable { let token: String; let id: Int? }

    func submit(text: String) async throws -> SubmissionResult {
        let data = try await send("/api/submissions", method: "POST", json: ["text": text])
        return try decode(SubmissionBody.self, data).submission
    }

    func me() async throws -> User {
        try decode(MeBody.self, try await send("/api/auth/me")).user
    }

    func games() async throws -> (games: [Game], categories: [GameCategory]) {
        let body = try decode(GamesBody.self, try await send("/api/submissions/games"))
        return (body.games, body.categories ?? [])
    }

    func scoring() async throws -> ScoringTable {
        try decode(ScoringTable.self, try await send("/api/submissions/scoring"))
    }

    func board(date: String?) async throws -> Board {
        try decode(Board.self, try await send("/api/submissions/board" + (date.map { "?date=\($0)" } ?? "")))
    }

    func prefs() async throws -> Prefs {
        try decode(Prefs.self, try await send("/api/prefs"))
    }

    @discardableResult
    func savePrefs(
        order: [String]? = nil, favorites: [String]? = nil, categoryOrder: [String]? = nil, collapsed: [String]? = nil
    ) async throws -> Prefs {
        var body: [String: Any] = [:]
        if let order { body["order"] = order }
        if let favorites { body["favorites"] = favorites }
        if let categoryOrder { body["categoryOrder"] = categoryOrder }
        if let collapsed { body["collapsed"] = collapsed }
        return try decode(Prefs.self, try await send("/api/prefs", method: "PUT", json: body))
    }

    func submitManual(gameId: String, value: Double) async throws -> SubmissionResult {
        let data = try await send("/api/submissions", method: "POST", json: ["gameId": gameId, "value": value])
        return try decode(SubmissionBody.self, data).submission
    }

    func feed(before: String? = nil) async throws -> Feed {
        try decode(Feed.self, try await send("/api/feed" + (before.map { "?before=\($0)" } ?? "")))
    }

    func unseenKudos() async throws -> Int {
        struct Body: Decodable { let count: Int }
        return try decode(Body.self, try await send("/api/feed/unseen")).count
    }

    func markKudosSeen() async throws {
        _ = try await send("/api/feed/seen", method: "POST")
    }

    func kudos(userId: Int, date: String, give: Bool) async throws {
        _ = try await send("/api/feed/kudos", method: give ? "POST" : "DELETE", json: ["userId": userId, "date": date])
    }

    /// One of today's scores as my highlight, or nil to go back to my top-points game.
    func setHighlight(submissionId: Int?) async throws {
        if let submissionId {
            _ = try await send("/api/feed/highlight", method: "PUT", json: ["submissionId": submissionId])
        } else {
            _ = try await send("/api/feed/highlight", method: "DELETE")
        }
    }

    func deleteSubmission(id: Int) async throws {
        _ = try await send("/api/submissions/\(id)", method: "DELETE")
    }

    /// Native sign-in or sign-up. The site answers with its session cookie; that cookie mints a
    /// device token (kept in the keychain) and is handed back so the web tabs share the session.
    func authenticate(username: String, password: String, register: Bool, deviceName: String)
        async throws -> (token: StoredToken, cookie: HTTPCookie?) {
        let server = Server.current
        let url = server.baseURL.appending(path: register ? "/api/auth/register" : "/api/auth/login")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["username": username, "password": password])
        let (data, response) = try await perform(req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw DailiesError.rejected(message ?? "Couldn't sign in.")
        }
        let user = try decode(MeBody.self, data).user
        let headers = ((response as? HTTPURLResponse)?.allHeaderFields as? [String: String]) ?? [:]
        guard let cookie = HTTPCookie.cookies(withResponseHeaderFields: headers, for: url).first(where: { $0.name == "db_token" }) else {
            throw DailiesError.server("Signed in, but the server didn't start a session.")
        }

        var tokenReq = URLRequest(url: server.baseURL.appending(path: "/api/auth/tokens"))
        tokenReq.httpMethod = "POST"
        tokenReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
        tokenReq.setValue("\(cookie.name)=\(cookie.value)", forHTTPHeaderField: "Cookie")
        tokenReq.httpBody = try JSONSerialization.data(withJSONObject: ["name": deviceName])
        let (tokenData, tokenResponse) = try await perform(tokenReq)
        guard (200..<300).contains((tokenResponse as? HTTPURLResponse)?.statusCode ?? 0) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: tokenData))?.error
            throw DailiesError.server(message ?? "Couldn't set up this device.")
        }
        let minted = try decode(TokenBody.self, tokenData)
        return (StoredToken(token: minted.token, tokenId: minted.id, username: user.username, server: server.rawValue), cookie)
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
        _ path: String, method: String = "GET", json: [String: Any]? = nil,
        token: String? = nil, server: Server = Server.current
    ) async throws -> Data {
        // appending(path:) would escape a "?", so a query string goes on separately
        let parts = path.split(separator: "?", maxSplits: 1).map(String.init)
        var url = server.baseURL.appending(path: parts[0])
        if parts.count == 2 { url = URL(string: url.absoluteString + "?" + parts[1]) ?? url }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(try token ?? currentToken())", forHTTPHeaderField: "Authorization")
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }

        let (data, response) = try await perform(req)
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

    private func perform(_ req: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: req)
        } catch {
            throw DailiesError.network("Couldn't reach The Dailies. Check your connection and try again.")
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
