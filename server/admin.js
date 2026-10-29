import { Router } from 'express'
import { q } from './db.js'
import { requireAuth, requireAdmin, deleteUser, isAdmin } from './auth.js'
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

// ---------- users ----------
// Look up an account before deleting it: when it joined, what it has, who it's connected to.
async function findUser(raw) {
  const name = String(raw || '').trim().toLowerCase().replace(/^@/, '')
  const { rows } = await q('SELECT id, username, created_at FROM users WHERE username = $1', [name])
  return rows[0] ?? null
}

adminRouter.get('/users/:username', async (req, res) => {
  const u = await findUser(req.params.username)
  if (!u) return res.status(404).json({ error: `No user named "${req.params.username}"` })
  const count = async (sql) => (await q(sql, [u.id])).rows[0].n
  const { rows: friends } = await q(
    `SELECT o.username, f.status FROM friendships f
       JOIN users o ON o.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
      WHERE f.user_a = $1 OR f.user_b = $1 ORDER BY o.username`,
    [u.id]
  )
  const { rows: last } = await q('SELECT max(created_at) AS at FROM submissions WHERE user_id = $1', [u.id])
  res.json({
    id: u.id, username: u.username, createdAt: u.created_at, admin: isAdmin(u),
    scores: await count('SELECT count(*)::int AS n FROM submissions WHERE user_id = $1'),
    lastScoreAt: last[0]?.at ?? null,
    kudos: await count('SELECT count(*)::int AS n FROM day_kudos WHERE owner_id = $1 OR giver_id = $1'),
    suggestions: await count('SELECT count(*)::int AS n FROM game_suggestions WHERE user_id = $1'),
    devices: await count('SELECT count(*)::int AS n FROM api_tokens WHERE user_id = $1'),
    friends: friends.filter((f) => f.status === 'accepted').map((f) => f.username),
    pending: friends.filter((f) => f.status !== 'accepted').map((f) => f.username),
  })
})

// Deletes an account and everything tied to it, the same as Delete account on its You tab.
// The admin types the username again to confirm; admins can't delete themselves or each other.
adminRouter.delete('/users/:username', async (req, res) => {
  const u = await findUser(req.params.username)
  if (!u) return res.status(404).json({ error: `No user named "${req.params.username}"` })
  if (String(req.body?.confirm || '').trim().toLowerCase().replace(/^@/, '') !== u.username) {
    return res.status(400).json({ error: `Type ${u.username} to confirm` })
  }
  if (u.id === req.user.id) return res.status(400).json({ error: 'Delete your own account from the You tab' })
  if (isAdmin(u)) return res.status(403).json({ error: "Admins can't be deleted here" })
  await deleteUser(u.id)
  console.log(`admin: ${req.user.username} deleted user ${u.username} (id ${u.id})`)
  res.json({ ok: true, username: u.username })
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
