#if os(iOS)
import SwiftUI
import Observation

/// The signed-in app: native tab bar, every tab native (the website shows only on the Mac).
/// Today, Feed, + (Add a score), Friends and Global; your profile opens from the button at the
/// top right of each tab.
struct AppTabs: View {
    enum Tab: String { case today, feed, add, friends, global }
    @State private var selection: Tab = .today
    @State private var shown: Tab = .today // the screen behind the + (which only opens a sheet)
    @State private var adding = false
    @State private var feed = FeedModel.shared
    @State private var push = Push.shared
    @State private var profile = ProfileSheet.shared
    @State private var invite = InviteLink.shared
    @State private var onboarding = OnboardingState.shared

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
            FriendsView()
                .tabItem { tabLabel("Friends", "users", .friends) }
                .tag(Tab.friends)
            GlobalView()
                .tabItem { tabLabel("Global", "globe-americas", .global) }
                .tag(Tab.global)
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
        .sheet(isPresented: $profile.open, onDismiss: { Task { await YouModel.shared.loadRecovery() } }) { YouView() }
        .onAppear { feed.startPolling() }
        .task { await YouModel.shared.loadRecovery() } // the account nudge on Today
        .task {
            if let me = AppSession.shared.username { await onboarding.checkAfterSignIn(me) }
            // the notification question waits until onboarding is closed (asking over it loses people)
            while onboarding.showing { try? await Task.sleep(for: .milliseconds(500)) }
            await push.registerIfAllowed()
        }
        .fullScreenCover(isPresented: $onboarding.showing) {
            OnboardingView(goToFriends: { selection = .friends })
        }
        // an invite link: send the request (or accept theirs) and show Friends
        .onChange(of: invite.pending, initial: true) { _, name in
            guard let name else { return }
            invite.pending = nil
            guard name != AppSession.shared.username else { return }
            selection = .friends
            Task {
                let result = await FriendsModel.shared.add(username: name)
                SubmissionQueue.shared.show(result.ok ? .ok : .err, result.message)
            }
        }
        // a tapped notification opens its tab ("you" opens the profile)
        .onChange(of: push.openTab, initial: true) { _, tab in
            guard let tab else { return }
            if tab == "you" {
                profile.open = true
            } else if let t = Tab(rawValue: tab), t != .add {
                selection = t
            }
            push.openTab = nil
        }
        .onDisappear {
            feed.signedOut()
            FriendsModel.shared.signedOut()
            YouModel.shared.signedOut()
            GlobalModel.shared.signedOut()
            profile.open = false
        }
        #if DEBUG
        .onAppear {
            // -dailiesTab feed|friends|global|you: open on that tab, or the profile (scripted Simulator runs)
            let tab = UserDefaults.standard.string(forKey: "dailiesTab")
            if tab == "you" { profile.open = true }
            if let t = tab.flatMap(Tab.init(rawValue:)) { selection = t }
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

/// Whether the profile (You) is showing; any tab's ProfileButton opens it.
@MainActor
@Observable
final class ProfileSheet {
    static let shared = ProfileSheet()
    var open = false
}

/// Your initial at the top right of each tab: opens your profile.
struct ProfileButton: View {
    var body: some View {
        Button {
            Haptic.tap()
            ProfileSheet.shared.open = true
        } label: {
            Text((AppSession.shared.username ?? "?").prefix(1).uppercased())
                .font(.system(.subheadline, design: .rounded, weight: .heavy))
                .foregroundStyle(Color.onAccent)
                .frame(width: 34, height: 34)
                .background(Circle().fill(Color.sun))
                .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(.pressIn)
        .accessibilityLabel("Your profile")
        .accessibilityIdentifier("profileButton")
    }
}
/// The profile button in a tab's navigation bar, without iOS 26's glass circle around it (the
/// button is its own yellow circle, like on Today).
struct ProfileToolbarItem: ToolbarContent {
    var body: some ToolbarContent {
        if #available(iOS 26.0, *) {
            ToolbarItem(placement: .topBarTrailing) { ProfileButton() }
                .sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarTrailing) { ProfileButton() }
        }
    }
}
#endif
