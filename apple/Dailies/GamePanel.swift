#if os(macOS)
import AppKit
import SwiftUI

/// Play on the Mac: the game in a panel over the page, drawn like the website's game panel
/// (web/src/GamePanel.jsx) since the window is the website: the game's tile and name, a pop-out
/// to its own full-screen window, ✕, and the paste footer. Unlike the site's iframe, every game
/// loads here: NYT and LinkedIn refuse to be framed by a page, not shown in the app's web view.
struct GamePanel: View {
    let launch: GameLaunch
    let close: () -> Void

    @Environment(\.openWindow) private var openWindow
    // created in onAppear, not init: SwiftUI may build this view more than once (GameBrowserView)
    @State private var browser: GameBrowser?
    @State private var flash: Flash?
    @State private var busy = false

    struct Flash: Equatable {
        let ok: Bool
        let text: String
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Site.backdrop
                    .contentShape(Rectangle())
                    .onTapGesture(perform: close)
                panel
                    .frame(width: min(560, geo.size.width - 32), height: min(920, geo.size.height - 32))
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .onAppear {
            if browser == nil { browser = GameBrowser(launch: launch) }
        }
        .onDisappear {
            browser?.close()
            browser = nil
        }
    }

    private var panel: some View {
        VStack(spacing: 0) {
            header
            Site.ink.frame(height: Site.border)
            Group {
                if let browser { GameWebView(webView: browser.webView) } else { Color.white }
            }
            Site.ink.frame(height: Site.border)
            footer
        }
        .background(Site.lavender)
        .clipShape(RoundedRectangle(cornerRadius: Site.radius))
        .overlay(RoundedRectangle(cornerRadius: Site.radius).strokeBorder(Site.ink, lineWidth: Site.border))
        .background(RoundedRectangle(cornerRadius: Site.radius).fill(Site.ink).offset(x: 5, y: 5))
        .environment(\.colorScheme, .light) // the site has one look
    }

    private var header: some View {
        HStack(spacing: 10) {
            Text(launch.emoji ?? "🎮")
                .font(.system(size: 18))
                .frame(width: 34, height: 34)
                .background(RoundedRectangle(cornerRadius: 10).fill(launch.color.map(Color.init(hex:)) ?? Site.lilac))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Site.ink, lineWidth: Site.border))
            Text(launch.name)
                .font(Site.font(16, .heavy))
                .foregroundStyle(Site.ink)
                .oneLine()
            Button {
                openWindow(id: "game", value: launch)
                close()
            } label: {
                Text("Window ↗").font(Site.font(13, .semibold)).foregroundStyle(Site.coral)
            }
            .buttonStyle(.plain)
            .help("Play \(launch.name) in its own full-screen window")
            Button(action: close) {
                Text("✕")
                    .font(Site.font(13, .bold))
                    .foregroundStyle(Site.ink)
                    .frame(width: 32, height: 28)
            }
            .buttonStyle(SitePill(fill: .white, shadow: 2))
            .keyboardShortcut(.cancelAction) // Esc
            .accessibilityLabel("Close \(launch.name)")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let flash {
                Text(flash.text)
                    .font(Site.font(14, .semibold))
                    .foregroundStyle(Site.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(flash.ok ? Site.okGreen : Site.errRed))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Site.ink, lineWidth: Site.border))
                    .background(RoundedRectangle(cornerRadius: 12).fill(Site.ink).offset(x: 3, y: 3))
            }
            HStack(spacing: 10) {
                Text("Finished? Tap Share or Copy in the game, then")
                    .font(Site.font(13.5, .medium))
                    .foregroundStyle(Site.muted)
                    .oneLine()
                Spacer(minLength: 0)
                SitePasteButton(title: busy ? "Saving…" : "Paste result", action: paste)
                    .disabled(busy)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private func paste() {
        guard let text = MacClipboard.text(), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            flash = Flash(ok: false, text: "Clipboard is empty. Tap Share or Copy in \(launch.name) first.")
            return
        }
        busy = true
        flash = nil
        Task {
            defer { busy = false }
            do {
                let saved = try await DailiesAPI.shared.submit(text: text)
                let done = Flash(ok: true, text: saved.savedText)
                flash = done
                WebController.shared.reloadBoard()
                // saved: back to the board after a moment to read it (as the website's panel does)
                try? await Task.sleep(for: .seconds(1.5))
                if flash == done { close() }
            } catch let error as DailiesError {
                flash = Flash(ok: false, text: error.message)
            } catch {
                flash = Flash(ok: false, text: "Couldn’t reach The Dailies. Check your connection.")
            }
        }
    }
}

