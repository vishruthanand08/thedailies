#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

struct TodayView: View {
    @State private var model = TodayModel.shared
    @State private var queue = SubmissionQueue.shared
    @State private var path: [String] = []
    /// How far the day's page is slid sideways while swiping between days.
    @State private var pageOffset: CGFloat = 0
    @State private var paging = false
    @State private var pageWidth: CGFloat = 400
    /// The game search under the crown, and the category filter beside it (like the website).
    @State private var query = ""
    @State private var only = "all"
    /// The Arrange groups sheet (from a group's ⠿ handle).
    @State private var arranging = false
    var goToFriends: () -> Void = {}

    private var searchText: String { query.trimmingCharacters(in: .whitespaces).lowercased() }
    private var filtering: Bool { !searchText.isEmpty || only != "all" }

    /// The groups with only the games that match. While searching or filtering every group shows
    /// open, and reordering is off (the rows on screen aren't the whole group).
    private var shownGroups: [TodayModel.Group] {
        model.groups.compactMap { g in
            guard only == "all" || g.id == only else { return nil }
            let games = searchText.isEmpty ? g.games : g.games.filter { $0.name.lowercased().contains(searchText) }
            guard !games.isEmpty else { return nil }
            return TodayModel.Group(id: g.id, title: g.title, icon: g.icon, games: games, movable: g.movable)
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            dayPage
            .scrollContentBackground(.hidden)
            .scrollIndicators(.hidden) // swipe, no scroll bar
            .offset(x: pageOffset)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pageWidth = $0 }
            .background(Color.canvas.ignoresSafeArea())
            // content scrolls under an opaque canvas strip behind the status bar
            .safeAreaInset(edge: .top, spacing: 0) { Color.clear.frame(height: 0).background(Color.canvas) }
            .toolbar(.hidden, for: .navigationBar)
            .navigationTitle(model.title) // still used for the back button on a game's screen
            .navigationDestination(for: String.self) { id in
                if let game = model.games.first(where: { $0.id == id }) {
                    GameDetailView(game: game)
                }
            }
            .refreshable { await model.reload() }
            .overlay {
                if model.board == nil && model.error == nil { ProgressView() }
            }
        }
        .tint(Color.ink)
        .sheet(isPresented: $arranging) { ArrangeGroups(model: model) }
        .task {
            if model.board == nil { await model.load() }
            #if DEBUG
            // -dailiesGame <gameId>: open that game's screen (scripted Simulator runs)
            if path.isEmpty, let id = UserDefaults.standard.string(forKey: "dailiesGame") { path = [id] }
            #endif
        }
        .sensoryFeedback(.selection, trigger: model.date)
        .sensoryFeedback(.selection, trigger: model.crownScope) // Overall / a category's standings
        .sensoryFeedback(trigger: queue.banner) { _, banner in
            switch banner?.kind {
            case .ok: .success
            case .err: .error
            case nil: nil
            }
        }
    }

    private var dayPage: some View {
        List {
            if let error = model.error, model.board == nil {
                EmptyState(art: "EmptyOffline", icon: "signal-slash", title: "Couldn't load", message: error,
                           action: ("Try again", { Task { await model.reload() } }))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            // the date title is part of the page, so it slides with the day instead of
            // staying put in the navigation bar while the content moves under it
            Text(model.title)
                .font(.brand(.title, .heavy))
                .foregroundStyle(Color.ink)
                .oneLine()
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("dayTitle")
                .listRowInsets(EdgeInsets(top: 8, leading: 4, bottom: 0, trailing: 0))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

            if let board = model.board {
                CrownCard(board: board, model: model, goToFriends: goToFriends,
                          onDrag: dragChanged, onDragEnd: dragEnded, onPage: page)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            if !model.groups.isEmpty {
                SearchRow(query: $query, only: $only, groups: model.groups)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 0, trailing: 4))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                if filtering && shownGroups.isEmpty {
                    Text(searchText.isEmpty ? "No games in this group." : "No games match \u{201C}\(query.trimmingCharacters(in: .whitespaces))\u{201D}.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .oneLine(.center)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }

            // one section per group; press and drag a game to reorder it within its group
            ForEach(shownGroups) { group in
                Section {
                    if filtering || !model.isCollapsed(group) {
                        ForEach(group.games) { row($0) }
                            .onMove(perform: filtering ? nil : { from, to in
                                Haptic.tap() // dropped in place
                                model.move(in: group.id, from: from, to: to)
                            })
                    }
                } header: {
                    groupHeader(group)
                } footer: {
                    if group.id == shownGroups.last?.id && model.favorites.isEmpty && !filtering {
                        Text("Tap to play. Played? Tap for the leaderboard.").oneLine()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollDismissesKeyboard(.immediately)
    }

    // MARK: swiping between days

    /// The page follows the finger; moving forward past today only gives a little.
    private func dragChanged(_ dx: CGFloat) {
        guard !paging else { return }
        pageOffset = (dx < 0 && model.isToday) ? dx * 0.2 : dx
    }

    /// Far or fast enough: slide this day off and the next one in. Otherwise spring back.
    private func dragEnded(_ dx: CGFloat, predicted: CGFloat) {
        guard !paging else { return }
        let forward = dx < 0
        let far = abs(dx) > pageWidth * 0.3 || abs(predicted) > pageWidth * 0.5
        guard far, !(forward && model.isToday) else {
            withAnimation(.spring(duration: 0.3, bounce: 0.2)) { pageOffset = 0 }
            return
        }
        page(forward ? 1 : -1)
    }

    private func page(_ days: Int) {
        guard !paging, !(days > 0 && model.isToday) else { return }
        paging = true
        let out: CGFloat = days > 0 ? -pageWidth : pageWidth
        withAnimation(.easeIn(duration: 0.16)) {
            pageOffset = out
        } completion: {
            Task {
                await model.shiftDay(days)
                // the new day comes in from the other side
                var t = Transaction()
                t.disablesAnimations = true
                withTransaction(t) { pageOffset = -out }
                withAnimation(.spring(duration: 0.32, bounce: 0.12)) {
                    pageOffset = 0
                } completion: {
                    paging = false
                }
            }
        }
    }

    /// A group's header: tap to open or close it; its ⠿ handle opens Arrange groups. (Dragging a
    /// header inside the List doesn't work: the List's own game reordering takes the drag.)
    private func groupHeader(_ group: TodayModel.Group) -> some View {
        let open = filtering || !model.isCollapsed(group)
        return HStack(spacing: 8) {
            Button { Haptic.select(); withAnimation(.snappy) { model.toggleCollapsed(group) } } label: {
                HStack(spacing: 8) {
                    HeroIcon("chevron-right", size: 14)
                        .rotationEffect(.degrees(open ? 90 : 0))
                    HeroIcon(group.icon, filled: group.id == "favorites")
                        .foregroundStyle(group.id == "favorites" ? Color.sun : Color.ink)
                    Text(group.title).oneLine()
                    Text("\(group.games.count)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7)
                        .background(Capsule().fill(Color.surface))
                        .layoutPriority(1)
                }
                .frame(minHeight: 36)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain) // headers stay still; only games and buttons press in
            .accessibilityLabel("\(group.title), \(group.games.count) games")
            .accessibilityValue(open ? "Expanded" : "Collapsed")
            .accessibilityHint(open ? "Collapses the group" : "Expands the group")
            Spacer(minLength: 0)
            if group.movable {
                Button {
                    Haptic.tap()
                    arranging = true
                } label: {
                    DragDots()
                        .frame(width: 44, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.pressIn)
                .accessibilityLabel("Arrange groups")
            }
        }
        .font(.brand(.footnote, .heavy))
        .foregroundStyle(Color.ink)
        .textCase(nil)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .modifier(CategoryMoves(group: group, model: model))
    }

    // MARK: game rows

    /// Played today (or looking back at a day): the game's leaderboard. Not played yet: the game.
    private func opensBoard(_ game: Game) -> Bool {
        !model.isToday || model.myEntry(for: game) != nil
    }

    private func open(_ game: Game) {
        if opensBoard(game) { path.append(game.id) } else { model.play(game) }
    }

    private func row(_ game: Game) -> some View {
        let entries = model.entries(for: game)
        let mine = model.myEntry(for: game)
        let favorite = model.prefs.favorites.contains(game.id)
        return Button { Haptic.tap(); open(game) } label: {
            GameCard(game: game, entries: entries, mine: mine, me: model.me, isToday: model.isToday)
        }
        .buttonStyle(.pressIn)
        // each game is its own card, like the website's tiles
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 8, trailing: 4))
        .accessibilityHint(opensBoard(game) ? "Shows the leaderboard" : "Opens the game")
        // no long-press menu: press and hold is how a game is dragged to a new place. Swiping
        // left offers Leaderboard (and Play or Delete score); VoiceOver gets the same as actions.
        .accessibilityAction(named: "Leaderboard") { path.append(game.id) }
        .swipeActions(edge: .leading) {
            Button { Haptic.tap(); model.toggleFavorite(game) } label: {
                Label(favorite ? "Unfavorite" : "Favorite", image: favorite ? "hero-star" : "hero-star-fill")
            }
            .tint(Color.sun)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if model.isToday {
                if let mine {
                    Button(role: .destructive) { Haptic.warning(); Task { await model.delete(mine) } } label: {
                        Label("Delete score", image: "hero-trash")
                    }
                } else {
                    Button { Haptic.tap(); model.play(game) } label: { Label("Play", image: "hero-play-fill") }
                        .tint(Color.ink)
                }
            }
            Button { Haptic.tap(); path.append(game.id) } label: { Label("Leaderboard", image: "hero-numbered-list") }
                .tint(Color.highlight)
        }
    }
}

/// The day's standings. Swipe it right for the day before, left to come forward again.
private struct CrownCard: View {
    let board: Board
    let model: TodayModel
    let goToFriends: () -> Void
    let onDrag: (CGFloat) -> Void
    let onDragEnd: (_ dx: CGFloat, _ predicted: CGFloat) -> Void
    let onPage: (Int) -> Void
    @State private var showScoring = false
    /// The whole standings instead of the top five (and me).
    @State private var showAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let shown = 5

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Label("Daily crown", hero: "trophy", filled: true, size: 18)
                    .font(.brand(.headline, .heavy))
                    .oneLine()
                Button { Haptic.tap(); showScoring = true } label: {
                    HeroIcon("information-circle", size: 20)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.pressIn)
                .accessibilityLabel("How scoring works")
                if !model.isToday {
                    HeroIcon("clock", size: 18)
                }
                // Overall, or one category's winners (NYT, LinkedIn, ...)
                Menu {
                    Picker("Standings", selection: Binding(get: { model.crownScope }, set: { model.crownScope = $0 })) {
                        Text("Overall").tag("all")
                        ForEach(model.orderedCategories) { c in
                            Label(c.name, image: "hero-\(c.hero)").tag(c.id)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(model.crownScopeName).lineLimit(1)
                        HeroIcon("chevron-down", size: 12)
                    }
                    .font(.brand(.footnote, .bold))
                    .foregroundStyle(Color.onAccent)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 28)
                    .background(Capsule().fill(Color.white.opacity(0.75)))
                    .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                    .layoutPriority(1)
                }
                .menuIndicator(.hidden)
                .fixedSize()
                .accessibilityLabel("Standings: \(model.crownScopeName)")
            }
            .foregroundStyle(Color.onAccent)

            if model.crown.isEmpty {
                Text(model.crownScope != "all" ? "Nobody has played these games \(model.isToday ? "yet today" : "this day")."
                     : model.isToday ? "No scores yet. Play a game to take the lead." : "Nobody played this day.")
                    .font(.footnote)
                    .foregroundStyle(Color.onAccent.opacity(0.8))
                    .oneLine()
            } else {
                let board = leaders(model.crown, top: shown) { $0.username == model.me }
                VStack(spacing: 0) {
                    ForEach(showAll ? model.crown : board.top) { crownRow($0) }
                    // further down than the top five: still see your own place
                    if !showAll, let mine = board.me {
                        if board.gap { BoardGap() }
                        crownRow(mine)
                    }
                }
                // a new score that changes the order slides the rows into place
                .animation(reduceMotion ? nil : .snappy, value: model.crown.map(\.id))
                if board.hidden > 0 {
                    Button {
                        Haptic.select()
                        withAnimation(reduceMotion ? nil : .snappy) { showAll.toggle() }
                    } label: {
                        HStack(spacing: 4) {
                            Text(showAll ? "Show less" : "Show all \(model.crown.count)")
                            HeroIcon(showAll ? "chevron-up" : "chevron-down", size: 12)
                        }
                        .font(.brand(.footnote, .bold))
                        .foregroundStyle(Color.onAccent.opacity(0.75))
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressIn)
                    .accessibilityLabel(showAll ? "Show the top \(shown)" : "Show all \(model.crown.count) players")
                }
            }

            if board.circleSize <= 1 {
                Button(action: goToFriends) {
                    Label("Add friends to compete", hero: "user-plus")
                        .font(.brand(.footnote, .bold))
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(Color.onAccent)
                }
                .buttonStyle(.pressIn(.white))
            }

            let hint = model.isToday ? "Swipe right for earlier days" : "Swipe left to come back to today"
            Label(hint,
                  hero: model.isToday ? "chevron-double-left" : "chevron-double-right", size: 14)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Color.onAccent.opacity(0.6))
                .oneLine()
        }
        .padding(14)
        .chunkyCard(.sun)
        .padding(.trailing, 4)
        .padding(.bottom, 4)
        .contentShape(Rectangle())
        // simultaneous: inside the List, a plain .gesture loses to the list's own scrolling.
        // global space: the whole page slides under the finger, so local coordinates would drift.
        .simultaneousGesture(
            DragGesture(minimumDistance: 15, coordinateSpace: .global)
                .onChanged { v in
                    guard abs(v.translation.width) > abs(v.translation.height) else { return }
                    onDrag(v.translation.width)
                }
                .onEnded { v in
                    onDragEnd(v.translation.width, v.predictedEndTranslation.width)
                }
        )
        .sheet(isPresented: $showScoring) { ScoringInfoView() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crownCard")
        // swipe-only isn't accessible: VoiceOver gets the same moves as actions
        .accessibilityAction(named: "Previous day") { onPage(-1) }
        .accessibilityAction(named: "Next day") { onPage(1) }
    }

    private func crownRow(_ entry: Board.CrownEntry) -> some View {
        let rank = entry.rank ?? (model.crown.firstIndex(of: entry) ?? 0) + 1
        let mine = entry.username == model.me
        return HStack(spacing: 8) {
            RankBadge(rank: rank, onAccent: true, size: 22)
            HStack(spacing: 6) {
                Text(entry.username).font(.brand(.subheadline, mine ? .heavy : .semibold))
                Text("\(entry.games) game\(entry.games == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(Color.onAccent.opacity(0.7))
            }
            .oneLine()
            Text("\(entry.points) pts").font(.brand(.subheadline, .heavy)).rolling(entry.points).lineLimit(1).layoutPriority(1)
        }
        .foregroundStyle(Color.onAccent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(mine ? Color.white.opacity(0.85) : Color.clear))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ordinal(rank)), \(mine ? "you" : entry.username), \(entry.points) points from \(entry.games) games")
    }
}

/// One game, drawn like the website's tile: the game's tile and name, then the day's top scores
/// with mine in lilac. Played today: my result and the time until the next puzzle instead of
/// Play, and tapping opens the leaderboard.
struct GameCard: View {
    let game: Game
    let entries: [BoardEntry]
    let mine: BoardEntry?
    let me: String?
    let isToday: Bool

    /// Three is enough to see who's winning; the leaderboard has the rest.
    private let shown = 3
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                GameAvatar(game: game, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(game.name).font(.brand(.subheadline, .heavy)).foregroundStyle(Color.ink)
                        if game.paid != nil {
                            HeroIcon("currency-dollar", size: 16)
                                .foregroundStyle(.secondary)
                                .accessibilityElement()
                                .accessibilityLabel("Needs a subscription")
                        }
                    }
                    .oneLine()
                    if isToday && mine != nil {
                        NextPuzzle()
                    } else if !isToday {
                        Text("Tap for the leaderboard").font(.caption).foregroundStyle(.secondary).oneLine()
                    }
                }
                if let mine, isToday {
                    Text(mine.display)
                        .font(.brand(.subheadline, .heavy))
                        .monospacedDigit()
                        .lineLimit(1)
                        .foregroundStyle(Color.ink)
                        .layoutPriority(1)
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.4).combined(with: .opacity))
                } else if isToday {
                    // a cue only: the whole card plays the game
                    Text("Play")
                        .font(.brand(.footnote, .heavy))
                        .lineLimit(1)
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 30)
                        .background(Capsule().fill(Color.sun))
                        .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                        .layoutPriority(1)
                        .transition(.opacity)
                }
            }
            // a score you just added springs in where Play was
            .animation(reduceMotion ? nil : .spring(duration: 0.4, bounce: 0.35), value: mine?.display)

            if entries.isEmpty {
                Text(isToday ? "No scores yet. Be the first." : "Nobody played this day.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .oneLine()
            } else {
                let board = leaders(entries, top: shown) { $0.username == me }
                VStack(spacing: 2) {
                    ForEach(board.top) { scoreRow($0) }
                    // further down than the top three: still see your own place
                    if let mine = board.me {
                        if board.gap { BoardGap() }
                        scoreRow(mine)
                    }
                    if board.hidden > 0 {
                        Text("+\(board.hidden) more")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 8)
                            .padding(.top, 2)
                    }
                }
                .animation(reduceMotion ? nil : .snappy, value: entries.map(\.id))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .chunkyCard(.surface)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func scoreRow(_ e: BoardEntry) -> some View {
        let isMe = e.username == me
        return HStack(spacing: 8) {
            RankBadge(rank: e.rank, size: 22)
            Text(e.username).font(.brand(.footnote, isMe ? .heavy : .semibold)).oneLine()
            Text(e.display).font(.brand(.footnote, .heavy)).monospacedDigit().lineLimit(1).layoutPriority(1)
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(isMe ? Color.highlight : Color.clear))
    }
}

