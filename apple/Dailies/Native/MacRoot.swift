#if os(macOS)
import AppKit
import SwiftUI

/// Lets the menu bar reach the Today screen (menus live outside the view hierarchy).
@MainActor
@Observable
final class MacCommands {
    static let shared = MacCommands()

    struct PageRequest: Equatable {
        let days: Int // -1 back, 1 forward, 0 back to today
        let id = UUID()
    }

    var section: MacRootView.Section? = .today
    var addingScore = false
    var pageRequest: PageRequest?

    func page(_ days: Int) {
        section = .today
        pageRequest = PageRequest(days: days)
    }

    /// Edit › Paste Result: the Mac doesn't gate the clipboard behind a prompt, so read it directly.
    func pasteResult() {
        guard let text = NSPasteboard.general.string(forType: .string),
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            SubmissionQueue.shared.show(.err, "The clipboard is empty. Tap Share or Copy in the game first.")
            return
        }
        SubmissionQueue.shared.enqueue(text)
    }
}

/// The signed-in Mac window: a sidebar of sections, the standard Mac layout (Mail, Notes, Music),
/// in place of the iPhone's tab bar. Feed, Friends and You still show the website until they're native.
struct MacRootView: View {
    enum Section: String, CaseIterable, Identifiable {
        case today = "Today", feed = "Feed", friends = "Friends", you = "You"
        var id: String { rawValue }
        var symbol: String {
            switch self {
            case .today: "sun.max"
            case .feed: "list.bullet.rectangle.portrait"
            case .friends: "person.2"
            case .you: "person.crop.circle"
            }
        }
    }

    @State private var commands = MacCommands.shared

    var body: some View {
        NavigationSplitView {
            List(Section.allCases, selection: $commands.section) { section in
                Label(section.rawValue, systemImage: section.symbol).tag(section)
            }
            .navigationSplitViewColumnWidth(min: 170, ideal: 190, max: 240)
            .safeAreaInset(edge: .bottom) {
                Button { commands.addingScore = true } label: {
                    Label("Add Score", systemImage: "plus.circle.fill")
                        .font(.brand(.body, .bold))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .background(Capsule().fill(Color.sun))
                        .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .padding(12)
                .help("Add a score (⌘N)")
            }
        } detail: {
            switch commands.section ?? .today {
            case .today:
                TodayView()
            case .feed, .friends, .you:
                MainWebView()
                    .background(Color.canvas)
                    .navigationTitle((commands.section ?? .today).rawValue)
            }
        }
        .tint(Color.ink)
        .onChange(of: commands.section, initial: true) { _, section in
            if let section, section != .today { WebController.shared.showTab(section.rawValue) }
        }
        // Today's own sheet covers Add Score while it's showing; other sections present it here
        .sheet(isPresented: Binding(
            get: { commands.addingScore && commands.section != .today },
            set: { commands.addingScore = $0 })) { AddScoreSheet() }
    }
}

/// Menu bar commands for the Mac app.
struct DailiesCommands: Commands {
    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("Add Score…") { MacCommands.shared.addingScore = true }
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
            ForEach(MacRootView.Section.allCases) { section in
                Button(section.rawValue) { MacCommands.shared.section = section }
                    .keyboardShortcut(KeyEquivalent(Character(String(MacRootView.Section.allCases.firstIndex(of: section)! + 1))))
            }
        }
    }
}
#endif
