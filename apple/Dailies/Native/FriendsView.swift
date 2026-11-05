#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

/// Friends, in Today's style: add someone or share your invite link, answer requests, People you
/// may know, the circle's leaderboards, then your friends. Everything the website's Friends tab does.
struct FriendsView: View {
    @State private var model = FriendsModel.shared
    @State private var removing: FriendList.Person?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        content
                    }
                    .animation(reduceMotion ? nil : .snappy, value: people)
                    .animation(reduceMotion ? nil : .snappy, value: model.suggestions)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                #if DEBUG
                // -dailiesScrollTo leaderboard|friends: start scrolled there (scripted Simulator runs)
                .task(id: model.stats == nil) {
                    guard model.stats != nil, let id = UserDefaults.standard.string(forKey: "dailiesScrollTo") else { return }
                    proxy.scrollTo(id, anchor: .top)
                }
                #endif
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Friends")
            .toolbar { ProfileToolbarItem() }
            .refreshable { await model.load() }
            .overlay {
                if model.list == nil && model.error == nil { ProgressView() }
            }
        }
        .tint(Color.ink)
        .task { await model.load() }
        .confirmationDialog(
            removing.map { "Remove \($0.username)?" } ?? "",
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
            titleVisibility: .visible,
            presenting: removing
        ) { person in
            Button("Remove \(person.username)", role: .destructive) {
                Haptic.warning()
                Task { await model.remove(person) }
            }
        } message: { person in
            Text("You'll leave each other's boards and feed. You can add \(person.username) again later.")
        }
    }

    @ViewBuilder
    private var content: some View {
        if let error = model.error, model.list == nil {
            EmptyState(art: "EmptyOffline", icon: "signal-slash", title: "Couldn't load", message: error,
                       action: ("Try again", { Task { await model.load() } }))
        } else if let list = model.list {
            AddFriendCard(model: model)
            if !list.incoming.isEmpty { RequestsCard(people: list.incoming, model: model) }
            SuggestionsCard(model: model)
            if list.friends.isEmpty {
                SectionCard(title: "Leaderboard", icon: "trophy") {
                    EmptyState(art: "EmptyBoard", icon: "trophy", title: "No one to beat yet",
                               message: "Add a friend to see who's winning.", compact: true)
                }
            } else {
                LeaderboardCard(model: model).id("leaderboard")
            }
            FriendsCard(list: list, onRemove: { removing = $0 }).id("friends")
        }
    }

    /// What changes when someone is added, accepted or removed, so the cards animate it.
    private var people: [Int] {
        guard let l = model.list else { return [] }
        return l.friends.map(\.id) + [-1] + l.incoming.map(\.id) + [-2] + l.outgoing.map(\.id)
    }
}

// MARK: cards

/// A person on a card: their initial, their name, a line under it, and buttons at the end.
private struct PersonRow<Actions: View>: View {
    let name: String
    var detail: String?
    @ViewBuilder var actions: Actions

    var body: some View {
        HStack(spacing: 10) {
            Avatar(name: name, size: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(name).font(.brand(.subheadline, .bold)).foregroundStyle(Color.ink).oneLine()
                if let detail {
                    Text(detail).font(.caption).foregroundStyle(.secondary).oneLine()
                }
            }
            actions
        }
        .frame(minHeight: 44)
    }
}

/// Add someone by username, or send your invite link.
private struct AddFriendCard: View {
    let model: FriendsModel
    @State private var name = ""
    @State private var flash: (ok: Bool, text: String)?
    @State private var busy = false
    @FocusState private var focused: Bool

