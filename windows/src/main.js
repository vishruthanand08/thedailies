// The Dailies for Windows: the website in its own window (src/site.js), every game playable in a
// panel over it (src/gamePanel.js), and the Mac app's menu commands. The site needs no changes:
// it already talks to the Mac app's bridge, which src/preload-site.js offers here too.
const { app, BrowserWindow, Menu, ipcMain, session } = require('electron')
const { SITE, isOwnSite, cleanUserAgent } = require('./config')
const hosts = require('./hosts')
const site = require('./site')
const { readClipboardText } = require('./clipboard')
const { GamePanel, panelIn, registerPanelIpc } = require('./gamePanel')
const { buildMenu } = require('./menu')

let mainWindow = null
let overlay = null // the game panel open over the main window

// games and the site see Chrome's own user agent, not Electron's
app.userAgentFallback = cleanUserAgent(app.userAgentFallback)
app.setAppUserModelId('lol.thedailies.windows')

function openGame(launch) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  overlay?.close()
  const panel = new GamePanel(mainWindow, launch, {
    mode: 'overlay',
    icon: site.ICON,
    openExternally: site.openExternally,
    submit: (text) => site.submit(mainWindow.webContents, text),
  })
  panel.onClosed = () => {
    if (overlay === panel) overlay = null
  }
  overlay = panel
}

// only the site's own top frame in the main window may use the bridge
function fromSite(e) {
  const frame = e.senderFrame
  return Boolean(mainWindow && !mainWindow.isDestroyed() && e.sender === mainWindow.webContents &&
    frame && frame === mainWindow.webContents.mainFrame && isOwnSite(frame.url))
}

function registerSiteIpc() {
  ipcMain.on('site:message', (e, msg) => {
    if (!fromSite(e) || typeof msg?.type !== 'string') return
    // Play on the board. ('session' messages are for the Mac's device token; nothing to do here.)
    if (msg.type === 'open' && typeof msg.url === 'string' && /^https?:\/\//i.test(msg.url)) {
      const name = typeof msg.name === 'string' ? msg.name : hosts.nameFor(msg.url)
      if (msg.gameId) hosts.learn(msg.url, name) // a game from the board
      if (!hosts.isGame(msg.url)) return site.openExternally(msg.url)
      openGame({
        url: msg.url,
        name,
        emoji: typeof msg.emoji === 'string' ? msg.emoji : null,
        color: typeof msg.color === 'string' ? msg.color : null,
      })
    }
  })
  // the site's Paste button
  ipcMain.handle('site:clipboard', (e) => (fromSite(e) ? readClipboardText() : ''))
}

// Games may copy their results and go full screen; nothing else is granted.
function limitPermissions() {
  const allowed = new Set(['clipboard-sanitized-write', 'fullscreen'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, done) => done(allowed.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
}

function start() {
  limitPermissions()
  registerSiteIpc()
  registerPanelIpc()

  const target = () => mainWindow.webContents
  // a command for the site: the main window comes forward, out from under any game panel
  const onSite = (fn) => () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    overlay?.close()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    fn(target())
  }
  Menu.setApplicationMenu(buildMenu({
    addScore: onSite((wc) => site.openPasteBox(wc)),
    // with a game open (here or in its own window), its panel's Paste button; else the site's
    pasteResult: () => {
      const panel = panelIn(BrowserWindow.getFocusedWindow())
      if (panel) panel.pasteNow()
      else onSite((wc) => site.pasteInPage(wc))()
    },
    tab: (label) => onSite((wc) => site.showTab(wc, label))(),
    day: (days) => onSite((wc) => site.showDay(wc, days))(),
    reload: onSite(() => site.loadSite(mainWindow)),
    openPage: (p) => site.openExternally(new URL(p, SITE).href),
  }))

  mainWindow = site.createMainWindow({ openGame })
  // closing the main window quits, game windows included
  mainWindow.on('closed', () => {
    mainWindow = null
    app.quit()
  })
}

// one copy at a time: opening it again brings the window forward
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.whenReady().then(start)
  app.on('window-all-closed', () => app.quit())
}

// no <webview> tags anywhere
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault())
})
