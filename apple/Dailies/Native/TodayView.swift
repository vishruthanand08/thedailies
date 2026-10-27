import SwiftUI

struct TodayView: View {
    @State private var model = TodayModel.shared
    @State private var queue = SubmissionQueue.shared
    @State private var path: [String] = []
    /// How far the day's page is slid sideways while swiping between days.
    @State private var pageOffset: CGFloat = 0
    @State private var paging = false
    @State private var pageWidth: CGFloat = 400
    #if os(macOS)
    @State private var commands = MacCommands.shared
    #endif
    var goToFriends: () -> Void = {}

    var body: some View {
        NavigationStack(path: $path) {
            dayPage
            .scrollContentBackground(.hidden)
            .offset(x: pageOffset)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pageWidth = $0 }
            .background(Color.canvas.ignoresSafeArea())
            #if os(iOS)
            // content scrolls under an opaque canvas strip behind the status bar
            .safeAreaInset(edge: .top, spacing: 0) { Color.clear.frame(height: 0).background(Color.canvas) }
            .toolbar(.hidden, for: .navigationBar)
            .navigationTitle(model.title) // still used for the back button on a game's screen
            #else
            // the Mac shows the day as the window title, with toolbar and menu commands to move between days
            .navigationTitle(model.title)
            .toolbar { macToolbar }
            .onChange(of: commands.pageRequest) { _, request in
                guard let request else { return }
                if request.days == 0 { Task { await model.load() } } else { page(request.days) }
            }
            .sheet(isPresented: $commands.addingScore) { AddScoreSheet() }
            #endif
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

    #if os(iOS)
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
            #if os(iOS)
            Text(model.title)
                .font(.brand(.largeTitle, .heavy))
                .foregroundStyle(Color.ink)
                .oneLine()
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("dayTitle")
                .listRowInsets(EdgeInsets(top: 8, leading: 4, bottom: 0, trailing: 0))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            #endif

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
                        Text("Tap a game to play it. Swipe right to favorite it.").oneLine()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
    #else
    /// The Mac follows the website: the crown card on top, then each group's games as a grid
    /// of cards with their scores right on them.
    private var dayPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let error = model.error, model.board == nil {
                    ContentUnavailableView {
                        Label("Couldn't load", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Try again") { Task { await model.reload() } }
                    }
                }
                if let board = model.board {
                    CrownCard(board: board, model: model, goToFriends: goToFriends,
                              onDrag: dragChanged, onDragEnd: dragEnded, onPage: page)
                }
                ForEach(model.groups) { group in
                    VStack(alignment: .leading, spacing: 12) {
                        groupHeader(group)
                        if !model.isCollapsed(group) {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 290), spacing: 18, alignment: .top)], alignment: .leading, spacing: 18) {
                                ForEach(group.games) { tile($0, in: group) }
                            }
                        }
                    }
                }
                if !model.games.isEmpty && model.favorites.isEmpty {
                    Text("Click a game to play it. ☆ adds it to Favorites, and you can drag games to rearrange them.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .oneLine()
                }
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 20)
            .frame(maxWidth: 1100, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }

    private func tile(_ game: Game, in group: TodayModel.Group) -> some View {
        let mine = model.myEntry(for: game)
        let favorite = model.prefs.favorites.contains(game.id)
        return MacGameTile(
            game: game, entries: model.entries(for: game), me: model.me, isToday: model.isToday, favorite: favorite,
            onPlay: { model.play(game) },
            onInfo: { path.append(game.id) },
            onFavorite: { withAnimation(.snappy) { model.toggleFavorite(game) } },
            onDelete: { entry in Task { await model.delete(entry) } }
        )
        // drag a card onto another in the same group to put it there
        .draggable(game.id) { GameAvatar(game: game, size: 42) }
        .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first, group.games.contains(where: { $0.id == id }) else { return false }
            withAnimation(.snappy) { model.move(in: group.id, id: id, onto: game.id) }
            return true
        }
        .contextMenu {
            if model.isToday { Button("Play \(game.name)") { model.play(game) } }
            Button("Show Scores") { path.append(game.id) }
            Button(favorite ? "Remove from Favorites" : "Add to Favorites") { model.toggleFavorite(game) }
            if model.isToday, let mine {
                Divider()
                Button("Delete My Score", role: .destructive) { Task { await model.delete(mine) } }
            }
        }
    }

    @ToolbarContentBuilder
    private var macToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            Button { page(-1) } label: { Label("Previous Day", systemImage: "chevron.backward") }
                .help("Previous day (⌘[)")
            Button { page(1) } label: { Label("Next Day", systemImage: "chevron.forward") }
                .help("Next day (⌘])")
                .disabled(model.isToday)
        }
        ToolbarItem(placement: .primaryAction) {
            Button { commands.addingScore = true } label: { Label("Add Score", systemImage: "plus") }
                .help("Add a score (⌘N)")
        }
    }
    #endif

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
                    #if os(macOS)
                    Text(group.title).lineLimit(1)
                    #else
                    Text(group.title).oneLine()
                    #endif
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
            #if os(macOS)
            .fixedSize()
            #endif
            .accessibilityLabel("\(group.title), \(group.games.count) games")
            .accessibilityValue(open ? "Expanded" : "Collapsed")
            .accessibilityHint(open ? "Collapses the group" : "Expands the group")
            Spacer(minLength: 0)
            if group.movable {
                DragDots()
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
                    #if os(macOS)
                    .help("Drag to move this group")
                    #endif
                    .accessibilityHidden(true)
            }
        }
        #if os(macOS)
        .font(.brand(.title3, .heavy)) // the site's big group titles
        #else
        .font(.brand(.subheadline, .heavy))
        #endif
        .foregroundStyle(Color.ink)
        .textCase(nil)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .modifier(CategoryDrag(group: group, model: model))
    }

    // MARK: game rows

    #if os(iOS)
    private func row(_ game: Game) -> some View {
        let entries = model.entries(for: game)
        let mine = model.myEntry(for: game)
        let favorite = model.prefs.favorites.contains(game.id)
        let info = Button { path.append(game.id) } label: {
            Image(systemName: "info.circle")
                .font(.title3)
                .foregroundStyle(Color.ink.opacity(0.7))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.pressIn)
        .accessibilityLabel("\(game.name) scores")
        return Button { model.play(game) } label: {
            GameRow(game: game, entries: entries, mine: mine, isToday: model.isToday)
                .padding(.trailing, 40) // room for the info button on top
        }
        .buttonStyle(.pressIn)
        .overlay(alignment: .trailing) { info }
        .listRowBackground(Color.surface)
        .accessibilityHint(model.isToday ? "Opens the game" : "")
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
        }
    }
    #endif
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
                #if os(macOS)
                .help("How scoring works")
                #endif
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

            #if os(iOS)
            let hint = model.isToday ? "Swipe right for earlier days" : "Swipe left to come back to today"
            #else
            let hint = model.isToday ? "Drag right or press ⌘[ for earlier days" : "Drag left or press ⌘] to come forward"
            #endif
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

