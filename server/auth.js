import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { q } from './db.js'
import { TZ, isValidTimeZone } from './util.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'dailyboard-dev-secret'
const COOKIE = 'db_token'

function setSession(res, user) {
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '90d' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 90 * 24 * 3600 * 1000,
  })
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const MAX_TOKENS = 10

// The player's time zone: the one their browser or app sends (X-Timezone), else the one saved
// on their account, else Eastern. A new or changed zone is saved, so requests that don't send
// one (the Windows app's game panel, older app builds) still use it.
function timeZoneFor(req, userId, saved) {
  const sent = req.get('x-timezone')
  if (isValidTimeZone(sent)) {
    if (sent !== saved) q('UPDATE users SET timezone = $2 WHERE id = $1', [userId, sent]).catch(() => {})
    return sent
  }
  return isValidTimeZone(saved) ? saved : TZ
}

// Bearer device token (native app, share extension, Shortcut) first, then the cookie.
export async function requireAuth(req, res, next) {
  try {
    const h = req.get('authorization') || ''
    if (h.startsWith('Bearer dly_')) {
      const { rows } = await q(
        `SELECT u.id, u.username, u.timezone, u.must_change_password, t.id AS token_id
           FROM api_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = $1`,
        [sha256(h.slice(7))]
      )
      if (!rows.length) {
        return res.status(401).json({ error: 'That device token is no longer valid. Sign in again in the app.' })
      }
      req.user = {
        id: rows[0].id, username: rows[0].username, tz: timeZoneFor(req, rows[0].id, rows[0].timezone),
        mustChangePassword: Boolean(rows[0].must_change_password),
      }
      req.tokenId = rows[0].token_id
      q('UPDATE api_tokens SET last_used_at = now() WHERE id = $1', [rows[0].token_id]).catch(() => {})
      return next()
    }

    const token = req.cookies?.[COOKIE]
    if (!token) return res.status(401).json({ error: 'Not signed in' })
    let session
    try {
      session = jwt.verify(token, JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Session expired — sign in again' })
    }
    // the account may have been deleted since (by its owner or an admin): that signs it out
    const { rows } = await q(
      'SELECT id, username, timezone, must_change_password, sessions_valid_after FROM users WHERE id = $1',
      [session.id]
    )
    if (!rows.length) {
      res.clearCookie(COOKIE)
      return res.status(401).json({ error: 'Not signed in' })
    }
    // a password reset since this session was signed (server/account.js) signs it out
    const cutoff = rows[0].sessions_valid_after
    if (cutoff && session.iat < Math.floor(new Date(cutoff).getTime() / 1000)) {
      res.clearCookie(COOKIE)
      return res.status(401).json({ error: 'Your password was reset. Sign in again.' })
    }
    req.user = {
      id: rows[0].id, username: rows[0].username, tz: timeZoneFor(req, rows[0].id, rows[0].timezone),
      mustChangePassword: Boolean(rows[0].must_change_password),
    }
    next()
  } catch (err) {
    next(err)
  }
}

export const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!/^[a-z0-9_]{2,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username: 2-20 letters, numbers, or _' })
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password needs 6+ characters' })
  // The website asks for an email at sign-up (it's confirmed afterwards, from /api/auth/email in
  // account.js); the iPhone app 1.6 signs up without one, so it stays optional here.
  const email = String(req.body.email || '').trim().toLowerCase()
  if (email) {
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'That doesn’t look like an email address' })
    }
    const { rows: taken } = await q('SELECT 1 FROM users WHERE lower(email) = $1', [email])
    if (taken.length) return res.status(409).json({ error: 'That email is already on an account. Sign in, or use Forgot password.' })
  }
  // admin names can't be signed up by anyone else, even if an admin deletes their account
  if (ADMINS.has(username)) return res.status(409).json({ error: 'That username is taken' })

  const hash = await bcrypt.hash(password, 10)
  try {
    const { rows } = await q(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    )
    setSession(res, rows[0])
    res.json({ user: rows[0] })
  } catch (e) {
    if (String(e).includes('unique') || String(e).includes('duplicate')) {
      return res.status(409).json({ error: 'Username taken' })
    }
    throw e
  }
})

authRouter.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const { rows } = await q('SELECT * FROM users WHERE username = $1', [username])
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Wrong username or password' })
  }
  setSession(res, rows[0])
  res.json({ user: { id: rows[0].id, username: rows[0].username } })
})

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

