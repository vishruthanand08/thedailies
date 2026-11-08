import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { q } from './db.js'
import { requireAuth, requireAdmin, deleteUser, isAdmin } from './auth.js'
import { GAMES, CATEGORIES } from './parsers.js'
import { isCategoryHidden, setCategoryHidden, isGameSwitchedOff, setGameHidden } from './categories.js'
import { allRules, checkRules, saveRules, resetRules } from './points.js'
import { revokeSessions } from './account.js'

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
    // every category, hidden ones too, so their games can still be tuned
    categories: CATEGORIES.map((c) => ({ ...c, hidden: isCategoryHidden(c.id) })),
  })
})

// ---------- categories and games ----------
// Hide a category or a single game, or bring it back (server/categories.js): hidden, its games
// aren't shown, played or scored anywhere, and their scores are kept for when they come back.
adminRouter.get('/categories', async (req, res) => {
  const [cats, games] = await Promise.all([
    q('SELECT category, updated_by, updated_at FROM category_settings'),
    q('SELECT game_id, updated_by, updated_at FROM game_settings'),
  ])
  const set = Object.fromEntries(cats.rows.map((r) => [r.category, { by: r.updated_by, at: r.updated_at }]))
  const gameSet = Object.fromEntries(games.rows.map((r) => [r.game_id, { by: r.updated_by, at: r.updated_at }]))
  res.json({
    categories: CATEGORIES.map((c) => ({
      id: c.id, name: c.name, emoji: c.emoji, hidden: isCategoryHidden(c.id), changed: set[c.id] ?? null,
      games: GAMES.filter((g) => g.category === c.id).map((g) => ({
        id: g.id, name: g.name, emoji: g.emoji, hidden: isGameSwitchedOff(g.id), changed: gameSet[g.id] ?? null,
      })),
    })),
  })
})

adminRouter.put('/games/:id', async (req, res) => {
  const game = GAMES.find((g) => g.id === req.params.id)
  if (!game) return res.status(404).json({ error: 'No such game' })
  const hidden = req.body?.hidden === true
  await setGameHidden(game.id, hidden, req.user.username)
  console.log(`admin: ${req.user.username} ${hidden ? 'hid' : 'showed'} ${game.name}`)
  res.json({ ok: true, id: game.id, hidden })
})

adminRouter.put('/categories/:id', async (req, res) => {
  const category = CATEGORIES.find((c) => c.id === req.params.id)
  if (!category) return res.status(404).json({ error: 'No such category' })
  const hidden = req.body?.hidden === true
  await setCategoryHidden(category.id, hidden, req.user.username)
  console.log(`admin: ${req.user.username} ${hidden ? 'hid' : 'showed'} the ${category.name} category`)
  res.json({ ok: true, id: category.id, hidden })
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
  const { rows } = await q('SELECT id, username, created_at, email, must_change_password FROM users WHERE username = $1', [name])
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
    // enough to tell them where a reset link would go, without showing the whole address
    email: u.email ? maskEmail(u.email) : null,
    mustChangePassword: Boolean(u.must_change_password),
  })
})

const maskEmail = (e) => e.replace(/^(.)[^@]*(@.*)$/, (_, first, rest) => `${first}•••${rest}`)

// A temporary password, for someone who wrote to support because they're locked out (check it's
// them first). It's shown once, here; the account is signed out everywhere and asked to choose a
// new password when they sign in. No admins: they reset their own.
const TEMP_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (l, 1, o, 0, i)
adminRouter.post('/users/:username/reset-password', async (req, res) => {
  const u = await findUser(req.params.username)
  if (!u) return res.status(404).json({ error: `No user named "${req.params.username}"` })
  if (isAdmin(u)) return res.status(403).json({ error: 'Admins reset their own password from the profile' })
  const temp = Array.from(crypto.randomBytes(10), (b) => TEMP_CHARS[b % TEMP_CHARS.length]).join('')
  const password = `${temp.slice(0, 5)}-${temp.slice(5)}`
  await q('UPDATE users SET password_hash = $2, must_change_password = true, has_password = true WHERE id = $1', [u.id, await bcrypt.hash(password, 10)])
  await revokeSessions(u.id)
  console.log(`admin: ${req.user.username} reset the password for ${u.username} (id ${u.id})`)
  res.json({ ok: true, username: u.username, password })
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