    var body: some View {
        SectionCard(title: "Add a friend", icon: "user-plus") {
            HStack(spacing: 10) {
                HStack(spacing: 8) {
                    Text("@").font(.brand(.subheadline, .bold)).foregroundStyle(.secondary)
                    TextField("their username", text: $name)
                        .font(.brand(.subheadline, .semibold))
                        .foregroundStyle(Color.ink)
                        .focused($focused)
                        .submitLabel(.send)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .onSubmit(add)
                }
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .modifier(Sunken(down: focused, fill: .canvas))
                .contentShape(Rectangle())
                .onTapGesture { focused = true }

                Button(action: add) {
                    Text("Add")
                        .font(.brand(.subheadline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 18)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.pressIn(.sun, radius: 14))
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                .fixedSize()
            }
            if let flash {
                // full sentences from the server: these wrap, like error messages
                NoticeView(ok: flash.ok, text: flash.text)
            }
            if let url = model.inviteURL {
                ShareLink(item: url, message: Text("Add me on The Dailies")) {
                    Label("Share your invite link", hero: "arrow-up-on-square", size: 16)
                        .font(.brand(.footnote, .bold))
                        .foregroundStyle(Color.ink)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.pressIn(.surface, radius: 14))
                .simultaneousGesture(TapGesture().onEnded { Haptic.tap() })
            }
            Text("Your link sends you a friend request")
                .font(.caption)
                .foregroundStyle(.secondary)
                .oneLine()
        }
        .sensoryFeedback(trigger: flash?.text) { _, _ in
            guard let flash else { return nil }
            return flash.ok ? .success : .error
        }
    }

    private func add() {
        let typed = name
        guard !typed.trimmingCharacters(in: .whitespaces).isEmpty, !busy else { return }
        busy = true
        Task {
            let result = await model.add(username: typed)
            busy = false
            withAnimation(.snappy) { flash = (result.ok, result.message) }
            if result.ok { name = "" }
        }
    }
}

private struct RequestsCard: View {
    let people: [FriendList.Person]
    let model: FriendsModel

    var body: some View {
        SectionCard(title: "Requests", icon: "users") {
            Text("\(people.count)")
                .font(.caption.weight(.heavy))
                .foregroundStyle(Color.onAccent)
                .padding(.horizontal, 7)
                .background(Capsule().fill(Color.sun))
                .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                .fixedSize()
        } content: {
            ForEach(people) { p in
                PersonRow(name: p.username, detail: "Wants to be friends") {
                    SmallButton(title: "Accept", icon: "check", primary: true) { Task { await model.respond(p, accept: true) } }
                    SmallButton(title: "Decline") { Task { await model.respond(p, accept: false) } }
                }
            }
        }
    }
}

/// Friends of friends, three at a time; hiding one brings up the next. Right after adding
/// someone, just their friends.
private struct SuggestionsCard: View {
    let model: FriendsModel
    private let shown = 3

    var body: some View {
        if let via = model.justAdded, model.suggestions.isEmpty {
            SectionCard(title: "Friends of \(via.username)", icon: "users") {
                Text("No one new among \(via.username)'s friends")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .oneLine()
                seeAll
            }
        } else if !model.suggestions.isEmpty {
            SectionCard(title: model.justAdded.map { "Friends of \($0.username)" } ?? "People you may know", icon: "users") {
                ForEach(model.suggestions.prefix(shown)) { s in
                    PersonRow(name: s.username, detail: s.why) {
                        switch model.asked[s.id] {
                        case .sent: status("Requested", icon: "check")
                        case .friends: status("Friends", icon: "check")
                        case .failed(let message): NoticeView(ok: false, text: message, compact: true).frame(maxWidth: 160)
                        case nil:
                            SmallButton(title: "Add", icon: "user-plus", primary: true) { Task { await model.ask(s) } }
                            Button {
                                Haptic.select()
                                withAnimation(.snappy) { model.hide(s) }
                            } label: {
                                HeroIcon("x-mark", size: 16)
                                    .foregroundStyle(.secondary)
                                    .frame(width: 36, height: 44)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.pressIn)
                            .accessibilityLabel("Hide \(s.username)")
                        }
                    }
                }
                if model.justAdded != nil { seeAll }
            }
        }
    }

    private var seeAll: some View {
        Button("See all suggestions") { Task { await model.showAllSuggestions() } }
            .font(.brand(.footnote, .bold))
            .foregroundStyle(Color.ink)
            .buttonStyle(.pressIn)
    }

    private func status(_ text: String, icon: String) -> some View {
        Label(text, hero: icon, size: 14)
            .font(.brand(.footnote, .bold))
            .foregroundStyle(.secondary)
            .labelStyle(.titleAndIcon)
            .fixedSize()
    }
}

private struct FriendsCard: View {
    let list: FriendList
    let onRemove: (FriendList.Person) -> Void

