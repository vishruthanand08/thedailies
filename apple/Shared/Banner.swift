import SwiftUI

struct Banner: Identifiable, Equatable {
    enum Kind { case ok, err }
    let id = UUID()
    let kind: Kind
    let text: String
}

/// Top-of-screen banner for native submission results; auto-dismisses after 4 s.
struct BannerOverlay: View {
    let banner: Banner?
    let dismiss: (Banner) -> Void

    var body: some View {
        VStack {
            if let banner {
                Text(banner.text)
                    .font(.system(.subheadline, weight: .semibold))
                    .foregroundStyle(Color(red: 0.086, green: 0.086, blue: 0.18))
                    .multilineTextAlignment(.leading)
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
                        try? await Task.sleep(for: .seconds(4))
                        dismiss(banner)
                    }
                    .accessibilityAddTraits(.isStaticText)
            }
            Spacer()
        }
        .animation(.spring(duration: 0.3), value: banner)
        .allowsHitTesting(banner != nil)
    }
}
