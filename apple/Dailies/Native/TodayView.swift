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

                // press and drag a row to reorder (onMove works outside edit mode)
                if !model.favorites.isEmpty {
                    Section {
                        ForEach(model.favorites) { row($0) }
                            .onMove { model.move(inFavorites: true, from: $0, to: $1) }
                    } header: {
                        sectionHeader("Favorites", systemImage: "star.fill")
                    }
                }

                if !model.others.isEmpty {
                    Section {
                        ForEach(model.others) { row($0) }
                            .onMove { model.move(inFavorites: false, from: $0, to: $1) }
                    } header: {
                        sectionHeader(model.favorites.isEmpty ? "Games" : "All games", systemImage: nil)
                    } footer: {
                        if model.favorites.isEmpty {
                            Text("Swipe right on a game to favorite it. Press and drag to reorder.").oneLine()
                        }
                    }
                }
            }
            #if os(iOS)
            .listStyle(.insetGrouped)
            #else
            .listStyle(.inset)
            #endif
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

    #if os(macOS)
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

    private func sectionHeader(_ title: String, systemImage: String?) -> some View {
        HStack(spacing: 6) {
            if let systemImage { Image(systemName: systemImage).foregroundStyle(Color.sun) }
            Text(title).oneLine()
        }
        .font(.brand(.subheadline, .heavy))
        .foregroundStyle(Color.ink)
        .textCase(nil)
    }

    // MARK: game rows

    private func row(_ game: Game) -> some View {
        let entries = model.entries(for: game)
        let mine = model.myEntry(for: game)
        let favorite = model.prefs.favorites.contains(game.id)
        return NavigationLink(value: game.id) {
            GameRow(game: game, entries: entries, mine: mine, isToday: model.isToday) { model.play(game) }
                #if os(macOS)
                // Mac lists run edge to edge; each game gets its own card, like the crown card
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .chunkyTile(.surface)
                #endif
        }
        #if os(macOS)
        .listRowInsets(EdgeInsets(top: 5, leading: 0, bottom: 9, trailing: 3))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        #else
        .listRowBackground(Color.surface)
        #endif
        .swipeActions(edge: .leading) {
            Button { model.toggleFavorite(game) } label: {
                Label(favorite ? "Unfavorite" : "Favorite", systemImage: favorite ? "star.slash" : "star.fill")
            }
            .tint(Color.sun)
        }
        #if os(macOS)
        .contextMenu {
            if model.isToday { Button("Play \(game.name)") { model.play(game) } }
            Button(favorite ? "Remove from Favorites" : "Add to Favorites") { model.toggleFavorite(game) }
            if model.isToday, let mine {
                Divider()
                Button("Delete My Score", role: .destructive) { Task { await model.delete(mine) } }
            }
        }
        #endif
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
}

/// The day's standings. Swipe it right for the day before, left to come forward again.
private struct CrownCard: View {
    let board: Board
    let model: TodayModel
    let goToFriends: () -> Void
    let onDrag: (CGFloat) -> Void
    let onDragEnd: (_ dx: CGFloat, _ predicted: CGFloat) -> Void
    let onPage: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label("Daily crown", systemImage: "crown.fill")
                    .font(.brand(.title3, .heavy))
                    .oneLine()
                if !model.isToday {
                    Image(systemName: "clock.arrow.circlepath").font(.subheadline.weight(.bold)).accessibilityHidden(true)
                }
            }
            .foregroundStyle(Color.onAccent)

            if board.crown.isEmpty {
                Text(model.isToday ? "No scores yet. Play a game to take the lead." : "Nobody played this day.")
                    .font(.subheadline)
                    .foregroundStyle(Color.onAccent.opacity(0.8))
                    .oneLine()
            } else {
                ForEach(Array(board.crown.enumerated()), id: \.element.id) { i, c in
                    crownRow(rank: i + 1, entry: c)
                }
            }

            if board.circleSize <= 1 {
                Button(action: goToFriends) {
                    Label("Add friends to compete", systemImage: "person.badge.plus")
                        .font(.brand(.subheadline, .bold))
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(Color.onAccent)
                        .background(Capsule().fill(Color.white.opacity(0.7)))
                        .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
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
    let play: () -> Void

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
                Button("Play", action: play)
                    .font(.brand(.subheadline, .heavy))
                    .lineLimit(1)
                    .foregroundStyle(Color.onAccent)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 34)
                    .background(Capsule().fill(Color.sun))
                    .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                    .contentShape(Capsule().inset(by: -6))
                    .buttonStyle(.borderless)
                    .layoutPriority(1)
                    .accessibilityLabel("Play \(game.name)")
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
