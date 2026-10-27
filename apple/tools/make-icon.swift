// Regenerates the app icon: swift apple/tools/make-icon.swift apple/Dailies/Assets.xcassets/AppIcon.appiconset
import AppKit
import CoreGraphics

// The Dailies icon: lavender background, tilted ink tile with a yellow offset shadow, white "D".
// mac: true draws the macOS plate (824pt rounded square on a transparent 1024 canvas).
func draw(size: Int, mac: Bool, to path: String) {
    let s = CGFloat(size)
    let alpha: CGImageAlphaInfo = mac ? .premultipliedLast : .noneSkipLast // iOS icons must be opaque
    let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: alpha.rawValue)!
    let lavender = CGColor(red: 0xE9/255, green: 0xE4/255, blue: 0xF7/255, alpha: 1)
    let ink = CGColor(red: 0x16/255, green: 0x16/255, blue: 0x2E/255, alpha: 1)
    let yellow = CGColor(red: 0xF8/255, green: 0xD3/255, blue: 0x4C/255, alpha: 1)

    var canvas = CGRect(x: 0, y: 0, width: s, height: s)
    if mac {
        ctx.clear(canvas)
        canvas = canvas.insetBy(dx: s * 100/1024, dy: s * 100/1024)
        let plate = CGPath(roundedRect: canvas, cornerWidth: s * 185/1024, cornerHeight: s * 185/1024, transform: nil)
        ctx.setShadow(offset: CGSize(width: 0, height: -s * 10/1024), blur: s * 20/1024, color: CGColor(gray: 0, alpha: 0.3))
        ctx.addPath(plate); ctx.setFillColor(lavender); ctx.fillPath()
        ctx.setShadow(offset: .zero, blur: 0, color: nil)
        ctx.addPath(plate); ctx.clip()
    } else {
        ctx.setFillColor(lavender); ctx.fill(canvas)
    }
    let u = canvas.width / 1024 // design units relative to the drawing area
    let c = CGPoint(x: canvas.midX, y: canvas.midY)

    ctx.saveGState()
    ctx.translateBy(x: c.x, y: c.y)
    ctx.rotate(by: 6 * .pi / 180) // counter-clockwise in CG = the site's -3deg tilt, a bit stronger
    let tile = CGRect(x: -300*u, y: -300*u, width: 600*u, height: 600*u)
    let radius = 120*u
    // hard offset shadow (down-right), like the site's cards
    ctx.addPath(CGPath(roundedRect: tile.offsetBy(dx: 44*u, dy: -44*u), cornerWidth: radius, cornerHeight: radius, transform: nil))
    ctx.setFillColor(yellow); ctx.fillPath()
    ctx.addPath(CGPath(roundedRect: tile, cornerWidth: radius, cornerHeight: radius, transform: nil))
    ctx.setFillColor(ink); ctx.fillPath()

    // white "D"
    let base = NSFont.systemFont(ofSize: 430*u, weight: .black)
    let font = base.fontDescriptor.withDesign(.rounded).flatMap { NSFont(descriptor: $0, size: 430*u) } ?? base
    let text = NSAttributedString(string: "D", attributes: [.font: font, .foregroundColor: NSColor.white])
    let line = CTLineCreateWithAttributedString(text)
    let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
    ctx.textPosition = CGPoint(x: -bounds.midX, y: -bounds.midY)
    CTLineDraw(line, ctx)
    ctx.restoreGState()

    let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let out = CommandLine.arguments[1]
draw(size: 1024, mac: false, to: out + "/icon-ios-1024.png")
for (pt, scale) in [(16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2), (256, 1), (256, 2), (512, 1), (512, 2)] {
    draw(size: pt * scale, mac: true, to: out + "/icon-mac-\(pt)@\(scale)x.png")
}
