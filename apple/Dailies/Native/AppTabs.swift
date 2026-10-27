#if os(iOS)
import SwiftUI

/// The signed-in app: native tab bar. Today is native; Feed, Friends and You still show the
/// website (without its own header and tabs) until they're rebuilt.
struct AppTabs: View {
    enum Tab: String { case today, feed, add, friends, you }
    @State private var selection: Tab = .today
    @State private var shown: Tab = .today // the screen behind the + (which only opens a sheet)
    @State private var adding = false

    var body: some View {
        TabView(selection: $selection) {
            TodayView(goToFriends: { selection = .friends })
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(Tab.today)
            WebTab(title: "Feed", webTab: "Feed", active: selection == .feed)
                .tabItem { Label("Feed", systemImage: "list.bullet.rectangle.portrait.fill") }
                .tag(Tab.feed)
            // + in the middle of the tab bar: opens Add a score over whatever tab you're on
            Color.canvas
                .tabItem { Label("Add score", systemImage: "plus.circle.fill") }
                .tag(Tab.add)
            WebTab(title: "Friends", webTab: "Friends", active: selection == .friends)
                .tabItem { Label("Friends", systemImage: "person.2.fill") }
                .tag(Tab.friends)
            WebTab(title: "You", webTab: "You", active: selection == .you)
                .tabItem { Label("You", systemImage: "person.crop.circle.fill") }
                .tag(Tab.you)
        }
        .tint(Color.ink)
        .onChange(of: selection) { _, tab in
            if tab == .add {
                selection = shown
                adding = true
            } else {
                shown = tab
            }
        }
        .sheet(isPresented: $adding) { AddScoreSheet() }
        #if DEBUG
        .onAppear {
            // -dailiesTab feed|friends|you: open on that tab (scripted Simulator runs)
            if let t = UserDefaults.standard.string(forKey: "dailiesTab").flatMap(Tab.init(rawValue:)) { selection = t }
            // -dailiesAddSheet YES: open Add a score (screenshots)
            if UserDefaults.standard.bool(forKey: "dailiesAddSheet") { adding = true }
        }
        #endif
    }
}

/// The one shared web view can only sit in one place, so only the active web tab hosts it.
private struct WebTab: View {
    let title: String
    let webTab: String
    let active: Bool

    var body: some View {
        NavigationStack {
            Group {
                if active { MainWebView() } else { Color.canvas }
            }
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
        .onChange(of: active, initial: true) { _, isActive in
            if isActive { WebController.shared.showTab(webTab) }
        }
    }
}
#endif
