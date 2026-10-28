import Network
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
    /// Set when the site itself didn't load (offline, server down); the Mac shows a retry card.
    private(set) var loadError: String?
    @ObservationIgnored private let network = NWPathMonitor()
    /// Play taps from the web app: the in-app game browser for game sites, else the system browser.
    @ObservationIgnored var presentGame: ((GameLaunch) -> Void)?

    @ObservationIgnored private let bridge = Bridge()
    @ObservationIgnored private var issuingToken = false
    /// The web app tab the native tab bar last asked for (iOS); re-applied after each page load.
    @ObservationIgnored private var webTab: String?

    private init() {
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "TheDailiesApp/1.0" // keeps the default UA, appends this
        config.websiteDataStore = .default() // login cookie persists across launches

        config.userContentController.add(bridge, contentWorld: .page, name: "dailies")
        #if os(iOS)
        // the native tab bar replaces the site's header and tabs
        config.userContentController.addUserScript(WKUserScript(
            source: """
            const s = document.createElement('style');
            s.textContent = '.header, .tabs { display: none !important } .container { padding-top: 12px }';
            document.documentElement.appendChild(s);
            """,
            injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .page))
        #else
        // the Mac window is the whole site; its Paste button reads the clipboard through the app
        // (web/src/native.js), which skips WebKit's paste prompt
        config.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "dailiesClipboard")
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__dailiesNative = { platform: 'mac', clipboard: true }",
            injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        #endif

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
        webView.scrollView.showsVerticalScrollIndicator = false // swipe, no scroll bar
        webView.scrollView.showsHorizontalScrollIndicator = false
        #endif

        bridge.owner = self
        // back online after a failed load: try again by itself
        network.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor in
                if self?.loadError != nil { self?.load() }
            }
        }
        network.start(queue: .main)
        load()
    }

    fileprivate func loaded() {
        loadError = nil
    }

    fileprivate func failedToLoad(_ error: Error) {
        let code = (error as NSError).code
        guard code != NSURLErrorCancelled else { return } // replaced by another load, not a failure
        loadError = error.localizedDescription
        log.error("site failed to load: \(error.localizedDescription, privacy: .public)")
    }

    /// Routes a Play tap: game sites open in the in-app game browser, anything else in Safari.
    func open(_ url: URL, name: String, emoji: String? = nil, color: String? = nil) {
        if GameHosts.isGame(url.host), let presentGame {
            presentGame(GameLaunch(url: url, name: name, emoji: emoji, color: color))
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

    /// Shows one of the web app's tabs ("Feed", "Friends", "You") by clicking its hidden tab button.
    func showTab(_ label: String) {
        webTab = label
        applyWebTab()
    }

    fileprivate func applyWebTab() {
        guard let webTab else { return }
        webView.callAsyncJavaScript("""
            for (let i = 0; i < 40; i++) {
                // the label is the first text: Feed may carry a kudos count after it
                const t = [...document.querySelectorAll('.tabs .tab')].find((b) => b.firstChild?.textContent.trim() === label)
                if (t) { t.click(); return }
                await new Promise((r) => setTimeout(r, 100))
            }
            """, arguments: ["label": webTab], in: nil, in: .page) { _ in }
    }

    /// Go menu: a day back or forward on the site's Today tab, or 0 for today
    /// (`dailies:day` in web/src/Today.jsx).
    func showDay(_ days: Int) {
        showTab("Today")
        dispatch("dailies:day", detail: days)
    }

    /// Edit › Paste Result: the site's Paste button (`dailies:paste` in web/src/PasteDock.jsx).
    func pasteInPage() {
        showTab("Today")
        dispatch("dailies:paste", detail: 0)
    }

    /// File › Add Score…: the site's paste box (`dailies:pastebox` in web/src/PasteDock.jsx).
    func openPasteBox() {
        showTab("Today")
        dispatch("dailies:pastebox", detail: 0)
    }

    /// Fires an event once the Today tab is on screen (it may be mid-switch).
    private func dispatch(_ event: String, detail: Int) {
        webView.callAsyncJavaScript("""
            for (let i = 0; i < 20 && !document.querySelector('.daterow'); i++) {
                await new Promise((r) => setTimeout(r, 50))
            }
            window.dispatchEvent(new CustomEvent(name, { detail }))
            """, arguments: ["name": event, "detail": detail], in: nil, in: .page) { _ in }
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
            if msg["gameId"] != nil { GameHosts.trust(url) } // a game from the board
            open(url, name: msg["name"] as? String ?? url.host ?? "Game",
                 emoji: msg["emoji"] as? String, color: msg["color"] as? String)
        default:
            log.debug("unknown message type \(type)")
        }
    }

    private func handleSession(_ user: [String: Any]?) {
        let server = Server.current.rawValue
        guard let name = user?["username"] as? String else {
            username = nil
            AppSession.shared.webSignedOut()
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
            AppSession.shared.webSignedIn(username)
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
private final class Bridge: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply,
    WKNavigationDelegate, WKUIDelegate {
    weak var owner: WebController?

    /// The Mac clipboard for the site's Paste button: plain text, or the text of a rich copy.
    func userContentController(
        _ controller: WKUserContentController, didReceive message: WKScriptMessage
    ) async -> (Any?, String?) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == Server.current.baseURL.host else { return (nil, "not allowed") }
        #if os(macOS)
        return (MacClipboard.text() ?? "", nil)
        #else
        return (nil, "not available")
        #endif
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // only our own site's main frame may drive the bridge
        guard let owner, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == Server.current.baseURL.host else { return }
        owner.handle(message.body)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let owner, let url = action.request.url else { return .allow }
        let isHTTP = url.scheme == "http" || url.scheme == "https"
        // same-site links load here; game links go to the game browser; anything else to the system browser
        if isHTTP, action.targetFrame?.isMainFrame ?? true, !owner.isOwnSite(url) {
            owner.open(url, name: GameHosts.name(for: url))
            return .cancel
        }
        return .allow
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        owner?.failedToLoad(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        owner?.failedToLoad(error)
    }

    // the page's process went away (memory pressure, a crash): bring the site back
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        owner?.loaded()
        owner?.applyWebTab()
        #if DEBUG
        DebugHooks.pageLoaded(webView)
        #endif
    }

    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // target=_blank links, including the Play links on a site version without the native
        // bridge: same routing as an `open` message
        if let url = action.request.url { owner?.open(url, name: GameHosts.name(for: url)) }
        return nil
    }
}
