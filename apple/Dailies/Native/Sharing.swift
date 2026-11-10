#if os(iOS)
import SwiftUI
import UIKit

/// Sharing a score or the day's crown as text (the server writes it, server/share.js: a playful
/// line and a link that invites people in and opens the game's board), through the share sheet.
@MainActor
enum Sharing {
    static func shareGame(_ gameId: String, date: String? = nil) {
        run { try await DailiesAPI.shared.shareText(path: "/api/share/game/\(gameId)" + (date.map { "?date=\($0)" } ?? "")) }
    }

    static func shareCrown(date: String? = nil) {
        run { try await DailiesAPI.shared.shareText(path: "/api/share/crown" + (date.map { "?date=\($0)" } ?? "")) }
    }

    private static func run(_ fetch: @escaping () async throws -> String) {
        Task {
            do {
                present(try await fetch())
            } catch let error as DailiesError {
                SubmissionQueue.shared.show(.err, error.message)
            } catch {
                SubmissionQueue.shared.show(.err, "Couldn't share that. Try again.")
            }
        }
    }

    /// The system share sheet over whatever is showing (a game window, a sheet or the tabs).
    private static func present(_ text: String) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) ?? UIApplication.shared.connectedScenes.first as? UIWindowScene,
              var top = scene.keyWindow?.rootViewController else { return }
        while let next = top.presentedViewController, !next.isBeingDismissed { top = next }
        let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = top.view // iPad
        sheet.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.maxY - 80, width: 1, height: 1)
        top.present(sheet, animated: true)
    }
}

/// "Share" with the share icon, in the app's small-button style.
struct ShareButton: View {
    var title = "Share"
    var primary = false
    let action: () -> Void

    var body: some View {
        SmallButton(title: title, icon: "arrow-up-on-square", primary: primary, action: action)
            .accessibilityHint("Shares your score with a link for friends to join")
    }
}
#endif
