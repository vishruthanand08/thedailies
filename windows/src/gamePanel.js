// Play: the game in a panel over the page, drawn like the website's game panel
// (web/src/GamePanel.jsx) and the Mac's GamePanel.swift: the game's tile and name, Window ↗ to
// pop it out to its own window, ✕, and the paste footer. Unlike the site's iframe, every game
// loads here: NYT and LinkedIn refuse to be framed by a page, not shown in their own view.
//
// Two views sit on the window: the panel's page (pages/panel.html: backdrop, header, footer,
// transparent elsewhere) and the game's own view on top of it, placed over the hole the page
// leaves for it. The game's page is never scripted; the score comes from the clipboard after
// the player taps the game's Share or Copy, as on the website and the Mac.
const { BrowserWindow, WebContentsView, ipcMain } = require('electron')
const path = require('node:path')
const hosts = require('./hosts')
const { readClipboardText } = require('./clipboard')
const { log } = require('./log')

const PANEL_PAGE = path.join(__dirname, 'pages', 'panel.html')
const panels = new Map() // the panel page's webContents id -> GamePanel

class GamePanel {
  // mode 'overlay' sits over the main window; 'window' fills a pop-out window of its own
  constructor(win, launch, { mode, submit, openExternally, icon }) {
    this.win = win
    this.launch = launch
    this.mode = mode
    this.submit = submit
    this.icon = icon
    this.openExternally = openExternally
    this.onClosed = null

    this.page = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, 'preload-panel.js'), contextIsolation: true, sandbox: true },
    })
    this.page.setBackgroundColor('#00000000')
    this.game = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true } })
    this.game.setBackgroundColor('#ffffff')
    this.game.setBounds({ x: 0, y: 0, width: 0, height: 0 }) // placed once the page reports its hole
    win.contentView.addChildView(this.page)
    win.contentView.addChildView(this.game)

    this.layout = () => {
      const [width, height] = win.getContentSize()
      this.page.setBounds({ x: 0, y: 0, width, height })
    }
    this.layout()
    win.on('resize', this.layout)
    panels.set(this.page.webContents.id, this)

    this.page.webContents.loadFile(PANEL_PAGE, {
      query: { mode, name: launch.name, emoji: launch.emoji || '🎮', color: launch.color || '#d9ccf5' },
    })
    this.guardGame()
    this.game.webContents.loadURL(launch.url)
    this.game.webContents.once('dom-ready', () => !this.closed && this.game.webContents.focus())
  }

  // links off the game's site open in the default browser; popups stay in this view
  guardGame() {
    const wc = this.game.webContents
    wc.on('will-navigate', (e, url) => {
      if (!/^https?:/i.test(url) || hosts.isGame(url)) return
      e.preventDefault()
      this.openExternally(url)
    })
    wc.setWindowOpenHandler(({ url }) => {
      if (hosts.isGame(url)) wc.loadURL(url)
      else this.openExternally(url)
      return { action: 'deny' }
    })
  }

  setHole({ x, y, width, height }) {
    if (this.closed || ![x, y, width, height].every(Number.isFinite)) return
    this.game.setBounds({
      x: Math.round(x), y: Math.round(y),
      width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)),
    })
  }

  async paste() {
    const text = readClipboardText()
    if (!text.trim()) return { ok: false, msg: `Clipboard is empty. Tap Share or Copy in ${this.launch.name} first.` }
    return this.submit(text)
  }

  // Edit › Paste Result: presses the panel's own button, so its message shows in the panel
  pasteNow() {
    if (!this.closed) this.page.webContents.send('panel:paste-now')
  }

  popOut() {
    const { launch, submit, openExternally, icon } = this
    this.close()
    openGameWindow(launch, { submit, openExternally, icon })
  }

  close() {
    if (this.closed) return
    this.closed = true
    panels.delete(this.page.webContents.id)
    if (!this.win.isDestroyed()) {
      this.win.off('resize', this.layout)
      this.win.contentView.removeChildView(this.game)
      this.win.contentView.removeChildView(this.page)
    }
    this.game.webContents.close()
    this.page.webContents.close()
    this.onClosed?.()
  }
}

// Window ↗: the game in its own maximized window, with the same header and paste footer
function openGameWindow(launch, opts) {
  const win = new BrowserWindow({
    width: 1200, height: 900, title: launch.name, icon: opts.icon,
    backgroundColor: '#e9e4f7', autoHideMenuBar: true, show: false,
  })
  win.maximize()
  win.show()
  const panel = new GamePanel(win, launch, { ...opts, mode: 'window' })
  win.on('closed', () => panel.close())
  return panel
}

// the open panel in a window, if any (for Edit › Paste Result)
function panelIn(win) {
  for (const p of panels.values()) if (p.win === win) return p
  return null
}

function registerPanelIpc() {
  const from = (e) => panels.get(e.sender.id)
  ipcMain.on('panel:hole', (e, rect) => from(e)?.setHole(rect ?? {}))
  ipcMain.on('panel:close', (e) => {
    const p = from(e)
    if (!p) return
    if (p.mode === 'window') p.win.close()
    else p.close()
  })
  ipcMain.on('panel:popout', (e) => {
    const p = from(e)
    if (p?.mode === 'overlay') p.popOut()
  })
  ipcMain.handle('panel:paste', async (e) => {
    const p = from(e)
    if (!p) return { ok: false, msg: 'That game is closed.' }
    try {
      return await p.paste()
    } catch (err) {
      log('paste failed:', err)
      return { ok: false, msg: 'Couldn’t save that. Try again, or paste it on the board.' }
    }
  })
}

module.exports = { GamePanel, panelIn, registerPanelIpc }
