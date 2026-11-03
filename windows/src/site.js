// The main window: the website itself, header, tabs and sign-in page included (like the Mac app's
// MacRootView), plus the commands the menus send it.
const { BrowserWindow, session, shell } = require('electron')
const path = require('node:path')
const { SITE, isOwnSite, siteUserAgent } = require('./config')
const hosts = require('./hosts')
const windowState = require('./windowState')
const { log } = require('./log')

const ICON = path.join(__dirname, 'assets', 'icon.png')
const OFFLINE_PAGE = path.join(__dirname, 'pages', 'offline.html')
const HIDE_PAGE_SCROLLBAR = 'html { scrollbar-width: none } html::-webkit-scrollbar { display: none }'

function openExternally(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url)
}

// `openGame(launch)` shows the game panel; links to anything else open in the default browser
function createMainWindow({ openGame }) {
  const state = windowState.load()
  const win = new BrowserWindow({
    ...state.bounds,
    minWidth: 400,
    minHeight: 560,
    title: 'The Dailies',
    icon: ICON,
    backgroundColor: '#e9e4f7',
    autoHideMenuBar: true, // the window looks like the site; Alt shows the menus
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-site.js'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  if (state.maximized) win.maximize()
  windowState.track(win)
  win.once('ready-to-show', () => win.show())
  setTimeout(() => !win.isDestroyed() && !win.isVisible() && win.show(), 4000) // never stay hidden

  const wc = win.webContents
  wc.setUserAgent(siteUserAgent())

  const route = (url) => {
    if (hosts.isGame(url)) openGame({ url, name: hosts.nameFor(url) })
    else openExternally(url)
  }
  // same-site links load here; game links open the panel; anything else the default browser
  wc.on('will-navigate', (e, url) => {
    if (isOwnSite(url)) return
    e.preventDefault()
    route(url)
  })
  // target=_blank and window.open, including Play on a site version without the app bridge
  wc.setWindowOpenHandler(({ url }) => {
    route(url)
    return { action: 'deny' }
  })

  // the site didn't load (offline, server down): a retry card that tries again by itself
  wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* replaced by another load */ || !isOwnSite(url)) return
    wc.loadFile(OFFLINE_PAGE, { query: { site: SITE.href } })
  })
  // the page's process went away (a crash, memory pressure): bring the site back
  wc.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit') loadSite(win)
  })
  // Windows draws a classic scroll bar down the page's side (the Mac's overlay bars stay hidden);
  // the window scrolls with the wheel, touchpad and keys without one
  wc.on('dom-ready', () => {
    if (isOwnSite(wc.getURL())) wc.insertCSS(HIDE_PAGE_SCROLLBAR).catch(() => {})
  })
  wc.on('did-finish-load', () => {
    if (isOwnSite(wc.getURL())) learnGames(wc)
  })

  loadSite(win)
  return win
}

function loadSite(win) {
  win.webContents.loadURL(SITE.href)
}

// the server's game list (signed in only), so links to any game open in the panel
async function learnGames(wc) {
  try {
    const data = await wc.executeJavaScript(
      "fetch('/api/submissions/games').then((r) => (r.ok ? r.json() : null)).catch(() => null)")
    for (const g of data?.games ?? []) hosts.learn(g.url, g.name)
  } catch {}
}

function run(wc, js) {
  if (!isOwnSite(wc.getURL())) return Promise.resolve(null)
  return wc.executeJavaScript(js).catch(() => null)
}

// Shows one of the site's tabs ("Today", "Feed", "Friends", "You") by clicking its tab button.
function showTab(wc, label) {
  return run(wc, `(async (label) => {
    for (let i = 0; i < 40; i++) {
      // the label is the first text: Feed may carry a kudos count after it
      const t = [...document.querySelectorAll('.tabs .tab')].find((b) => b.firstChild?.textContent.trim() === label)
      if (t) { t.click(); return }
      await new Promise((r) => setTimeout(r, 100))
    }
  })(${JSON.stringify(label)})`)
}

// Fires one of the site's app events once the Today tab is on screen (it may be mid-switch).
function dispatch(wc, name, detail) {
  return run(wc, `(async (name, detail) => {
    for (let i = 0; i < 20 && !document.querySelector('.daterow'); i++) {
      await new Promise((r) => setTimeout(r, 50))
    }
    window.dispatchEvent(new CustomEvent(name, { detail }))
  })(${JSON.stringify(name)}, ${JSON.stringify(detail)})`)
}

// Go menu: a day back or forward on Today, or 0 for today (`dailies:day` in web/src/Today.jsx)
function showDay(wc, days) {
  showTab(wc, 'Today')
  dispatch(wc, 'dailies:day', days)
}

// Edit › Paste Result: the site's Paste button (`dailies:paste` in web/src/PasteDock.jsx)
function pasteInPage(wc) {
  showTab(wc, 'Today')
  dispatch(wc, 'dailies:paste', 0)
}

// File › Add Score…: the site's paste box (`dailies:pastebox` in web/src/PasteDock.jsx)
function openPasteBox(wc) {
  showTab(wc, 'Today')
  dispatch(wc, 'dailies:pastebox', 0)
}

// the board reloads after the game panel saves a score (`dailies:refresh` in web/src/Today.jsx)
function reloadBoard(wc) {
  run(wc, "window.dispatchEvent(new Event('dailies:refresh'))")
}

const UNREACHABLE = 'Couldn’t reach The Dailies. Check your connection.'

// Saves a result for the game panel. The app posts it itself with the site's sign-in cookie (the
// same session the window uses), so it doesn't depend on the page being loaded or ready; the
// server's error messages are written to be shown as they are. Then the board reloads.
async function submit(wc, text) {
  let res
  try {
    res = await session.defaultSession.fetch(new URL('/api/submissions', SITE).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      credentials: 'include', // the site's db_token cookie
      cache: 'no-store',
    })
  } catch (err) {
    log('save failed: no response:', err)
    return { ok: false, msg: UNREACHABLE }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    log(`save failed: ${res.status}`, data.error || '(no message)')
    if (res.status === 401) return { ok: false, msg: 'You’re signed out. Sign in to The Dailies, then paste again.' }
    return { ok: false, msg: data.error || 'Something went wrong. Try again.' }
  }
  const s = data.submission ?? {}
  reloadBoard(wc)
  return { ok: true, msg: `${s.emoji ?? ''} ${s.gameName ?? 'Score'} ${s.display ?? ''} saved ✓`.replace(/\s+/g, ' ').trim() }
}

module.exports = {
  ICON, createMainWindow, loadSite, openExternally,
  showTab, showDay, pasteInPage, openPasteBox, submit,
}
