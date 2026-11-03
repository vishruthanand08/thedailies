import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Brand tokens (light and dark values live in Assets.xcassets) and type styles.
/// Text uses Dynamic Type styles throughout; the brand voice comes from the rounded design.
extension Color {
    static let canvas = Color("Canvas")
    static let surface = Color("Surface")
    static let ink = Color("Ink")
    static let onAccent = Color("OnAccent")
    static let sun = Color("Sun")
    static let highlight = Color("Highlight")
    static let positive = Color("Positive")
    static let negative = Color("Negative")

    /// Game tile colors from the server ("#C8E6B8").
    init(hex: String) {
        let v = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0xEEEEEE
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

extension Font {
    static func brand(_ style: Font.TextStyle, _ weight: Font.Weight = .bold) -> Font {
        .system(style, design: .rounded, weight: weight)
    }
}

#if os(iOS)
/// Taps you can feel, matched to the action: lighter for what happens often, heavier for what's
/// rare. Where a state change is the trigger, `.sensoryFeedback(_:trigger:)` does the same job.
enum Haptic {
    /// Light for everyday taps (open a game, swipe actions, stars); medium for the main actions.
    static func tap(_ weight: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: weight).impactOccurred()
    }
    /// A tick for picking or toggling (collapse a group, open a shared result).
    static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    /// Taking something away, like deleting a score.
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
}

/// An empty screen with some personality: art when there is some, a next step when there is one.
/// `art` names an image in Assets.xcassets (EmptyFeed, EmptyBoard, EmptyOffline). Until that art
/// exists, the Heroicon `icon` stands in, in the brand's yellow chunky circle.
struct EmptyState: View {
    let art: String
    let icon: String
    let title: String
    let message: String
    var action: (label: String, run: () -> Void)?
    var compact = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        VStack(spacing: compact ? 8 : 12) {
            Group {
                if UIImage(named: art) != nil {
                    Image(art).resizable().scaledToFit().frame(maxWidth: compact ? 96 : 160)
                } else {
                    HeroIcon(icon, size: compact ? 28 : 40)
                        .foregroundStyle(Color.onAccent)
                        .frame(width: compact ? 60 : 88, height: compact ? 60 : 88)
                        .background(Circle().fill(Color.sun))
                        .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2.5))
                        .background(Circle().fill(Color.onAccent).offset(x: 3, y: 3))
                }
            }
            .accessibilityHidden(true)
            // the picture settles in with a little bounce the first time the screen shows
            .scaleEffect(shown || reduceMotion ? 1 : 0.6)
            .opacity(shown ? 1 : 0)
            .padding(.bottom, compact ? 0 : 4)
            Text(title)
                .font(.brand(compact ? .headline : .title3, .heavy))
                .foregroundStyle(Color.ink)
                .oneLine(.center)
            // full sentences: these wrap rather than cut off, like error messages
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let action {
                Button {
                    Haptic.tap(.medium)
                    action.run()
                } label: {
                    Text(action.label)
                        .font(.brand(.subheadline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 24)
                        .frame(minHeight: 48)
                }
                .buttonStyle(.pressIn(.sun))
                .padding(.top, 6)
            }
        }
        .frame(maxWidth: 320)
        .frame(maxWidth: .infinity)
        .padding(.vertical, compact ? 12 : 40)
        .padding(.horizontal, 16)
        .onAppear {
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0.4)) { shown = true }
        }
    }
}

enum Appearance {
    /// Rounded heavy navigation titles on the brand canvas.
    static func configure() {
        func rounded(_ style: UIFont.TextStyle, _ weight: UIFont.Weight) -> UIFont {
            let base = UIFont.preferredFont(forTextStyle: style)
            let desc = base.fontDescriptor.addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
            return UIFont(descriptor: desc.withDesign(.rounded) ?? desc, size: 0)
        }
        let ink = UIColor(named: "Ink") ?? .label
        let nav = UINavigationBarAppearance()
        nav.configureWithDefaultBackground()
        nav.largeTitleTextAttributes = [.font: rounded(.title1, .heavy), .foregroundColor: ink]
        nav.titleTextAttributes = [.font: rounded(.headline, .bold), .foregroundColor: ink]
        let edge = UINavigationBarAppearance()
        edge.configureWithTransparentBackground()
        edge.largeTitleTextAttributes = nav.largeTitleTextAttributes
        edge.titleTextAttributes = nav.titleTextAttributes
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = edge

    }
}
#endif

