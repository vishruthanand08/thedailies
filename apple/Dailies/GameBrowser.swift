import SwiftUI
import WebKit

/// One game page in its own WKWebView. Created per sheet/window. The page runs untouched; the
/// score comes from the paste bar after the player taps the game's own Share or Copy.
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

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = bridge
        webView.uiDelegate = bridge
        #if DEBUG
        webView.isInspectable = true
        #endif
        bridge.owner = self
        webView.load(URLRequest(url: launch.url))
    }

    func close() {
        webView.stopLoading()
    }

    fileprivate func pageLoaded() {
        canGoBack = webView.canGoBack
        log.info("game page loaded: \(self.webView.url?.host ?? "?", privacy: .public)")
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
private final class GameBridge: NSObject, WKNavigationDelegate, WKUIDelegate {
    weak var owner: GameBrowser?

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url, action.targetFrame?.isMainFrame ?? true,
              url.scheme == "http" || url.scheme == "https" else { return .allow }
        // links off the game sites open in the system browser
        if GameHosts.isGame(url.host) { return .allow }
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
        // target=_blank / window.open: stay in this view on a game site, else the system browser
        if let url = action.request.url {
            if GameHosts.isGame(url.host) { webView.load(URLRequest(url: url)) } else { WebController.shared.openExternally(url) }
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
            .safeAreaInset(edge: .bottom, spacing: 0) {
                PasteBar(gameName: launch.name) { queue.enqueue($0) }
            }
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
        .background(FullScreenOnOpen())
        #endif
    }
}

/// The same for every game, and the same flow as the website's game panel: the game's Share or
/// Copy puts the result on the clipboard, Paste saves it. The system PasteButton reads the
/// clipboard without the "Allow Paste?" prompt.
private struct PasteBar: View {
    let gameName: String
    let onPaste: (String) -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Finished?").font(.system(.subheadline, design: .rounded, weight: .heavy))
                Text("Tap Share or Copy in \(gameName), then paste.").font(.footnote).opacity(0.75)
            }
            .lineLimit(1)
            .foregroundStyle(Color("OnAccent"))
            .frame(maxWidth: .infinity, alignment: .leading)
            PasteButton(payloadType: String.self) { strings in
                guard let text = strings.first else { return }
                Task { @MainActor in onPaste(text) }
            }
            .labelStyle(.titleAndIcon)
            .buttonBorderShape(.capsule)
            .tint(Color("OnAccent"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color("Sun")) // same yellow bar as the Today tab
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

/// Puts a game's window into full screen (its own Space) as soon as it opens. Done or Cmd-W
/// closes it and returns to The Dailies; Esc leaves full screen and keeps the window.
private struct FullScreenOnOpen: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            guard let window = view.window, !window.styleMask.contains(.fullScreen) else { return }
            window.collectionBehavior.insert(.fullScreenPrimary)
            window.toggleFullScreen(nil)
        }
        return view
    }
    func updateNSView(_ view: NSView, context: Context) {}
}
#endif
