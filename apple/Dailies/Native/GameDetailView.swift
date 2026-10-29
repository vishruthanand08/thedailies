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
                    Text(note).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
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
                Button { model.toggleFavorite(game) } label: {
                    Image(systemName: favorite ? "star.fill" : "star")
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
                GameAvatar(game: game, size: 60)
                VStack(alignment: .leading, spacing: 2) {
                    Text(game.name).font(.brand(.title2, .heavy)).foregroundStyle(Color.ink).oneLine()
                    if model.isToday && mine != nil { NextPuzzle() }
                }
                if let mine, model.isToday {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(mine.display).font(.brand(.title3, .heavy)).monospacedDigit().lineLimit(1)
                        Text(ordinal(mine.rank)).font(.caption.weight(.bold)).foregroundStyle(.secondary)
                    }
                    .foregroundStyle(Color.ink)
                    .layoutPriority(1)
                }
            }
            if model.isToday {
                Button { model.play(game) } label: {
                    Label(mine == nil ? "Play today's \(game.name)" : "Open \(game.name)", systemImage: "play.fill")
                        .font(.brand(.headline, .heavy))
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
                .font(.brand(.headline, .heavy))
                .foregroundStyle(Color.ink)
                .accessibilityAddTraits(.isHeader)
            Text("Ranked by \(game.metricLabel), \(game.better == "higher" ? "higher" : "lower") is better")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .oneLine()
                .padding(.bottom, 4)
            if entries.isEmpty {
                Text(model.isToday ? "No scores yet. Be the first." : "Nobody played this day.")
                    .foregroundStyle(.secondary)
                    .oneLine()
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
        let row = HStack(spacing: 12) {
            RankBadge(rank: e.rank)
            HStack(spacing: 8) {
                Text(e.username).font(.brand(.body, isMe ? .heavy : .semibold))
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
            Text(e.display).font(.brand(.body, .heavy)).monospacedDigit().lineLimit(1).layoutPriority(1)
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(isMe ? Color.highlight : Color.clear))
        .accessibilityElement(children: .combine)

        if model.isToday && isMe {
            // press and hold (or a VoiceOver action) to take my score off
            row
                .contextMenu {
                    Button(role: .destructive) { Task { await model.delete(e) } } label: {
                        Label("Delete score", systemImage: "trash")
                    }
                }
                .accessibilityAction(named: "Delete score") { Task { await model.delete(e) } }
        } else {
            row
        }
    }

    private var manualEntry: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Enter your score").font(.brand(.headline, .heavy)).foregroundStyle(Color.ink)
            HStack(spacing: 10) {
                TextField(game.metricLabel.capitalized, text: $manualValue)
                    .keyboardType(.decimalPad)
                    .focused($manualFocused)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 44)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 2))
                Button { Task { await addManual() } } label: {
                    Text("Add").font(.brand(.headline, .heavy)).foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 18).frame(minHeight: 44)
                }
                .buttonStyle(.pressIn(.sun))
                .disabled(saving || Double(manualValue) == nil)
            }
            if let manualError {
                Text(manualError).font(.footnote).foregroundStyle(.red) // errors may wrap
            }
            Text(game.note ?? "Typed-in scores are marked as manual on the board.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .oneLine()
        }
        .padding(16)
        .chunkyCard(.surface)
    }

    private func subscription(_ paid: Game.Paid) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Subscription", systemImage: "dollarsign.circle.fill")
                .font(.brand(.headline, .heavy))
                .foregroundStyle(Color.ink)
                .oneLine()
            // full sentences: these wrap rather than cut off (the one exception to one-line text)
            Text(paid.what).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            ForEach(paid.deals, id: \.label) { deal in
                if let s = deal.url, let url = URL(string: s) {
                    Link(destination: url) {
                        Label(deal.label, systemImage: "arrow.up.right.square")
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .foregroundStyle(Color.ink)
                    .frame(minHeight: 36)
                } else {
                    Label(deal.label, systemImage: "building.columns")
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
        saving = true
        manualError = await model.submitManual(game, value: value)
        saving = false
        if manualError == nil {
            manualValue = ""
            manualFocused = false
        }
    }
}
#endif