/// A Heroicon from the asset catalog (heroicons.com, MIT; added with the premium-ios-feel skill's
/// add_heroicons.py as `hero-<name>` and `hero-<name>-fill`): thin outline at rest, solid when
/// `filled` (selected, or something that's on). Every interface icon is one of these, so the app
/// keeps one family. Menus, swipe actions and tab items take the asset by name instead
/// (`Label("Play", image: "hero-play")`), since they only show plain images.
struct HeroIcon: View {
    let name: String
    var filled = false
    var size: CGFloat = 20
    @ScaledMetric private var scale: CGFloat = 1 // grows with Dynamic Type, like the text beside it

    init(_ name: String, filled: Bool = false, size: CGFloat = 20) {
        self.name = name
        self.filled = filled
        self.size = size
    }

    var body: some View {
        Image(filled ? "hero-\(name)-fill" : "hero-\(name)")
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(width: size * scale, height: size * scale)
            .accessibilityHidden(true)
    }
}

extension Label where Title == Text, Icon == HeroIcon {
    @MainActor init(_ title: String, hero: String, filled: Bool = false, size: CGFloat = 20) {
        self.init { Text(title) } icon: { HeroIcon(hero, filled: filled, size: size) }
    }
}

/// A quick bounce when `trigger` changes: an icon filling in (kudos, stars). None with Reduce Motion.
struct Pop<T: Equatable>: ViewModifier {
    let trigger: T
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.keyframeAnimator(initialValue: 1.0, trigger: trigger) { view, scale in
                view.scaleEffect(scale)
            } keyframes: { _ in
                SpringKeyframe(1.3, duration: 0.12)
                SpringKeyframe(1.0, spring: .bouncy)
            }
        }
    }
}

/// Digits roll to their new value instead of swapping (points, counts, scores), and keep a fixed
/// width so nothing beside them jiggles.
struct Rolling<T: Equatable>: ViewModifier {
    let value: T
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .monospacedDigit()
            .contentTransition(.numericText())
            .animation(reduceMotion ? nil : .snappy, value: value)
    }
}

extension View {
    func pop<T: Equatable>(on trigger: T) -> some View { modifier(Pop(trigger: trigger)) }
    func rolling<T: Equatable>(_ value: T) -> some View { modifier(Rolling(value: value)) }
}

extension GameCategory {
    /// The app's icon for a category. The server's `symbol` is the SF Symbol older builds show.
    var hero: String { Self.heroes[id] ?? "squares-2x2" }
    private static let heroes = [
        "nyt": "newspaper", "linkedin": "briefcase", "geography": "globe-americas", "words": "language", "sports": "flag",
    ]
}

/// A game's identity: its color with its emoji. The emoji is content here, not an interface icon.
struct GameAvatar: View {
    let game: Game
    var size: CGFloat = 44

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(Color(hex: game.color))
            .overlay(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).strokeBorder(Color.onAccent.opacity(0.85), lineWidth: 1.5))
            .overlay(Text(game.emoji).font(.system(size: size * 0.5)))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// 1, 2, 3 in gold, silver, bronze; other ranks plain. Shape plus number, so color isn't the only cue.
struct RankBadge: View {
    let rank: Int
    /// On the always-yellow crown card, plain ranks use dark ink in both light and dark mode.
    var onAccent = false
    var size: CGFloat = 24

    private var fill: Color? {
        switch rank {
        case 1: Color(red: 0.97, green: 0.78, blue: 0.20)
        case 2: Color(red: 0.80, green: 0.81, blue: 0.86)
        case 3: Color(red: 0.74, green: 0.60, blue: 0.48)
        default: nil
        }
    }

    var body: some View {
        Text("\(rank)")
            .font(.brand(.footnote, .heavy))
            .monospacedDigit()
            .foregroundStyle(fill == nil && !onAccent ? Color.secondary : Color.onAccent)
            .frame(width: size, height: size)
            .background(Circle().fill(fill ?? Color.clear))
            .overlay(Circle().strokeBorder(fill == nil && !onAccent ? Color.secondary.opacity(0.4) : Color.onAccent.opacity(0.7), lineWidth: 1.5))
            .accessibilityLabel(Text("Rank \(rank)"))
    }
}

