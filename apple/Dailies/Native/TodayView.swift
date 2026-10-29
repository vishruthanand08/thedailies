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
    var goToFriends: () -> Void = {}

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
        .task {
            if model.board == nil { await model.load() }
            #if DEBUG
            // -dailiesGame <gameId>: open that game's screen (scripted Simulator runs)
            if path.isEmpty, let id = UserDefaults.standard.string(forKey: "dailiesGame") { path = [id] }
            #endif
        }
        .sensoryFeedback(.selection, trigger: model.date)
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
                ContentUnavailableView {
                    Label("Couldn't load", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try again") { Task { await model.reload() } }
                }
                .listRowBackground(Color.clear)
            }

            // the date title is part of the page, so it slides with the day instead of
            // staying put in the navigation bar while the content moves under it
            Text(model.title)
                .font(.brand(.largeTitle, .heavy))
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

            // one section per group; press and drag a game to reorder it within its group
            ForEach(model.groups) { group in
                Section {
                    if !model.isCollapsed(group) {
                        ForEach(group.games) { row($0) }
                            .onMove { model.move(in: group.id, from: $0, to: $1) }
                    }
                } header: {
                    groupHeader(group)
                } footer: {
                    if group.id == model.groups.last?.id && model.favorites.isEmpty {
                        Text("Tap to play. Played? Tap for the leaderboard.").oneLine()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
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

    /// A group's header: click to open or close it; hold and drag it (or its handle) onto another
    /// group to move it there, like the website.
    private func groupHeader(_ group: TodayModel.Group) -> some View {
        let open = !model.isCollapsed(group)
        return HStack(spacing: 8) {
            Button { withAnimation(.snappy) { model.toggleCollapsed(group) } } label: {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.heavy))
                        .rotationEffect(.degrees(open ? 90 : 0))
                    Image(systemName: group.symbol)
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
                DragDots()
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
                    .accessibilityHidden(true)
            }
        }
        .font(.brand(.subheadline, .heavy))
        .foregroundStyle(Color.ink)
        .textCase(nil)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .modifier(CategoryDrag(group: group, model: model))
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
        return Button { open(game) } label: {
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
            Button { model.toggleFavorite(game) } label: {
                Label(favorite ? "Unfavorite" : "Favorite", systemImage: favorite ? "star.slash" : "star.fill")
            }
            .tint(Color.sun)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if model.isToday {
                if let mine {
                    Button(role: .destructive) { Task { await model.delete(mine) } } label: {
                        Label("Delete score", systemImage: "trash")
                    }
                } else {
                    Button { model.play(game) } label: { Label("Play", systemImage: "play.fill") }
                        .tint(Color.ink)
                }
            }
            Button { path.append(game.id) } label: { Label("Leaderboard", systemImage: "list.number") }
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

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label("Daily crown", systemImage: "crown.fill")
                    .font(.brand(.title3, .heavy))
                    .oneLine()
                Button { showScoring = true } label: {
                    Image(systemName: "info.circle")
                        .font(.body.weight(.semibold))
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.pressIn)
                .accessibilityLabel("How scoring works")
                if !model.isToday {
                    Image(systemName: "clock.arrow.circlepath").font(.subheadline.weight(.bold)).accessibilityHidden(true)
                }
                // Overall, or one category's winners (NYT, LinkedIn, ...)
                Menu {
                    Picker("Standings", selection: Binding(get: { model.crownScope }, set: { model.crownScope = $0 })) {
                        Text("Overall").tag("all")
                        ForEach(model.orderedCategories) { c in
                            Label(c.name, systemImage: c.symbol).tag(c.id)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(model.crownScopeName).lineLimit(1)
                        Image(systemName: "chevron.down").font(.caption2.weight(.heavy))
                    }
                    .font(.brand(.subheadline, .bold))
                    .foregroundStyle(Color.onAccent)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 32)
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
                    .font(.subheadline)
                    .foregroundStyle(Color.onAccent.opacity(0.8))
                    .oneLine()
            } else {
                ForEach(Array(model.crown.enumerated()), id: \.element.id) { i, c in
                    crownRow(rank: c.rank ?? i + 1, entry: c)
                }
            }

            if board.circleSize <= 1 {
                Button(action: goToFriends) {
                    Label("Add friends to compete", systemImage: "person.badge.plus")
                        .font(.brand(.subheadline, .bold))
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(Color.onAccent)
                }
                .buttonStyle(.pressIn(.white))
            }

            let hint = model.isToday ? "Swipe right for earlier days" : "Swipe left to come back to today"
            Label(hint,
                  systemImage: model.isToday ? "chevron.left.2" : "chevron.right.2")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.onAccent.opacity(0.6))
                .oneLine()
        }
        .padding(16)
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

    private func crownRow(rank: Int, entry: Board.CrownEntry) -> some View {
        let mine = entry.username == model.me
        return HStack(spacing: 10) {
            RankBadge(rank: rank, onAccent: true)
            HStack(spacing: 6) {
                Text(entry.username).font(.brand(.body, mine ? .heavy : .semibold))
                Text("\(entry.games) game\(entry.games == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(Color.onAccent.opacity(0.7))
            }
            .oneLine()
            Text("\(entry.points) pts").font(.brand(.body, .heavy)).monospacedDigit().lineLimit(1).layoutPriority(1)
        }
        .foregroundStyle(Color.onAccent)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                GameAvatar(game: game, size: 42)
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(game.name).font(.brand(.headline, .heavy)).foregroundStyle(Color.ink)
                        if game.paid != nil {
                            Image(systemName: "dollarsign.circle.fill")
                                .imageScale(.small)
                                .foregroundStyle(.secondary)
                                .accessibilityLabel("Needs a subscription")
                        }
                    }
                    .oneLine()
                    if isToday && mine != nil {
                        NextPuzzle()
                    } else if !isToday {
                        Text("Tap for the leaderboard").font(.footnote).foregroundStyle(.secondary).oneLine()
                    }
                }
                if let mine, isToday {
                    Text(mine.display)
                        .font(.brand(.headline, .heavy))
                        .monospacedDigit()
                        .lineLimit(1)
                        .foregroundStyle(Color.ink)
                        .layoutPriority(1)
                } else if isToday {
                    // a cue only: the whole card plays the game
                    Text("Play")
                        .font(.brand(.subheadline, .heavy))
                        .lineLimit(1)
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 34)
                        .background(Capsule().fill(Color.sun))
                        .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                        .layoutPriority(1)
                }
            }

            if entries.isEmpty {
                Text(isToday ? "No scores yet. Be the first." : "Nobody played this day.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .oneLine()
            } else {
                VStack(spacing: 4) {
                    ForEach(entries.prefix(shown)) { scoreRow($0) }
                    if entries.count > shown {
                        Text("+\(entries.count - shown) more")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 8)
                            .padding(.top, 2)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .chunkyCard(.surface)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func scoreRow(_ e: BoardEntry) -> some View {
        let isMe = e.username == me
        return HStack(spacing: 10) {
            RankBadge(rank: e.rank)
            Text(e.username).font(.brand(.subheadline, isMe ? .heavy : .semibold)).oneLine()
            Text(e.display).font(.brand(.subheadline, .heavy)).monospacedDigit().lineLimit(1).layoutPriority(1)
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(isMe ? Color.highlight : Color.clear))
    }
}

/// "Next in 4h 12m" to local midnight, when most games put out the next puzzle (the website's
/// countdown); seconds in the last hour.
struct NextPuzzle: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            Text("Next in \(Self.label(at: context.date))")
                .font(.footnote.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .oneLine()
        }
        .accessibilityLabel("Played. Next puzzle at midnight")
    }

    static func label(at now: Date) -> String {
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(24 * 60 * 60)
        let secs = max(0, Int(midnight.timeIntervalSince(now)))
        let h = secs / 3600, m = secs % 3600 / 60, s = secs % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m \(String(format: "%02d", s))s"
    }
}


/// Hold a category's header and drag it onto another category's header to put it there.
/// VoiceOver gets Move Up / Move Down actions instead.
private struct CategoryDrag: ViewModifier {
    let group: TodayModel.Group
    let model: TodayModel
    static let prefix = "dailies-category:"

    func body(content: Content) -> some View {
        if group.movable {
            content
                .draggable(Self.prefix + group.id) {
                    Label(group.title, systemImage: group.symbol)
                        .font(.brand(.subheadline, .heavy))
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.surface))
                }
                .dropDestination(for: String.self) { items, _ in
                    guard let item = items.first, item.hasPrefix(Self.prefix) else { return false }
                    withAnimation(.snappy) { model.moveCategory(String(item.dropFirst(Self.prefix.count)), onto: group.id) }
                    return true
                }
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
