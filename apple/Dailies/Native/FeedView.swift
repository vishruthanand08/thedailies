import SwiftUI

/// The Feed, like Strava: a card per player per day with their highlight in yellow, kudos, and
/// today's friends' highlights in a row at the top.
struct FeedView: View {
    @State private var model = FeedModel.shared

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        content(proxy)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden) // swipe, no scroll bar
            }
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Feed")
            .refreshable { await model.load() }
            .overlay {
                if model.feed == nil && model.error == nil { ProgressView() }
            }
            #if os(macOS)
            .toolbar {
                Button { Task { await model.load() } } label: { Label("Refresh", systemImage: "arrow.clockwise") }
                    .help("Refresh the feed")
            }
            #endif
        }
        .tint(Color.ink)
        // each time the Feed is opened: fresh cards, and any new kudos count as seen
        .task { await model.load() }
        .sensoryFeedback(.success, trigger: model.kudosTick)
    }

    @ViewBuilder
    private func content(_ proxy: ScrollViewProxy) -> some View {
        if let error = model.error, model.feed == nil {
            ContentUnavailableView {
                Label("Couldn't load", systemImage: "wifi.exclamationmark")
            } description: {
                Text(error)
            } actions: {
                Button("Try again") { Task { await model.load() } }
            }
        } else if let feed = model.feed {
            ForEach(feed.notices, id: \.date) { notice in
                Label {
                    Text("\(FeedModel.names(notice.usernames)) gave you kudos for \(model.dayLabel(notice.date).lowercasedDay)")
                        .font(.brand(.subheadline, .bold))
                } icon: {
                    Image(systemName: "hands.clap.fill")
                }
                .foregroundStyle(Color.onAccent)
                .oneLine()
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .chunkyCard(.sun)
            }

            if !feed.highlights.isEmpty {
                HighlightsRow(highlights: feed.highlights) { id in
                    withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(id, anchor: .top) }
                }
            }

            if feed.cards.isEmpty {
                ContentUnavailableView(
                    "Nothing here yet", systemImage: "list.bullet.rectangle.portrait",
                    description: Text("Scores you and your friends add show up here. Add some friends and start playing."))
            }
            // one section per day, so a player's earlier days read as earlier days
            ForEach(days(feed), id: \.date) { day in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(model.dayLabel(day.date)).font(.brand(.title2, .heavy))
                    if !day.cards.isEmpty {
                        Text("\(day.cards.count) \(day.cards.count == 1 ? "player" : "players")")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(Color.ink)
                .oneLine()
                .padding(.top, 6)
                .accessibilityAddTraits(.isHeader)
                if day.date == feed.today, let waiting = feed.waiting, !waiting.isEmpty {
                    Text("Haven't played yet today: \(waiting.joined(separator: ", "))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .oneLine()
                }
                ForEach(day.cards) { card in
                    DayCard(card: card, model: model).id(card.id)
                }
            }
            if feed.nextBefore != nil {
                // the next few days load as the end of the list comes into view
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding()
                    .task(id: feed.cards.count) { await model.loadMore() }
            }
        }
    }
}

private extension FeedView {
    struct Day { let date: String; var cards: [Feed.Card] }

    /// Cards arrive newest day first. Today always leads while someone is still to play.
    func days(_ feed: Feed) -> [Day] {
        var out = [Day(date: feed.today, cards: [])]
        for card in feed.cards {
            if out[out.count - 1].date != card.date { out.append(Day(date: card.date, cards: [])) }
            out[out.count - 1].cards.append(card)
        }
        return out.filter { !$0.cards.isEmpty || ($0.date == feed.today && !(feed.waiting ?? []).isEmpty) }
    }
}

