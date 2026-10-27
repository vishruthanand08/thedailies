import Foundation
import Observation

/// Data behind the native Today tab: the day's board, the game list and the player's layout.
@MainActor
@Observable
final class TodayModel {
    static let shared = TodayModel()

    private(set) var games: [Game] = []
    private(set) var categories: [GameCategory] = []
    private(set) var board: Board?
    private(set) var prefs = Prefs()
    /// Which standings the crown card shows: "all" or a category id.
    var crownScope = "all"
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
    /// Favorites in the order they were pinned (and rearranged to). They stay in their category
    /// too, so a favorite shows up in both places.
    var favorites: [Game] {
        let byId = Dictionary(uniqueKeysWithValues: games.map { ($0.id, $0) })
        return prefs.favorites.compactMap { byId[$0] }
    }

    /// A section on Today: Favorites, then each category in the player's order.
    struct Group: Identifiable {
        let id: String
        let title: String
        let symbol: String
        let games: [Game]
        let movable: Bool
    }

    var orderedCategories: [GameCategory] {
        let at = Dictionary(uniqueKeysWithValues: prefs.categoryOrder.enumerated().map { ($1, $0) })
        return categories.enumerated()
            .sorted { (at[$0.element.id] ?? 100 + $0.offset) < (at[$1.element.id] ?? 100 + $1.offset) }
            .map(\.element)
    }

    var groups: [Group] {
        var out = [Group(id: "favorites", title: "Favorites", symbol: "star.fill", games: favorites, movable: false)]
        for c in orderedCategories {
            out.append(Group(id: c.id, title: c.name, symbol: c.symbol,
                             games: ordered.filter { $0.category == c.id }, movable: true))
        }
        // games outside every known category (or a server that doesn't send categories yet)
        // still show up, in one group at the end
        let known = Set(categories.map(\.id))
        out.append(Group(id: "other", title: categories.isEmpty ? "Games" : "More Games", symbol: "square.grid.2x2.fill",
                         games: ordered.filter { !known.contains($0.category ?? "") }, movable: false))
        return out.filter { !$0.games.isEmpty }
    }

    func isCollapsed(_ group: Group) -> Bool { prefs.collapsed.contains(group.id) }

    var crown: [Board.CrownEntry] {
        guard let board else { return [] }
        return crownScope == "all" ? board.crown : board.categoryCrowns?[crownScope] ?? []
    }

    var crownScopeName: String {
        categories.first { $0.id == crownScope }?.name ?? "Overall"
    }

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
            if games.isEmpty { (games, categories) = try await DailiesAPI.shared.games() }
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

    /// Reorders games within one group. Favorites are ordered by the favorites list itself and
    /// categories by the game order (every category's games joined), so one never reshuffles the other.
    func move(in groupId: String, from: IndexSet, to: Int) {
        if groupId == "favorites" {
            var favs = favorites.map(\.id)
            favs.move(fromOffsets: from, toOffset: to)
            prefs.favorites = favs
            Task { try? await DailiesAPI.shared.savePrefs(favorites: favs) }
            return
        }
        var lists = groups.filter { $0.id != "favorites" }.map { ($0.id, $0.games.map(\.id)) }
        guard let i = lists.firstIndex(where: { $0.0 == groupId }) else { return }
        lists[i].1.move(fromOffsets: from, toOffset: to)
        prefs.order = lists.flatMap(\.1)
        let order = prefs.order
        Task { try? await DailiesAPI.shared.savePrefs(order: order) }
    }

    /// Puts game `id` where `target` is in the group (dragging one card onto another).
    func move(in groupId: String, id: String, onto target: String) {
        guard let games = groups.first(where: { $0.id == groupId })?.games,
              let from = games.firstIndex(where: { $0.id == id }),
              let to = games.firstIndex(where: { $0.id == target }), from != to else { return }
        move(in: groupId, from: IndexSet(integer: from), to: to > from ? to + 1 : to)
    }

    func toggleCollapsed(_ group: Group) {
        var collapsed = prefs.collapsed
        if let i = collapsed.firstIndex(of: group.id) { collapsed.remove(at: i) } else { collapsed.append(group.id) }
        prefs.collapsed = collapsed
        Task { try? await DailiesAPI.shared.savePrefs(collapsed: collapsed) }
    }

    /// Moves a category group one place up (-1) or down (1).
    func moveCategory(_ id: String, by step: Int) {
        var ids = orderedCategories.map(\.id)
        guard let i = ids.firstIndex(of: id), ids.indices.contains(i + step) else { return }
        ids.swapAt(i, i + step)
        prefs.categoryOrder = ids
        Task { try? await DailiesAPI.shared.savePrefs(categoryOrder: ids) }
    }

    /// Puts category `id` where `target` is (dragging one header onto another).
    func moveCategory(_ id: String, onto target: String) {
        var ids = orderedCategories.map(\.id)
        guard let from = ids.firstIndex(of: id), let to = ids.firstIndex(of: target), from != to else { return }
        ids.remove(at: from)
        ids.insert(id, at: to)
        prefs.categoryOrder = ids
        Task { try? await DailiesAPI.shared.savePrefs(categoryOrder: ids) }
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
