import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { circleIds } from './friends.js'
import { GAMES, CATEGORIES, gameById, detect, expectedDate } from './parsers.js'
import { buildBoards } from './scoring.js'
import { allRules, pointsFor } from './points.js'
import { todayISO, daysApart, isValidISODate, secondsToClock } from './util.js'

export const submissionsRouter = Router()
submissionsRouter.use(requireAuth)

submissionsRouter.get('/games', (req, res) => {
  res.json({
    games: GAMES.map(({ id, category, name, emoji, color, url, metricLabel, better, manual, note, embed, paid }) => ({
      id, category, name, emoji, color, url, metricLabel, better, manual, note, embed: !!embed, paid: paid ?? null,
    })),
    categories: CATEGORIES,
  })
})

// A scoring value in words: "4 guesses", "1:30", "Failed", "12,500 pts".
function describe(game, v) {
  const fail = game.scoring.failAt
  if (fail != null && (game.better === 'lower' ? v >= fail : v <= fail)) return 'Failed'
  if (game.metricLabel === 'time') return secondsToClock(Math.round(v))
  if (game.id === 'fermi') return `${+v.toFixed(2)}× off`
  const n = Number.isInteger(v) ? v : +v.toFixed(1)
  if (/points|score/.test(game.metricLabel)) return `${n.toLocaleString('en-US')} pts`
  const unit = n === 1 ? game.metricLabel.replace(/(ss)es$/, '$1').replace(/([^s])s$/, '$1') : game.metricLabel
  return `${n.toLocaleString('en-US')} ${unit}`
}

// How points are worked out, for the ⓘ on the boards: every game's perfect, par and zero.
submissionsRouter.get('/scoring', (req, res) => {
  const rules = allRules()
  res.json({
    games: GAMES.map((g) => ({
      id: g.id, name: g.name, emoji: g.emoji, category: g.category,
      perfect: describe(g, rules[g.id].perfect), par: describe(g, rules[g.id].par), zero: describe(g, rules[g.id].zero),
    })),
    categories: CATEGORIES,
  })
})

