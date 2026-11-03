# The Dailies for Windows

An Electron app that matches the Mac app: the website in its own window, every game playable in
a panel over it, and the Mac's menu commands on Ctrl. It is self-contained in this folder (its
own `package.json` and `node_modules`); the website, server, Mac and iPhone apps don't depend on
it, and the site needs no Windows code: `src/preload-site.js` offers the same
`webkit.messageHandlers` bridge the Mac app does (`web/src/native.js`).

```bash
cd windows && npm install
npm start                 # against www.thedailies.lol
npm run start:local       # against `npm run dev` (Vite on :5173); or --server=<url>
npm run dist              # dist/TheDailies-Setup-<version>.exe: one installer for x64 and ARM64
```

`npm run dist` works on a Mac (no Wine needed). The installer is unsigned, so Windows SmartScreen
asks "Windows protected your PC" → More info → Run anyway. It installs per user (no admin) and
adds a Start menu and desktop shortcut.

| File | What it does |
| --- | --- |
| `src/main.js` | Startup, one copy at a time, the site bridge, permissions, menu actions |
| `src/site.js` | The main window (the site), link routing, offline card, the menu commands it runs in the page, saving a score from the panel |
| `src/gamePanel.js` | Play: the game panel over the window, and Window ↗ (its own window) |
| `src/pages/panel.*` | The panel's frame, drawn like `web/src/GamePanel.jsx`; the game's view sits over `#hole` |
| `src/pages/offline.*` | "Can't reach The Dailies", retrying by itself |
| `src/pages/site.css` | The site's tokens and styles for these pages; keep in step with `web/src/styles.css` |
| `src/hosts.js` | Which sites are games (from the server's list and Play taps); others open in the browser |
| `src/updates.js` | Auto-updates: checks `/windows-update/latest.yml` at launch and every 6 hours, downloads in the background, installs on close; Help › Check for Updates… |
| `src/log.js` | `%APPDATA%\The Dailies\dailies.log` (Help › Open Log File): failed saves and updates |
| `src/menu.js` | File › Add Score… Ctrl+N, Edit › Paste Result Ctrl+Shift+V, Go › tabs Ctrl+1–4 and days Ctrl+[ ] T |

Scores from the game panel are posted by the app itself (`site.submit`, `session.fetch` with the
site's sign-in cookie), not from inside the page; there are no device tokens on Windows. Game pages are never scripted: the
player taps the game's Share or Copy, then Paste result reads the clipboard.

## Releasing

Bump `version` in `package.json`, then `tools/release.sh "What's new"`: it builds the installer,
uploads it to a GitHub release `windows-<version>` and writes `server/windows-release.json`.
Commit that file and deploy: installed copies update themselves from `/windows-update/latest.yml`
(served from that file; the installer and its `.blockmap` are on GitHub), and the website offers the download to Windows browsers (a popup
once, and a card on the You tab, `web/src/DesktopApp.jsx`) at `/download/windows`.

To try updates locally: `npm start -- --server=local --update-feed=<feed>` (with
`dev-app-update.yml`). On a Mac the updater asks for `latest-mac.yml`, so serve the feed under
that name; checking and downloading work there, installing needs Windows. 1.0.0 had no updater,
so a 1.0.0 install has to be replaced by hand once.

Not yet: notifications, code signing.
