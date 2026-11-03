// Which sites are games (they open in the game panel; anything else goes to the default browser).
// Like the Mac's GameHosts: learned from the server's game list and from Play taps on the board.
const bases = new Map() // site base ("nytimes.com") -> a display name

// "www.nytimes.com" -> "nytimes.com"; a game's links and sign-in pages stay on its own site
function baseOf(hostname) {
  const parts = hostname.toLowerCase().split('.')
  // two-letter country domains like co.uk keep three labels
  const keep = parts.length > 2 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length === 2 ? 3 : 2
  return parts.slice(-keep).join('.')
}

function hostOf(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null
  } catch {
    return null
  }
}

function learn(url, name) {
  const host = hostOf(url)
  if (!host) return
  const base = baseOf(host)
  if (!bases.has(base) || name) bases.set(base, name || host.replace(/^www\./, ''))
}

function isGame(url) {
  const host = hostOf(url)
  return Boolean(host && bases.has(baseOf(host)))
}

function nameFor(url) {
  const host = hostOf(url)
  return (host && bases.get(baseOf(host))) || host || 'Game'
}

module.exports = { learn, isGame, nameFor }
