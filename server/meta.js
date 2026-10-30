import { q } from './db.js'

// Link previews (iMessage, WhatsApp, Slack, X…) read <meta> tags from the page's HTML and don't
// run its JavaScript, so the server writes them into index.html for every page. An invite link
// (/?add=username) gets its own title, so a shared invite says who it's from.
const DESCRIPTION = 'One leaderboard for Wordle, Connections, Queens and every other daily you play. Paste your results and beat your friends.'

const escape = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

async function inviter(raw) {
  const name = String(raw || '').toLowerCase()
  if (!/^[a-z0-9_]{2,20}$/.test(name)) return null // the same rule as signing up
  const { rows } = await q('SELECT username FROM users WHERE username = $1', [name])
  return rows[0]?.username ?? null
}

/** The tags for a page at `origin` (`add` is the invite's username, if any). */
export async function metaFor(origin, add) {
  const name = await inviter(add).catch(() => null)
  const title = name ? `Add @${name} on The Dailies` : 'The Dailies: beat your friends at every daily game'
  const description = name
    ? `@${name} wants to be friends on The Dailies. Tap to add them and compare scores on Wordle, Connections, Queens and more.`
    : DESCRIPTION
  const url = name ? `${origin}/?add=${name}` : `${origin}/`
  const tags = [
    `<meta name="description" content="${escape(description)}" />`,
    '<meta property="og:site_name" content="The Dailies" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta property="og:image" content="${escape(`${origin}/og.png`)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escape(name ? `Add @${name} on The Dailies` : 'The Dailies')}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ')
  return { title: escape(title), tags }
}

export function withMeta(html, { title, tags }) {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace('<!-- server meta -->', tags)
}

// links in previews always name the www address: the bare thedailies.lol forwards to it and drops the path
const SITE = 'https://www.thedailies.lol'

export async function pageWithMeta(html, req) {
  const origin = process.env.NODE_ENV === 'production' ? SITE : `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`
  return withMeta(html, await metaFor(origin, req.query.add))
}
