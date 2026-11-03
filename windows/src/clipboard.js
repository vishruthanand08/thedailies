// The Windows clipboard as text: plain text, or the text of a rich copy (some games copy only HTML).
const { clipboard } = require('electron')

function readClipboardText() {
  const text = clipboard.readText()
  if (text.trim()) return text
  const html = clipboard.readHTML()
  return html ? htmlToText(html) : ''
}

function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

module.exports = { readClipboardText }