/// Today's friends' highlights, side by side; tapping one jumps to that player's day.
private struct HighlightsRow: View {
    let highlights: [Feed.Highlight]
    let onTap: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Today's highlights", systemImage: "star.fill")
                .font(.brand(.headline, .heavy))
                .foregroundStyle(Color.ink)
                .oneLine()
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(highlights) { h in
                        Button { onTap(h.cardId) } label: { chip(h) }
                            .buttonStyle(.pressIn(.sun, radius: 16, weight: 2, shadow: 3))
                            .accessibilityLabel("\(h.username): \(h.gameName) \(h.display)\(h.pb ? ", personal best" : "")")
                    }
                }
                .padding(.vertical, 2)
                .padding(.trailing, 6) // room for the last chip's shadow
            }
            .scrollClipDisabled()
        }
    }

    private func chip(_ h: Feed.Highlight) -> some View {
        HStack(spacing: 10) {
            Avatar(name: h.username, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(h.username).font(.brand(.subheadline, .heavy)).oneLine()
                Text("\(h.emoji) \(h.gameName)").font(.caption.weight(.semibold)).oneLine()
                HStack(spacing: 6) {
                    Text(h.display).font(.brand(.headline, .heavy)).monospacedDigit().lineLimit(1)
                    if h.pb { PBTag() }
                }
            }
            .frame(width: 112, alignment: .leading)
        }
        .foregroundStyle(Color.onAccent)
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
    }
}

/// One player's day: points total, streak, their games with the highlight first, and kudos.
private struct DayCard: View {
    let card: Feed.Card
    let model: FeedModel
    @State private var expanded = false
    @State private var receipt: Int?

