import Foundation
import os

enum AppGroup {
    static let id = "group.lol.thedailies"
    /// Shared between the app and the share extension (pending shares, server choice, flags).
    static let defaults = UserDefaults(suiteName: id) ?? .standard
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
