#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

// Pieces the Friends and You tabs share, in Today's style.

/// A section of the Friends and You tabs: a heading and its rows on a chunky white card, like a game on Today.
struct SectionCard<Content: View, Trailing: View>: View {
    let title: String
    let icon: String
    let trailing: Trailing
    let content: Content

    init(title: String, icon: String, @ViewBuilder trailing: () -> Trailing, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.trailing = trailing()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label(title, hero: icon, filled: true, size: 18)
                    .font(.brand(.headline, .heavy))
                    .foregroundStyle(Color.ink)
                    .oneLine()
                    .accessibilityAddTraits(.isHeader)
                trailing
            }
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .chunkyCard(.surface)
        .padding(.trailing, 4)
    }
}

extension SectionCard where Trailing == EmptyView {
    init(title: String, icon: String, @ViewBuilder content: () -> Content) {
        self.init(title: title, icon: icon, trailing: { EmptyView() }, content: content)
    }
}

/// A small chunky button: yellow for the main action, white for the rest.
struct SmallButton: View {
    let title: String
    var icon: String?
    var primary = false
    let action: () -> Void

    var body: some View {
        Button {
            Haptic.tap(primary ? .medium : .light)
            action()
        } label: {
            HStack(spacing: 4) {
                if let icon { HeroIcon(icon, filled: primary, size: 14) }
                Text(title)
            }
            .font(.brand(.footnote, .heavy))
            .foregroundStyle(primary ? Color.onAccent : Color.ink)
            .lineLimit(1)
            .padding(.horizontal, 12)
            .frame(minHeight: 34)
        }
        .buttonStyle(.pressIn(primary ? .sun : .surface))
        .fixedSize()
    }
}

/// All time / 30 days / 7 days, as chunky buttons (the website's range row).
struct RangeChips: View {
    @Binding var range: FriendsModel.Range
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 6) {
            ForEach(FriendsModel.Range.allCases) { r in
                let on = range == r
                Button {
                    withAnimation(reduceMotion ? nil : .snappy) { range = r }
                } label: {
                    Text(r.label)
                        .font(.brand(.footnote, .heavy))
                        .foregroundStyle(on ? Color.onAccent : Color.ink)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.pressIn(on ? .sun : .canvas, radius: 12, weight: 1.5, shadow: on ? 2 : 0))
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: range)
    }
}
/// A message from the server, like Sign in's: dark text on the pale green or red. Full sentences
/// wrap, as error messages may.
struct NoticeView: View {
    let ok: Bool
    let text: String
    var compact = false

    var body: some View {
        Label { Text(text) } icon: { HeroIcon(ok ? "check" : "exclamation-circle", filled: true, size: compact ? 14 : 16) }
            .font((compact ? Font.caption : .footnote).weight(.semibold))
            .foregroundStyle(Color.onAccent)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(compact ? 6 : 10)
            .background(RoundedRectangle(cornerRadius: compact ? 8 : 12, style: .continuous).fill(ok ? Color.positive : Color.negative))
            .accessibilityElement(children: .combine)
    }
}
#endif
