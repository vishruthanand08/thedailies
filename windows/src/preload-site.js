// Runs in the website's page before its scripts. The site already talks to the Mac app through
// WebKit's message handlers (web/src/native.js); this offers the same two handlers, so the site
// needs no Windows-specific code:
//   webkit.messageHandlers.dailies.postMessage(msg)       session updates and Play ('open')
//   webkit.messageHandlers.dailiesClipboard.postMessage() resolves to the clipboard's text
// and __dailiesNative.clipboard tells the Paste button to read the clipboard through the app.
const { contextBridge, ipcRenderer } = require('electron')

// only on the site's own pages (the offline card is a local file and gets nothing)
if (location.protocol === 'https:' || location.protocol === 'http:') {
  contextBridge.exposeInMainWorld('webkit', {
    messageHandlers: {
      dailies: { postMessage: (msg) => ipcRenderer.send('site:message', msg) },
      dailiesClipboard: { postMessage: () => ipcRenderer.invoke('site:clipboard') },
    },
  })
  contextBridge.exposeInMainWorld('__dailiesNative', { platform: 'windows', clipboard: true })
}
