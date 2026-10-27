import Foundation
import Observation

/// FIFO of share texts waiting to be submitted. Pending items persist in the App Group so a
/// share received while backgrounded or offline isn't lost; `flush()` runs after each enqueue
/// and whenever the app comes to the foreground.
@MainActor
@Observable
final class SubmissionQueue {
    static let shared = SubmissionQueue()

    private(set) var banner: Banner?
    /// Called after each successful save (the app reloads the board).
    @ObservationIgnored var onSaved: (() -> Void)?

    private struct Pending: Codable {
        let text: String
        let addedAt: Date
    }

    @ObservationIgnored private var pending: [Pending]
    @ObservationIgnored private var recent: [String: Date] = [:]
    @ObservationIgnored private var flushing = false
    private static let key = "pendingShares"
    private static let dedupeWindow: TimeInterval = 60

    private init() {
        let data = AppGroup.defaults.data(forKey: Self.key)
        pending = data.flatMap { try? JSONDecoder().decode([Pending].self, from: $0) } ?? []
    }

    func enqueue(_ raw: String) {
        let text = String(raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(4000))
        guard !text.isEmpty else { return }
        let now = Date()
        recent = recent.filter { now.timeIntervalSince($0.value) < Self.dedupeWindow }
        // games often call share and copy back to back with the same text
        guard recent[text] == nil else {
            log.info("dropping duplicate share within \(Self.dedupeWindow)s")
            return
        }
        recent[text] = now
        pending.append(Pending(text: text, addedAt: now))
        persist()
        Task { await flush() }
    }

    func flush() async {
        guard !flushing else { return }
        flushing = true
        defer { flushing = false }

        while let item = pending.first {
            do {
                let result = try await DailiesAPI.shared.submit(text: item.text)
                pending.removeFirst()
                persist()
                show(.ok, result.savedText)
                onSaved?()
            } catch let error as DailiesError {
                switch error {
                case .network, .notSignedIn, .server:
                    // keep it for the next flush (foreground, sign-in, connectivity)
                    show(.err, error.message)
                    return
                case .duplicate, .rejected:
                    pending.removeFirst()
                    persist()
                    show(.err, error.message)
                }
            } catch {
                pending.removeFirst()
                persist()
                show(.err, "Couldn't save that score.")
            }
        }
    }

    func show(_ kind: Banner.Kind, _ text: String) {
        banner = Banner(kind: kind, text: text)
    }

    func dismiss(_ b: Banner) {
        if banner?.id == b.id { banner = nil }
    }

    private func persist() {
        AppGroup.defaults.set(try? JSONEncoder().encode(pending), forKey: Self.key)
    }
}
