import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { circleIds } from './friends.js'
import { gameById } from './parsers.js'
import { pointsFor } from './points.js'
import { todayISO, isValidISODate } from './util.js'
import { notifyKudos } from './push.js'

// The feed is one card per player per day (like a Strava activity): their points total, every
// game they played, and their highlight, which is the game they picked or else their top-points
// game. Friends give a day kudos. Today's friends' highlights also come back on their own, for
// the row at the top of the feed.
export const feedRouter = Router()
feedRouter.use(requireAuth)

const DAYS_PER_PAGE = 4
const iso = (d) => (typeof d === 'string' ? d : new Date(d).toISOString().slice(0, 10))
const dayBefore = (d) => new Date(Date.parse(d + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
const better = (game, a, b) => (game.better === 'higher' ? a > b : a < b)

feedRouter.get('/', async (req, res) => {
  const me = req.user.id
  const ids = await circleIds(me)
  const today = todayISO()
  const before = isValidISODate(String(req.query.before || '')) ? req.query.before : null

  const { rows: dateRows } = await q(
    `SELECT DISTINCT puzzle_date FROM submissions
      WHERE user_id = ANY($1) AND ($2::date IS NULL OR puzzle_date < $2::date)
      ORDER BY puzzle_date DESC LIMIT $3`,
    [ids, before, DAYS_PER_PAGE]
  )
  const dates = dateRows.map((r) => iso(r.puzzle_date))
  if (!before && !dates.includes(today)) dates.unshift(today) // the highlights row always looks at today

  // every score in the circle, small enough to read whole: personal bests and streaks need history
  const { rows: all } = await q(
    `SELECT s.id, s.user_id, s.game_id, s.puzzle_date, s.metric, s.points, s.display, s.raw_text,
            s.verified, s.created_at, u.username
       FROM submissions s JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ANY($1) AND s.puzzle_date <= $2::date`,
    [ids, dates[0] ?? today]
  )
  const [{ rows: picks }, { rows: kudos }] = await Promise.all([
    q('SELECT user_id, puzzle_date, submission_id FROM day_highlights WHERE user_id = ANY($1) AND puzzle_date = ANY($2::date[])', [ids, dates]),
    q(
      `SELECT k.owner_id, k.puzzle_date, k.giver_id, u.username
         FROM day_kudos k JOIN users u ON u.id = k.giver_id
        WHERE k.owner_id = ANY($1) AND k.puzzle_date = ANY($2::date[])
        ORDER BY k.created_at`,
      [ids, dates]
    ),
  ])

  const daysByUser = new Map() // user -> Set of dates played
  const history = new Map() // user|game -> [{ date, metric }]
  for (const s of all) {
    s.date = iso(s.puzzle_date)
    if (!daysByUser.has(s.user_id)) daysByUser.set(s.user_id, new Set())
    daysByUser.get(s.user_id).add(s.date)
    const key = `${s.user_id}|${s.game_id}`
    if (!history.has(key)) history.set(key, [])
    history.get(key).push(s)
  }
  // a personal best beats every earlier score of theirs on that game (a first play isn't one)
  const isPB = (s, game) => {
    const earlier = history.get(`${s.user_id}|${s.game_id}`).filter((h) => h.date < s.date)
    return earlier.length > 0 && earlier.every((h) => better(game, s.metric, h.metric))
  }
  // days in a row played, up to and including this one
  const streakOn = (userId, date) => {
    const days = daysByUser.get(userId)
    let n = 0
    for (let d = date; days.has(d); d = dayBefore(d)) n += 1
    return n
  }

  const pickFor = new Map(picks.map((p) => [`${p.user_id}|${iso(p.puzzle_date)}`, p.submission_id]))
  const kudosFor = new Map()
  for (const k of kudos) {
    const key = `${k.owner_id}|${iso(k.puzzle_date)}`
    if (!kudosFor.has(key)) kudosFor.set(key, [])
    kudosFor.get(key).push({ userId: k.giver_id, username: k.username })
  }

  const cards = new Map() // user|date -> card
  for (const s of all) {
    if (!dates.includes(s.date)) continue
    const game = gameById[s.game_id]
    if (!game) continue
    const key = `${s.user_id}|${s.date}`
    if (!cards.has(key)) {
      const givers = kudosFor.get(key) ?? []
      cards.set(key, {
        userId: s.user_id, username: s.username, date: s.date, points: 0, games: [], lastActivity: s.created_at,
        streak: streakOn(s.user_id, s.date), picked: pickFor.has(key),
        kudos: { count: givers.length, givers, mine: givers.some((g) => g.userId === me) },
      })
    }
    const card = cards.get(key)
    const points = Math.round(s.points ?? pointsFor(s.game_id, s.metric))
    card.points += points
    if (new Date(s.created_at) > new Date(card.lastActivity)) card.lastActivity = s.created_at
    card.games.push({
      submissionId: s.id, gameId: s.game_id, gameName: game.name, emoji: game.emoji, color: game.color,
      display: s.display, points, verified: s.verified, pb: isPB(s, game), createdAt: s.created_at,
      rawText: s.raw_text.startsWith('(manual entry)') ? null : s.raw_text,
    })
  }

  for (const card of cards.values()) {
    // top points first; on a tie, whichever was posted first
    card.games.sort((a, b) => b.points - a.points || new Date(a.createdAt) - new Date(b.createdAt))
    const picked = pickFor.get(`${card.userId}|${card.date}`)
    card.highlightId = card.games.some((g) => g.submissionId === picked) ? picked : card.games[0].submissionId
    const i = card.games.findIndex((g) => g.submissionId === card.highlightId)
    card.games.unshift(...card.games.splice(i, 1)) // the highlight leads the card
  }

  const list = [...cards.values()].sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : new Date(b.lastActivity) - new Date(a.lastActivity))
  )
  // friends with nothing posted today, named under Today
  const playedToday = new Set(list.filter((c) => c.date === today).map((c) => c.userId))
  const { rows: circle } = before
    ? { rows: [] }
    : await q('SELECT id, username FROM users WHERE id = ANY($1) ORDER BY lower(username)', [ids])
  const waiting = circle.filter((u) => u.id !== me && !playedToday.has(u.id)).map((u) => u.username)

  const highlights = before
    ? []
    : list
        .filter((c) => c.date === today && c.userId !== me)
        .map((c) => ({ userId: c.userId, username: c.username, date: c.date, ...c.games[0] }))

  // kudos on my days I haven't seen yet, newest day first
  const { rows: unseen } = await q(
    `SELECT k.puzzle_date, u.username FROM day_kudos k JOIN users u ON u.id = k.giver_id
      WHERE k.owner_id = $1 AND NOT k.seen ORDER BY k.puzzle_date DESC, k.created_at`,
    [me]
  )
  const notices = []
  for (const r of unseen) {
    const date = iso(r.puzzle_date)
    let n = notices.find((x) => x.date === date)
    if (!n) notices.push((n = { date, usernames: [] }))
    n.usernames.push(r.username)
  }

  const oldest = dates[dates.length - 1]
  res.json({
    today,
    cards: list,
    highlights,
    waiting,
    notices,
    nextBefore: dateRows.length === DAYS_PER_PAGE ? oldest : null,
  })
})

