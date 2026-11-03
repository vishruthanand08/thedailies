#if os(iOS)
import SwiftUI

/// The signed-in app: native tab bar. Today and Feed are native; Friends and You still show the
/// website (without its own header and tabs) until they're rebuilt.
struct AppTabs: View {
    enum Tab: String { case today, feed, add, friends, you }
    @State private var selection: Tab = .today
    @State private var shown: Tab = .today // the screen behind the + (which only opens a sheet)
    @State private var adding = false
    @State private var feed = FeedModel.shared
    @State private var push = Push.shared

    var body: some View {
        TabView(selection: $selection) {
            TodayView(goToFriends: { selection = .friends })
                .tabItem { tabLabel("Today", "sun", .today) }
                .tag(Tab.today)
            FeedView(goToFriends: { selection = .friends })
                .tabItem { tabLabel("Feed", "queue-list", .feed) }
                .badge(feed.unseen) // kudos not seen yet
                .tag(Tab.feed)
            // + in the middle of the tab bar: opens Add a score over whatever tab you're on
            Color.canvas
                .tabItem { tabLabel("Add score", "plus-circle", .add) }
                .tag(Tab.add)
            WebTab(title: "Friends", webTab: "Friends", active: selection == .friends)
                .tabItem { tabLabel("Friends", "users", .friends) }
                .tag(Tab.friends)
            WebTab(title: "You", webTab: "You", active: selection == .you)
                .tabItem { tabLabel("You", "user-circle", .you) }
                .tag(Tab.you)
        }
        .tint(Color.ink)
        // a light tap on every tab change, a touch firmer than a picker's tick
        .sensoryFeedback(.impact(weight: .light), trigger: shown)
        .onChange(of: selection) { _, tab in
            if tab == .add {
                selection = shown
                Haptic.tap(.medium) // the app's main action
                adding = true
            } else {
                shown = tab
            }
        }
        .sheet(isPresented: $adding) { AddScoreSheet() }
        .onAppear { feed.startPolling() }
        .task { await push.registerIfAllowed() }
        // a tapped notification opens its tab
        .onChange(of: push.openTab, initial: true) { _, tab in
            guard let tab, let t = Tab(rawValue: tab), t != .add else { return }
            selection = t
            push.openTab = nil
        }
        .onDisappear { feed.signedOut() }
        #if DEBUG
        .onAppear {
            // -dailiesTab feed|friends|you: open on that tab (scripted Simulator runs)
            if let t = UserDefaults.standard.string(forKey: "dailiesTab").flatMap(Tab.init(rawValue:)) { selection = t }
            // -dailiesAddSheet YES: open Add a score (screenshots)
            if UserDefaults.standard.bool(forKey: "dailiesAddSheet") { adding = true }
        }
        #endif
    }

    /// Thin outline Heroicon at rest, the solid one on the selected tab.
    private func tabLabel(_ title: String, _ icon: String, _ tab: Tab) -> some View {
        Label(title, image: tab == shown ? "hero-\(icon)-fill" : "hero-\(icon)")
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