/// Search games by name, and filter to one group with the funnel (the website's search row).
/// The field sinks into its shadow while you type, like the site's.
private struct SearchRow: View {
    @Binding var query: String
    @Binding var only: String
    let groups: [TodayModel.Group]
    @FocusState private var focused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var picked: TodayModel.Group? { groups.first { $0.id == only } }

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                HeroIcon("magnifying-glass", size: 18).foregroundStyle(.secondary)
                TextField("Search games", text: $query)
                    .font(.brand(.subheadline, .semibold))
                    .foregroundStyle(Color.ink)
                    .focused($focused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                if !query.isEmpty {
                    Button {
                        Haptic.tap()
                        query = ""
                    } label: {
                        HeroIcon("x-mark", size: 16)
                            .foregroundStyle(.secondary)
                            .frame(width: 32, height: 32)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, query.isEmpty ? 12 : 4)
            .frame(minHeight: 44)
            .modifier(Sunken(down: focused, fill: .surface))
            .contentShape(Rectangle())
            .onTapGesture { focused = true }

            // one tap to a group: All games, Favorites, NYT, LinkedIn, ...
            Menu {
                Picker("Show", selection: $only) {
                    Label("All games", image: "hero-squares-2x2").tag("all")
                    ForEach(groups) { g in
                        Label(g.title, image: "hero-\(g.icon)").tag(g.id)
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    HeroIcon("funnel", filled: picked != nil, size: 18)
                    if let picked { Text(picked.title).lineLimit(1) }
                }
                .font(.brand(.footnote, .bold))
                .foregroundStyle(picked != nil ? Color.onAccent : Color.ink)
                .padding(.horizontal, 12)
                .frame(minWidth: 44, minHeight: 44)
                .modifier(Sunken(down: false, fill: picked != nil ? .sun : .surface))
            }
            .menuIndicator(.hidden)
            .fixedSize()
            .accessibilityLabel(picked.map { "Showing \($0.title)" } ?? "Filter games")
        }
        .sensoryFeedback(.selection, trigger: only)
        .animation(reduceMotion ? nil : .snappy(duration: 0.15), value: focused)
        .animation(reduceMotion ? nil : .snappy, value: query.isEmpty)
    }
}

/// The chunky look for a field: outline and hard shadow, sitting down onto the shadow while active.
private struct Sunken: ViewModifier {
    let down: Bool
    let fill: Color

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        content
            .background(shape.fill(fill))
            .overlay(shape.strokeBorder(Color.onAccent, lineWidth: 2))
            .offset(x: down ? 3 : 0, y: down ? 3 : 0)
            .background(shape.fill(Color.onAccent).offset(x: 3, y: 3).opacity(down ? 0 : 1))
    }
}

