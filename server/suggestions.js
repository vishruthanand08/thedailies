import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { circleIds } from './friends.js'

export const suggestionsRouter = Router()
suggestionsRouter.use(requireAuth)

const PER_DAY = 5

// Lists only my circle's suggestions (no strangers' free text), but votes count from everyone,
// and a repeat of anyone's suggestion becomes a vote for it.
suggestionsRouter.get('/', async (req, res) => {
  const ids = await circleIds(req.user.id)
  const { rows } = await q(
    `SELECT s.id, s.user_id, s.name, s.url, s.note, s.status, s.created_at, u.username,
            (SELECT COUNT(*) FROM game_suggestion_votes v WHERE v.suggestion_id = s.id)::int AS votes,
            EXISTS (SELECT 1 FROM game_suggestion_votes v WHERE v.suggestion_id = s.id AND v.user_id = $1) AS voted
       FROM game_suggestions s
       JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ANY($2) OR s.id IN (SELECT suggestion_id FROM game_suggestion_votes WHERE user_id = $1)
      ORDER BY (s.status = 'open') DESC, votes DESC, s.created_at DESC
      LIMIT 30`,
    [req.user.id, ids]
  )
  res.json({
    suggestions: rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      note: r.note,
      votes: r.votes,
      added: r.status === 'added',
      voted: r.voted,
      mine: r.user_id === req.user.id,
      by: ids.includes(r.user_id) ? r.username : null,
      createdAt: r.created_at,
    })),
  })
})

suggestionsRouter.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ').slice(0, 60)
  let url = String(req.body.url || '').trim().slice(0, 300)
  const note = String(req.body.note || '').trim().slice(0, 300)
  if (!name) return res.status(400).json({ error: 'Give the game a name' })
  if (url) {
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    try {
      const u = new URL(url)
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error()
      url = u.href
    } catch {
      return res.status(400).json({ error: "That link doesn't look right" })
    }
  }

  const same = await q('SELECT id, name FROM game_suggestions WHERE lower(name) = lower($1) LIMIT 1', [name])
  if (same.rows.length) {
    await q(
      'INSERT INTO game_suggestion_votes (suggestion_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [same.rows[0].id, req.user.id]
    )
    return res.json({ ok: true, merged: true, name: same.rows[0].name })
  }

  const recent = await q(
    `SELECT COUNT(*)::int AS n FROM game_suggestions WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
    [req.user.id]
  )
  if (recent.rows[0].n >= PER_DAY) {
    return res.status(429).json({ error: `That's ${PER_DAY} suggestions today. Thanks! Try again tomorrow.` })
  }

  const { rows } = await q(
    'INSERT INTO game_suggestions (user_id, name, url, note) VALUES ($1, $2, $3, $4) RETURNING id',
    [req.user.id, name, url || null, note || null]
  )
  await q('INSERT INTO game_suggestion_votes (suggestion_id, user_id) VALUES ($1, $2)', [rows[0].id, req.user.id])
  res.json({ ok: true, merged: false, name })
})

// Toggle my +1.
suggestionsRouter.post('/:id/vote', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Unknown suggestion' })
  const exists = await q('SELECT 1 FROM game_suggestions WHERE id = $1', [id])
  if (!exists.rows.length) return res.status(404).json({ error: 'Unknown suggestion' })
  const removed = await q(
    'DELETE FROM game_suggestion_votes WHERE suggestion_id = $1 AND user_id = $2 RETURNING 1',
    [id, req.user.id]
  )
  if (!removed.rows.length) {
    await q('INSERT INTO game_suggestion_votes (suggestion_id, user_id) VALUES ($1, $2)', [id, req.user.id])
  }
  res.json({ ok: true, voted: !removed.rows.length })
})

suggestionsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Unknown suggestion' })
  await q('DELETE FROM game_suggestions WHERE id = $1 AND user_id = $2', [id, req.user.id])
  res.json({ ok: true })
})
