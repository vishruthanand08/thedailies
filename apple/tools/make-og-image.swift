// Draws the website's link-preview image (iMessage, WhatsApp, Slack…), 1200×630:
//   swift apple/tools/make-og-image.swift apple/Dailies/Assets.xcassets/AppIcon.appiconset/icon-ios-1024.png web/public/og.png
// The site's look: lavender, ink outlines with hard offset shadows, yellow, and the app icon.
import AppKit

let width: CGFloat = 1200, height: CGFloat = 630
let args = CommandLine.arguments
guard args.count == 3, let icon = NSImage(contentsOfFile: args[1]) else {
    print("usage: make-og-image.swift <app icon png> <out png>"); exit(1)
}

let lavender = NSColor(srgbRed: 0xE9/255, green: 0xE4/255, blue: 0xF7/255, alpha: 1)
let ink = NSColor(srgbRed: 0x16/255, green: 0x16/255, blue: 0x2E/255, alpha: 1)
let muted = NSColor(srgbRed: 0x6F/255, green: 0x6F/255, blue: 0x8A/255, alpha: 1)
let yellow = NSColor(srgbRed: 0xF8/255, green: 0xD3/255, blue: 0x4C/255, alpha: 1)
let lilac = NSColor(srgbRed: 0xD9/255, green: 0xCC/255, blue: 0xF5/255, alpha: 1)

func rounded(_ size: CGFloat, _ weight: NSFont.Weight) -> NSFont {
    let base = NSFont.systemFont(ofSize: size, weight: weight)
    return NSFont(descriptor: base.fontDescriptor.withDesign(.rounded) ?? base.fontDescriptor, size: size) ?? base
}
func text(_ s: String, _ font: NSFont, _ color: NSColor) -> NSAttributedString {
    NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color])
}
/// A box with an ink border and a hard shadow down and to the right, like the site's cards.
func card(_ rect: CGRect, radius: CGFloat, fill: NSColor, shadow: CGFloat, border: CGFloat = 4) {
    ink.setFill()
    NSBezierPath(roundedRect: rect.offsetBy(dx: shadow, dy: shadow), xRadius: radius, yRadius: radius).fill()
    let box = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill(); box.fill()
    ink.setStroke(); box.lineWidth = border; box.stroke()
}

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width), pixelsHigh: Int(height),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let base = NSGraphicsContext(bitmapImageRep: rep)!
base.cgContext.translateBy(x: 0, y: height)
base.cgContext.scaleBy(x: 1, y: -1) // top-left origin
NSGraphicsContext.current = NSGraphicsContext(cgContext: base.cgContext, flipped: true)

lavender.setFill()
CGRect(x: 0, y: 0, width: width, height: height).fill()

// logo: an ink pill with "The", then "Dailies"
let the = text("The", rounded(44, .heavy), .white)
let dailies = text("Dailies", rounded(44, .heavy), ink)
let pill = CGRect(x: 80, y: 78, width: the.size().width + 36, height: 64)
ink.setFill()
NSBezierPath(roundedRect: pill, xRadius: 18, yRadius: 18).fill()
the.draw(at: CGPoint(x: pill.minX + 18, y: pill.midY - the.size().height / 2))
dailies.draw(at: CGPoint(x: pill.maxX + 14, y: pill.midY - dailies.size().height / 2))

// headline, with "everything" on a yellow highlighter stripe like the site's hero
let line1 = text("Beat your friends", rounded(66, .heavy), ink)
line1.draw(at: CGPoint(x: 80, y: 178))
let at = text("at ", rounded(66, .heavy), ink)
let every = text("everything", rounded(66, .heavy), ink)
let y2: CGFloat = 256
at.draw(at: CGPoint(x: 80, y: y2))
let everyX = 80 + at.size().width
yellow.setFill()
NSBezierPath(roundedRect: CGRect(x: everyX - 6, y: y2 + every.size().height * 0.52, width: every.size().width + 12, height: every.size().height * 0.36),
             xRadius: 8, yRadius: 8).fill()
every.draw(at: CGPoint(x: everyX, y: y2))

text("Wordle · Connections · Queens · Strands", rounded(28, .semibold), muted)
    .draw(at: CGPoint(x: 82, y: 360))
text("One leaderboard for every daily you play.", rounded(28, .semibold), muted)
    .draw(at: CGPoint(x: 82, y: 400))

// the call to action, on a yellow sticker
let cta = text("Add friends. Compare every day. 👑", rounded(30, .bold), ink)
let ctaRect = CGRect(x: 80, y: 476, width: cta.size().width + 52, height: 70)
card(ctaRect, radius: 35, fill: yellow, shadow: 6)
cta.draw(at: CGPoint(x: ctaRect.minX + 26, y: ctaRect.midY - cta.size().height / 2))

// the app icon on a card, tilted a little
let ctx = NSGraphicsContext.current!.cgContext
ctx.saveGState()
let iconRect = CGRect(x: 0, y: 0, width: 300, height: 300)
ctx.translateBy(x: 955, y: 305)
ctx.rotate(by: 4 * .pi / 180)
ctx.translateBy(x: -iconRect.width / 2, y: -iconRect.height / 2)
card(iconRect.insetBy(dx: -14, dy: -14), radius: 80, fill: lilac, shadow: 12, border: 5)
NSBezierPath(roundedRect: iconRect, xRadius: 66, yRadius: 66).addClip()
icon.draw(in: iconRect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
ctx.restoreGState()

NSGraphicsContext.current = nil
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
