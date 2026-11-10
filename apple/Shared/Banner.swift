import SwiftUI

struct Banner: Identifiable, Equatable {
    enum Kind { case ok, err }
    let id = UUID()
    let kind: Kind
    let text: String
    /// A score saved automatically from a game: the banner offers Undo, which deletes it.
    var undoId: Int? = nil
    /// A saved score: the banner offers Share (the app's Sharing).
    var shareGameId: String? = nil
}

/// Top-of-screen banner for native submission results; auto-dismisses after 4 s.
struct BannerOverlay: View {
    let banner: Banner?
    let dismiss: (Banner) -> Void
    var undo: ((Int) -> Void)? = nil
    var share: ((String) -> Void)? = nil

    var body: some View {
        VStack {
            if let banner {
                HStack(spacing: 12) {
                    Text(banner.text)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let gameId = banner.shareGameId, let share {
                        Button("Share") {
                            share(gameId)
                            dismiss(banner)
                        }
                        .font(.system(.subheadline, weight: .heavy))
                        .underline()
                        .accessibilityHint("Shares your score with a link for friends to join")
                    }
                    if let id = banner.undoId, let undo {
                        Button("Undo") {
                            undo(id)
                            dismiss(banner)
                        }
                        .font(.system(.subheadline, weight: .heavy))
                        .underline()
                        .accessibilityHint("Removes this score from the board")
                    }
                }
                    .font(.system(.subheadline, weight: .semibold))
                    .foregroundStyle(Color(red: 0.086, green: 0.086, blue: 0.18))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .frame(maxWidth: 420, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(banner.kind == .ok ? Color(red: 0.85, green: 0.95, blue: 0.89) : Color(red: 0.98, green: 0.83, blue: 0.80))
                    )
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(red: 0.086, green: 0.086, blue: 0.18), lineWidth: 2.5))
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .onTapGesture { dismiss(banner) }
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: banner.id) {
                        try? await Task.sleep(for: .seconds(banner.undoId == nil && banner.shareGameId == nil ? 4 : 8))
                        dismiss(banner)
                    }
            }
            Spacer()
        }
        .animation(.spring(duration: 0.3), value: banner)
        .allowsHitTesting(banner != nil)
    }
}
