import Foundation
import Observation

/// Data behind the native Feed: one card per player per day, today's highlights, kudos, and the
/// count of kudos I haven't seen (the badge on the Feed tab).
@MainActor
@Observable
final class FeedModel {
    static let shared = FeedModel()

    private(set) var feed: Feed?
    private(set) var error: String?
    private(set) var loadingMore = false
    /// Kudos on my days I haven't seen yet.
    private(set) var unseen = 0
    /// Bumped on each kudos given, for haptics.
    private(set) var kudosTick = 0
    @ObservationIgnored private var polling: Task<Void, Never>?

    var me: String? { AppSession.shared.username }

    func load() async {
        do {
            let fresh = try await DailiesAPI.shared.feed()
            feed = fresh
            error = nil
            Push.shared.clearBadge() // the icon's kudos count
            if !fresh.notices.isEmpty {
                try? await DailiesAPI.shared.markKudosSeen()
                unseen = 0
            }
        } catch let e as DailiesError {
            error = e.message
        } catch {}
    }

    func loadMore() async {
        guard let before = feed?.nextBefore, !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        do {
            let page = try await DailiesAPI.shared.feed(before: before)
            feed?.cards += page.cards
            feed?.nextBefore = page.nextBefore
        } catch let e as DailiesError {
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    func refreshUnseen() async {
        if let n = try? await DailiesAPI.shared.unseenKudos() { unseen = n }
    }

    /// Checks for new kudos every minute while the app is open.
    func startPolling() {
        polling?.cancel()
        polling = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshUnseen()
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }

    func stopPolling() {
        polling?.cancel()
        polling = nil
    }

    func isMine(_ card: Feed.Card) -> Bool { card.username == me }

    /// Shows at once; put back if the server says no.
    func toggleKudos(_ card: Feed.Card) async {
        guard let i = feed?.cards.firstIndex(where: { $0.id == card.id }) else { return }
        let giving = !card.kudos.mine
        var k = card.kudos
        k.mine = giving
        k.count += giving ? 1 : -1
        if giving, let me {
            k.givers.append(.init(userId: -1, username: me))
        } else {
            k.givers.removeAll { $0.username == me }
        }
        feed?.cards[i].kudos = k
        if giving { kudosTick += 1 }
        do {
            try await DailiesAPI.shared.kudos(userId: card.userId, date: card.date, give: giving)
        } catch let e as DailiesError {
            if let j = feed?.cards.firstIndex(where: { $0.id == card.id }) { feed?.cards[j].kudos = card.kudos }
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    /// Tapping the current pick goes back to the automatic highlight (top points).
    func highlight(_ game: Feed.Played, on card: Feed.Card) async {
        do {
            let unpick = card.picked && game.submissionId == card.highlightId
            try await DailiesAPI.shared.setHighlight(submissionId: unpick ? nil : game.submissionId)
            await load()
        } catch let e as DailiesError {
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    func signedOut() {
        feed = nil
        unseen = 0
        stopPolling()
    }

    // MARK: words

    func dayLabel(_ date: String) -> String {
        guard let today = feed?.today else { return date }
        if date == today { return "Today" }
        if date == Self.shift(today, by: -1) { return "Yesterday" }
        guard let d = Self.isoDay.date(from: date) else { return date }
        return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    /// "alex", "alex and maya", "alex, maya and 2 more"
    static func names(_ list: [String]) -> String {
        if list.count <= 2 { return list.joined(separator: " and ") }
        return "\(list.prefix(2).joined(separator: ", ")) and \(list.count - 2) more"
    }

    static func ago(_ iso: String) -> String {
        guard let date = isoTime.date(from: iso) ?? isoTimePlain.date(from: iso) else { return "" }
        return date.formatted(.relative(presentation: .named, unitsStyle: .abbreviated))
    }

    private static func shift(_ date: String, by days: Int) -> String? {
        guard let d = isoDay.date(from: date),
              let shifted = Calendar.current.date(byAdding: .day, value: days, to: d) else { return nil }
        return isoDay.string(from: shifted)
    }

    private static let isoDay: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        // local midnight, so the formatted weekday is the puzzle's own day
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    private static let isoTime: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoTimePlain = ISO8601DateFormatter()
}
