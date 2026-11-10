import SwiftUI
import WebKit

/// One game page in its own WKWebView. Created per sheet/window. `ResultCatcher` saves the score
/// by itself when the game shares or copies it (and presses the game's Share for the player); the
/// paste bar is the fallback.
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
        ResultCatcher.install(in: config, autoPress: !Self.alreadyPlayed(launch)) { text in
            SubmissionQueue.shared.enqueue(text, auto: true)
        }

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
        ResultCatcher.uninstall(from: webView)
        Task { await GameHosts.keepSignIns() }
    }

    /// The player has today's score for this game already: no need to press its Share again.
    private static func alreadyPlayed(_ launch: GameLaunch) -> Bool {
        let today = TodayModel.shared
        guard today.isToday, let game = today.games.first(where: { $0.playURL == launch.url }) else { return false }
        return today.myEntry(for: game) != nil
    }

    fileprivate func pageLoaded() {
        canGoBack = webView.canGoBack
        log.info("game page loaded: \(self.webView.url?.host ?? "?", privacy: .public)")
        #if DEBUG
        // -dailiesGameCookies YES: log the game store's cookies (names, expiry and a short hash of
        // the value, never the value) to check logins survive a relaunch
        if UserDefaults.standard.bool(forKey: "dailiesGameCookies") {
            GameHosts.dataStore.httpCookieStore.getAllCookies { cookies in
                for c in cookies.sorted(by: { ($0.domain, $0.name) < ($1.domain, $1.name) }) {
                    let hash = String(c.value.utf8.reduce(UInt32(2166136261)) { ($0 ^ UInt32($1)) &* 16777619 } & 0xffff, radix: 16) // FNV-1a, stable across launches
                    let expiry = c.expiresDate.map { "\($0)" } ?? "session"
                    let flags = c.isHTTPOnly ? " httpOnly" : ""
                    log.info("game cookie \(c.domain, privacy: .public) \(c.name, privacy: .public) expires \(expiry, privacy: .public)\(flags, privacy: .public) #\(hash, privacy: .public)")
                }
            }
        }
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
    @State private var showGuide = false

    /// Share on a saved score's banner (iPhone; the Mac's sharing is the website's).
    private var shareScore: ((String) -> Void)? {
        #if os(iOS)
        return { gameId in
            Haptic.tap(.medium)
            Sharing.shareGame(gameId)
        }
        #else
        return nil
        #endif
    }

    var body: some View {
        NavigationStack {
            Group {
                if let browser {
                    GameWebView(webView: browser.webView)
                } else {
                    Color.clear
                }
            }
            #if os(iOS)
            // over the game, just above the yellow bar it points to
            .overlay(alignment: .bottom) { GameGuide(gameName: launch.name, visible: $showGuide) }
            #endif
            .safeAreaInset(edge: .bottom, spacing: 0) {
                PasteBar(gameName: launch.name) { queue.enqueue($0) }
            }
            .navigationTitle(launch.name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItemGroup(placement: .navigation) {
                    Button { browser?.webView.goBack() } label: { HeroIcon("chevron-left", size: 22) }
                        .disabled(!(browser?.canGoBack ?? false))
                        .accessibilityLabel("Back")
                    Button { browser?.webView.reload() } label: { HeroIcon("arrow-path", size: 22) }
                        .accessibilityLabel("Reload")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .overlay { BannerOverlay(banner: queue.banner, dismiss: { queue.dismiss($0) }, undo: { queue.undo($0) }, share: shareScore) }
        .onChange(of: queue.banner) { _, banner in
            if banner?.undoId != nil, let browser { ResultCatcher.saved(in: browser.webView) }
        }
        .onAppear {
            if browser == nil {
                browser = GameBrowser(launch: launch)
                #if os(iOS)
                // the steps over the game, the first few times a game is opened. The view can be set
                // up more than once as a game opens, so opens within ten seconds count once.
                let defaults = UserDefaults.standard
                let shown = defaults.integer(forKey: GameGuide.key)
                if shown < GameGuide.times {
                    let last = defaults.double(forKey: GameGuide.key + ".at")
                    if Date().timeIntervalSince1970 - last > 10 {
                        defaults.set(shown + 1, forKey: GameGuide.key)
                        defaults.set(Date().timeIntervalSince1970, forKey: GameGuide.key + ".at")
                    }
                    Task {
                        try? await Task.sleep(for: .seconds(0.6)) // after the game starts loading
                        withAnimation(.spring(duration: 0.45, bounce: 0.25)) { showGuide = true }
                    }
                }
                #endif
            }
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
        #if os(macOS)
        // the website's game panel footer, as in GamePanel, since the Mac app looks like the site.
        // It reads the clipboard directly: the Mac's PasteButton only re-checks it when the
        // window gains focus, so after the game's own Copy it often stays greyed out.
        HStack(spacing: 10) {
            Text("Finished? Tap Share or Copy in the game, then")
                .font(Site.font(13.5, .medium))
                .foregroundStyle(Site.muted)
                .oneLine()
            Spacer(minLength: 0)
            SitePasteButton(title: "Paste result", action: pasteFromClipboard)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Site.lavender)
        .overlay(alignment: .top) { Site.ink.frame(height: Site.border) }
        .environment(\.colorScheme, .light)
        #else
        IPhonePasteBar(gameName: gameName, onPaste: onPaste)
        #endif
    }

    #if os(macOS)
    private func pasteFromClipboard() {
        guard let text = MacClipboard.text(), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            SubmissionQueue.shared.show(.err, "The clipboard is empty. Tap Share or Copy in \(gameName) first.")
            return
        }
        onPaste(text)
    }
    #endif
}

#if os(iOS)
/// Notices when something new is copied while a game is open, without reading the clipboard (so
/// no "Allow Paste?" prompt): iOS's changeCount goes up on every copy, including one made from the
/// share sheet's Copy, which happens outside the app and doesn't notify it. Checked twice a second
/// while the game is on screen and whenever the app comes back.
@MainActor
@Observable
final class ClipboardWatcher {
    private(set) var changeCount = UIPasteboard.general.changeCount
    private(set) var hasText = UIPasteboard.general.hasStrings
    /// Something was copied since the game opened: most likely the result.
    private(set) var copiedSinceOpen = false
    @ObservationIgnored private let startCount = UIPasteboard.general.changeCount
    @ObservationIgnored private var timer: Timer?

    func start() {
        check()
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.check() }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    func check() {
        let count = UIPasteboard.general.changeCount
        guard count != changeCount || !copiedSinceOpen && count != startCount else {
            hasText = UIPasteboard.general.hasStrings
            return
        }
        changeCount = count
        hasText = UIPasteboard.general.hasStrings
        copiedSinceOpen = count != startCount && hasText
    }

    /// After a save: back to waiting for the next copy.
    func saved() { copiedSinceOpen = false }
}

/// The yellow bar under a game: what to do next, and the system Paste button (which reads the
/// clipboard without a prompt). Rebuilt on every copy so it never sits greyed out after one, and
/// it lights up once the result is copied.
private struct IPhonePasteBar: View {
    let gameName: String
    let onPaste: (String) -> Void
    @State private var watcher = ClipboardWatcher()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    private var ready: Bool { watcher.copiedSinceOpen }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(ready ? "Copied! Tap Paste to save" : "Your score saves itself")
                    .font(.system(.subheadline, design: .rounded, weight: .heavy))
                Text(ready ? "Your \(gameName) result goes on the board." : "Just play. If it doesn't, tap Share, then Paste.")
                    .font(.footnote).opacity(0.75)
            }
            .lineLimit(1)
            .foregroundStyle(Color("OnAccent"))
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentTransition(.opacity)
            Group {
                #if DEBUG
                if UserDefaults.standard.bool(forKey: "dailiesScreenshots") {
                    ScreenshotPasteButton() // see AddScoreSheet
                } else {
                    pasteButton
                }
                #else
                pasteButton
                #endif
            }
            .labelStyle(.titleAndIcon)
            .buttonBorderShape(.capsule)
            .tint(Color("OnAccent"))
            .scaleEffect(ready && pulse && !reduceMotion ? 1.08 : 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color("Sun")) // same yellow bar as the Today tab
        .overlay(alignment: .top) {
            // a bright edge while there's a result waiting to be saved
            if ready { Color("OnAccent").frame(height: 3).transition(.opacity) }
        }
        .animation(reduceMotion ? nil : .snappy, value: ready)
        .sensoryFeedback(.success, trigger: ready) { _, now in now }
        .onAppear {
            watcher.start()
            if !reduceMotion {
                withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { pulse = true }
            }
        }
        .onDisappear { watcher.stop() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { watcher.check() } }
    }

    private var pasteButton: some View {
        PasteButton(payloadType: String.self) { strings in
            guard let text = strings.first else { return }
            Task { @MainActor in
                watcher.saved()
                onPaste(text)
            }
        }
        // a fresh button for each copy: the system one doesn't always notice a copy on its own
        .id(watcher.changeCount)
    }
}

/// The three steps, over the bottom of the game the first few times someone opens one, since
/// "copy your result, then paste it" isn't obvious. "Got it" hides it for good.
private struct GameGuide: View {
    let gameName: String
    @Binding var visible: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    static let key = "dailies.gameGuideShown"
    static let times = 3

    var body: some View {
        Group {
            if visible {
                VStack(alignment: .leading, spacing: 10) {
                    Text("How to add your score").font(.system(.headline, design: .rounded, weight: .heavy))
                    step(1, "Play today's \(gameName).")
                    step(2, "When you finish, your score saves itself.")
                    step(3, "Didn't save? Tap the game's Share, then Paste below.")
                    Button {
                        Haptic.tap()
                        UserDefaults.standard.set(Self.times, forKey: Self.key) // for good
                        withAnimation(reduceMotion ? nil : .snappy) { visible = false }
                    } label: {
                        Text("Got it")
                            .font(.system(.subheadline, design: .rounded, weight: .heavy))
                            .foregroundStyle(Color("OnAccent"))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.pressIn(Color("Sun"), radius: 14))
                }
                .foregroundStyle(Color("Ink"))
                .padding(16)
                .chunkyCard(Color("Surface"))
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
                .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    private func step(_ n: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(n)")
                .font(.system(.footnote, design: .rounded, weight: .heavy))
                .foregroundStyle(Color("OnAccent"))
                .frame(width: 24, height: 24)
                .background(Circle().fill(Color("Sun")))
                .overlay(Circle().strokeBorder(Color("OnAccent"), lineWidth: 1.5))
            Text(text).font(.subheadline.weight(.semibold)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct GameWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#else
struct GameWebView: NSViewRepresentable {
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
