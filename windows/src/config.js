// Which server the app shows, and the user agents it presents.
const { app } = require('electron')

const PRODUCTION = 'https://www.thedailies.lol'

// Development runs can point at another server: `--server=local` (Vite on :5173, which proxies
// /api to :3001) or `--server=<url>`. A packaged app always shows the real site.
function serverURL() {
  if (app.isPackaged) return PRODUCTION
  const arg = process.argv.find((a) => a.startsWith('--server='))?.slice('--server='.length) || process.env.DAILIES_SERVER
  if (arg === 'local') return 'http://localhost:5173'
  if (arg && /^https?:\/\//.test(arg)) return arg.replace(/\/+$/, '')
  return PRODUCTION
}

const SITE = new URL(serverURL())
// thedailies.lol and www.thedailies.lol are the same site
const SITE_ORIGINS = new Set([SITE.origin])
if (SITE.hostname === 'www.thedailies.lol') SITE_ORIGINS.add('https://thedailies.lol')

function isOwnSite(url) {
  try {
    return SITE_ORIGINS.has(new URL(url).origin)
  } catch {
    return false
  }
}

// Chrome's own user agent, without the "Electron/…" and app-name tokens some sites turn away.
function cleanUserAgent(ua) {
  return ua.replace(/\(KHTML, like Gecko\) .*?Chrome\//, '(KHTML, like Gecko) Chrome/').replace(/ Electron\/\S+/, '')
}

// The site itself also sees TheDailiesApp/, which turns on its app bridge (web/src/native.js),
// the same token the Mac and iPhone apps append.
function siteUserAgent() {
  return `${app.userAgentFallback} TheDailiesApp/${app.getVersion()} (Windows)`
}

module.exports = { SITE, isOwnSite, cleanUserAgent, siteUserAgent }
