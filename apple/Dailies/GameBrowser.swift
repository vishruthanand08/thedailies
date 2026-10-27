import SwiftUI
import WebKit

/// One game page in its own WKWebView, with capture.js injected. Created per sheet/window.
@MainActor
@Observable
final class GameBrowser {
    let launch: GameLaunch
    let webView: WKWebView
    private(set) var canGoBack = false

    @ObservationIgnored private let bridge = GameBridge()
    @ObservationIgnored private var evalDone = false

    init(launch: GameLaunch) {
        self.launch = launch
        let config = WKWebViewConfiguration()
        config.websiteDataStore = GameHosts.dataStore // default UA, no TheDailiesApp suffix

        // the harness is a bundled file:// page, whose host is ""
        let hosts = launch.harness ? [""] : Array(GameHosts.active).sorted()
        let controller = config.userContentController
        controller.add(bridge, contentWorld: .page, name: "dailiesCapture")
        controller.addUserScript(WKUserScript(
            source: GameHosts.captureScript(hosts: hosts),
            injectionTime: .atDocumentStart, forMainFrameOnly: false, in: .page))

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = bridge
        webView.uiDelegate = bridge
        #if DEBUG
        webView.isInspectable = true
        #endif
        bridge.owner = self

        if launch.url.isFileURL {
            webView.loadFileURL(launch.url, allowingReadAccessTo: launch.url.deletingLastPathComponent())
        } else {
            webView.load(URLRequest(url: launch.url))
        }
    }

    func close() {
        webView.stopLoading()
        webView.configuration.userContentController.removeAllScriptMessageHandlers()
    }

    fileprivate func allows(_ host: String?) -> Bool {
        launch.harness ? host == "" : GameHosts.isAllowed(host)
    }

    fileprivate func captured(text: String, via: String, host: String) {
        log.info("captured via \(via, privacy: .public) on \(host, privacy: .public)")
        if launch.harness {
            SubmissionQueue.shared.show(.ok, "Captured via \(via): \(text)")
        } else {
            SubmissionQueue.shared.enqueue(text)
        }
    }

    fileprivate func pageLoaded() {
        canGoBack = webView.canGoBack
        log.info("game page loaded: \(self.webView.url?.host ?? "file", privacy: .public)")
        #if DEBUG
        // -dailiesGameEval "<js>": run once after the first game page load (scripted Simulator tests)
        if !evalDone, let js = UserDefaults.standard.string(forKey: "dailiesGameEval") {
            evalDone = true
            webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { result in
                if case .failure(let error) = result {
                    log.error("game eval failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
        #endif
    }
}

@MainActor
private final class GameBridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    weak var owner: GameBrowser?

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let host = message.frameInfo.securityOrigin.host
        // checked again here: the script's own host check runs in the page and can't be trusted
        guard let owner, owner.allows(host),
              let body = message.body as? [String: Any], let text = body["text"] as? String else {
            log.error("ignored capture from \(host, privacy: .public)")
            return
        }
        owner.captured(text: text, via: body["via"] as? String ?? "?", host: host)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let owner, let url = action.request.url, action.targetFrame?.isMainFrame ?? true,
              url.scheme == "http" || url.scheme == "https" else { return .allow }
        // links off the game (and off the allowlist) open in the system browser
        if owner.allows(url.host) { return .allow }
        WebController.shared.openExternally(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        owner?.pageLoaded()
    }

    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // target=_blank / window.open: stay in this view when allowed, else the system browser
        if let url = action.request.url {
            if owner?.allows(url.host) == true { webView.load(URLRequest(url: url)) } else { WebController.shared.openExternally(url) }
        }
        return nil
    }
}

struct GameBrowserView: View {
    let launch: GameLaunch
    @Environment(\.dismiss) private var dismiss
    // created in onAppear, not init: SwiftUI may build this view more than once, and each
    // GameBrowser is a live web view running the game
    @State private var browser: GameBrowser?
    @State private var queue = SubmissionQueue.shared

    var body: some View {
        NavigationStack {
            Group {
                if let browser {
                    GameWebView(webView: browser.webView)
                } else {
                    Color.clear
                }
            }
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(launch.name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItemGroup(placement: .navigation) {
                    Button { browser?.webView.goBack() } label: { Image(systemName: "chevron.backward") }
                        .disabled(!(browser?.canGoBack ?? false))
                        .accessibilityLabel("Back")
                    Button { browser?.webView.reload() } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("Reload")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .overlay { BannerOverlay(banner: queue.banner) { queue.dismiss($0) } }
        .onAppear {
            if browser == nil { browser = GameBrowser(launch: launch) }
        }
        .onDisappear {
            browser?.close()
            browser = nil
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 700)
        #endif
    }
}

#if os(iOS)
private struct GameWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#else
private struct GameWebView: NSViewRepresentable {
    let webView: WKWebView
    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#endif
