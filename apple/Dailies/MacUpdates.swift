#if os(macOS)
import AppKit
import Observation
#if DIRECT_DOWNLOAD
import Sparkle
#endif

/// Updates for the Mac app.
/// - Downloaded from the website (the DailiesDirect target, DIRECT_DOWNLOAD): Sparkle reads
///   thedailies.lol/appcast.xml (server/release.js) every few hours, downloads a new version in
///   the background and installs it when the app quits. Check for Updates… asks right away.
/// - App Store and TestFlight copies (they carry a receipt): Apple updates them, and they never
///   offer an update of their own.
/// - Anything else (the Dailies target run from Xcode): the older check against /api/app/mac, and
///   a card that offers the download. Copies from before Sparkle (builds 1–4) use the same check,
///   which is how they reach a Sparkle build once by hand.
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

    /// A newer build than this one, once the server reports it (not with Sparkle, which has its own).
    private(set) var available: Release?
    @ObservationIgnored private var checking: Task<Void, Never>?
    #if DIRECT_DOWNLOAD
    @ObservationIgnored private let sparkle = SPUStandardUpdaterController(
        startingUpdater: false, updaterDelegate: SparkleFeed.shared, userDriverDelegate: nil)
    #endif

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
        #if DIRECT_DOWNLOAD
        sparkle.startUpdater()
        #else
        guard !fromAppStore, checking == nil else { return }
        checking = Task { [weak self] in
            while !Task.isCancelled {
                await self?.check()
                try? await Task.sleep(for: .seconds(6 * 60 * 60))
            }
        }
        #endif
    }

    /// App menu › Check for Updates…: says so either way.
    func checkNow() {
        #if DIRECT_DOWNLOAD
        sparkle.checkForUpdates(nil)
        #else
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
        #endif
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

#if DIRECT_DOWNLOAD
/// Debug builds can read another feed, to try an update against the local server:
/// `defaults write lol.thedailies.app dailiesFeedURL http://localhost:3001/appcast.xml`.
final class SparkleFeed: NSObject, SPUUpdaterDelegate {
    static let shared = SparkleFeed()

    func feedURLString(for updater: SPUUpdater) -> String? {
        #if DEBUG
        UserDefaults.standard.string(forKey: "dailiesFeedURL")
        #else
        nil
        #endif
    }
}
#endif
#endif
