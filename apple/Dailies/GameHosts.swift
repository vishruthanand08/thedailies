import Foundation
import WebKit

/// Which games may open in the in-app browser (Stage 4, Debug-gated, never in a submission).
/// GeoGuessr is never allowlisted: no share text, and its terms bar unauthorized clients.
enum GameHosts {
    static let indie: Set<String> = [
        "worldle.teuteuf.fr", "globle-game.com", "travle.earth", "www.minutecryptic.com", "minutecryptic.com",
        "costcodle.com", "fermi.gg", "maptap.gg", "krillion.io", "hbd.gg",
    ]
    static let experimental: Set<String> = ["www.nytimes.com", "nytimes.com", "www.linkedin.com", "linkedin.com"]

    /// Debug toggle (default off). Launch argument: -dailiesInAppGames YES
    static var inAppEnabled: Bool {
        get {
            #if DEBUG
            UserDefaults.standard.bool(forKey: "dailiesInAppGames")
            #else
            false
            #endif
        }
        set { UserDefaults.standard.set(newValue, forKey: "dailiesInAppGames") }
    }

    /// "Experimental: NYT and LinkedIn in-app (personal use only)". Launch argument: -dailiesExperimentalGames YES
    static var experimentalEnabled: Bool {
        get { inAppEnabled && UserDefaults.standard.bool(forKey: "dailiesExperimentalGames") }
        set { UserDefaults.standard.set(newValue, forKey: "dailiesExperimentalGames") }
    }

    static var active: Set<String> {
        experimentalEnabled ? indie.union(experimental) : indie
    }

    /// Exact host or a subdomain of an allowed host (e.g. a game's login or CDN-hosted page).
    static func isAllowed(_ host: String?, in hosts: Set<String> = active) -> Bool {
        guard let host, !host.isEmpty else { return false }
        return hosts.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    /// Cookies for game sites live apart from the Dailies session, in one persistent store,
    /// so a NYT or LinkedIn login survives between games and launches.
    @MainActor static let dataStore: WKWebsiteDataStore = {
        let key = "gameDataStoreID"
        let id = UserDefaults.standard.string(forKey: key).flatMap(UUID.init(uuidString:)) ?? {
            let new = UUID()
            UserDefaults.standard.set(new.uuidString, forKey: key)
            return new
        }()
        return WKWebsiteDataStore(forIdentifier: id)
    }()

    /// capture.js with the allowlist substituted for __HOSTS__.
    static func captureScript(hosts: [String]) -> String {
        guard let url = Bundle.main.url(forResource: "capture", withExtension: "js"),
              var source = try? String(contentsOf: url, encoding: .utf8),
              let json = try? JSONSerialization.data(withJSONObject: hosts),
              let list = String(data: json, encoding: .utf8) else {
            log.error("capture.js missing from the bundle")
            return ""
        }
        source = source.replacingOccurrences(of: "__HOSTS__", with: list)
        return source
    }
}

/// What to open in the game browser. Codable/Hashable so macOS can open it in its own window.
struct GameLaunch: Codable, Hashable, Identifiable {
    var url: URL
    var name: String
    var harness = false
    var id: URL { url }
}