    var body: some View {
        SectionCard(title: "Friends", icon: "users") {
            Text("\(list.friends.count)")
                .font(.brand(.subheadline, .heavy))
                .foregroundStyle(.secondary)
                .fixedSize()
        } content: {
            if list.friends.isEmpty {
                Text("No friends yet. Add one above.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .oneLine()
            }
            ForEach(list.friends) { p in
                PersonRow(name: p.username) {
                    Menu {
                        Button(role: .destructive) { onRemove(p) } label: { Label("Remove friend", image: "hero-user-minus") }
                    } label: {
                        HeroIcon("ellipsis-horizontal", size: 18)
                            .foregroundStyle(.secondary)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("Options for \(p.username)")
                }
                .contextMenu {
                    Button(role: .destructive) { onRemove(p) } label: { Label("Remove friend", image: "hero-user-minus") }
                }
            }
            if !list.outgoing.isEmpty {
                Text("Pending")
                    .font(.brand(.subheadline, .heavy))
                    .foregroundStyle(Color.ink)
                    .padding(.top, 4)
                ForEach(list.outgoing) { p in
                    PersonRow(name: p.username, detail: "Waiting for them to accept") { EmptyView() }
                }
            }
        }
    }
}

// MARK: leaderboards

/// The circle's standings over a range: overall (or a category), sortable, then one game's board.
private struct LeaderboardCard: View {
    @Bindable var model: FriendsModel
    @State private var showScoring = false
    @State private var showAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let shown = 5

    var body: some View {
        SectionCard(title: "Leaderboard", icon: "trophy") {
            Button { Haptic.tap(); showScoring = true } label: {
                HeroIcon("information-circle", size: 20)
                    .foregroundStyle(Color.ink)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.pressIn)
            .accessibilityLabel("How scoring works")
        } content: {
            RangeChips(range: $model.range)

            HStack(spacing: 8) {
                chipMenu(model.scopeName, filled: model.scope != "all") {
                    Picker("Standings", selection: $model.scope) {
                        Text("Overall").tag("all")
                        ForEach(TodayModel.shared.orderedCategories) { c in
                            Label(c.name, image: "hero-\(c.hero)").tag(c.id)
                        }
                    }
                }
                chipMenu("By \(model.sort.label.lowercased())", filled: false) {
                    Picker("Sort by", selection: $model.sort) {
                        ForEach(FriendsModel.Sort.allCases) { Text($0.label).tag($0) }
                    }
                }
                Spacer(minLength: 0)
            }

            if let error = model.statsError, model.stats == nil {
                NoticeView(ok: false, text: error)
            } else if model.stats == nil {
                ProgressView().frame(maxWidth: .infinity, minHeight: 60)
            } else if model.standings.isEmpty {
                Text("No scores \(model.scope == "all" ? "" : "in \(model.scopeName) ")\(model.range == .all ? "yet" : "in this range").")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .oneLine()
            } else {
                standings
                gameBoard
            }
        }
        .sensoryFeedback(.selection, trigger: model.scope)
        .sensoryFeedback(.selection, trigger: model.sort)
        .sheet(isPresented: $showScoring) { ScoringInfoView() }
    }

    private var standings: some View {
        let all = model.standings
        let board = leaders(all, top: shown) { $0.username == model.me }
        return VStack(spacing: 2) {
            ForEach(Array((showAll ? all : board.top).enumerated()), id: \.element.id) { i, p in playerRow(p, place: i + 1) }
            if !showAll, let mine = board.me {
                if board.gap { BoardGap() }
                playerRow(mine, place: (all.firstIndex(of: mine) ?? 0) + 1)
            }
            if board.hidden > 0 {
                showAllButton(count: all.count)
            }
            Text("Crowns and wins need two players that day")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .oneLine()
                .padding(.top, 4)
        }
        .animation(reduceMotion ? nil : .snappy, value: all.map(\.id))
    }

    private func playerRow(_ p: Stats.Player, place: Int) -> some View {
        let isMe = p.username == model.me
        return HStack(spacing: 8) {
            RankBadge(rank: place, size: 22)
            VStack(alignment: .leading, spacing: 0) {
                Text(p.username).font(.brand(.subheadline, isMe ? .heavy : .semibold)).oneLine()
                HStack(spacing: 8) {
                    stat("crown", p.crowns, "crowns")
                    stat("wins", p.wins, "wins")
                    stat("played", p.played, "played")
                    if p.streak > 0 {
                        Label("\(p.streak)", hero: "fire", size: 12).labelStyle(.titleAndIcon)
                    }
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .oneLine()
            }
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(model.value(p))").font(.brand(.subheadline, .heavy)).rolling(model.value(p))
                Text(model.sort == .points ? "pts" : model.sort.label.lowercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .lineLimit(1)
            .fixedSize()
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(isMe ? Color.highlight : Color.clear))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(ordinal(place)), \(isMe ? "you" : p.username): \(p.points) points, \(p.crowns) crowns, \(p.wins) wins, \(p.played) played, \(p.streak)-day streak")
    }

    @ViewBuilder
    private func stat(_ key: String, _ n: Int, _ word: String) -> some View {
        let active = model.sort.rawValue == (key == "crown" ? "crowns" : key)
        return Group {
            if key == "crown" {
                Label("\(n)", hero: "trophy", filled: active, size: 12).labelStyle(.titleAndIcon)
            } else {
                Text("\(n) \(n == 1 && word == "wins" ? "win" : word)")
            }
        }
        .fontWeight(active ? .heavy : .semibold)
    }

    @ViewBuilder
    private var gameBoard: some View {
        if let board = model.gameBoard, let game = TodayModel.shared.games.first(where: { $0.id == board.gameId }) {
            Divider().padding(.vertical, 4)
            HStack(spacing: 10) {
                GameAvatar(game: game, size: 32)
                Menu {
                    Picker("Game", selection: Binding(get: { board.gameId }, set: { model.gameId = $0 })) {
                        ForEach(model.gameBoards) { b in
                            Text(TodayModel.shared.games.first { $0.id == b.gameId }?.name ?? b.gameId).tag(b.gameId)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(game.name).font(.brand(.subheadline, .heavy)).lineLimit(1)
                        HeroIcon("chevron-down", size: 12)
                    }
                    .foregroundStyle(Color.ink)
                }
                .menuIndicator(.hidden)
                .accessibilityLabel("Game: \(game.name)")
                Spacer(minLength: 0)
                Text("Best · Avg").font(.caption2.weight(.bold)).foregroundStyle(.secondary).fixedSize()
            }
            VStack(spacing: 2) {
                ForEach(Array(board.entries.enumerated()), id: \.element.id) { i, e in
                    let isMe = e.username == model.me
                    HStack(spacing: 8) {
                        RankBadge(rank: i + 1, size: 22)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(e.username).font(.brand(.footnote, isMe ? .heavy : .semibold)).oneLine()
                            Text("\(e.wins) \(e.wins == 1 ? "win" : "wins") · \(e.played) played").font(.caption2.weight(.semibold)).foregroundStyle(.secondary).oneLine()
                        }
                        Text("\(e.bestDisplay) · \(e.avgDisplay)")
                            .font(.brand(.footnote, .heavy))
                            .monospacedDigit()
                            .lineLimit(1)
                            .fixedSize()
                    }
                    .foregroundStyle(Color.ink)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(isMe ? Color.highlight : Color.clear))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(ordinal(i + 1)), \(isMe ? "you" : e.username): best \(e.bestDisplay), average \(e.avgDisplay), \(e.wins) wins, \(e.played) played")
                }
            }
            Text("Ranked by best ever, then average (\(board.better == "higher" ? "higher" : "lower") is better).")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .oneLine()
        }
    }

    private func showAllButton(count: Int) -> some View {
        Button {
            Haptic.select()
            withAnimation(reduceMotion ? nil : .snappy) { showAll.toggle() }
        } label: {
            HStack(spacing: 4) {
                Text(showAll ? "Show less" : "Show all \(count)")
                HeroIcon(showAll ? "chevron-up" : "chevron-down", size: 12)
            }
            .font(.brand(.footnote, .bold))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 32)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressIn)
    }

    /// A pill that opens a picker, like the crown card's Overall menu.
    private func chipMenu<C: View>(_ title: String, filled: Bool, @ViewBuilder content: () -> C) -> some View {
        Menu(content: content) {
            HStack(spacing: 4) {
                Text(title).lineLimit(1)
                HeroIcon("chevron-down", size: 12)
            }
            .font(.brand(.footnote, .bold))
            .foregroundStyle(filled ? Color.onAccent : Color.ink)
            .padding(.horizontal, 12)
            .frame(minHeight: 32)
            .background(Capsule().fill(filled ? Color.sun : Color.canvas))
            .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
        }
        .menuIndicator(.hidden)
        .fixedSize()
    }
}
#endif