/// "Next in 4h 12m" to local midnight, when most games put out the next puzzle (the website's
/// countdown); seconds in the last hour.
struct NextPuzzle: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            Text("Next in \(Self.label(at: context.date))")
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .oneLine()
        }
        .accessibilityLabel("Played. Next puzzle at midnight")
    }

    static func label(at now: Date) -> String {
        // the next calendar day, not +24h: a daylight-saving day is 23 or 25 hours long
        let today = Calendar.current.startOfDay(for: now)
        let midnight = Calendar.current.date(byAdding: .day, value: 1, to: today) ?? today.addingTimeInterval(86400)
        let secs = max(0, Int(midnight.timeIntervalSince(now)))
        let h = secs / 3600, m = secs % 3600 / 60, s = secs % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m \(String(format: "%02d", s))s"
    }
}


/// Drag categories into the order Today shows them, with the system's reorder handles.
private struct ArrangeGroups: View {
    let model: TodayModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(model.orderedCategories) { c in
                        Label(c.name, hero: c.hero)
                            .font(.brand(.subheadline, .bold))
                            .foregroundStyle(Color.ink)
                    }
                    .onMove { from, to in
                        Haptic.tap()
                        withAnimation(.snappy) { model.moveCategories(from: from, to: to) }
                    }
                } footer: {
                    Text("Favorites stay on top. Drag the others into the order you want.")
                }
            }
            .environment(\.editMode, .constant(.active))
            .scrollContentBackground(.hidden)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Arrange groups")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.font(.brand(.headline, .bold))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .tint(Color.ink)
    }
}

/// VoiceOver's Move Up / Move Down on a category's header.
private struct CategoryMoves: ViewModifier {
    let group: TodayModel.Group
    let model: TodayModel

    func body(content: Content) -> some View {
        if group.movable {
            content
                .accessibilityAction(named: "Move up") { withAnimation { model.moveCategory(group.id, by: -1) } }
                .accessibilityAction(named: "Move down") { withAnimation { model.moveCategory(group.id, by: 1) } }
        } else {
            content
        }
    }
}

/// The website's ⠿ drag handle: two columns of three dots.
private struct DragDots: View {
    var body: some View {
        Grid(horizontalSpacing: 4, verticalSpacing: 4) {
            ForEach(0..<3, id: \.self) { _ in
                GridRow {
                    Circle().frame(width: 4.5, height: 4.5)
                    Circle().frame(width: 4.5, height: 4.5)
                }
            }
        }
        .foregroundStyle(Color.ink.opacity(0.6))
    }
}
#endif
