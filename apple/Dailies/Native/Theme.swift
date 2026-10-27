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
        nav.largeTitleTextAttributes = [.font: rounded(.largeTitle, .heavy), .foregroundColor: ink]
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
            .font(.brand(.subheadline, .heavy))
            .monospacedDigit()
            .foregroundStyle(fill == nil && !onAccent ? Color.secondary : Color.onAccent)
            .frame(width: 28, height: 28)
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
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: down)
        .onHover { hovering = $0 }
    }
}

extension ButtonStyle where Self == PressInStyle {
    static var pressIn: PressInStyle { PressInStyle() }
    static func pressIn(_ fill: Color, radius: CGFloat = 999, weight: CGFloat = 2, shadow: CGFloat = 3) -> PressInStyle {
        PressInStyle(kind: .chunky(fill: fill, radius: radius, weight: weight, shadow: shadow))
    }
}
