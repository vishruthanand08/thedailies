#if os(iOS) // the Mac app shows the website instead (MacRootView)
import Foundation
import Observation

/// Data behind the native Friends tab: my friends and requests, People you may know, and the
/// circle's leaderboards (the website's Friends.jsx and Leaderboards.jsx).
@MainActor
@Observable
final class FriendsModel {
    static let shared = FriendsModel()

    enum Range: String, CaseIterable, Identifiable {
        case all, month, week
        var id: String { rawValue }
        var days: Int? { switch self { case .all: nil; case .month: 30; case .week: 7 } }
        var label: String { switch self { case .all: "All time"; case .month: "30 days"; case .week: "7 days" } }
    }

    enum Sort: String, CaseIterable, Identifiable {
        case points, crowns, wins, played, streak
        var id: String { rawValue }
        var label: String {
            switch self {
            case .points: "Points"
            case .crowns: "Crowns"
            case .wins: "Wins"
            case .played: "Played"
            case .streak: "Streak"
            }
        }
    }

    /// What happened to a suggestion I acted on.
    enum Asked: Equatable { case sent, friends, failed(String) }

    private(set) var list: FriendList?
    private(set) var error: String?
    private(set) var suggestions: [Suggestion] = []
    /// A friend just added: their friends come up first, to keep going.
    private(set) var justAdded: FriendList.Person?
    private(set) var asked: [Int: Asked] = [:]
    private(set) var stats: Stats?
    private(set) var statsError: String?

    var range: Range = .all { didSet { if range != oldValue { Task { await loadStats() } } } }
    /// "all", or one category's standings.
    var scope = "all"
    var sort: Sort = .points
    /// The game picked for the per-game board (nil: the busiest one).
    var gameId: String?

    var me: String? { AppSession.shared.username }

    func load() async {
        do {
            list = try await DailiesAPI.shared.friends()
            error = nil
        } catch let e as DailiesError {
            error = e.message
        } catch {}
        await loadSuggestions()
        if TodayModel.shared.games.isEmpty { await TodayModel.shared.load() } // game names and tiles
        await loadStats()
    }

    func loadSuggestions() async {
        suggestions = (try? await DailiesAPI.shared.suggestions(via: justAdded?.id)) ?? []
    }

    func loadStats() async {
        guard !(list?.friends.isEmpty ?? true) else { stats = nil; return }
        do {
            stats = try await DailiesAPI.shared.stats(days: range.days)
            statsError = nil
        } catch let e as DailiesError {
            statsError = e.message
        } catch {}
    }

    /// The message to show under the field (nil when it went through).
    func add(username: String, share: String? = nil) async -> (ok: Bool, message: String) {
        let name = username.trimmingCharacters(in: .whitespaces).lowercased()
        guard !name.isEmpty else { return (false, "") }
        do {
            let r = try await DailiesAPI.shared.requestFriend(username: name, share: share)
            if r.accepted { justAdded = r.user }
            await load()
            return (true, r.accepted ? "You and \(r.user.username) are now friends" : "Request sent to \(r.user.username)")
        } catch let e as DailiesError {
            return (false, e.message)
        } catch {
            return (false, "Something went wrong. Try again.")
        }
    }

    func respond(_ person: FriendList.Person, accept: Bool) async {
        do {
            try await DailiesAPI.shared.respondToFriend(userId: person.id, accept: accept)
            if accept { justAdded = person }
            await load()
        } catch let e as DailiesError {
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    func remove(_ person: FriendList.Person) async {
        do {
            try await DailiesAPI.shared.removeFriend(userId: person.id)
            if justAdded == person { justAdded = nil }
            await load()
        } catch let e as DailiesError {
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    func ask(_ s: Suggestion) async {
        do {
            let r = try await DailiesAPI.shared.requestFriend(username: s.username)
            asked[s.id] = r.accepted ? .friends : .sent
            if r.accepted {
                list = try? await DailiesAPI.shared.friends()
                await loadStats()
            }
        } catch let e as DailiesError {
            asked[s.id] = .failed(e.message)
        } catch {}
    }

    func hide(_ s: Suggestion) {
        suggestions.removeAll { $0.id == s.id }
        Task { try? await DailiesAPI.shared.dismissSuggestion(userId: s.id) }
    }

    /// Back to everyone's suggestions after the ones from a friend just added.
    func showAllSuggestions() async {
        justAdded = nil
        await loadSuggestions()
    }

    func signedOut() {
        list = nil
        stats = nil
        suggestions = []
        justAdded = nil
        asked = [:]
    }

    // MARK: leaderboards

    /// Overall or one category's standings, in the chosen order.
    var standings: [Stats.Player] {
        guard let stats else { return [] }
        let rows = scope == "all" ? stats.overall : stats.categories?[scope] ?? []
        guard sort != .points else { return rows }
        return rows.sorted { a, b in
            let x = value(a), y = value(b)
            if x != y { return x > y }
            if a.points != b.points { return a.points > b.points }
            return a.played < b.played
        }
    }

    func value(_ p: Stats.Player) -> Int {
        switch sort {
        case .points: p.points
        case .crowns: p.crowns
        case .wins: p.wins
        case .played: p.played
        case .streak: p.streak
        }
    }

    /// The games with scores in this range (and scope), busiest first.
    var gameBoards: [Stats.GameBoard] {
        let games = TodayModel.shared.games
        return (stats?.games ?? [])
            .filter { b in scope == "all" || games.first { $0.id == b.gameId }?.category == scope }
            .sorted { $0.entries.reduce(0) { $0 + $1.played } > $1.entries.reduce(0) { $0 + $1.played } }
    }

    var gameBoard: Stats.GameBoard? {
        gameBoards.first { $0.gameId == gameId } ?? gameBoards.first
    }

    var scopeName: String {
        scope == "all" ? "Overall" : TodayModel.shared.categories.first { $0.id == scope }?.name ?? "Overall"
    }

    /// The invite link: opening it and signing in sends me a friend request.
    var inviteURL: URL? {
        guard let me else { return nil }
        // always the www address: the bare domain forwards to it and drops ?add=
        return URL(string: Server.current.baseURL.absoluteString + "/?add=\(me)")
    }
}
#endif
