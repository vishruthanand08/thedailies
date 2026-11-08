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
/// The account nudge at the top of Today, one at a time, most important first (the website's
/// AccountNudge): choose your own password after support's reset; confirm the email waiting for
/// its link (Resend); add an email to an older account ("Not now" hides it for a week).
struct AccountNudge: View {
    @State private var model = YouModel.shared
    @AppStorage("dailies.emailNudgeLater") private var laterUntil: Double = 0
    @State private var resent: String?

    var body: some View {
        if let r = model.recovery {
            if r.mustChangePassword {
                card("You signed in with a temporary password", "Choose your own now", icon: "lock-closed") {
                    SmallButton(title: "Change", primary: true) { ProfileSheet.shared.open = true }
                }
            } else if r.emailAvailable, r.email == nil, let pending = r.pendingEmail {
                card("Confirm your email", resent ?? "We sent a link to \(pending)", icon: "envelope") {
                    if resent == nil {
                        SmallButton(title: "Resend") {
                            Task {
                                let failed = await model.addEmail(pending)
                                resent = failed ?? "Sent again. Check your inbox."
                            }
                        }
                    }
                }
            } else if r.emailAvailable, r.email == nil, r.appleLinked != true, Date().timeIntervalSince1970 > laterUntil {
                card("Add an email", "So you can always get back in", icon: "envelope") {
                    SmallButton(title: "Add", primary: true) { ProfileSheet.shared.open = true }
                    Button {
                        Haptic.select()
                        withAnimation(.snappy) { laterUntil = Date().addingTimeInterval(7 * 86400).timeIntervalSince1970 }
                    } label: {
                        HeroIcon("x-mark", size: 16).foregroundStyle(.secondary).frame(width: 32, height: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.pressIn)
                    .accessibilityLabel("Not now")
                }
            }
        }
    }

    private func card<Actions: View>(_ title: String, _ detail: String, icon: String, @ViewBuilder actions: () -> Actions) -> some View {
        HStack(spacing: 10) {
            HeroIcon(icon, filled: true, size: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.brand(.subheadline, .heavy)).oneLine()
                Text(detail).font(.caption.weight(.semibold)).opacity(0.75).oneLine()
            }
            actions()
        }
        .foregroundStyle(Color.onAccent)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .chunkyCard(.sun)
        .padding(.trailing, 4)
    }
}
#endif
