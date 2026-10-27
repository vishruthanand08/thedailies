import Observation
import WebKit
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Owns the one long-lived WKWebView showing the React site. Never recreated on view updates.
@MainActor
@Observable
final class WebController {
    static let shared = WebController()

    let webView: WKWebView
    private(set) var username: String?
    /// Play taps from the web app: the in-app game browser when allowed, else the system browser.
    @ObservationIgnored var presentGame: ((GameLaunch) -> Void)?

    @ObservationIgnored private let bridge = Bridge()
    @ObservationIgnored private var issuingToken = false

    private init() {
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "TheDailiesApp/1.0" // keeps the default UA, appends this
        config.websiteDataStore = .default() // login cookie persists across launches

        config.userContentController.add(bridge, contentWorld: .page, name: "dailies")
        Self.addFlagsScript(to: config.userContentController)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = bridge
        webView.uiDelegate = bridge
        #if DEBUG
        webView.isInspectable = true
        #endif
        #if os(iOS)
        let refresh = UIRefreshControl()
        refresh.addAction(UIAction { [weak webView, weak refresh] _ in
            webView?.reload()
            refresh?.endRefreshing()
        }, for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        #endif

        bridge.owner = self
        load()
    }

    /// The share extension (iOS) or the in-app game browser saves scores without pasting;
    /// the web app hides its paste bar then.
    private static var hasNativeCapture: Bool {
        #if os(iOS)
        true
        #else
        GameHosts.inAppEnabled
        #endif
    }

    private static func addFlagsScript(to controller: WKUserContentController) {
        controller.addUserScript(WKUserScript(
            source: "window.__dailiesNative = { capture: \(hasNativeCapture) };",
            injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
    }

    /// Re-injects the flags (after a Debug toggle changes them) and reloads the site.
    func refreshNativeFlags() {
        webView.configuration.userContentController.removeAllUserScripts()
        Self.addFlagsScript(to: webView.configuration.userContentController)
        webView.reload()
    }

    /// Routes a Play tap: in-app when the browser is on and the host is allowlisted, else Safari.
    func open(_ url: URL, name: String) {
        if GameHosts.inAppEnabled, GameHosts.isAllowed(url.host), let presentGame {
            presentGame(GameLaunch(url: url, name: name))
        } else {
            openExternally(url)
        }
    }

    func load() {
        webView.load(URLRequest(url: Server.current.baseURL))
    }

    func reload() {
        webView.reload()
    }

    /// Asks the Today view to reload the board (see `dailies:refresh` in web/src/Today.jsx).
    func reloadBoard() {
        webView.evaluateJavaScript("window.dispatchEvent(new Event('dailies:refresh'))")
    }

    // MARK: messages from the web app (web/src/native.js)

    fileprivate func handle(_ body: Any) {
        guard let msg = body as? [String: Any], let type = msg["type"] as? String else { return }
        switch type {
        case "session":
            handleSession(msg["user"] as? [String: Any])
        case "token":
            handleToken(msg)
        case "open":
            guard let s = msg["url"] as? String, let url = URL(string: s) else { return }
            open(url, name: msg["name"] as? String ?? url.host ?? "Game")
        default:
            log.debug("unknown message type \(type)")
        }
    }

    private func handleSession(_ user: [String: Any]?) {
        let server = Server.current.rawValue
        guard let name = user?["username"] as? String else {
            username = nil
            if let old = Keychain.load() {
                Keychain.clear()
                Task { await DailiesAPI.shared.revoke(old) }
                log.info("signed out; cleared device token")
            }
            return
        }
        username = name

        if let stored = Keychain.load(), stored.username == name, stored.server == server {
            // make sure the stored token still works (it may have been revoked from the Devices card)
            Task {
                do {
                    _ = try await DailiesAPI.shared.me()
                    await SubmissionQueue.shared.flush()
                } catch DailiesError.notSignedIn {
                    Keychain.clear()
                    issueToken()
                } catch {
                    log.error("token check failed: \(String(describing: error), privacy: .public)")
                }
            }
            return
        }
        if let old = Keychain.load() {
            Keychain.clear()
            Task { await DailiesAPI.shared.revoke(old) }
        }
        issueToken()
    }

    private func issueToken() {
        guard !issuingToken else { return }
        issuingToken = true
        log.info("requesting a device token from the web app")
        webView.callAsyncJavaScript(
            "await window.__dailies?.issueToken(name)",
            arguments: ["name": Self.deviceName], in: nil, in: .page
        ) { [weak self] result in
            if case .failure(let error) = result {
                log.error("issueToken call failed: \(error.localizedDescription, privacy: .public)")
                self?.issuingToken = false
            }
        }
    }

    private func handleToken(_ msg: [String: Any]) {
        issuingToken = false
        guard let token = msg["token"] as? String, let username else {
            log.error("token handshake failed: \(msg["error"] as? String ?? "no token", privacy: .public)")
            return
        }
        let stored = StoredToken(token: token, tokenId: msg["id"] as? Int, username: username, server: Server.current.rawValue)
        if Keychain.save(stored) {
            log.info("device token saved to keychain for \(username, privacy: .public)")
            Task { await SubmissionQueue.shared.flush() }
        }
    }

    private static var deviceName: String {
        #if os(iOS)
        String(UIDevice.current.name.prefix(40))
        #else
        String((Host.current().localizedName ?? "Mac").prefix(40))
        #endif
    }

    // MARK: navigation

    func openExternally(_ url: URL) {
        #if os(iOS)
        UIApplication.shared.open(url)
        #else
        NSWorkspace.shared.open(url)
        #endif
    }

    fileprivate func isOwnSite(_ url: URL) -> Bool {
        let base = Server.current.baseURL
        return url.host == base.host && url.port == base.port
    }
}

/// WebKit delegates and the script message handler; forwards to the controller.
@MainActor
private final class Bridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    weak var owner: WebController?

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // only our own site's main frame may drive the bridge
        guard let owner, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == Server.current.baseURL.host else { return }
        owner.handle(message.body)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let owner, let url = action.request.url else { return .allow }
        let isHTTP = url.scheme == "http" || url.scheme == "https"
        // same-site links load here; anything else goes to the system browser
        if isHTTP, action.targetFrame?.isMainFrame ?? true, !owner.isOwnSite(url) {
            owner.openExternally(url)
            return .cancel
        }
        return .allow
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if DEBUG
        DebugHooks.pageLoaded(webView)
        #endif
    }

    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = action.request.url { owner?.openExternally(url) }
        return nil
    }
}
