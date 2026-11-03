// The Windows clipboard as text: plain text, or the text of a rich copy (some games copy only HTML).
// Electron's clipboard is asynchronous (modeled on the browser's navigator.clipboard): readText()
// and read() return promises, so this does too. Always resolves to a string.
const { clipboard } = require('electron')

async function readClipboardText() {
  try {
    const text = await clipboard.readText()
    if (typeof text === 'string' && text.trim()) return text
  } catch {}
  try {
    for (const item of await clipboard.read()) {
      if (!item.types.includes('text/html')) continue
      const html = await item.getType('text/html')
      return htmlToText(typeof html === 'string' ? html : await html.text())
    }
  } catch {}
  return ''
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
