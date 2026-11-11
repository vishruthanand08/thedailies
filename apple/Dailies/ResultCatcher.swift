import Foundation
import WebKit

/// Saves a game's result by itself, so players just play.
///
/// A small script runs in every game page (all frames, from the start) and does two things:
/// 1. Catches the result text whenever the page shares or copies it: `navigator.clipboard.writeText`
///    and `.write`, `navigator.share`, `document.execCommand('copy')` and copy events. Each text goes
///    to the app, which posts it like a paste (`SubmissionQueue.enqueue(_, auto: true)`): the server
///    decides whether it's a result, and anything that isn't (a copied link) is dropped quietly.
/// 2. Presses the game's own Share or Copy button once it appears (a button labelled just "Share",
///    "Share results", "Copy", ... that has stayed on screen for a moment), so the score is in
///    without the player tapping anything: each button once, up to four a page (a Share that opens
///    the game's own menu, then the menu's Share), paused while the player is tapping, and none
///    once a score is saved or when the player already has one for today.
///
/// Safe by default, so a mistake here can't stop anyone playing: only the script's own press is
/// held back (the 2 s after it: no share sheet, clipboard untouched, the page just hears sharing
/// worked); every other share or copy, the player's included, goes through exactly as in Safari,
/// and any error in a hook is swallowed before the real call.
enum ResultCatcher {
    static let handlerName = "dailiesResult"

