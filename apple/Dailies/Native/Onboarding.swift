#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI
import Observation

/// Invite links (www.thedailies.lol/?add=username) opened in the app, through Associated Domains
/// or the website's Smart App Banner. Held until someone is signed in (a new player may sign up
/// first), then AppTabs sends the friend request and opens Friends.
@MainActor
@Observable
final class InviteLink {
    static let shared = InviteLink()
    private static let key = "dailies.pendingInvite"

    var pending: String? = UserDefaults.standard.string(forKey: key) {
        didSet { UserDefaults.standard.set(pending, forKey: Self.key) }
    }

    /// Returns true when the URL was an invite.
    @discardableResult
    func receive(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased(), host.hasSuffix("thedailies.lol") || host == Server.current.baseURL.host,
              let name = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "add" })?.value?
                .lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "@ ")),
              name.range(of: "^[a-z0-9_]{2,20}$", options: .regularExpression) != nil else { return false }
        pending = name
        return true
    }
}

/// Whether to show onboarding: once per account on this device, for accounts made in the last
/// couple of days (people who've played for a while don't need it); "How it works" on the profile
/// replays it any time.
@MainActor
@Observable
final class OnboardingState {
    static let shared = OnboardingState()
    var showing = false

    private func key(_ username: String) -> String { "dailies.onboarded.\(username)" }

    func checkAfterSignIn(_ username: String) async {
        guard !UserDefaults.standard.bool(forKey: key(username)) else { return }
        guard let iso = try? await DailiesAPI.shared.profileCreatedAt(), let joined = Self.date(iso) else { return }
        UserDefaults.standard.set(true, forKey: key(username)) // once, whatever happens next
        if Date().timeIntervalSince(joined) < 2 * 86400 { showing = true }
    }

    private static func date(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}

/// Three pages for new players: what The Dailies is, how a score gets in (the step people miss),
/// and friends. Skip any time.
struct OnboardingView: View {
    var goToFriends: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var page = 0
    private let pages = 3

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Skip") { Haptic.tap(); dismiss() }
                    .font(.brand(.subheadline, .bold))
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 44, minHeight: 44)
                    .opacity(page < pages - 1 ? 1 : 0)
            }
            .padding(.horizontal, 16)

            TabView(selection: $page) {
                OnboardPage(title: "All your daily games",
                            text: "Wordle, Connections, Queens, geography games and more. Play them right here.") { gamesArt }
                    .tag(0)
                OnboardPage(title: "Play, copy, paste",
                            text: "Finish a game, tap its Share or Copy, then tap Paste. Your score lands on the board.") { pasteArt }
                    .tag(1)
                OnboardPage(title: "Beat your friends",
                            text: "Every score earns up to 100 points. The most points across the day takes the crown.") { crownArt }
                    .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(reduceMotion ? nil : .snappy, value: page)

            dots.padding(.bottom, 18)

            VStack(spacing: 10) {
                Button {
                    Haptic.tap(.medium)
                    if page < pages - 1 { withAnimation(reduceMotion ? nil : .snappy) { page += 1 } } else { dismiss() }
                } label: {
                    Text(page < pages - 1 ? "Next" : "Start playing")
                        .font(.brand(.headline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.pressIn(.sun, weight: 2.5, shadow: 4))
                if page == pages - 1 {
                    Button {
                        Haptic.tap()
                        dismiss()
                        goToFriends()
                    } label: {
                        Label("Add friends first", hero: "user-plus", size: 18)
                            .font(.brand(.subheadline, .heavy))
                            .foregroundStyle(Color.ink)
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.pressIn(.surface, weight: 2, shadow: 3))
                    .transition(.opacity)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
            .animation(reduceMotion ? nil : .snappy, value: page)
        }
        .background(Color.canvas.ignoresSafeArea())
        .sensoryFeedback(.selection, trigger: page)
    }

    private var dots: some View {
        HStack(spacing: 8) {
            ForEach(0..<pages, id: \.self) { i in
                Capsule()
                    .fill(i == page ? Color.ink : Color.ink.opacity(0.2))
                    .frame(width: i == page ? 22 : 8, height: 8)
            }
        }
        .animation(reduceMotion ? nil : .snappy, value: page)
        .accessibilityElement()
        .accessibilityLabel("Page \(page + 1) of \(pages)")
    }

    // MARK: pictures, drawn in the app's own style

    private var gamesArt: some View {
        let games = Array(TodayModel.shared.games.prefix(6))
        return LazyVGrid(columns: Array(repeating: GridItem(.fixed(64), spacing: 14), count: 3), spacing: 14) {
            ForEach(games) { GameAvatar(game: $0, size: 64) }
        }
        .padding(20)
        .chunkyCard(.surface)
    }

    private var pasteArt: some View {
        VStack(spacing: 12) {
            ForEach(Array(["Finish today's puzzle", "Tap Share or Copy", "Tap Paste"].enumerated()), id: \.offset) { i, step in
                HStack(spacing: 12) {
                    Text("\(i + 1)")
                        .font(.brand(.subheadline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(Color.sun))
                        .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2))
                    Text(step).font(.brand(.headline, .bold)).foregroundStyle(Color.ink).oneLine()
                }
            }
            HStack {
                Text("Copied! Tap Paste to save").font(.brand(.subheadline, .heavy)).oneLine()
                Label("Paste", hero: "clipboard-document", size: 16)
                    .font(.brand(.subheadline, .heavy))
                    .padding(.horizontal, 14).frame(minHeight: 36)
                    .background(Capsule().fill(Color.surface))
                    .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                    .fixedSize()
            }
            .foregroundStyle(Color.onAccent)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.sun))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 2))
        }
        .padding(20)
        .chunkyCard(.surface)
    }

    private var crownArt: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Daily crown", hero: "trophy", filled: true, size: 18).font(.brand(.headline, .heavy)).oneLine()
            ForEach(Array([("you", 248), ("alex", 231), ("maya", 190)].enumerated()), id: \.offset) { i, row in
                HStack(spacing: 8) {
                    RankBadge(rank: i + 1, onAccent: true, size: 24)
                    Text(row.0).font(.brand(.subheadline, i == 0 ? .heavy : .semibold)).oneLine()
                    Text("\(row.1) pts").font(.brand(.subheadline, .heavy)).fixedSize()
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(i == 0 ? Color.white.opacity(0.85) : .clear))
            }
        }
        .foregroundStyle(Color.onAccent)
        .padding(16)
        .frame(width: 280)
        .chunkyCard(.sun)
    }
}

private struct OnboardPage<Art: View>: View {
    let title: String
    let text: String
    @ViewBuilder var art: Art
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 0)
            art
                .scaleEffect(shown || reduceMotion ? 1 : 0.85)
                .opacity(shown ? 1 : 0)
            VStack(spacing: 10) {
                Text(title).font(.brand(.title2, .heavy)).foregroundStyle(Color.ink).oneLine(.center)
                // a full sentence: this wraps, like an empty state's message
                Text(text)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 320)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .onAppear { withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0.35)) { shown = true } }
    }
}
#endif
