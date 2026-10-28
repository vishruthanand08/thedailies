// Draws the Mac .dmg window's background (the "drag to Applications" screen), at 1x and 2x:
//   swift apple/tools/make-dmg-background.swift <out dir>     -> background.png, background@2x.png
// The site's look: lavender, ink outlines with hard offset shadows, a yellow arrow. Finder puts
// the two icons (and their names) on the white cards; release-mac.sh places them to match.
import AppKit

let width: CGFloat = 640, height: CGFloat = 400
// icon centers, in points from the top-left (release-mac.sh uses the same numbers)
let appCenter = CGPoint(x: 170, y: 212), appsCenter = CGPoint(x: 470, y: 212)

let lavender = NSColor(srgbRed: 0xE9/255, green: 0xE4/255, blue: 0xF7/255, alpha: 1)
let lilac = NSColor(srgbRed: 0xD9/255, green: 0xCC/255, blue: 0xF5/255, alpha: 1)
let ink = NSColor(srgbRed: 0x16/255, green: 0x16/255, blue: 0x2E/255, alpha: 1)
let yellow = NSColor(srgbRed: 0xF8/255, green: 0xD3/255, blue: 0x4C/255, alpha: 1)

func rounded(_ size: CGFloat, _ weight: NSFont.Weight) -> NSFont {
    let base = NSFont.systemFont(ofSize: size, weight: weight)
    return NSFont(descriptor: base.fontDescriptor.withDesign(.rounded) ?? base.fontDescriptor, size: size) ?? base
}

func text(_ s: String, _ font: NSFont, _ color: NSColor) -> NSAttributedString {
    NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color])
}

/// A rounded box with an ink border and a hard shadow down and to the right, like the site's cards.
func card(_ rect: CGRect, radius: CGFloat, fill: NSColor, shadow: CGFloat = 5, border: CGFloat = 2.5) {
    ink.setFill()
    NSBezierPath(roundedRect: rect.offsetBy(dx: shadow, dy: shadow), xRadius: radius, yRadius: radius).fill()
    let box = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill(); box.fill()
    ink.setStroke(); box.lineWidth = border; box.stroke()
}

func draw(scale: CGFloat, to path: String) {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width * scale), pixelsHigh: Int(height * scale),
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: width, height: height) // 2x pixels, same points
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = ctx
    // top-left origin, like Finder's icon positions
    ctx.cgContext.translateBy(x: 0, y: height)
    ctx.cgContext.scaleBy(x: 1, y: -1)
    let flipped = NSGraphicsContext(cgContext: ctx.cgContext, flipped: true)
    NSGraphicsContext.current = flipped

    lavender.setFill()
    CGRect(x: 0, y: 0, width: width, height: height).fill()

    // logo: an ink pill with "The", then "Dailies"
    let the = text("The", rounded(24, .heavy), .white)
    let dailies = text("Dailies", rounded(24, .heavy), ink)
    let pill = CGSize(width: the.size().width + 22, height: 36)
    let logoWidth = pill.width + 8 + dailies.size().width
    let logoX = (width - logoWidth) / 2, logoY: CGFloat = 30
    let pillRect = CGRect(x: logoX, y: logoY, width: pill.width, height: pill.height)
    ink.setFill()
    NSBezierPath(roundedRect: pillRect, xRadius: 11, yRadius: 11).fill()
    the.draw(at: CGPoint(x: pillRect.minX + 11, y: pillRect.midY - the.size().height / 2))
    dailies.draw(at: CGPoint(x: pillRect.maxX + 8, y: pillRect.midY - dailies.size().height / 2))

    let title = text("Drag The Dailies into Applications", rounded(16, .bold), ink)
    title.draw(at: CGPoint(x: (width - title.size().width) / 2, y: 80))

    // a card behind each icon and its name
    for center in [appCenter, appsCenter] {
        card(CGRect(x: center.x - 82, y: center.y - 78, width: 164, height: 172), radius: 22, fill: .white)
    }

    // the arrow, pointing at Applications
    let midY = appCenter.y, left = appCenter.x + 102, right = appsCenter.x - 108
    func arrow(dx: CGFloat, dy: CGFloat) -> NSBezierPath {
        let p = NSBezierPath()
        let shaft: CGFloat = 13, head: CGFloat = 28, headLength: CGFloat = 34
        p.move(to: CGPoint(x: left + dx, y: midY - shaft + dy))
        p.line(to: CGPoint(x: right - headLength + dx, y: midY - shaft + dy))
        p.line(to: CGPoint(x: right - headLength + dx, y: midY - head + dy))
        p.line(to: CGPoint(x: right + dx, y: midY + dy))
        p.line(to: CGPoint(x: right - headLength + dx, y: midY + head + dy))
        p.line(to: CGPoint(x: right - headLength + dx, y: midY + shaft + dy))
        p.line(to: CGPoint(x: left + dx, y: midY + shaft + dy))
        p.close()
        p.lineJoinStyle = .round
        return p
    }
    ink.setFill(); arrow(dx: 4, dy: 4).fill()
    let a = arrow(dx: 0, dy: 0)
    yellow.setFill(); a.fill()
    ink.setStroke(); a.lineWidth = 2.5; a.stroke()

    // a hint below, on a lilac sticker
    let hint = text("Then open it from Applications. Your friends are waiting.", rounded(12.5, .semibold), ink)
    let hintRect = CGRect(x: (width - hint.size().width) / 2 - 14, y: 336, width: hint.size().width + 28, height: 30)
    card(hintRect, radius: 15, fill: lilac, shadow: 3, border: 2)
    hint.draw(at: CGPoint(x: hintRect.minX + 14, y: hintRect.midY - hint.size().height / 2))

    NSGraphicsContext.current = nil
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
draw(scale: 1, to: "\(out)/background.png")
draw(scale: 2, to: "\(out)/background@2x.png")
