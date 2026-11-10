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
///    "Share results", "Copy", ... that has stayed on screen for a moment), at most three presses
///    per page and none once a score is saved or when the player already has one for today.
///
/// The game itself isn't changed: when the player taps Share themselves, the share sheet and the
/// clipboard work as usual. The script's own press isn't a tap, so it never opens the share sheet
/// or touches the clipboard; the page just hears that sharing worked.
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

    // Plain ES2017, no dependencies. Every hook passes the call through when the player really
    // tapped (navigator.userActivation), so the page behaves exactly as in Safari.
    private static let script = #"""
    (() => {
      if (window.__dailiesCatcher) return
      window.__dailiesCatcher = true
      const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.dailiesResult
      if (!handler) return

      const tapped = () => { try { return !!(navigator.userActivation && navigator.userActivation.isActive) } catch (e) { return false } }
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

      // 1. Catch the result whenever the page shares or copies it
      const clip = navigator.clipboard
      if (clip && typeof clip.writeText === 'function') {
        const writeText = clip.writeText.bind(clip)
        clip.writeText = function (t) {
          send(String(t), 'writeText')
          return tapped() ? writeText(t) : Promise.resolve()
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
          return tapped() ? write(items) : Promise.resolve()
        }
      }
      if (typeof navigator.share === 'function') {
        const share = navigator.share.bind(navigator)
        navigator.share = function (data) {
          if (data) send(String(data.text || data.title || ''), 'share')
          return tapped() ? share(data) : Promise.resolve()
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
        if (String(command).toLowerCase() === 'copy') send(selected(), 'execCommand')
        return execCommand.apply(this, arguments)
      }
      let inCopy = false
      window.addEventListener('copy', () => {
        inCopy = true
        setTimeout(() => { inCopy = false }, 0)
        send(selected(), 'copy')
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
      const firstSeen = new WeakMap()
      const pressed = new WeakSet()
      let presses = 0
      const started = Date.now()
      const timer = setInterval(() => {
        if (saved || presses >= 3 || Date.now() - started > 45 * 60 * 1000) return clearInterval(timer)
        if (document.hidden) return
        const now = Date.now()
        for (const el of document.querySelectorAll('button, [role="button"], a')) {
          if (pressed.has(el) || !LABEL.test(labelOf(el)) || !onScreen(el)) continue
          const seen = firstSeen.get(el)
          if (!seen) { firstSeen.set(el, now); continue }
          if (now - seen < 800) continue // let the results finish animating in
          pressed.add(el)
          presses++
          el.click()
          return
        }
      }, 500)
    })()
    """#
}
