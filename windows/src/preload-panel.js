// The game panel's own page (pages/panel.html) talks to the app through these.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dailiesPanel', {
  // where the game should sit, in the page's coordinates
  hole: (rect) => ipcRenderer.send('panel:hole', rect),
  // reads the clipboard and saves it; resolves to { ok, msg }
  paste: () => ipcRenderer.invoke('panel:paste'),
  close: () => ipcRenderer.send('panel:close'),
  popOut: () => ipcRenderer.send('panel:popout'),
  // Edit › Paste Result while the panel is open
  onPasteNow: (fn) => ipcRenderer.on('panel:paste-now', () => fn()),
})
