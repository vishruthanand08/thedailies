#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI
import Observation

/// The global leaderboard: today's crowns across everyone who joined, not just your friends
/// (the website's Global.jsx). Anyone can look; joining puts you on it, under your username or a
/// fun name like "Zesty Zebra". Only pasted scores count.
@MainActor
@Observable
final class GlobalModel {
    static let shared = GlobalModel()

    private(set) var board: GlobalBoard?
    private(set) var error: String?
    private(set) var busy = false

    func load() async {
        do {
            board = try await DailiesAPI.shared.global()
            error = nil
        } catch let e as DailiesError {
            error = e.message
        } catch {}
    }

    func join(anonymous: Bool) async { await change { try await DailiesAPI.shared.joinGlobal(anonymous: anonymous) } }
    func leave() async { await change { try await DailiesAPI.shared.leaveGlobal() } }

    private func change(_ action: () async throws -> Void) async {
        busy = true
        defer { busy = false }
        do {
            try await action()
            await load()
        } catch let e as DailiesError {
            SubmissionQueue.shared.show(.err, e.message)
        } catch {}
    }

    func signedOut() {
        board = nil
        error = nil
    }
}

struct GlobalView: View {
    @State private var model = GlobalModel.shared
    @State private var leaving = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    content
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
                .animation(reduceMotion ? nil : .snappy, value: model.board?.me)
            }
            .scrollIndicators(.hidden)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Global")
            .toolbar { ProfileToolbarItem() }
            .refreshable { await model.load() }
            .overlay {
                if model.board == nil && model.error == nil { ProgressView() }
            }
        }
        .tint(Color.ink)
        .task { await model.load() }
        .sensoryFeedback(.success, trigger: model.board?.me.joined == true)
        .confirmationDialog("Leave the Global leaderboard?", isPresented: $leaving, titleVisibility: .visible) {
            Button("Leave", role: .destructive) {
                Haptic.warning()
                Task { await model.leave() }
            }
        } message: {
            Text("Your scores stop showing here. You can join again any time.")
        }
    }

    @ViewBuilder
    private var content: some View {
        if let error = model.error, model.board == nil {
            EmptyState(art: "EmptyOffline", icon: "signal-slash", title: "Couldn't load", message: error,
                       action: ("Try again", { Task { await model.load() } }))
        } else if let board = model.board {
            // not joined yet: the invitation first. Joined: the boards first, your settings last.
            if !board.me.joined { JoinCard(model: model) }
            GlobalCrownCard(standings: board.overall)
            ForEach(board.categories) { c in
                CategoryCard(category: c, hero: TodayModel.shared.categories.first { $0.id == c.id }?.hero ?? "squares-2x2")
            }
            if board.me.joined { MembershipCard(me: board.me, model: model, onLeave: { leaving = true }) }
        }
    }
}

/// Join, under your username or a fun name.
private struct JoinCard: View {
    let model: GlobalModel
    @State private var anonymous = false

    var body: some View {
        SectionCard(title: "Play the world", icon: "globe-americas") {
            Text("See how your day stacks up against everyone")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .oneLine()
            Toggle(isOn: $anonymous) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Use a fun name").font(.brand(.subheadline, .bold)).oneLine()
                    Text("Like \u{201C}Zesty Zebra\u{201D}, instead of your username").font(.caption).foregroundStyle(.secondary).oneLine()
                }
            }
            .tint(Color.sun)
            .foregroundStyle(Color.ink)
            .sensoryFeedback(.selection, trigger: anonymous)
            Button {
                Haptic.tap(.medium)
                Task { await model.join(anonymous: anonymous) }
            } label: {
                Text(model.busy ? "Joining…" : "Join the Global leaderboard")
                    .font(.brand(.subheadline, .heavy))
                    .foregroundStyle(Color.onAccent)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.pressIn(.sun, radius: 16))
            .disabled(model.busy)
        }
    }
}

/// How I show up, and leaving.
private struct MembershipCard: View {
    let me: GlobalBoard.Me
    let model: GlobalModel
    let onLeave: () -> Void

    var body: some View {
        SectionCard(title: "You're on the board", icon: "check") {
            Text(me.anonymous ? "As \(me.alias ?? "your fun name")" : "Under your username")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .oneLine()
            HStack(spacing: 8) {
                SmallButton(title: me.anonymous ? "Use my username" : "Use a fun name") {
                    Task { await model.join(anonymous: !me.anonymous) }
                }
                .disabled(model.busy)
                SmallButton(title: "Leave", action: onLeave)
                    .disabled(model.busy)
                Spacer(minLength: 0)
            }
        }
    }
}

