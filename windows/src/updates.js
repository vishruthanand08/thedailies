// Keeps the app up to date, like the Mac app's Sparkle: it checks at launch and every 6 hours,
// downloads a newer version in the background, and installs it when the app closes. Help ›
// Check for Updates… asks right away.
//
// The feed is the website's /windows-update/latest.yml (server/release.js), built from
// server/windows-release.json, which windows/tools/release.sh writes for each release; the
// installer itself is on GitHub Releases. electron-updater checks the download's SHA-512. The
// "publish" setting in package.json writes the same feed into the installed app as
// resources/app-update.yml, which the updater also needs.
const { app, dialog, BrowserWindow } = require('electron')
const { NsisUpdater } = require('electron-updater')
const { SITE } = require('./config')

const EVERY = 6 * 60 * 60 * 1000

let updater = null
let downloaded = null // the version waiting to install

// Development runs can try a feed: `--update-feed=http://localhost:3001/windows-update`, with
// dev-app-update.yml standing in for app-update.yml (the check and download work on a Mac too,
// where the updater asks for latest-mac.yml; only installing needs Windows).
function feedURL() {
  const arg = process.argv.find((a) => a.startsWith('--update-feed='))?.slice('--update-feed='.length)
  if (!app.isPackaged) return arg || null
  return new URL('/windows-update', SITE).href
}

function startUpdates() {
  const url = feedURL()
  if (!url) return
  updater = new NsisUpdater({ provider: 'generic', url })
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.disableWebInstaller = true // one full installer, not a web installer
  updater.forceDevUpdateConfig = !app.isPackaged // lets a development run check the test feed
  updater.logger = console
  updater.on('update-downloaded', (info) => {
    downloaded = info.version
  })
  updater.on('error', (err) => console.error('update failed:', err?.message || err))

  // a failed download is logged by the 'error' handler above
  const check = () => updater.checkForUpdates().then((r) => r?.downloadPromise?.catch(() => {})).catch(() => {})
  setTimeout(check, 10 * 1000) // once the window has settled
  setInterval(check, EVERY)
}

function ask(options) {
  const win = BrowserWindow.getFocusedWindow()
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

// Help › Check for Updates…
async function checkNow() {
  if (!updater) {
    return ask({ type: 'info', message: 'Updates are off', detail: 'This copy of The Dailies doesn’t check for updates.' })
  }
  if (downloaded) return offerRestart(downloaded)
  let result
  try {
    result = await updater.checkForUpdates()
  } catch (err) {
    return ask({
      type: 'warning',
      message: 'Couldn’t check for updates',
      detail: 'Check your internet connection and try again.',
    })
  }
  const newer = result?.isUpdateAvailable ? result.updateInfo.version : null
  if (!newer) {
    return ask({ type: 'info', message: 'You’re up to date', detail: `The Dailies ${app.getVersion()} is the newest version.` })
  }
  try {
    await result.downloadPromise
  } catch {
    return ask({ type: 'warning', message: 'Couldn’t download the update', detail: 'Try again in a little while.' })
  }
  return offerRestart(newer)
}

async function offerRestart(version) {
  const { response } = await ask({
    type: 'info',
    message: `The Dailies ${version} is ready`,
    detail: 'It installs when you close The Dailies, or restart now to get it straight away.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) updater.quitAndInstall(true, true) // silent install, then reopen
}

module.exports = { startUpdates, checkNow }
