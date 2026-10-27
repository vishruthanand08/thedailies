import { Router } from 'express'
import { q } from './db.js'
import { requireAuth, requireAdmin } from './auth.js'
import { GAMES } from './parsers.js'
import { allRules, checkRules, saveRules, resetRules } from './points.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

// Every game's scoring values, with its defaults so the page can show what changed.
adminRouter.get('/scoring', async (req, res) => {
  const rules = allRules()
  const { rows } = await q('SELECT game_id, updated_by, updated_at FROM game_scoring')
  const edits = Object.fromEntries(rows.map((r) => [r.game_id, { by: r.updated_by, at: r.updated_at }]))
  res.json({
    games: GAMES.map((g) => ({
      id: g.id, name: g.name, emoji: g.emoji, category: g.category, metricLabel: g.metricLabel, better: g.better,
      perfect: rules[g.id].perfect, par: rules[g.id].par, zero: rules[g.id].zero, failAt: g.scoring.failAt ?? null,
      defaults: { perfect: g.scoring.perfect, par: g.scoring.par, zero: g.scoring.zero },
      custom: rules[g.id].custom, edited: edits[g.id] ?? null,
    })),
  })
})

// New values apply to scores posted from now on; earlier scores keep the points they were saved with.
adminRouter.put('/scoring/:gameId', async (req, res) => {
  const values = { perfect: Number(req.body.perfect), par: Number(req.body.par), zero: Number(req.body.zero) }
  const problem = checkRules(req.params.gameId, values)
  if (problem) return res.status(400).json({ error: problem })
  await saveRules(req.params.gameId, values, req.user.username)
  res.json({ ok: true })
})

adminRouter.delete('/scoring/:gameId', async (req, res) => {
  await resetRules(req.params.gameId)
  res.json({ ok: true })
})

// All suggestions from everyone, most voted first.
adminRouter.get('/suggestions', async (req, res) => {
  const { rows } = await q(
    `SELECT s.id, s.name, s.url, s.note, s.status, s.created_at, u.username,
            (SELECT COUNT(*) FROM game_suggestion_votes v WHERE v.suggestion_id = s.id)::int AS votes
       FROM game_suggestions s
       JOIN users u ON u.id = s.user_id
      ORDER BY (s.status = 'open') DESC, votes DESC, s.created_at DESC`
  )
  res.json({
    suggestions: rows.map((r) => ({
      id: r.id, name: r.name, url: r.url, note: r.note, status: r.status, votes: r.votes, by: r.username, createdAt: r.created_at,
    })),
  })
})

adminRouter.patch('/suggestions/:id', async (req, res) => {
  const status = req.body.status === 'added' ? 'added' : 'open'
  await q('UPDATE game_suggestions SET status = $1 WHERE id = $2', [status, Number(req.params.id)])
  res.json({ ok: true })
})

adminRouter.delete('/suggestions/:id', async (req, res) => {
  await q('DELETE FROM game_suggestions WHERE id = $1', [Number(req.params.id)]) // votes cascade
  res.json({ ok: true })
})
