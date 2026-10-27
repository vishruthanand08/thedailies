import Foundation

/// Turns what a game hands the share sheet into the text the server parses. Games differ:
/// some pass plain text, some only `attributedContentText`, some text plus a separate URL.
enum ShareInput {
    static let maxLength = 4000

    static func combine(texts: [String], urls: [URL]) -> String {
        var parts: [String] = []
        for t in texts {
            let s = t.trimmingCharacters(in: .whitespacesAndNewlines)
            // the same text often arrives twice (attributedContentText and a plain-text attachment)
            if !s.isEmpty, !parts.contains(s) { parts.append(s) }
        }
        let joined = parts.joined(separator: "\n")
        for url in urls where !joined.contains(url.absoluteString) {
            parts.append(url.absoluteString)
        }
        return String(parts.joined(separator: "\n").prefix(maxLength))
    }
}
