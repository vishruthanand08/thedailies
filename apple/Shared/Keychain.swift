import Foundation
import Security

/// The device token the app got from the server, shared with the share extension.
struct StoredToken: Codable, Equatable {
    var token: String
    var tokenId: Int?
    var username: String
    var server: String
}

/// One generic-password item, `dailies.token`. Queries pass no kSecAttrAccessGroup, so the item
/// lands in the first `keychain-access-groups` entry (`<prefix>.lol.thedailies.shared`), which the
/// app and the share extension both list; that keeps the team prefix out of the code.
enum Keychain {
    private static let service = "lol.thedailies"
    private static let account = "dailies.token"

    private static var baseQuery: [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        #if os(macOS)
        q[kSecUseDataProtectionKeychain as String] = true
        #endif
        return q
    }

    static func load() -> StoredToken? {
        var q = baseQuery
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        let status = SecItemCopyMatching(q as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else {
            if status != errSecItemNotFound { log.error("keychain load failed: \(status)") }
            return nil
        }
        return try? JSONDecoder().decode(StoredToken.self, from: data)
    }

    @discardableResult
    static func save(_ token: StoredToken) -> Bool {
        guard let data = try? JSONEncoder().encode(token) else { return false }
        SecItemDelete(baseQuery as CFDictionary)
        var q = baseQuery
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(q as CFDictionary, nil)
        if status != errSecSuccess { log.error("keychain save failed: \(status)") }
        return status == errSecSuccess
    }

    static func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}
