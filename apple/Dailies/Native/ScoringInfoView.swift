import SwiftUI

/// The ⓘ on the crown card: how points are worked out, with every game's results worth 100, 50 and 0.
struct ScoringInfoView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var table: ScoringTable?
    @State private var error: String?

    private let rules: [(String, String)] = [
        ("number.circle.fill", "Every game turns your result into 0 to 100 points: perfect is 100, the game's typical result (par) is 50 and a fail is 0."),
        ("lock.fill", "Your points depend only on your own result and are locked in when you post."),
        ("crown.fill", "The daily crown goes to the most points across the day's games. A tie goes to whoever played fewer games."),
        ("square.grid.2x2.fill", "Each category's crown counts just that category's games."),
        ("trophy.fill", "Leaderboards add up daily points. A game's own board ranks the actual results."),
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(rules, id: \.1) { symbol, text in
                        Label {
                            Text(text).font(.subheadline)
                        } icon: {
                            Image(systemName: symbol).foregroundStyle(Color.ink)
                        }
                    }
                }
                if let error {
                    Text(error).foregroundStyle(.secondary)
                }
                if let table {
                    ForEach(table.categories) { category in
                        Section {
                            ForEach(table.games.filter { $0.category == category.id }) { row($0) }
                        } header: {
                            HStack {
                                Label(category.name, systemImage: category.symbol)
                                Spacer()
                                Text("100 · 50 · 0 pts").monospacedDigit()
                            }
                        }
                    }
                }
            }
            .overlay { if table == nil && error == nil { ProgressView() } }
            .navigationTitle("How scoring works")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 560)
        #endif
        .task {
            do { table = try await DailiesAPI.shared.scoring() } catch { self.error = "Couldn't load the scoring table." }
        }
    }

    private func row(_ r: ScoringTable.Row) -> some View {
        HStack(spacing: 10) {
            Text("\(r.emoji) \(r.name)").font(.brand(.subheadline, .bold)).oneLine()
            Group {
                Text(r.perfect)
                Text(r.par)
                Text(r.zero)
            }
            .font(.caption.weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .frame(width: 66, alignment: .trailing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(r.name): 100 points for \(r.perfect), 50 for \(r.par), 0 for \(r.zero)")
    }
}
