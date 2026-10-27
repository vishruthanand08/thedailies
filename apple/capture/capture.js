// Injected at document start into every frame of the in-app game browser (apple/Dailies/
// GameBrowser.swift). Catches the text a game passes to its own Share/Copy button and posts it
// to native, which submits it like a paste. It never reads cookies, forms, storage or page
// content: the only data sent is what the game itself shares or copies.
//
// Native replaces __HOSTS__ with a JSON array of allowed hosts before injecting. The test
// harness (harness.html) defines window.__HOSTS__ instead.
;(function () {
  var hosts = __HOSTS__
  var SUPPRESS_SHARE_SHEET = true // share() resolves without the system sheet; the native banner is the feedback

  var host = location.host
  var allowed = false
  for (var i = 0; i < hosts.length; i++) {
    if (host === hosts[i] || (hosts[i] && host.slice(-hosts[i].length - 1) === '.' + hosts[i])) allowed = true
  }
  if (!allowed || window.__dailiesCapture) return
  Object.defineProperty(window, '__dailiesCapture', { value: true })

  var lastText = null
  var lastAt = 0

  function post(text, via) {
    if (typeof text !== 'string') return
    text = text.trim()
    if (!text) return
    var now = Date.now()
    // games often call share and copy back to back with the same text
    if (text === lastText && now - lastAt < 2000) return
    lastText = text
    lastAt = now
    try {
      window.webkit.messageHandlers.dailiesCapture.postMessage({ text: text, via: via, href: location.href })
    } catch (e) {}
  }

  function define(obj, name, fn) {
    try {
      Object.defineProperty(obj, name, { value: fn, configurable: true, writable: true })
    } catch (e) {}
  }

  // navigator.share: defined even where WebKit lacks it (macOS), so games take their share path
  var origShare = navigator.share
  define(navigator, 'share', function (data) {
    var parts = []
    if (data && data.text) parts.push(String(data.text))
    if (data && data.url && parts.join('\n').indexOf(String(data.url)) === -1) parts.push(String(data.url))
    post(parts.join('\n'), 'share')
    if (SUPPRESS_SHARE_SHEET || !origShare) return Promise.resolve()
    return origShare.apply(navigator, arguments)
  })
  if (!navigator.canShare) {
    define(navigator, 'canShare', function (data) {
      return !!(data && (data.text || data.url))
    })
  }

  // Clipboard.prototype.writeText
  if (window.Clipboard && Clipboard.prototype.writeText) {
    var origWriteText = Clipboard.prototype.writeText
    define(Clipboard.prototype, 'writeText', function (text) {
      post(String(text), 'writeText')
      return origWriteText.apply(this, arguments)
    })
  }

  // Clipboard.prototype.write: the text/plain blob is only readable asynchronously
  if (window.Clipboard && Clipboard.prototype.write) {
    var origWrite = Clipboard.prototype.write
    define(Clipboard.prototype, 'write', function (items) {
      try {
        for (var j = 0; j < (items || []).length; j++) {
          var item = items[j]
          if (item && item.types && item.types.indexOf('text/plain') !== -1) {
            item.getType('text/plain').then(function (blob) {
              return blob.text()
            }).then(function (t) {
              post(t, 'write')
            }, function () {})
          }
        }
      } catch (e) {}
      return origWrite.apply(this, arguments)
    })
  }

  // document.execCommand('copy'): copies the current selection, often a hidden textarea
  var origExec = Document.prototype.execCommand
  define(Document.prototype, 'execCommand', function (command) {
    if (String(command).toLowerCase() === 'copy') {
      var text = ''
      var el = document.activeElement
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && typeof el.selectionStart === 'number') {
        text = el.value.slice(el.selectionStart, el.selectionEnd)
      }
      if (!text) text = String(window.getSelection ? window.getSelection() : '')
      post(text, 'execCommand')
    }
    return origExec.apply(this, arguments)
  })
})()
