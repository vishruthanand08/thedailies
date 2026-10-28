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

export function macDownload(req, res) {
  const r = macRelease()
  if (!r) return res.status(404).send('There’s no Mac app to download yet.')
  res.redirect(302, r.url)
}