    private static let shown = 3
    private var mine: Bool { model.isMine(card) }
    private var canPick: Bool { mine && card.date == model.feed?.today && card.games.count > 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            VStack(spacing: 6) {
                ForEach(expanded ? card.games : Array(card.games.prefix(Self.shown))) { line($0) }
            }
            if card.games.count > Self.shown {
                Button(expanded ? "Show less" : "+\(card.games.count - Self.shown) more") {
                    withAnimation(.easeOut(duration: 0.2)) { expanded.toggle() }
                }
                .font(.brand(.subheadline, .bold))
                .foregroundStyle(Color.ink)
                .buttonStyle(.pressIn)
            }
            footer
        }
        .padding(14)
        .chunkyCard(.surface)
        .padding(.trailing, 4)
    }

    private var header: some View {
        HStack(spacing: 10) {
            Avatar(name: card.username, size: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(mine ? "You" : card.username).font(.brand(.headline, .heavy)).oneLine()
                HStack(spacing: 4) {
                    Text("\(card.games.count) \(card.games.count == 1 ? "game" : "games")")
                    if card.streak > 1 {
                        Text("·")
                        Label("\(card.streak)", systemImage: "flame.fill").labelStyle(.titleAndIcon)
                            .accessibilityLabel("\(card.streak)-day streak")
                    }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .oneLine()
            }
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text("\(card.points)").font(.brand(.title, .heavy)).monospacedDigit()
                Text("pts").font(.caption.weight(.bold)).foregroundStyle(.secondary)
            }
            .fixedSize()
            .accessibilityElement(children: .combine)
        }
        .foregroundStyle(Color.ink)
    }

    private func line(_ g: Feed.Played) -> some View {
        let isHighlight = g.submissionId == card.highlightId
        let fg = isHighlight ? Color.onAccent : Color.ink
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Button {
                    if g.rawText != nil { withAnimation(.easeOut(duration: 0.2)) { receipt = receipt == g.id ? nil : g.id } }
                } label: {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(Color(hex: g.color))
                            .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 1.5))
                            .overlay(Text(g.emoji).font(.system(size: isHighlight ? 17 : 14)))
                            .frame(width: isHighlight ? 32 : 26, height: isHighlight ? 32 : 26)
                            .accessibilityHidden(true)
                        Text(g.gameName)
                            .font(.brand(isHighlight ? .headline : .subheadline, isHighlight ? .heavy : .bold))
                            .oneLine()
                        if g.pb { PBTag() }
                        if !g.verified {
                            Image(systemName: "pencil")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(fg.opacity(0.6))
                                .accessibilityLabel("Typed in")
                        }
                        Text(g.display)
                            .font(.brand(isHighlight ? .headline : .subheadline, .heavy))
                            .monospacedDigit()
                            .fixedSize()
                        Text("\(g.points)")
                            .font(.caption.weight(.heavy))
                            .monospacedDigit()
                            .foregroundStyle(Color.ink)
                            .frame(minWidth: 26)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.surface))
                            .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 1.5))
                            .fixedSize()
                            .accessibilityLabel("\(g.points) points")
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint(g.rawText != nil ? "Shows the shared result" : "")

                if canPick { star(g, isHighlight: isHighlight) }
            }
            if receipt == g.id, let raw = g.rawText {
                Text(raw)
                    .font(.system(.footnote, design: .monospaced))
                    .foregroundStyle(Color.ink)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.surface))
            }
        }
        .foregroundStyle(fg)
        .padding(.horizontal, 8)
        .padding(.vertical, isHighlight ? 8 : 5)
        .background(shape.fill(isHighlight ? Color.sun : Color.highlight))
        .overlay(shape.strokeBorder(Color.onAccent, lineWidth: 1.5))
        .background(shape.fill(Color.onAccent).offset(x: 2, y: 2).opacity(isHighlight ? 1 : 0))
    }

    /// Make a game my highlight for today; the current pick's star goes back to top points.
    private func star(_ g: Feed.Played, isHighlight: Bool) -> some View {
        Button { Task { await model.highlight(g, on: card) } } label: {
            Image(systemName: isHighlight ? "star.fill" : "star")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(isHighlight ? Color.sun : Color.ink)
                .frame(width: 30, height: 30)
                .background(Circle().fill(isHighlight ? Color.onAccent : Color.surface))
                .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 1.5))
                .frame(width: 44, height: 44) // tap target
                .contentShape(Rectangle())
        }
        .buttonStyle(.pressIn)
        .padding(.vertical, -7)
        .disabled(isHighlight && !card.picked)
        .accessibilityLabel(isHighlight ? (card.picked ? "Stop highlighting \(g.gameName)" : "\(g.gameName) is your highlight") : "Highlight \(g.gameName)")
        #if os(macOS)
        .help(isHighlight ? (card.picked ? "Go back to your top-points game" : "Your highlight (top points)") : "Make this your highlight")
        #endif
    }

    private var footer: some View {
        HStack(spacing: 10) {
            if mine {
                Label("\(card.kudos.count)", systemImage: "hands.clap.fill")
                    .font(.brand(.subheadline, .heavy))
                    .labelStyle(.titleAndIcon)
                    .fixedSize()
                    .accessibilityLabel("\(card.kudos.count) kudos")
            } else {
                Button { Task { await model.toggleKudos(card) } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: card.kudos.mine ? "hands.clap.fill" : "hands.clap")
                        Text(card.kudos.mine ? "Kudos given" : "Give kudos")
                        if card.kudos.count > 0 {
                            Text("\(card.kudos.count)")
                                .font(.caption.weight(.heavy))
                                .monospacedDigit()
                                .foregroundStyle(Color.surface)
                                .padding(.horizontal, 7)
                                .background(Capsule().fill(Color.ink))
                        }
                    }
                    .font(.brand(.subheadline, .bold))
                    .foregroundStyle(card.kudos.mine ? Color.onAccent : Color.ink)
                    .lineLimit(1)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 36)
                }
                .buttonStyle(.pressIn(card.kudos.mine ? .sun : .surface))
                .fixedSize()
                .accessibilityAddTraits(card.kudos.mine ? .isSelected : [])
            }
            Text(givers)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .oneLine()
            Text(FeedModel.ago(card.lastActivity))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize()
        }
    }

    private var givers: String {
        if card.kudos.count == 0 { return mine ? "No kudos yet" : "" }
        return FeedModel.names(card.kudos.givers.map { $0.username == model.me ? "you" : $0.username })
    }
}

private struct Avatar: View {
    let name: String
    var size: CGFloat = 40

    var body: some View {
        Text(name.prefix(1).uppercased())
            .font(.system(size: size * 0.42, weight: .heavy, design: .rounded))
            .foregroundStyle(Color.ink)
            .frame(width: size, height: size)
            .background(Circle().fill(Color.highlight))
            .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2))
            .accessibilityHidden(true)
    }
}

/// Personal best: better than every earlier score of theirs on that game.
private struct PBTag: View {
    var body: some View {
        Text("PB")
            .font(.caption2.weight(.heavy))
            .foregroundStyle(Color.sun)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(RoundedRectangle(cornerRadius: 5).fill(Color.onAccent))
            .fixedSize()
            .accessibilityLabel("Personal best")
    }
}

private extension String {
    /// "Today" -> "today" inside a sentence; dates stay as they are.
    var lowercasedDay: String { self == "Today" || self == "Yesterday" ? lowercased() : self }
}