/// The overall crown, yellow like Today's daily crown.
private struct GlobalCrownCard: View {
    let standings: GlobalBoard.Standings
    @State private var showScoring = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Label("Global crown", hero: "trophy", filled: true, size: 18)
                    .font(.brand(.headline, .heavy))
                    .oneLine()
                Button { Haptic.tap(); showScoring = true } label: {
                    HeroIcon("information-circle", size: 20)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.pressIn)
                .accessibilityLabel("How scoring works")
                if standings.total > 0 {
                    Text("\(standings.total) \(standings.total == 1 ? "player" : "players")")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.onAccent.opacity(0.7))
                        .fixedSize()
                }
            }
            GlobalRows(standings: standings, onAccent: true,
                       empty: "Nobody on the global board has a pasted score yet today.")
        }
        .foregroundStyle(Color.onAccent)
        .padding(14)
        .chunkyCard(.sun)
        .padding(.trailing, 4)
        .padding(.bottom, 4)
        .sheet(isPresented: $showScoring) { ScoringInfoView() }
    }
}

private struct CategoryCard: View {
    let category: GlobalBoard.Category
    let hero: String

    var body: some View {
        SectionCard(title: category.name, icon: hero) {
            if category.total > 0 {
                Text("\(category.total) \(category.total == 1 ? "player" : "players")")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .fixedSize()
            }
        } content: {
            GlobalRows(standings: category.standings, onAccent: false, empty: "Nobody yet today.")
        }
    }
}

/// One crown's rows: the top five and mine further down, then the rest of the top 25.
private struct GlobalRows: View {
    let standings: GlobalBoard.Standings
    let onAccent: Bool
    let empty: String
    @State private var showAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let shown = 5

    var body: some View {
        if standings.total == 0 {
            Text(empty)
                .font(.footnote)
                .foregroundStyle(onAccent ? Color.onAccent.opacity(0.8) : .secondary)
                .oneLine()
        } else {
            let top = standings.top
            let meAt = top.firstIndex { $0.me }
            // further down than what's shown (or past the top 25): my row under a ⋯
            let mine: GlobalBoard.Row? = showAll ? standings.mine : (meAt.map { $0 >= shown ? top[$0] : nil } ?? standings.mine)
            let rows = showAll ? top : Array(top.prefix(shown))
            VStack(spacing: 0) {
                ForEach(rows) { row($0) }
                if let mine {
                    BoardGap()
                    row(mine)
                }
            }
            .animation(reduceMotion ? nil : .snappy, value: showAll)
            if top.count > shown {
                Button {
                    Haptic.select()
                    withAnimation(reduceMotion ? nil : .snappy) { showAll.toggle() }
                } label: {
                    HStack(spacing: 4) {
                        Text(showAll ? "Show less" : "Show top \(top.count)")
                        HeroIcon(showAll ? "chevron-up" : "chevron-down", size: 12)
                    }
                    .font(.brand(.footnote, .bold))
                    .foregroundStyle(onAccent ? Color.onAccent.opacity(0.75) : .secondary)
                    .frame(maxWidth: .infinity, minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.pressIn)
            }
        }
    }

    private func row(_ r: GlobalBoard.Row) -> some View {
        HStack(spacing: 8) {
            RankBadge(rank: r.rank, onAccent: onAccent, size: 22)
            HStack(spacing: 6) {
                // a fun name reads a little differently from a username, so nobody mixes them up
                Text(r.me ? "\(r.name) (you)" : r.name)
                    .font(.brand(.subheadline, r.me ? .heavy : .semibold))
                    .italic(r.anonymous)
                Text("\(r.games) game\(r.games == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(onAccent ? Color.onAccent.opacity(0.7) : .secondary)
            }
            .oneLine()
            Text("\(r.points) pts").font(.brand(.subheadline, .heavy)).rolling(r.points).lineLimit(1).layoutPriority(1)
        }
        .foregroundStyle(onAccent ? Color.onAccent : Color.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(r.me ? (onAccent ? Color.white.opacity(0.85) : Color.highlight) : Color.clear))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ordinal(r.rank)), \(r.me ? "you" : r.name), \(r.points) points from \(r.games) games")
    }
}
#endif