submissionsRouter.post('/', async (req, res) => {
  const today = todayISO()
  let gameId, metric, display, rawText, puzzleNumber = null, verified = true, puzzleDate = today

  if (req.body.text) {
    const text = String(req.body.text).trim().slice(0, 4000)
    const hit = detect(text)
    if (!hit) {
      return res.status(400).json({
        error: "Couldn't recognize that as a result from any supported game. Copy the share text straight from the game's share button.",
      })
    }
    const { game, parsed } = hit
    const derived = expectedDate(game, parsed)
    if (derived && game.dateTolerance != null) {
      if (daysApart(derived, today) > game.dateTolerance) {
        return res.status(400).json({
          error: `That looks like ${/^the /i.test(game.name) ? '' : 'the '}${game.name} from ${derived}, not today's. Only today's puzzle counts.`,
        })
      }
      puzzleDate = derived <= today ? derived : today
    }
    gameId = game.id
    metric = parsed.metric
    display = parsed.display
    puzzleNumber = parsed.puzzleNumber ?? null
    rawText = text
  } else if (req.body.gameId) {
    const game = gameById[req.body.gameId]
    if (!game) return res.status(400).json({ error: 'Unknown game' })
    if (!game.manual) {
      return res.status(400).json({ error: `${game.name} needs the pasted share text` })
    }
    const value = Number(req.body.value)
    if (!Number.isFinite(value) || value < 0 || value > 10000000) {
      return res.status(400).json({ error: 'Enter a valid number' })
    }
    gameId = game.id
    metric = value
    display = game.id === 'fermi' ? `${value}×` : `${value.toLocaleString()} pts`
    rawText = `(manual entry) ${game.name}: ${display}`
    verified = false
  } else {
    return res.status(400).json({ error: 'Nothing to submit' })
  }

  const dupe = await q(
    'SELECT id FROM submissions WHERE user_id = $1 AND game_id = $2 AND puzzle_date = $3',
    [req.user.id, gameId, puzzleDate]
  )
  if (dupe.rows.length) {
    return res.status(409).json({
      error: `You already have a ${gameById[gameId].name} score today. Delete it from the board first if you need to fix it.`,
    })
  }

  const { rows } = await q(
    `INSERT INTO submissions (user_id, game_id, puzzle_date, puzzle_number, metric, display, raw_text, verified, points)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [req.user.id, gameId, puzzleDate, puzzleNumber, metric, display, rawText, verified, pointsFor(gameId, metric)]
  )
  const game = gameById[gameId]
  res.json({
    ok: true,
    submission: { id: rows[0].id, gameId, gameName: game.name, emoji: game.emoji, display, puzzleDate, verified },
  })
})

submissionsRouter.delete('/:id', async (req, res) => {
  await q('DELETE FROM submissions WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id])
  res.json({ ok: true })
})

submissionsRouter.get('/board', async (req, res) => {
  const date = isValidISODate(String(req.query.date || '')) ? req.query.date : todayISO()
  const ids = await circleIds(req.user.id)
  const { rows } = await q(
    `SELECT s.*, u.username FROM submissions s
       JOIN users u ON u.id = s.user_id
      WHERE s.puzzle_date = $1 AND s.user_id = ANY($2)`,
    [date, ids]
  )
  const { boards, crown, categoryCrowns } = buildBoards(rows)
  res.json({ date, today: todayISO(), boards, crown, categoryCrowns, circleSize: ids.length })
})

submissionsRouter.get('/feed', async (req, res) => {
  const ids = await circleIds(req.user.id)
  const { rows } = await q(
    `SELECT s.id, s.user_id, s.game_id, s.puzzle_date, s.display, s.raw_text, s.verified, s.created_at, u.username
       FROM submissions s
       JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ANY($2)
      ORDER BY s.created_at DESC
      LIMIT $1`,
    [60, ids]
  )
  res.json({
    feed: rows.map((r) => {
      const game = gameById[r.game_id]
      return {
        id: r.id,
        userId: r.user_id,
        username: r.username,
        gameId: r.game_id,
        gameName: game?.name ?? r.game_id,
        emoji: game?.emoji ?? '🎮',
        color: game?.color ?? '#eee',
        display: r.display,
        rawText: r.raw_text,
        verified: r.verified,
        puzzleDate: typeof r.puzzle_date === 'string' ? r.puzzle_date : new Date(r.puzzle_date).toISOString().slice(0, 10),
        createdAt: r.created_at,
      }
    }),
  })
})

// An average or best metric; the unit (metricLabel) goes in the column header, except for times.
function formatMetric(game, v) {
  if (game.metricLabel === 'time') return secondsToClock(Math.round(v))
  if (game.id === 'fermi') return `${+v.toFixed(2)}×`
  const n = Number.isInteger(v) ? v : +v.toFixed(1)
  return n.toLocaleString('en-US')
}

const iso = (d) => (typeof d === 'string' ? d : new Date(d).toISOString().slice(0, 10))

// All-time (or last N days) standings for my circle. A day's crown or a game's win only
// counts when at least two people played, so playing alone never wins anything.
submissionsRouter.get('/stats', async (req, res) => {
  const days = ['7', '30'].includes(req.query.days) ? Number(req.query.days) : null
  const today = todayISO()
  const since = days ? new Date(Date.parse(today + 'T12:00:00Z') - (days - 1) * 86400000).toISOString().slice(0, 10) : null
  const ids = await circleIds(req.user.id)
  const { rows } = await q(
    `SELECT s.id, s.user_id, s.game_id, s.puzzle_date, s.metric, s.points, s.display, s.verified, u.username
       FROM submissions s
       JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ANY($1)`,
    [ids]
  )
  for (const r of rows) r.puzzle_date = iso(r.puzzle_date)

  // standings per scope: 'all' plus one per category, so each category has its own winners
  const scopes = new Map([['all', new Map()], ...CATEGORIES.map((c) => [c.id, new Map()])])
  const player = (scope, id, username) => {
    const m = scopes.get(scope)
    if (!m.has(id)) {
      m.set(id, { userId: id, username, points: 0, crowns: 0, wins: 0, played: 0, days: new Set(), allDays: new Set() })
    }
    return m.get(id)
  }
  const perGame = new Map() // game_id -> user_id -> { played, wins, sum, best }

  const byDate = new Map()
  for (const r of rows) {
    player('all', r.user_id, r.username).allDays.add(r.puzzle_date)
    const cat = gameById[r.game_id]?.category
    if (cat) player(cat, r.user_id, r.username).allDays.add(r.puzzle_date)
    if (since && r.puzzle_date < since) continue
    if (!byDate.has(r.puzzle_date)) byDate.set(r.puzzle_date, [])
    byDate.get(r.puzzle_date).push(r)
  }

  for (const dayRows of byDate.values()) {
    const { boards, crown, categoryCrowns } = buildBoards(dayRows)
    for (const [scope, list] of [['all', crown], ...Object.entries(categoryCrowns)]) {
      if (list.length >= 2) {
        for (const c of list) if (c.rank === 1) player(scope, c.userId, c.username).crowns += 1
      }
      for (const c of list) player(scope, c.userId, c.username).points += c.points
    }
    for (const b of boards) {
      const game = gameById[b.gameId]
      if (!perGame.has(b.gameId)) perGame.set(b.gameId, new Map())
      const g = perGame.get(b.gameId)
      for (const e of b.entries) {
        const won = e.rank === 1 && b.entries.length >= 2
        for (const scope of ['all', game.category]) {
          const p = player(scope, e.userId, e.username)
          p.played += 1
          p.days.add(dayRows[0].puzzle_date)
          if (won) p.wins += 1
        }
        const s = g.get(e.userId) || { userId: e.userId, username: e.username, played: 0, wins: 0, sum: 0, best: null }
        s.played += 1
        if (won) s.wins += 1
        s.sum += e.metric
        const better = game.better === 'higher' ? e.metric > s.best : e.metric < s.best
        if (s.best === null || better) s.best = e.metric
        g.set(e.userId, s)
      }
    }
  }

  // consecutive days played, counting back from today (or yesterday, if today isn't in yet)
  const streak = (daysSet) => {
    let d = daysSet.has(today) ? today : new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
    let n = 0
    while (daysSet.has(d)) {
      n += 1
      d = new Date(Date.parse(d + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
    }
    return n
  }

  // longest run of consecutive days ever played
  const bestStreak = (daysSet) => {
    let best = 0
    for (const d of daysSet) {
      const prev = new Date(Date.parse(d + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
      if (daysSet.has(prev)) continue // not the start of a run
      let n = 0
      let cur = d
      while (daysSet.has(cur)) {
        n += 1
        cur = new Date(Date.parse(cur + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10)
      }
      best = Math.max(best, n)
    }
    return best
  }

  const standings = (scope) => [...scopes.get(scope).values()]
    .filter((p) => p.played > 0)
    .map((p) => ({
      userId: p.userId, username: p.username, points: p.points, crowns: p.crowns, wins: p.wins,
      played: p.played, daysPlayed: p.days.size, streak: streak(p.allDays), bestStreak: bestStreak(p.allDays),
    }))
    // most points; a tie goes to whoever played fewer games (more per game)
    .sort((a, b) => b.points - a.points || a.played - b.played || a.username.localeCompare(b.username))
  const overall = standings('all')
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c.id, standings(c.id)]))

  const games = GAMES.filter((game) => perGame.has(game.id)).map((game) => {
    const dir = game.better === 'higher' ? -1 : 1
    const entries = [...perGame.get(game.id).values()]
      .map((s) => ({
        userId: s.userId, username: s.username, played: s.played, wins: s.wins,
        avg: s.sum / s.played, best: s.best,
        avgDisplay: formatMetric(game, s.sum / s.played), bestDisplay: formatMetric(game, s.best),
      }))
      // best ever result, then the better average
      .sort((a, b) => dir * (a.best - b.best) || dir * (a.avg - b.avg) || b.played - a.played)
    return { gameId: game.id, better: game.better, entries }
  })

  res.json({ days, since, today, overall, categories, games })
})
