import Foundation
import os

enum AppGroup {
    static let id = "group.lol.thedailies"
    /// Shared between the app and the share extension (pending shares, server choice, flags).
    /// macOS has no extension, and a free (Personal Team) Mac profile doesn't grant the group,
    /// so the Mac app keeps these in its own defaults.
    static let defaults: UserDefaults = {
        #if os(macOS)
        .standard
        #else
        UserDefaults(suiteName: id) ?? .standard
        #endif
    }()
}

let log = Logger(subsystem: "lol.thedailies", category: "dailies")

enum Server: String, CaseIterable, Identifiable {
    case production
    case local

    var id: String { rawValue }

    var baseURL: URL {
        switch self {
        case .production: URL(string: "https://www.thedailies.lol")!
        case .local: URL(string: "http://localhost:5173")!
        }
    }

    /// Another address for the same server, for networks whose filters block the main one (a new
    /// .lol domain gets blocked by some school, office and home filters). The app signs in with a
    /// device token, not a cookie, so any address works. Links people see stay on baseURL.
    var fallbackURL: URL? {
        switch self {
        case .production: URL(string: "https://app-production-677e.up.railway.app")!
        case .local: nil
        }
    }

    var label: String {
        switch self {
        case .production: "thedailies.lol"
        case .local: "Local dev server (localhost:5173)"
        }
    }

    private static let key = "server"

    /// Release builds always talk to production. Debug builds can switch, and a
    /// `-dailiesServer local` launch argument overrides the saved choice.
    static var current: Server {
        get {
            #if DEBUG
            if let arg = UserDefaults.standard.string(forKey: "dailiesServer"), let s = Server(rawValue: arg) {
                return s
            }
            return AppGroup.defaults.string(forKey: key).flatMap(Server.init(rawValue:)) ?? .production
            #else
            return .production
            #endif
        }
        set {
            AppGroup.defaults.set(newValue.rawValue, forKey: key)
        }
    }
}
