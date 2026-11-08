// Links that open the iPhone app instead of the website.
//
// apple-app-site-association: Apple's devices fetch this from www.thedailies.lol and, for an app
// that lists the domain under Associated Domains, open matching links in the app. Here that's
// invite links (/?add=username). Its app id is "<team id>.lol.thedailies.app"; the team id comes
// from APPLE_TEAM_ID (never committed), and without it there's no file (links stay on the site).
//
// The Smart App Banner (meta.js) offers "Open" or "Get" at the top of the site in Safari on iPhone,
// for people without the app or before a build with Associated Domains.
export const APP_STORE_ID = process.env.APP_STORE_ID || '6827838654'
const BUNDLE_ID = process.env.APNS_TOPIC || 'lol.thedailies.app'

export function appSiteAssociation(req, res) {
  const team = process.env.APPLE_TEAM_ID
  if (!team) return res.status(404).json({ error: 'Not set up' })
  const appID = `${team}.${BUNDLE_ID}`
  // served as JSON with no redirect; Apple's CDN caches it for a while
  res.set('Cache-Control', 'public, max-age=3600')
  res.json({
    applinks: {
      details: [
        {
          appIDs: [appID],
          components: [{ '/': '/', '?': { add: '?*' }, comment: 'invite links: /?add=username' }],
        },
      ],
    },
    // lets iOS offer the passwords saved for the website when signing in to the app
    webcredentials: { apps: [appID] },
  })
}
