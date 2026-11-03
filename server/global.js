import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { CATEGORIES } from './parsers.js'
import { buildBoards } from './scoring.js'
import { todayISO, isValidISODate } from './util.js'

// The global leaderboard: one day's crowns (overall, then each category) across everyone who
// joined (global_members), not just your friends. Anyone signed in can look; only members appear.
// Only pasted (verified) scores count, since a typed-in score can't be checked. A member can be
// anonymous: their username never leaves the server, and they show under their fun name instead
// ("Zesty Zebra"), picked when they join and different from every other member's.
export const globalRouter = Router()
globalRouter.use(requireAuth)

const TOP = 25

// Fun names: an adjective and an animal, about 3,000 of them.
const ADJECTIVES = [
  'Bouncy', 'Brave', 'Breezy', 'Bubbly', 'Cheeky', 'Chill', 'Clever', 'Cosmic', 'Cozy', 'Crafty',
  'Dapper', 'Daring', 'Dizzy', 'Dreamy', 'Eager', 'Fancy', 'Fearless', 'Feisty', 'Fizzy', 'Fluffy',
  'Frosty', 'Funky', 'Fuzzy', 'Gentle', 'Giddy', 'Glowing', 'Groovy', 'Happy', 'Hasty', 'Jazzy',
  'Jolly', 'Jumpy', 'Lucky', 'Mellow', 'Merry', 'Mighty', 'Nifty', 'Nimble', 'Peppy', 'Perky',
  'Plucky', 'Quick', 'Quirky', 'Radiant', 'Rowdy', 'Sassy', 'Snappy', 'Sneaky', 'Snazzy', 'Sparkly',
  'Speedy', 'Spicy', 'Sunny', 'Swift', 'Tiny', 'Wild', 'Witty', 'Wobbly', 'Zany', 'Zesty',
]
const ANIMALS = [
  'Alpaca', 'Badger', 'Beaver', 'Bison', 'Bobcat', 'Camel', 'Cheetah', 'Chipmunk', 'Cobra', 'Coyote',
  'Dingo', 'Dolphin', 'Eagle', 'Falcon', 'Ferret', 'Flamingo', 'Fox', 'Gazelle', 'Gecko', 'Giraffe',
  'Goose', 'Hedgehog', 'Heron', 'Hippo', 'Ibis', 'Iguana', 'Jaguar', 'Kangaroo', 'Koala', 'Lemur',
  'Llama', 'Lobster', 'Lynx', 'Manatee', 'Meerkat', 'Moose', 'Narwhal', 'Ocelot', 'Otter', 'Owl',
  'Panda', 'Parrot', 'Pelican', 'Penguin', 'Puffin', 'Quokka', 'Raccoon', 'Sloth', 'Tiger', 'Toucan',
  'Walrus', 'Wombat', 'Yak', 'Zebra',
]
const pick = (list) => list[Math.floor(Math.random() * list.length)]

// A fun name no other member has.
async function freshAlias() {
  const { rows } = await q('SELECT alias FROM global_members WHERE alias IS NOT NULL')
  const taken = new Set(rows.map((r) => r.alias))
  for (let i = 0; i < 100; i++) {
    const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
    if (!taken.has(name)) return name
  }
  // thousands of members in: add a number
  for (let n = 2; ; n++) {
    const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${n}`
    if (!taken.has(name)) return name
  }
}

// The top 25 of a crown, plus my own row when I'm further down. No user ids go out, so an
// anonymous row can't be matched to anyone.
function standings(list, meId, aliases) {
  const row = (c) => ({
    rank: c.rank,
    name: aliases.get(c.userId) ?? c.username,
    anonymous: aliases.has(c.userId),
    points: c.points,
    games: c.games,
    me: c.userId === meId,
  })
  const at = list.findIndex((c) => c.userId === meId)
  return {
    top: list.slice(0, TOP).map(row),
    mine: at >= TOP ? row(list[at]) : null,
    total: list.length,
  }
}

globalRouter.get('/', async (req, res) => {
  const date = isValidISODate(String(req.query.date || '')) ? req.query.date : todayISO()
  const [{ rows }, { rows: members }] = await Promise.all([
    q(
      `SELECT s.*, u.username FROM submissions s
         JOIN users u ON u.id = s.user_id
         JOIN global_members g ON g.user_id = s.user_id
        WHERE s.puzzle_date = $1 AND s.verified`,
      [date]
    ),
    q('SELECT user_id, anonymous, alias FROM global_members'),
  ])
  // anyone who joined before fun names existed gets one now
  for (const m of members.filter((m) => !m.alias)) {
    m.alias = await freshAlias()
    await q('UPDATE global_members SET alias = $1 WHERE user_id = $2', [m.alias, m.user_id])
  }
  // anonymous members: user id -> their fun name
  const aliases = new Map(members.filter((m) => m.anonymous).map((m) => [m.user_id, m.alias]))
  const mine = members.find((m) => m.user_id === req.user.id)
  const { crown, categoryCrowns } = buildBoards(rows)
  res.json({
    date,
    today: todayISO(),
    members: members.length,
    me: mine ? { joined: true, anonymous: mine.anonymous, alias: mine.alias } : { joined: false, anonymous: false },
    overall: standings(crown, req.user.id, aliases),
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      symbol: c.symbol,
      ...standings(categoryCrowns[c.id] ?? [], req.user.id, aliases),
    })),
  })
})

// Join, or change how I show up (my fun name or my username). The fun name is picked once and
// kept while I'm a member, so switching back and forth doesn't change it.
globalRouter.post('/join', async (req, res) => {
  const anonymous = Boolean(req.body.anonymous)
  const { rows } = await q('SELECT alias FROM global_members WHERE user_id = $1', [req.user.id])
  const alias = rows[0]?.alias ?? (await freshAlias())
  await q(
    `INSERT INTO global_members (user_id, anonymous, alias) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET anonymous = EXCLUDED.anonymous, alias = EXCLUDED.alias`,
    [req.user.id, anonymous, alias]
  )
  res.json({ ok: true, joined: true, anonymous, alias })
})

globalRouter.post('/leave', async (req, res) => {
  await q('DELETE FROM global_members WHERE user_id = $1', [req.user.id])
  res.json({ ok: true, joined: false })
})
