import { Router } from 'express'
import { readFileSync } from 'node:fs'

// The Mac app downloaded from the website (not the App Store copy) can't update through the App
// Store, so it asks /api/app/mac for the newest build and offers the download. The website's
// "Get the Mac app" links go through /download/mac, which always points at the newest .dmg.
// apple/tools/release-mac.sh writes mac-release.json for each release; until it exists, there's
// no Mac download and the site doesn't offer one.
const file = new URL('./mac-release.json', import.meta.url)

function macRelease() {
  try {
    const r = JSON.parse(readFileSync(file, 'utf8'))
    return r.url && Number.isInteger(r.build) ? r : null
  } catch {
    return null
  }
}

export const releaseRouter = Router()

releaseRouter.get('/mac', (req, res) => {
  const r = macRelease()
  if (!r) return res.status(404).json({ error: 'There’s no Mac app to download yet' })
  res.set('Cache-Control', 'no-cache').json(r)
})

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Sparkle's update feed for copies from the website (DailiesDirect, build 5 on): they check it
// every few hours and install a newer build when they quit. The release script signs each .dmg
// with the private key in the release Mac's keychain (edSignature); a release without a
// signature isn't offered here, only through /api/app/mac.
export function appcast(req, res) {
  const r = macRelease()
  const item = r?.edSignature
    ? `
    <item>
      <title>The Dailies ${xml(r.version)} (${r.build})</title>
      <pubDate>${new Date(r.published || Date.now()).toUTCString()}</pubDate>
      <sparkle:version>${r.build}</sparkle:version>
      <sparkle:shortVersionString>${xml(r.version)}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>${xml(r.minimumSystem || '14.0')}</sparkle:minimumSystemVersion>
      <description><![CDATA[<p>${xml(r.notes || '')}</p>]]></description>
      <enclosure url="${xml(r.url)}" length="${Number(r.length) || 0}" type="application/octet-stream" sparkle:edSignature="${xml(r.edSignature)}" />
    </item>`
    : ''
  res.type('application/rss+xml').set('Cache-Control', 'no-cache').send(`<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>The Dailies</title>
    <link>https://www.thedailies.lol</link>${item}
  </channel>
</rss>
`)
}

export function macDownload(req, res) {
  const r = macRelease()
  if (!r) return res.status(404).send('There’s no Mac app to download yet.')
  res.redirect(302, r.url)
}
