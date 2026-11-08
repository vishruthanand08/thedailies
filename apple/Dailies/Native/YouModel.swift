#if os(iOS) // the Mac app shows the website instead (MacRootView)
import Foundation
import Observation

/// Data behind the native You tab: my own stats over a range, game by game, and when I joined
/// (the website's Profile.jsx).
@MainActor
@Observable
final class YouModel {
    static let shared = YouModel()

    struct GameLine: Identifiable, Hashable {
        let game: Game
        let played: Int
        let wins: Int
        let best: String
        let average: String
        var id: String { game.id }
    }

    private(set) var stats: Stats?
    private(set) var error: String?
    private(set) var joined: Date?
    /// Email, Apple and password state (server/account.js).
    private(set) var recovery: DailiesAPI.Recovery?

    var range: FriendsModel.Range = .all { didSet { if range != oldValue { Task { await loadStats() } } } }

    var me: String? { AppSession.shared.username }

    func load() async {
        if TodayModel.shared.games.isEmpty { await TodayModel.shared.load() } // game names and tiles
        if joined == nil, let iso = try? await DailiesAPI.shared.profileCreatedAt() {
            joined = Self.isoTime.date(from: iso) ?? Self.isoTimePlain.date(from: iso)
        }
        await loadRecovery()
        await loadStats()
    }

    func loadRecovery() async {
        if let r = try? await DailiesAPI.shared.recovery() { recovery = r }
    }

    var hasPassword: Bool { recovery?.hasPassword != false }

    /// nil when it worked, otherwise the message to show.
    func addEmail(_ email: String) async -> String? {
        do {
            try await DailiesAPI.shared.addEmail(email.trimmingCharacters(in: .whitespaces).lowercased())
            await loadRecovery()
            return nil
        } catch let e as DailiesError {
            return e.message
        } catch {
            return "Something went wrong. Try again."
        }
    }

    func removeEmail() async {
        try? await DailiesAPI.shared.removeEmail()
        await loadRecovery()
    }

    func linkApple(identityToken: String, code: String?) async -> String? {
        do {
            try await DailiesAPI.shared.linkApple(identityToken: identityToken, code: code)
            await loadRecovery()
            return nil
        } catch let e as DailiesError {
            return e.message
        } catch {
            return "Something went wrong. Try again."
        }
    }

    func loadStats() async {
        do {
            stats = try await DailiesAPI.shared.stats(days: range.days)
            error = nil
        } catch let e as DailiesError {
            error = e.message
        } catch {}
    }

    /// My row in the standings (nil before my first score in this range).
    var mine: Stats.Player? { stats?.overall.first { $0.username == me } }

    /// The games I've played in this range, most played first.
    var games: [GameLine] {
        let all = TodayModel.shared.games
        return (stats?.games ?? []).compactMap { board in
            guard let e = board.entries.first(where: { $0.username == me }), e.played > 0,
                  let game = all.first(where: { $0.id == board.gameId }) else { return nil }
            return GameLine(game: game, played: e.played, wins: e.wins, best: e.bestDisplay, average: e.avgDisplay)
        }
        .sorted { $0.played != $1.played ? $0.played > $1.played : $0.wins > $1.wins }
    }

    var joinedText: String? {
        joined.map { "Playing since \($0.formatted(.dateTime.month(.wide).year()))" }
    }

    /// nil when it worked, otherwise the message to show.
    func changePassword(current: String, next: String) async -> String? {
        do {
            try await DailiesAPI.shared.changePassword(current: current, next: next)
            await loadRecovery()
            return nil
        } catch let e as DailiesError {
            return e.message
        } catch {
            return "Something went wrong. Try again."
        }
    }

    /// nil when the account is gone (and this device signed out), otherwise the message to show.
    /// `password` is the username for an account that signs in with Apple only.
    func deleteAccount(password: String) async -> String? {
        do {
            if hasPassword {
                try await DailiesAPI.shared.deleteAccount(password: password)
            } else {
                try await DailiesAPI.shared.deleteAccount(confirmUsername: password)
            }
            AppSession.shared.signOut()
            return nil
        } catch let e as DailiesError {
            return e.message
        } catch {
            return "Something went wrong. Try again."
        }
    }

    func signedOut() {
        recovery = nil
        stats = nil
        joined = nil
        error = nil
    }

    private static let isoTime: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoTimePlain = ISO8601DateFormatter()
}
#endif