/// The site's signature look, used sparingly: thick outline and a hard offset shadow.
struct ChunkyCard: ViewModifier {
    var fill: Color
    var radius: CGFloat = 20
    var weight: CGFloat = 2.5
    var shadow: CGFloat = 4
    func body(content: Content) -> some View {
        content
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Color.onAccent, lineWidth: weight))
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Color.onAccent).offset(x: shadow, y: shadow))
    }
}

extension View {
    func chunkyCard(_ fill: Color) -> some View { modifier(ChunkyCard(fill: fill)) }

    /// Never wraps: text stays on one line and anything past the available width is hidden,
    /// fading out where it meets the next element.
    func oneLine(_ alignment: Alignment = .leading) -> some View { modifier(OneLine(alignment: alignment)) }
}

struct OneLine: ViewModifier {
    var alignment: Alignment = .leading

    func body(content: Content) -> some View {
        content
            .labelStyle(.titleAndIcon) // a squeezed Label would otherwise drop to icon-only
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .frame(minWidth: 0, maxWidth: .infinity, alignment: alignment)
            .mask {
                HStack(spacing: 0) {
                    if alignment != .leading {
                        LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing).frame(width: 14)
                    }
                    Rectangle()
                    LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing).frame(width: 14)
                }
            }
            .clipped()
    }
}

/// A short board: the first `top` rows, plus mine underneath when I'm further down, so you always
/// see your own place. `hidden` is how many rows that leaves out.
func leaders<T>(_ all: [T], top: Int, isMe: (T) -> Bool) -> (top: [T], me: T?, gap: Bool, hidden: Int) {
    let head = Array(all.prefix(top))
    guard let at = all.firstIndex(where: isMe), at >= top else {
        return (head, nil, false, all.count - head.count)
    }
    // gap: rows between the top and me that aren't shown (a ⋯ goes there)
    return (head, all[at], at > top, all.count - head.count - 1)
}

/// The ⋯ between the top of a short board and my own row further down.
struct BoardGap: View {
    var body: some View {
        HeroIcon("ellipsis-horizontal", size: 14)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .frame(height: 10)
    }
}

func ordinal(_ n: Int) -> String {
    let suffix: String
    switch (n % 100, n % 10) {
    case (11...13, _): suffix = "th"
    case (_, 1): suffix = "st"
    case (_, 2): suffix = "nd"
    case (_, 3): suffix = "rd"
    default: suffix = "th"
    }
    return "\(n)\(suffix)"
}

/// Press-in: a pressed (or, with a pointer, hovered) control sinks into its own shadow, which
/// disappears as it lands. Controls without a shadow just sink in a little.
struct PressInStyle: ButtonStyle {
    enum Kind {
        /// The brand card look as a button: fill, ink outline, hard offset shadow.
        case chunky(fill: Color, radius: CGFloat = 999, weight: CGFloat = 2, shadow: CGFloat = 3)
        /// No shadow to sink into: shrink slightly.
        case plain
    }
    var kind: Kind = .plain

    func makeBody(configuration: Configuration) -> some View {
        PressInBody(configuration: configuration, kind: kind)
    }
}

private struct PressInBody: View {
    let configuration: ButtonStyle.Configuration
    let kind: PressInStyle.Kind
    @State private var hovering = false
    @Environment(\.isEnabled) private var enabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let down = enabled && (configuration.isPressed || hovering)
        Group {
            switch kind {
            case let .chunky(fill, radius, weight, shadow):
                let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
                configuration.label
                    .background(shape.fill(fill))
                    .overlay(shape.strokeBorder(Color.onAccent, lineWidth: weight))
                    .offset(x: down ? shadow : 0, y: down ? shadow : 0)
                    // the shadow stays put underneath; the button slides onto it
                    .background(shape.fill(Color.onAccent).offset(x: shadow, y: shadow).opacity(down ? 0 : 1))
            case .plain:
                configuration.label
                    .scaleEffect(down ? 0.97 : 1)
                    .opacity(down ? 0.8 : 1)
            }
        }
        .contentShape(Rectangle())
        .animation(reduceMotion ? nil : .snappy(duration: 0.15), value: down)
        .onHover { hovering = $0 }
    }
}

extension ButtonStyle where Self == PressInStyle {
    static var pressIn: PressInStyle { PressInStyle() }
    static func pressIn(_ fill: Color, radius: CGFloat = 999, weight: CGFloat = 2, shadow: CGFloat = 3) -> PressInStyle {
        PressInStyle(kind: .chunky(fill: fill, radius: radius, weight: weight, shadow: shadow))
    }
}
