import Foundation
import Observation
#if os(iOS)
import UIKit
#endif
import WebKit

/// Who is signed in to the native app. The device token in the keychain is the source of truth;
/// the web tabs (still web until they're rebuilt natively) share the session through its cookie.
@MainActor
@Observable
final class AppSession {
    static let shared = AppSession()

    enum State: Equatable { case signedOut, signedIn(String) }
    private(set) var state: State

    private init() {
        if let stored = Keychain.load(), stored.server == Server.current.rawValue {
            state = .signedIn(stored.username)
        } else {
            state = .signedOut
        }
    }

    var username: String? {
        if case .signedIn(let name) = state { return name }
        return nil
    }

    /// Re-checks the stored token at launch (it may have been revoked from another device).
    func verify() async {
        guard username != nil else { return }
        do {
            _ = try await DailiesAPI.shared.me()
        } catch DailiesError.notSignedIn {
            signOut()
        } catch {
            // offline: stay signed in and try again next launch
        }
    }

    func signIn(username: String, password: String, register: Bool) async throws {
        let result = try await DailiesAPI.shared.authenticate(
            username: username, password: password, register: register,
            deviceName: Self.deviceName)
        if let old = Keychain.load() { await DailiesAPI.shared.revoke(old) }
        guard Keychain.save(result.token) else {
            throw DailiesError.server("Couldn't save your sign-in on this device.")
        }
        if let cookie = result.cookie {
            await WKWebsiteDataStore.default().httpCookieStore.setCookie(cookie)
        }
        state = .signedIn(result.token.username)
        WebController.shared.load()
        await SubmissionQueue.shared.flush()
    }

    private static var deviceName: String {
        #if os(iOS)
        String(UIDevice.current.name.prefix(40))
        #else
        String((Host.current().localizedName ?? "Mac").prefix(40))
        #endif
    }

    func signOut() {
        if let old = Keychain.load() {
            Keychain.clear()
            Task {
                await Push.shared.signOut(using: old) // while the old token still works
                await DailiesAPI.shared.revoke(old)
            }
        }
        state = .signedOut
        Task {
            let store = WKWebsiteDataStore.default().httpCookieStore
            for cookie in await store.allCookies() where cookie.name == "db_token" {
                await store.deleteCookie(cookie)
            }
            WebController.shared.load()
        }
    }

    /// The web tabs signed out (Log out or Delete account on the web You tab).
    func webSignedOut() {
        guard username != nil else { return }
        Keychain.clear()
        state = .signedOut
    }
}