/// One game in the list: who's winning and how I did, or a Play button if I haven't played.
struct GameRow: View {
    let game: Game
    let entries: [BoardEntry]
    let mine: BoardEntry?
    let isToday: Bool

    private var subtitle: String {
        if let mine { return "\(ordinal(mine.rank)) of \(entries.count)" }
        if let leader = entries.first { return "\(leader.username) leads · \(leader.display)" }
        return isToday ? "No scores yet" : "Nobody played"
    }

    var body: some View {
        HStack(spacing: 12) {
            GameAvatar(game: game)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(game.name).font(.brand(.headline, .bold)).foregroundStyle(Color.ink)
                    if game.paid != nil {
                        Image(systemName: "dollarsign.circle.fill")
                            .imageScale(.small)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel("Needs a subscription")
                    }
                }
                .oneLine()
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary).oneLine()
            }
            if let mine {
                Text(mine.display)
                    .font(.brand(.headline, .heavy))
                    .monospacedDigit()
                    .lineLimit(1)
                    .foregroundStyle(Color.ink)
                    .layoutPriority(1)
            } else if isToday {
                // a cue only: the whole row plays the game
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
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

#if os(macOS)
/// One game as a card, like the website's tiles: the game, then the day's scores. Clicking the
/// card plays the game; hovering sinks it into its shadow, the same press-in as the buttons.
private struct MacGameTile: View {
    let game: Game
    let entries: [BoardEntry]
    let me: String?
    let isToday: Bool
    let favorite: Bool
    let onPlay: () -> Void
    let onInfo: () -> Void
    let onFavorite: () -> Void
    let onDelete: (BoardEntry) -> Void
    @State private var hovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let shadow: CGFloat = 5

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        let down = hovering && isToday
        VStack(alignment: .leading, spacing: 10) {
            header
            if entries.isEmpty {
                Text(isToday ? "No scores yet. Be first." : "Nobody played.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .oneLine()
                    .padding(.horizontal, 2)
            } else {
                VStack(spacing: 2) {
                    ForEach(entries) { scoreRow($0) }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(shape.fill(Color.surface))
        .overlay(shape.strokeBorder(Color.onAccent, lineWidth: 2.5))
        .offset(x: down ? shadow : 0, y: down ? shadow : 0)
        .background(shape.fill(Color.onAccent).offset(x: shadow, y: shadow).opacity(down ? 0 : 1))
        .padding(.trailing, shadow)
        .padding(.bottom, shadow)
        .contentShape(shape)
        .onHover { hovering = $0 }
        .onTapGesture { if isToday { onPlay() } }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: down)
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: "Play \(game.name)") { onPlay() }
    }

    private var header: some View {
        HStack(spacing: 10) {
            GameAvatar(game: game, size: 42)
            VStack(alignment: .leading, spacing: 2) {
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
                if isToday {
                    Label("Play", systemImage: "arrow.up.right")
                        .labelStyle(.titleAndIcon)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.ink.opacity(0.75))
                        .oneLine()
                }
            }
            Button(action: onFavorite) {
                Image(systemName: favorite ? "star.fill" : "star")
                    .font(.title3)
                    .foregroundStyle(favorite ? Color.sun : Color.ink.opacity(0.6))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.pressIn)
            .help(favorite ? "Remove from Favorites" : "Add to Favorites")
            .accessibilityLabel(favorite ? "Remove \(game.name) from favorites" : "Add \(game.name) to favorites")
            Button(action: onInfo) {
                Image(systemName: "info.circle")
                    .font(.title3)
                    .foregroundStyle(Color.ink.opacity(0.6))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.pressIn)
            .help("Show scores")
            .accessibilityLabel("\(game.name) scores")
        }
    }

    private func scoreRow(_ e: BoardEntry) -> some View {
        let mine = e.username == me
        return HStack(spacing: 8) {
            Text(["🥇", "🥈", "🥉"].indices.contains(e.rank - 1) ? ["🥇", "🥈", "🥉"][e.rank - 1] : "\(e.rank).")
                .frame(width: 24)
                .accessibilityHidden(true)
            HStack(spacing: 4) {
                Text(e.username)
                if !e.verified {
                    Text("manual").font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                }
            }
            .oneLine()
            Text(e.display).font(.brand(.subheadline, .heavy)).monospacedDigit().lineLimit(1).layoutPriority(1)
            if mine && isToday {
                Button { onDelete(e) } label: {
                    Image(systemName: "xmark").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                }
                .buttonStyle(.pressIn)
                .help("Delete my score")
                .accessibilityLabel("Delete my \(game.name) score")
            }
        }
        .font(.brand(.subheadline, .semibold))
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(mine ? Color.highlight : Color.clear))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ordinal(e.rank)), \(mine ? "you" : e.username), \(e.display)")
    }
}
#endif

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
