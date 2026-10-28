import Foundation
import WebKit

/// The games on the board. Play opens them in the in-app game browser, which works the same
/// for every game: play, tap the game's Share or Copy, then Paste in the bar at the bottom.
/// Nothing is injected into the game pages.
enum GameHosts {
    /// Base domains; subdomains (www., login pages) count too.
    static let all: Set<String> = [
        "worldle.teuteuf.fr", "globle-game.com", "travle.earth", "minutecryptic.com", "costcodle.com",
        "fermi.gg", "maptap.gg", "krillion.io", "hbd.gg", "geoguessr.com", "nytimes.com", "linkedin.com",
        "timeguessr.com", "worldguessr.com", "chainle.io", "perceptle.com", "poeltl.nbpa.com",
        "sports-reference.com", "dailytens.com",
    ]

    /// Hosts of the server's games (GET /api/submissions/games), so a game added to the server
    /// later opens in the game browser without an app update.
    @MainActor private static var fromServer: Set<String> = []

    @MainActor static func learn(_ games: [Game]) {
        fromServer.formUnion(games.compactMap { $0.playURL?.host.map(base) })
    }

    /// A game the site's own Play asked for (WebController's `open` message): the site only
    /// sends games on the board, so it counts as one. The Mac shows the site's Today, not the
    /// native one that calls `learn`.
    @MainActor static func trust(_ url: URL) {
        if let host = url.host { fromServer.insert(base(host)) }
    }

    private static func base(_ host: String) -> String {
        let host = host.lowercased()
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    /// Title for the game browser when a link arrives without the web app's game name
    /// (e.g. the live site's plain Play links).
    static func name(for url: URL) -> String {
        let host = url.host ?? ""
        let path = url.path.lowercased()
        let byPath: [(String, String)] = [
            ("wordle", "Wordle"), ("connections", "Connections"), ("strands", "Strands"), ("mini", "The Mini"), ("queens", "Queens"),
            ("tango", "Tango"), ("zip", "Zip"), ("pinpoint", "Pinpoint"), ("crossclimb", "Crossclimb"),
            ("wend", "Wend"), ("mini-sudoku", "Mini Sudoku"), ("patches", "Patches"),
        ]
        if host.hasSuffix("nytimes.com") || host.hasSuffix("linkedin.com") {
            // longest match first so "mini-sudoku" wins over "mini"
            for (key, name) in byPath.sorted(by: { $0.0.count > $1.0.count }) where path.contains(key) { return name }
        }
        let byHost: [String: String] = [
            "worldle.teuteuf.fr": "Worldle", "globle-game.com": "Globle", "travle.earth": "Travle",
            "minutecryptic.com": "Minute Cryptic", "timeguessr.com": "TimeGuessr", "worldguessr.com": "WorldGuessr", "costcodle.com": "Costcodle", "fermi.gg": "Fermi",
            "maptap.gg": "MapTap", "krillion.io": "Krillion", "hbd.gg": "EthnoGuessr", "geoguessr.com": "GeoGuessr",
            "chainle.io": "Chainle", "perceptle.com": "Perceptle", "poeltl.nbpa.com": "Poeltl",
            "sports-reference.com": "Immaculate Grid", "dailytens.com": "Daily Tens",
        ]
        return byHost.first { host == $0.key || host.hasSuffix("." + $0.key) }?.value ?? host
    }

    /// Exact host or a subdomain of a game's host (e.g. a game's login page).
    @MainActor static func isGame(_ host: String?) -> Bool {
        guard let host = host?.lowercased(), !host.isEmpty else { return false }
        return all.union(fromServer).contains { host == $0 || host.hasSuffix("." + $0) }
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
}

/// What to open in the game browser. Codable/Hashable so macOS can open it in its own window.
struct GameLaunch: Codable, Hashable, Identifiable {
    var url: URL
    var name: String
    /// The game's tile, for the Mac game panel's header (sent by the site with Play).
    var emoji: String? = nil
    var color: String? = nil
    var id: URL { url }
}
