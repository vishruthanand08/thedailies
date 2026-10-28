#if os(macOS)
import AppKit
import Observation

/// The Mac app downloaded from the website can't update through the App Store, so it asks the
/// server for the newest build (server/release.js) at launch and every few hours, and the sidebar
/// offers the download. App Store and TestFlight copies carry a receipt and leave updates to Apple.
@MainActor
@Observable
final class MacUpdates {
    static let shared = MacUpdates()

    struct Release: Decodable {
        let version: String
        let build: Int
        let url: URL
        let notes: String?
    }

    /// A newer build than this one, once the server reports it.
    private(set) var available: Release?
    @ObservationIgnored private var checking: Task<Void, Never>?

    /// App Store and TestFlight copies; Apple updates those, and they mustn't offer their own updates.
    var fromAppStore: Bool {
        guard let receipt = Bundle.main.appStoreReceiptURL else { return false }
        return FileManager.default.fileExists(atPath: receipt.path)
    }

    private var build: Int {
        Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0
    }

    var currentVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    func start() {
        guard !fromAppStore, checking == nil else { return }
        checking = Task { [weak self] in
            while !Task.isCancelled {
                await self?.check()
                try? await Task.sleep(for: .seconds(6 * 60 * 60))
            }
        }
    }

    /// App menu › Check for Updates…: says so either way.
    func checkNow() {
        Task {
            await check()
            let alert = NSAlert()
            if let available {
                alert.messageText = "The Dailies \(available.version) is available"
                alert.informativeText = available.notes ?? "You have \(currentVersion)."
                alert.addButton(withTitle: "Download")
                alert.addButton(withTitle: "Later")
                if alert.runModal() == .alertFirstButtonReturn { download() }
            } else {
                alert.messageText = "You’re up to date"
                alert.informativeText = "The Dailies \(currentVersion) is the newest version."
                alert.runModal()
            }
        }
    }

    func download() {
        guard let available else { return }
        NSWorkspace.shared.open(available.url)
    }

    private func check() async {
        let url = Server.current.baseURL.appending(path: "/api/app/mac")
        guard let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let latest = try? JSONDecoder().decode(Release.self, from: data) else { return }
        available = latest.build > build ? latest : nil
    }
}
#endif
