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
      // what a copy copies: the selection in a text field (focused or not: NYT selects one that
      // isn't), else the page's selection
      const selected = () => {
        const fields = [document.activeElement].concat(Array.from(document.querySelectorAll('input, textarea')))
        for (const el of fields) {
          if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT')) continue
          try {
            if (typeof el.selectionStart === 'number' && el.selectionEnd > el.selectionStart) {
              return el.value.slice(el.selectionStart, el.selectionEnd)
            }
          } catch (e) {} // inputs like checkboxes throw on selectionStart
        }
        return String(window.getSelection ? window.getSelection() : '')
      }
      const execCommand = document.execCommand
      document.execCommand = function (command) {
        let copy = false
        quietly(() => { copy = String(command).toLowerCase() === 'copy'; if (copy) send(selected(), 'execCommand') })
        if (copy && ours()) return true
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
      // A button's hidden label and its visible text are checked separately: Poeltl's says "Share
      // Today's Game" to screen readers and "Share" on screen, Plain's "Challenge friends: share your
      // result" and "Challenge friends".
      const LABEL = new RegExp('^(' + [
        "share( (your|my|the|today'?s|today’s))?( (results?|score|stats|grid|game))?", 'share (your|my) card',
        'share with friends', 'challenge (friends|them back)',
        'copy( (your|my|the|share|spoiler-free))?( (results?|score|grid|text))?( for sharing)?',
        'copy to clipboard',
      ].join('|') + ')[!.]?$', 'i')
      // spaces collapsed, icons and emoji around the words dropped ("📤 Share", "Copy ✓")
      const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}!.]+$/gu, '')
      const host = location.hostname
      // A step some games need before their Share shows up, or a menu item that is the result there
      const extra = (el, text) =>
        // Immaculate Grid: below 9/9 the summary offers Keep Guessing, and Share only appears after this
        (/sports-reference\.com$/.test(host) && /-no-thanks$/.test(el.getAttribute('data-testid') || '')) ||
        // GeoGuessr: a "Share your result" card opens its share dialog (Copy result, Share)
        (/geoguessr\.com$/.test(host) && el.getAttribute('aria-haspopup') === 'dialog' && /^share your result/i.test(text)) ||
        // NYT's own share menu, when the iPhone share sheet isn't offered: The Mini's result is the link
        (/nytimes\.com$/.test(host) && /^copy link$/i.test(clean(el.getAttribute('aria-label'))))
      const wanted = (el) => {
        const text = clean(el.textContent)
        if (text.length > 80 && !extra(el, text)) return false
        return LABEL.test(clean(el.getAttribute('aria-label'))) || LABEL.test(text) || extra(el, text)
      }
      // Below the fold is fine (a long results column puts Share at the bottom, and a click doesn't
      // need it on screen); hidden, disabled, off to the side or a link away is not.
      const pressable = (el) => {
        if (el.disabled || el.closest('[aria-hidden="true"], [inert], header, nav, footer')) return false
        if (el.tagName === 'A') {
          const href = el.getAttribute('href')
          if (href && href !== '#' && !/^javascript:/i.test(href)) return false // a link away, not a button
        }
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8 || r.right < 0 || r.left > innerWidth) return false
        const s = getComputedStyle(el)
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.2 && s.pointerEvents !== 'none'
      }
      // Buttons, plus plain text styled to be tapped (Poople's "Copy results" is a <span>), unless
      // it sits inside a button, which is pressed itself.
      const candidates = () => {
        const out = Array.from(document.querySelectorAll('button, [role="button"], a'))
        for (const el of document.querySelectorAll('span, div, p, li, label')) {
          if (el.childElementCount > 0 || el.closest('button, [role="button"], a')) continue
          if (!LABEL.test(clean(el.textContent))) continue
          if (getComputedStyle(el).cursor === 'pointer') out.push(el)
        }
        return out
      }
      // Presses wait while the player is tapping (playing means touching the page, so a touch only
      // pauses it), so they never fight the player; buttons are still noticed meanwhile, so the
      // press comes as soon as the pause ends. Each button once, at most four a page: enough for a
      // step first (Immaculate Grid) or a Share that opens the game's own menu with another Share
      // inside (NYT, GeoGuessr), and the presses stop as soon as a score is saved.
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
        if (document.hidden) return
        const now = Date.now()
        const paused = now - lastTouch < 1500 // the player is mid-tap
        try {
          for (const el of candidates()) {
            if (pressed.has(el) || !wanted(el) || !pressable(el)) continue
            const seen = firstSeen.get(el)
            if (!seen) { firstSeen.set(el, now); continue }
            if (paused || now - seen < 600) continue // let the results finish animating in
            pressed.add(el)
            presses++
            ourPressAt = Date.now()
            quietly(() => el.click())
            return
          }
        } catch (e) {}
      }, 500)
    })()
    """#
}
