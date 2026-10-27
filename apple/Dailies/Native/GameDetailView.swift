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
        List {
            Section {
                VStack(spacing: 14) {
                    GameAvatar(game: game, size: 72)
                    VStack(spacing: 4) {
                        Text(game.name).font(.brand(.title2, .heavy)).foregroundStyle(Color.ink).oneLine(.center)
                        Text("Ranked by \(game.metricLabel), \(game.better == "higher" ? "higher" : "lower") is better")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .oneLine(.center)
                    }
                    if model.isToday {
                        Button { model.play(game) } label: {
                            Label(mine == nil ? "Play today's \(game.name)" : "Open \(game.name)", systemImage: "play.fill")
                                .font(.brand(.headline, .heavy))
                                .oneLine(.center)
                                .padding(.horizontal, 16)
                                .foregroundStyle(Color.onAccent)
                                .frame(maxWidth: .infinity, minHeight: 50)
                                .background(Capsule().fill(Color.sun))
                                .overlay(Capsule().strokeBorder(Color.onAccent, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            Section {
                if entries.isEmpty {
                    Text(model.isToday ? "No scores yet. Be the first." : "Nobody played this day.")
                        .foregroundStyle(.secondary)
                        .oneLine()
                }
                ForEach(entries) { e in
                    HStack(spacing: 12) {
                        RankBadge(rank: e.rank)
                        HStack(spacing: 8) {
                        Text(e.username).font(.brand(.body, e.username == model.me ? .heavy : .semibold))
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
                    .listRowBackground(e.username == model.me ? Color.highlight : Color.surface)
                    .accessibilityElement(children: .combine)
                    .swipeActions {
                        if model.isToday && e.username == model.me {
                            Button(role: .destructive) { Task { await model.delete(e) } } label: {
                                Label("Delete score", systemImage: "trash")
                            }
                        }
                    }
                }
            } header: {
                Text(model.isToday ? "Today's board" : "Board").oneLine()
            }
            .listRowBackground(Color.surface)

            if model.isToday && game.acceptsManual && mine == nil {
                Section {
                    HStack(spacing: 10) {
                        TextField(game.metricLabel.capitalized, text: $manualValue)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .focused($manualFocused)
                            .frame(minHeight: 44)
                        Button("Add") { Task { await addManual() } }
                            .fontWeight(.bold)
                            .disabled(saving || Double(manualValue) == nil)
                    }
                    if let manualError {
                        Text(manualError).font(.footnote).foregroundStyle(.red) // errors may wrap
                    }
                } header: {
                    Text("Enter your score").oneLine()
                } footer: {
                    Text(game.note ?? "Typed-in scores are marked as manual on the board.").oneLine()
                }
                .listRowBackground(Color.surface)
            } else if let note = game.note, entries.isEmpty {
                Section { Text(note).font(.footnote).foregroundStyle(.secondary).oneLine() }
                    .listRowBackground(Color.surface)
            }

            if let paid = game.paid {
                Section {
                    ForEach(paid.deals, id: \.label) { deal in
                        if let s = deal.url, let url = URL(string: s) {
                            Link(destination: url) {
                                Label(deal.label, systemImage: "arrow.up.right.square").oneLine()
                            }
                            .foregroundStyle(Color.ink)
                        } else {
                            Label(deal.label, systemImage: "building.columns")
                                .foregroundStyle(Color.ink)
                                .oneLine()
                        }
                    }
                } header: {
                    Label("Subscription", systemImage: "dollarsign.circle.fill").oneLine()
                } footer: {
                    Text(paid.what).oneLine()
                }
                .listRowBackground(Color.surface)
            }
        }
        #if os(iOS)
        .listStyle(.insetGrouped)
        #else
        .listStyle(.inset)
        #endif
        .scrollContentBackground(.hidden)
        .background(Color.canvas.ignoresSafeArea())
        .navigationTitle(game.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        #endif
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