// Count for the badge on the Feed tab.
feedRouter.get('/unseen', async (req, res) => {
  const { rows } = await q('SELECT count(*)::int AS n FROM day_kudos WHERE owner_id = $1 AND NOT seen', [req.user.id])
  res.json({ count: rows[0].n })
})

feedRouter.post('/seen', async (req, res) => {
  await q('UPDATE day_kudos SET seen = TRUE WHERE owner_id = $1 AND NOT seen', [req.user.id])
  res.json({ ok: true })
})

async function kudosTarget(req, res) {
  const owner = Number(req.body?.userId)
  const date = String(req.body?.date || '')
  if (!Number.isInteger(owner) || !isValidISODate(date)) {
    res.status(400).json({ error: 'Pick a day to give kudos to' })
    return null
  }
  if (owner === req.user.id) {
    res.status(400).json({ error: "You can't give yourself kudos" })
    return null
  }
  if (!(await circleIds(req.user.id)).includes(owner)) {
    res.status(403).json({ error: 'You can only give kudos to friends' })
    return null
  }
  return { owner, date }
}

feedRouter.post('/kudos', async (req, res) => {
  const t = await kudosTarget(req, res)
  if (!t) return
  const { rows } = await q('SELECT 1 FROM submissions WHERE user_id = $1 AND puzzle_date = $2 LIMIT 1', [t.owner, t.date])
  if (!rows.length) return res.status(404).json({ error: "They didn't play that day" })
  await q(
    'INSERT INTO day_kudos (owner_id, puzzle_date, giver_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [t.owner, t.date, req.user.id]
  )
  res.json({ ok: true })
  notifyKudos(t.owner, t.date).catch((err) => console.warn('push:', err.message))
})

feedRouter.delete('/kudos', async (req, res) => {
  const t = await kudosTarget(req, res)
  if (!t) return
  await q('DELETE FROM day_kudos WHERE owner_id = $1 AND puzzle_date = $2 AND giver_id = $3', [t.owner, t.date, req.user.id])
  res.json({ ok: true })
})

// Pick one of today's scores as my highlight, in place of my top-points game.
feedRouter.put('/highlight', async (req, res) => {
  const id = Number(req.body?.submissionId)
  const { rows } = await q('SELECT puzzle_date FROM submissions WHERE id = $1 AND user_id = $2', [id, req.user.id])
  if (!rows.length) return res.status(404).json({ error: 'That score is gone' })
  const date = iso(rows[0].puzzle_date)
  if (date !== todayISO()) return res.status(400).json({ error: 'You can only change today’s highlight' })
  await q(
    `INSERT INTO day_highlights (user_id, puzzle_date, submission_id) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, puzzle_date) DO UPDATE SET submission_id = EXCLUDED.submission_id`,
    [req.user.id, date, id]
  )
  res.json({ ok: true })
})

// Back to the automatic highlight (top points).
feedRouter.delete('/highlight', async (req, res) => {
  await q('DELETE FROM day_highlights WHERE user_id = $1 AND puzzle_date = $2', [req.user.id, todayISO()])
  res.json({ ok: true })
})
