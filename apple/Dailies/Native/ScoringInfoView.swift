#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

/// The ⓘ on the crown card: how points are worked out, with every game's results worth 100, 50 and 0.
struct ScoringInfoView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var table: ScoringTable?
    @State private var error: String?

    private let rules: [(String, String)] = [
        ("calculator", "Every game turns your result into 0 to 100 points: perfect is 100, the game's typical result (par) is 50 and a fail is 0."),
        ("lock-closed", "Your points depend only on your own result and are locked in when you post."),
        ("trophy", "The daily crown goes to the most points across the day's games. A tie goes to whoever played fewer games."),
        ("squares-2x2", "Each category's crown counts just that category's games."),
        ("chart-bar", "Leaderboards add up daily points. A game's own board ranks the actual results."),
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(rules, id: \.1) { icon, text in
                        Label {
                            Text(text).font(.footnote)
                        } icon: {
                            HeroIcon(icon).foregroundStyle(Color.ink)
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
                                Label(category.name, hero: category.hero, size: 16)
                                Spacer()
                                Text("100 · 50 · 0 pts").monospacedDigit()
                            }
                        }
                    }
                }
            }
            .overlay { if table == nil && error == nil { ProgressView() } }
            .navigationTitle("How scoring works")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .task {
            do { table = try await DailiesAPI.shared.scoring() } catch { self.error = "Couldn't load the scoring table." }
        }
    }

    private func row(_ r: ScoringTable.Row) -> some View {
        HStack(spacing: 10) {
            Text("\(r.emoji) \(r.name)").font(.brand(.footnote, .bold)).oneLine()
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
#endif
