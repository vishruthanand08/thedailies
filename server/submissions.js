import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { circleIds } from './friends.js'
import { GAMES, gameById, detect, expectedDate } from './parsers.js'
import { buildBoards } from './scoring.js'
import { todayISO, daysApart, isValidISODate } from './util.js'

export const submissionsRouter = Router()
submissionsRouter.use(requireAuth)

submissionsRouter.get('/games', (req, res) => {
  res.json({
    games: GAMES.map(({ id, name, emoji, color, url, metricLabel, better, manual, note, embed }) => ({
      id, name, emoji, color, url, metricLabel, better, manual, note, embed: !!embed,
    })),
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
          error: `That looks like the ${game.name} from ${derived}, not today's. Only today's puzzle counts.`,
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
    `INSERT INTO submissions (user_id, game_id, puzzle_date, puzzle_number, metric, display, raw_text, verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [req.user.id, gameId, puzzleDate, puzzleNumber, metric, display, rawText, verified]
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
  const { boards, crown } = buildBoards(rows)
  res.json({ date, today: todayISO(), boards, crown, circleSize: ids.length })
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