// Admins see the website's Admin tab (scoring values, game suggestions). ADMIN_USERNAMES
// (comma separated) overrides the default list, e.g. to try it with a local test account.
const ADMINS = new Set(
  (process.env.ADMIN_USERNAMES || 'nickpianfetti,vishruthanand').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean)
)
export const isAdmin = (user) => Boolean(user && ADMINS.has(user.username.toLowerCase()))

export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' })
  next()
}

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    user: { id: req.user.id, username: req.user.username, admin: isAdmin(req.user), mustChangePassword: req.user.mustChangePassword },
  })
})

authRouter.get('/profile', requireAuth, async (req, res) => {
  const { rows } = await q('SELECT username, created_at FROM users WHERE id = $1', [req.user.id])
  if (!rows.length) return res.status(404).json({ error: 'No such user' })
  res.json({ username: rows[0].username, createdAt: rows[0].created_at })
})

// Existing sessions and device tokens stay signed in; only the password changes. Clears the
// "change your password" nudge after an admin reset.
authRouter.post('/password', requireAuth, async (req, res) => {
  const current = String(req.body.current || '')
  const next = String(req.body.next || '')
  if (next.length < 6) return res.status(400).json({ error: 'New password needs 6+ characters' })
  const { rows } = await q('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  if (!rows.length || !(await bcrypt.compare(current, rows[0].password_hash))) {
    return res.status(400).json({ error: 'Your current password is wrong' })
  }
  await q('UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1', [req.user.id, await bcrypt.hash(next, 10)])
  res.json({ ok: true })
})

// Deletes the account and everything tied to it (App Store guideline 5.1.1(v): accounts made in
// the app must be deletable in the app). Children first, since the tables reference users(id).
authRouter.delete('/account', requireAuth, async (req, res) => {
  const password = String(req.body?.password || '')
  const { rows } = await q('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(400).json({ error: 'Your password is wrong' })
  }
  await deleteUser(req.user.id)
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

/**
 * Removes a user and every row that references them, children first (the tables reference
 * users(id)). Used by Delete account and by admins (server/admin.js). Any new table with a
 * user_id belongs here.
 */
export async function deleteUser(id) {
  await q('DELETE FROM game_suggestion_votes WHERE user_id = $1', [id])
  await q('DELETE FROM game_suggestions WHERE user_id = $1', [id]) // their votes cascade
  await q('DELETE FROM api_tokens WHERE user_id = $1', [id])
  await q('DELETE FROM user_prefs WHERE user_id = $1', [id])
  await q('DELETE FROM day_kudos WHERE owner_id = $1 OR giver_id = $1', [id])
  await q('DELETE FROM day_highlights WHERE user_id = $1', [id])
  await q('DELETE FROM push_devices WHERE user_id = $1', [id])
  await q('DELETE FROM push_user_reminders WHERE user_id = $1', [id])
  await q('DELETE FROM account_tokens WHERE user_id = $1', [id])
  await q('DELETE FROM global_members WHERE user_id = $1', [id])
  await q('DELETE FROM friend_suggestion_dismissals WHERE user_id = $1 OR other_id = $1', [id])
  await q('DELETE FROM submissions WHERE user_id = $1', [id])
  await q('DELETE FROM friendships WHERE user_a = $1 OR user_b = $1 OR requested_by = $1', [id])
  await q('DELETE FROM users WHERE id = $1', [id])
}

// ---------- device tokens ----------
// Plaintext is "dly_" + 32 random bytes (base64url), returned exactly once.

authRouter.post('/tokens', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim()
  if (name.length < 1 || name.length > 40) {
    return res.status(400).json({ error: 'Device name: 1-40 characters' })
  }
  const { rows: count } = await q('SELECT count(*)::int AS n FROM api_tokens WHERE user_id = $1', [req.user.id])
  if (count[0].n >= MAX_TOKENS) {
    return res.status(400).json({ error: 'Too many devices, remove one first' })
  }
  const token = 'dly_' + crypto.randomBytes(32).toString('base64url')
  const { rows } = await q(
    'INSERT INTO api_tokens (user_id, token_hash, name) VALUES ($1, $2, $3) RETURNING id, name, created_at',
    [req.user.id, sha256(token), name]
  )
  res.json({ token, id: rows[0].id, name: rows[0].name, created_at: rows[0].created_at })
})

authRouter.get('/tokens', requireAuth, async (req, res) => {
  const { rows } = await q(
    'SELECT id, name, created_at, last_used_at FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  )
  res.json({ tokens: rows })
})

authRouter.delete('/tokens/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Unknown device' })
  await q('DELETE FROM api_tokens WHERE id = $1 AND user_id = $2', [id, req.user.id])
  res.json({ ok: true })
})
