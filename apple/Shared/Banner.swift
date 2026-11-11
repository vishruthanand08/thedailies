import SwiftUI

struct Banner: Identifiable, Equatable {
    enum Kind { case ok, err }
    let id = UUID()
    let kind: Kind
    let text: String
    /// A score that was just saved (pasted or caught from a game). The game window closes on it.
    var saved = false
    /// A saved score: the banner offers Share (the app's Sharing), except over a game.
    var shareGameId: String? = nil
}

/// Top-of-screen banner for native submission results. It goes by itself: a saved score after
/// 2 s (the game window closes under it), other messages after 4 s, 6 s when it offers Share.
struct BannerOverlay: View {
    let banner: Banner?
    let dismiss: (Banner) -> Void
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
                        .accessibilityHint("Shares your place and score")
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
                        let showsShare = banner.shareGameId != nil && share != nil
                        try? await Task.sleep(for: .seconds(showsShare ? 6 : banner.saved ? 2 : 4))
                        dismiss(banner)
                    }
            }
            Spacer()
        }
        .animation(.spring(duration: 0.3), value: banner)
        .allowsHitTesting(banner != nil)
    }
}
