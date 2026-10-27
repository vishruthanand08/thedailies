import Foundation
import Observation

/// Data behind the native Today tab: the day's board, the game list and the player's layout.
@MainActor
@Observable
final class TodayModel {
    static let shared = TodayModel()

    private(set) var games: [Game] = []
    private(set) var board: Board?
    private(set) var prefs = Prefs(order: [], favorites: [])
    private(set) var loading = false
    private(set) var error: String?
    /// The date being viewed; nil means the server's today.
    private(set) var date: String?
    /// Boards already seen or fetched ahead, so swiping to a neighbouring day is instant.
    @ObservationIgnored private var cache: [String: Board] = [:]

    var isToday: Bool { board.map { $0.date == $0.today } ?? true }
    var me: String? { AppSession.shared.username }

    // MARK: derived lists

    /// The player's order; games added since they last arranged go at the end (same rule as the site).
    var ordered: [Game] {
        let at = Dictionary(uniqueKeysWithValues: prefs.order.enumerated().map { ($1, $0) })
        return games.enumerated()
            .sorted { (at[$0.element.id] ?? prefs.order.count + $0.offset) < (at[$1.element.id] ?? prefs.order.count + $1.offset) }
            .map(\.element)
    }
    var favorites: [Game] { ordered.filter { prefs.favorites.contains($0.id) } }
    var others: [Game] { ordered.filter { !prefs.favorites.contains($0.id) } }

    func entries(for game: Game) -> [BoardEntry] {
        board?.boards.first { $0.gameId == game.id }?.entries ?? []
    }

    func myEntry(for game: Game) -> BoardEntry? {
        entries(for: game).first { $0.username == me }
    }

    // MARK: loading

    func load(date: String? = nil) async {
        loading = true
        defer { loading = false }
        do {
            if games.isEmpty { games = try await DailiesAPI.shared.games() }
            async let b = DailiesAPI.shared.board(date: date)
            async let p = DailiesAPI.shared.prefs()
            let (newBoard, newPrefs) = try await (b, p)
            board = newBoard
            prefs = newPrefs
            self.date = newBoard.date
            cache[newBoard.date] = newBoard
            error = nil
            prefetchNeighbours()
        } catch let e as DailiesError {
            error = e.message
            if case .notSignedIn = e { AppSession.shared.signOut() }
        } catch {
            self.error = "Couldn't load today's board."
        }
    }

    func reload() async { await load(date: date) }

    /// Shows the day `days` away: instantly from the cache when it's there (then refreshes it
    /// quietly), otherwise after loading it.
    func shiftDay(_ days: Int) async {
        guard let day = dateShifted(days) else { return }
        if let cached = cache[day] {
            board = cached
            date = day
            Task { await load(date: day) }
        } else {
            await load(date: day)
        }
    }

    private func dateShifted(_ days: Int) -> String? {
        guard let current = board?.date else { return nil }
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: current), let next = Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: d) else { return nil }
        return f.string(from: next)
    }

    private func prefetchNeighbours() {
        let days = [dateShifted(-1), isToday ? nil : dateShifted(1)].compactMap { $0 }
        for day in days where cache[day] == nil {
            Task {
                if let b = try? await DailiesAPI.shared.board(date: day) { cache[day] = b }
            }
        }
    }

    var title: String {
        guard let board else { return "Today" }
        if board.date == board.today { return "Today" }
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: board.date), let t = f.date(from: board.today) else { return board.date }
        if Calendar.current.dateComponents([.day], from: d, to: t).day == 1 { return "Yesterday" }
        let out = DateFormatter()
        out.timeZone = TimeZone(identifier: "UTC")
        out.dateFormat = "EEE, MMM d"
        return out.string(from: d)
    }

    // MARK: layout

    func toggleFavorite(_ game: Game) {
        var favs = prefs.favorites
        if let i = favs.firstIndex(of: game.id) { favs.remove(at: i) } else { favs.append(game.id) }
        prefs.favorites = favs
        Task { try? await DailiesAPI.shared.savePrefs(favorites: favs) }
    }

    /// Reorders within one section (favorites or the rest); the saved order is the two sections joined.
    func move(inFavorites: Bool, from: IndexSet, to: Int) {
        var favs = favorites.map(\.id)
        var rest = others.map(\.id)
        if inFavorites { favs.move(fromOffsets: from, toOffset: to) } else { rest.move(fromOffsets: from, toOffset: to) }
        prefs.order = favs + rest
        let order = prefs.order
        Task { try? await DailiesAPI.shared.savePrefs(order: order) }
    }

    // MARK: scores

    func submitManual(_ game: Game, value: Double) async -> String? {
        do {
            let result = try await DailiesAPI.shared.submitManual(gameId: game.id, value: value)
            SubmissionQueue.shared.show(.ok, result.savedText)
            await reload()
            return nil
        } catch let e as DailiesError {
            return e.message
        } catch {
            return "Couldn't save that score."
        }
    }

    func delete(_ entry: BoardEntry) async {
        do {
            try await DailiesAPI.shared.deleteSubmission(id: entry.submissionId)
            await reload()
        } catch let e as DailiesError {
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    func play(_ game: Game) {
        guard let url = game.playURL else { return }
        WebController.shared.open(url, name: game.name)
    }
}
