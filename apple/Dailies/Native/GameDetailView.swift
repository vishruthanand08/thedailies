#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

/// One game's full board for the day, with Play, manual entry and subscription info.
struct GameDetailView: View {
    let game: Game
    @State private var model = TodayModel.shared
    @State private var manualValue = ""
    @State private var manualError: String?
    @State private var saving = false
    @FocusState private var manualFocused: Bool
    /// Rows dropped down to show what they pasted.
    @State private var opened: Set<Int> = []
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var entries: [BoardEntry] { model.entries(for: game) }
    private var mine: BoardEntry? { model.myEntry(for: game) }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                board
                if model.isToday && game.acceptsManual && mine == nil {
                    manualEntry
                } else if let note = game.note, entries.isEmpty {
                    Text(note).font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                }
                if let paid = game.paid { subscription(paid) }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Color.canvas.ignoresSafeArea())
        .navigationTitle(game.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                let favorite = model.prefs.favorites.contains(game.id)
                Button { Haptic.tap(); model.toggleFavorite(game) } label: {
                    HeroIcon("star", filled: favorite, size: 24)
                        .pop(on: favorite)
                        .foregroundStyle(favorite ? Color.sun : Color.ink)
                }
                .accessibilityLabel(favorite ? "Remove from Favorites" : "Add to Favorites")
            }
        }
        .refreshable { await model.reload() }
    }

    /// The game's tile and name, how it's ranked, my result today, and Play.
    private var header: some View {
        VStack(spacing: 14) {
            HStack(spacing: 14) {
                GameAvatar(game: game, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(game.name).font(.brand(.title3, .heavy)).foregroundStyle(Color.ink).oneLine()
                    if model.isToday && mine != nil { NextPuzzle() }
                }
                if let mine, model.isToday {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(mine.display).font(.brand(.headline, .heavy)).monospacedDigit().lineLimit(1)
                        Text(ordinal(mine.rank)).font(.caption.weight(.bold)).foregroundStyle(.secondary)
                    }
                    .foregroundStyle(Color.ink)
                    .layoutPriority(1)
                }
            }
            if model.isToday {
                Button { Haptic.tap(); model.play(game) } label: {
                    Label(mine == nil ? "Play today's \(game.name)" : "Open \(game.name)", hero: "play", filled: true)
                        .font(.brand(.subheadline, .heavy))
                        .oneLine(.center)
                        .padding(.horizontal, 16)
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.pressIn(.sun))
            }
        }
        .padding(16)
        .chunkyCard(.surface)
    }

    /// Everyone's result, ranked, mine in lilac (the website's board).
    private var board: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(model.isToday ? "Today's board" : "Board")
                .font(.brand(.subheadline, .heavy))
                .foregroundStyle(Color.ink)
                .accessibilityAddTraits(.isHeader)
            Text("Ranked by \(game.metricLabel), \(game.better == "higher" ? "higher" : "lower") is better")
                .font(.caption)
                .foregroundStyle(.secondary)
                .oneLine()
                .padding(.bottom, 4)
            if entries.isEmpty {
                EmptyState(art: "EmptyBoard", icon: "trophy",
                           title: model.isToday ? "No scores yet" : "Nobody played",
                           message: model.isToday ? "Be the first. Whoever posts first sets the score to beat." : "No one played \(game.name) this day.",
                           compact: true)
            }
            ForEach(entries) { e in boardRow(e) }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .chunkyCard(.surface)
    }

    @ViewBuilder
    private func boardRow(_ e: BoardEntry) -> some View {
        let isMe = e.username == model.me
        let open = opened.contains(e.id)
        let share = e.shareText.map(Self.shareBody)
        let line = HStack(spacing: 10) {
            RankBadge(rank: e.rank)
            HStack(spacing: 8) {
                Text(e.username).font(.brand(.subheadline, isMe ? .heavy : .semibold))
                if !e.verified {
                    Text("manual")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .overlay(Capsule().strokeBorder(Color.secondary.opacity(0.5)))
                }
            }
            .oneLine()
            Text(e.display).font(.brand(.subheadline, .heavy)).monospacedDigit().lineLimit(1).layoutPriority(1)
            HeroIcon("chevron-down", size: 12)
                .foregroundStyle(.secondary)
                .rotationEffect(.degrees(open ? 180 : 0))
        }
        // tap a name to see what they pasted
        let row = Button {
            Haptic.select()
            withAnimation(reduceMotion ? nil : .snappy) {
                if open { opened.remove(e.id) } else { opened.insert(e.id) }
            }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                line
                if open {
                    Group {
                        if let share {
                            Text(share)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                        } else {
                            Text(e.verified ? "Their pasted result isn't available." : "Typed in, so there's nothing pasted to show.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.canvas))
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .foregroundStyle(Color.ink)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(isMe ? Color.highlight : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint(open ? "Hides what they pasted" : "Shows what they pasted")

        if model.isToday && isMe {
            // press and hold (or a VoiceOver action) to take my score off
            row
                .contextMenu {
                    Button(role: .destructive) { Haptic.warning(); Task { await model.delete(e) } } label: {
                        Label("Delete score", image: "hero-trash")
                    }
                }
                .accessibilityAction(named: "Delete score") { Task { await model.delete(e) } }
        } else {
            row
        }
    }

    /// The share without lines that are only a link (the website's popup does the same).
    static func shareBody(_ text: String) -> String {
        text.split(separator: "\n", omittingEmptySubsequences: false)
            .filter { !$0.trimmingCharacters(in: .whitespaces).hasPrefix("http") }
            .joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var manualEntry: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Enter your score").font(.brand(.subheadline, .heavy)).foregroundStyle(Color.ink)
            HStack(spacing: 10) {
                TextField(game.metricLabel.capitalized, text: $manualValue)
                    .keyboardType(.decimalPad)
                    .focused($manualFocused)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 44)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 2))
                Button { Task { await addManual() } } label: {
                    Text("Add").font(.brand(.subheadline, .heavy)).foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 18).frame(minHeight: 44)
                }
                .buttonStyle(.pressIn(.sun))
                .disabled(saving || Double(manualValue) == nil)
            }
            if let manualError {
                Text(manualError).font(.caption).foregroundStyle(.red) // errors may wrap
            }
            Text(game.note ?? "Typed-in scores are marked as manual on the board.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .oneLine()
        }
        .padding(16)
        .chunkyCard(.surface)
    }

    private func subscription(_ paid: Game.Paid) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Subscription", hero: "currency-dollar")
                .font(.brand(.subheadline, .heavy))
                .foregroundStyle(Color.ink)
                .oneLine()
            // full sentences: these wrap rather than cut off (the one exception to one-line text)
            Text(paid.what).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            ForEach(paid.deals, id: \.label) { deal in
                if let s = deal.url, let url = URL(string: s) {
                    Link(destination: url) {
                        Label(deal.label, hero: "arrow-top-right-on-square")
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .foregroundStyle(Color.ink)
                    .frame(minHeight: 36)
                } else {
                    Label(deal.label, hero: "building-library")
                        .foregroundStyle(Color.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .chunkyCard(.surface)
    }

    private func addManual() async {
        guard let value = Double(manualValue) else { return }
        Haptic.tap(.medium)
        saving = true
        manualError = await model.submitManual(game, value: value)
        saving = false
        if manualError == nil { Haptic.success() } else { Haptic.error() }
        if manualError == nil {
            manualValue = ""
            manualFocused = false
        }
    }
}
#endif
