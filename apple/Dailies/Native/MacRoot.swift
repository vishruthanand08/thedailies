#if os(macOS)
import AppKit
import SwiftUI

/// Lets the menu bar reach the main window (menus live outside the view hierarchy).
@MainActor
@Observable
final class MacCommands {
    static let shared = MacCommands()

    /// The game open in the panel over the page (GamePanel).
    var playing: GameLaunch?

    /// Go › Previous Day / Next Day / Today, on the site's Today tab.
    func page(_ days: Int) {
        WebController.shared.showDay(days)
    }

    /// Edit › Paste Result: the same as the site's Paste button.
    func pasteResult() {
        WebController.shared.pasteInPage()
    }

    /// File › Add Score…: the site's paste box, to paste or type a result into.
    func addScore() {
        WebController.shared.openPasteBox()
    }
}

/// The Mac window is the website itself, sign-in and header and tabs included, so the app looks
/// just like it; the site's floating Paste button reads the clipboard through the app (no paste
/// prompt). Native around it: menus and shortcuts, notifications, the game panel, updates.
struct MacRootView: View {
    /// The site's tabs, for the Go menu (⌘1–4) and notifications that name one.
    static let tabs = ["Today", "Feed", "Friends", "You"]

    @State private var commands = MacCommands.shared
    @State private var push = Push.shared
    @State private var updates = MacUpdates.shared
    @State private var session = AppSession.shared
    @State private var web = WebController.shared

    var body: some View {
        MainWebView()
            .background(Site.lavender)
            .overlay(alignment: .bottomLeading) {
                if let release = updates.available { UpdateCard(release: release) }
            }
            .overlay {
                if let error = web.loadError { CantReach(detail: error) }
            }
            .overlay {
                if let game = commands.playing {
                    GamePanel(launch: game) { commands.playing = nil }
                        .id(game) // a different game gets a fresh web view
                        .transition(.opacity)
                }
            }
            .animation(.easeOut(duration: 0.15), value: commands.playing)
            .background(SiteColoredTitleBar())
            .onAppear {
                var tab = "Today"
                #if DEBUG
                // -dailiesTab feed|friends|you, as on iPhone (screenshots)
                if let arg = UserDefaults.standard.string(forKey: "dailiesTab"),
                   let match = Self.tabs.first(where: { $0.lowercased() == arg }) { tab = match }
                #endif
                WebController.shared.showTab(tab)
                updates.start()
            }
            // once signed in (on the site's own sign-in page, or again after signing out)
            .task(id: session.username) {
                if session.username != nil { await push.registerIfAllowed() }
            }
            // the kudos count on the Dock icon: the site's Feed tab shows it once you're here
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                push.clearBadge()
            }
            // a clicked notification opens its tab
            .onChange(of: push.openTab, initial: true) { _, tab in
                guard let tab, let label = Self.tabs.first(where: { $0.lowercased() == tab }) else { return }
                WebController.shared.showTab(label)
                push.openTab = nil
            }
    }
}

/// The title bar takes the site's lavender and drops the title, so the window reads as one page;
/// it stays a real title bar, so the window still drags from the top.
private struct SiteColoredTitleBar: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async { style(view.window) }
        return view
    }
    // SwiftUI puts the title back when it updates the window, so hide it again each time
    func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async { style(view.window) }
    }

    private func style(_ window: NSWindow?) {
        guard let window else { return }
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = NSColor(srgbRed: 0xE9 / 255, green: 0xE4 / 255, blue: 0xF7 / 255, alpha: 1) // the site's lavender
    }
}

/// The site didn't load: says so in the site's style, and tries again by itself once the Mac is
/// back online (WebController).
private struct CantReach: View {
    let detail: String

    var body: some View {
        ZStack {
            Site.lavender.ignoresSafeArea()
            VStack(spacing: 14) {
                Text("📡").font(.system(size: 40))
                Text("Can’t reach The Dailies")
                    .font(Site.font(22, .heavy))
                Text("Check your internet connection. This page reloads by itself when you’re back online.")
                    .font(Site.font(14, .medium))
                    .foregroundStyle(Site.muted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Text(detail)
                    .font(Site.font(12, .medium))
                    .foregroundStyle(Site.muted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Button { WebController.shared.load() } label: {
                    Text("Try again")
                        .font(Site.font(15, .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 22)
                        .padding(.vertical, 10)
                }
                .buttonStyle(SitePill(fill: Site.ink, shadow: 3))
                .keyboardShortcut(.defaultAction)
                .padding(.top, 4)
            }
            .foregroundStyle(Site.ink)
            .padding(28)
            .frame(maxWidth: 400)
            .background(RoundedRectangle(cornerRadius: Site.radius).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: Site.radius).strokeBorder(Site.ink, lineWidth: Site.border))
            .background(RoundedRectangle(cornerRadius: Site.radius).fill(Site.ink).offset(x: 5, y: 5))
            .padding(24)
        }
        .environment(\.colorScheme, .light)
    }
}

/// A newer version on the website (copies downloaded from there don't update through the App Store).
private struct UpdateCard: View {
    let release: MacUpdates.Release

    var body: some View {
        Button { MacUpdates.shared.download() } label: {
            HStack(spacing: 8) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Update available")
                        .font(.brand(.subheadline, .bold))
                        .oneLine()
                    Text("Download the new version")
                        .font(.brand(.caption))
                        .foregroundStyle(Color.ink.opacity(0.7))
                        .oneLine()
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(Color.ink)
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.highlight))
        }
        .buttonStyle(.plain)
        .frame(width: 230)
        .shadow(color: .black.opacity(0.15), radius: 8, y: 2)
        .padding(16)
        .help(release.notes ?? "Download The Dailies \(release.version)")
    }
}

/// Menu bar commands for the Mac app.
struct DailiesCommands: Commands {
    var body: some Commands {
        CommandGroup(after: .appInfo) {
            if !MacUpdates.shared.fromAppStore {
                Button("Check for Updates…") { MacUpdates.shared.checkNow() }
            }
        }
        CommandGroup(replacing: .newItem) {
            Button("Add Score…") { MacCommands.shared.addScore() }
                .keyboardShortcut("n")
        }
        CommandGroup(after: .pasteboard) {
            Button("Paste Result") { MacCommands.shared.pasteResult() }
                .keyboardShortcut("v", modifiers: [.command, .shift])
        }
        CommandMenu("Go") {
            Button("Previous Day") { MacCommands.shared.page(-1) }
                .keyboardShortcut("[")
            Button("Next Day") { MacCommands.shared.page(1) }
                .keyboardShortcut("]")
            Button("Today") { MacCommands.shared.page(0) }
                .keyboardShortcut("t")
            Divider()
            ForEach(Array(MacRootView.tabs.enumerated()), id: \.offset) { i, tab in
                Button(tab) { WebController.shared.showTab(tab) }
                    .keyboardShortcut(KeyEquivalent(Character(String(i + 1))))
            }
        }
    }
}
#endif