    @MainActor static func install(in config: WKWebViewConfiguration, autoPress: Bool, onResult: @escaping (String) -> Void) {
        let controller = config.userContentController
        controller.add(Handler(onResult: onResult), contentWorld: .page, name: handlerName)
        let source = "window.__dailiesAutoPress = \(autoPress);\n" + script
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false, in: .page))
    }

    /// Tells the page a score was saved, so it stops pressing buttons.
    @MainActor static func saved(in webView: WKWebView) {
        webView.evaluateJavaScript("window.__dailiesSaved && window.__dailiesSaved()", completionHandler: nil)
    }

    /// Removes the message handler (it would otherwise keep the GameBrowser alive).
    @MainActor static func uninstall(from webView: WKWebView) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: handlerName, contentWorld: .page)
    }

    private final class Handler: NSObject, WKScriptMessageHandler {
        let onResult: (String) -> Void
        init(onResult: @escaping (String) -> Void) { self.onResult = onResult }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let text = body["text"] as? String,
                  !text.isEmpty, text.count <= 4000 else { return }
            let how = body["how"] as? String ?? "?"
            log.info("result caught (\(how, privacy: .public)) on \(message.frameInfo.request.url?.host ?? "?", privacy: .public)")
            Task { @MainActor in self.onResult(text) }
        }
    }

    // Plain ES2017, no dependencies. Every hook passes the call through unless it comes straight
    // after the script's own press, so the page behaves exactly as in Safari.
    private static let script = #"""
    (() => {
      if (window.__dailiesCatcher) return
      window.__dailiesCatcher = true
      const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.dailiesResult
      if (!handler) return

      // Only the app's own press (part 2) is held back, and only just after it: everything else, a
      // player's tap included (some games share after a fetch, when the tap no longer counts as
      // recent), goes through to the real share sheet or clipboard, so a mistake here can't block it.
      let ourPressAt = 0
      const ours = () => Date.now() - ourPressAt < 2000
      const sentRecently = new Map()
      const send = (text, how) => {
        if (typeof text !== 'string') return
        text = text.trim()
        if (!text || text.length > 4000) return
        const now = Date.now()
        if (now - (sentRecently.get(text) || 0) < 5000) return // share and copy back to back
        sentRecently.set(text, now)
        try { handler.postMessage({ text, how }) } catch (e) {}
      }
      const quietly = (f) => { try { f() } catch (e) {} }

      // 1. Catch the result whenever the page shares or copies it
      const clip = navigator.clipboard
      if (clip && typeof clip.writeText === 'function') {
        const writeText = clip.writeText.bind(clip)
        clip.writeText = function (t) {
          quietly(() => send(String(t), 'writeText'))
          return ours() ? Promise.resolve() : writeText(t)
        }
      }
      if (clip && typeof clip.write === 'function') {
        const write = clip.write.bind(clip)
        clip.write = function (items) {
          try {
            for (const item of items || []) {
              if (item && item.types && item.types.indexOf('text/plain') >= 0) {
                Promise.resolve(item.getType('text/plain')).then((b) => b.text()).then((t) => send(t, 'write')).catch(() => {})
              }
            }
          } catch (e) {}
          return ours() ? Promise.resolve() : write(items)
        }
      }
      if (typeof navigator.share === 'function') {
        const share = navigator.share.bind(navigator)
        navigator.share = function (data) {
          // the text and the link: some games' result is only the link (The Mini's ?d=…&t=…)
          quietly(() => { if (data) send([data.text, data.url].filter(Boolean).join('\n') || String(data.title || ''), 'share') })
          return ours() ? Promise.resolve() : share(data)
        }
      }
      const selected = () => {
        const el = document.activeElement
        if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && typeof el.selectionStart === 'number') {
          const t = el.value.slice(el.selectionStart, el.selectionEnd)
          if (t) return t
        }
        return String(window.getSelection ? window.getSelection() : '')
      }
      const execCommand = document.execCommand
      document.execCommand = function (command) {
        quietly(() => { if (String(command).toLowerCase() === 'copy') send(selected(), 'execCommand') })
        return execCommand.apply(this, arguments)
      }
      let inCopy = false
      window.addEventListener('copy', () => {
        inCopy = true
        setTimeout(() => { inCopy = false }, 0)
        quietly(() => send(selected(), 'copy'))
      }, true)
      const setData = DataTransfer.prototype.setData
      DataTransfer.prototype.setData = function (type, value) {
        try { if (inCopy && /^text(\/plain)?$/i.test(type)) send(String(value), 'setData') } catch (e) {}
        return setData.apply(this, arguments)
      }

      // 2. Press the game's own Share or Copy once it shows up
      let saved = false
      window.__dailiesSaved = () => { saved = true }
      if (!window.__dailiesAutoPress) return
      const LABEL = /^(share|share (your |my |the )?(results?|score|stats|grid)|copy|copy (your |my |the )?(results?|score|grid)|copy to clipboard)!?$/i
      const labelOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()
      const onScreen = (el) => {
        if (el.disabled || el.closest('[aria-hidden="true"], header, nav, footer')) return false
        if (el.tagName === 'A') {
          const href = el.getAttribute('href')
          if (href && href !== '#' && !/^javascript:/i.test(href)) return false // a link away, not a button
        }
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false
        const s = getComputedStyle(el)
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.2 && s.pointerEvents !== 'none'
      }
      // Presses wait while the player is tapping (playing means touching the page, so a touch only
      // pauses it), so they never fight the player. Each button once, at most four a page: enough
      // for a game whose Share opens its own menu with another Share inside (NYT), and the presses
      // stop as soon as a score is saved.
      let lastTouch = 0
      for (const type of ['pointerdown', 'touchstart', 'keydown']) {
        window.addEventListener(type, (e) => { if (e.isTrusted) lastTouch = Date.now() }, true)
      }
      const firstSeen = new WeakMap()
      const pressed = new WeakSet()
      let presses = 0
      const started = Date.now()
      const timer = setInterval(() => {
        if (saved || presses >= 4 || Date.now() - started > 45 * 60 * 1000) return clearInterval(timer)
        if (Date.now() - lastTouch < 1500) return // the player is mid-tap
        if (document.hidden) return
        const now = Date.now()
        for (const el of document.querySelectorAll('button, [role="button"], a')) {
          if (pressed.has(el) || !LABEL.test(labelOf(el)) || !onScreen(el)) continue
          const seen = firstSeen.get(el)
          if (!seen) { firstSeen.set(el, now); continue }
          if (now - seen < 800) continue // let the results finish animating in
          pressed.add(el)
          presses++
          ourPressAt = Date.now()
          quietly(() => el.click())
          return
        }
      }, 500)
    })()
    """#
}