/// The Mac clipboard as text: plain text, or the text of a rich copy (some games copy only HTML).
enum MacClipboard {
    static func text() -> String? {
        let board = NSPasteboard.general
        return board.string(forType: .string)
            ?? (board.readObjects(forClasses: [NSAttributedString.self]) as? [NSAttributedString])?.first?.string
    }
}

/// The website's tokens (web/src/styles.css), for native pieces drawn to sit inside its look.
enum Site {
    static let lavender = Color(hex: "#e9e4f7")
    static let lilac = Color(hex: "#d9ccf5")
    static let ink = Color(hex: "#16162e")
    static let coral = Color(hex: "#f2735c")
    static let yellow = Color(hex: "#f8d34c")
    static let muted = Color(hex: "#6f6f8a")
    static let okGreen = Color(hex: "#d9f2e2")
    static let errRed = Color(hex: "#fbd3cb")
    static let backdrop = Color(hex: "#16162e").opacity(0.55)
    static let radius: CGFloat = 16
    static let border: CGFloat = 2.5

    static func font(_ size: CGFloat, _ weight: Font.Weight) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

/// The website's Paste button (`.pastefab` in web/src/styles.css): yellow, ink outline, the
/// clipboard icon, and a hard shadow it sinks into on hover and press.
struct SitePasteButton: View {
    let title: String
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                ClipboardGlyph().frame(width: 18, height: 18)
                Text(title).font(Site.font(15, .heavy))
            }
            .foregroundStyle(Site.ink)
            .padding(.leading, 16)
            .padding(.trailing, 20)
            .frame(height: 44)
        }
        .buttonStyle(SitePill(fill: Site.yellow, shadow: 4, hovering: hovering))
        .onHover { hovering = $0 }
        .help("Paste the result you copied (⌘⇧V)")
    }
}

/// The site's clipboard icon (the SVG in web/src/PasteDock.jsx), on a 24-point grid.
private struct ClipboardGlyph: View {
    var body: some View {
        Canvas { context, size in
            let k = size.width / 24
            func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> Path {
                Path(roundedRect: CGRect(x: x * k, y: y * k, width: w * k, height: h * k), cornerRadius: r * k)
            }
            context.stroke(rect(5, 4, 14, 17, 2.5), with: .color(Site.ink), lineWidth: 2.2 * k)
            let clip = rect(8.5, 2, 7, 4.5, 1.5)
            context.fill(clip, with: .color(Site.yellow))
            context.stroke(clip, with: .color(Site.ink), lineWidth: 2 * k)
            var lines = Path()
            lines.move(to: CGPoint(x: 9 * k, y: 12 * k)); lines.addLine(to: CGPoint(x: 15 * k, y: 12 * k))
            lines.move(to: CGPoint(x: 9 * k, y: 16 * k)); lines.addLine(to: CGPoint(x: 13 * k, y: 16 * k))
            context.stroke(lines, with: .color(Site.ink), style: StrokeStyle(lineWidth: 2.2 * k, lineCap: .round))
        }
    }
}

/// The site's chunky pill: ink border and a hard shadow that it sinks into on hover and press.
struct SitePill: ButtonStyle {
    let fill: Color
    let shadow: CGFloat
    var hovering = false

    func makeBody(configuration: Configuration) -> some View {
        // hover sinks halfway, press all the way (the site's .pastefab)
        let sink = configuration.isPressed ? shadow : hovering ? shadow / 2 : 0
        configuration.label
            .background(Capsule().fill(fill))
            .overlay(Capsule().strokeBorder(Site.ink, lineWidth: Site.border))
            .offset(x: sink, y: sink)
            .background(Capsule().fill(Site.ink).offset(x: shadow, y: shadow))
            .animation(.easeOut(duration: 0.08), value: sink)
    }
}
#endif
