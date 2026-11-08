import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { q } from './db.js'
import { requireAuth, setSession, isAdmin } from './auth.js'
import { appleEnabled, appleClients, verifyIdentityToken, exchangeCode } from './appleid.js'
import { mailEnabled, sendMail, PUBLIC_URL } from './mail.js'

// Account recovery, mounted beside authRouter at /api/auth:
// - an optional email, saved only once its confirmation link is clicked (/email, /email/verify)
// - "Forgot password?": a one-time reset link to that email, good for an hour (/forgot, /reset)
// - revokeSessions(): a reset signs the account out everywhere (cookie sessions signed before it
//   stop working, device tokens and push devices go)
// Nothing here says whether a username or email exists to someone who isn't signed in.
export const accountRouter = Router()

const VERIFY_HOURS = 24
const RESET_MINUTES = 60
const SENDS_PER_HOUR = 5 // emails one account can be sent in an hour, either kind

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const normEmail = (s) => String(s || '').trim().toLowerCase()
const validEmail = (s) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

// A few tries per address in a window, for the routes anyone can call. Kept in memory (one server).
const tries = new Map()
function tooMany(req, key, max, minutes) {
  const ip = (req.get('x-forwarded-for') || '').split(',')[0].trim() || req.ip
  const k = `${key}:${ip}`
  const now = Date.now()
  const recent = (tries.get(k) || []).filter((t) => now - t < minutes * 60000)
  recent.push(now)
  tries.set(k, recent)
  if (tries.size > 5000) tries.clear() // a crude cap; worst case, limits reset
  return recent.length > max
}

async function sentRecently(userId) {
  const { rows } = await q(
    `SELECT count(*)::int AS n FROM account_tokens WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [userId]
  )
  return rows[0].n >= SENDS_PER_HOUR
}

async function newToken(userId, kind, email, minutes) {
  const token = crypto.randomBytes(32).toString('base64url')
  await q(
    `INSERT INTO account_tokens (token_hash, user_id, kind, email, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5::int * interval '1 minute'))`,
    [sha256(token), userId, kind, email, minutes]
  )
  return token
}

// A live (unused, unexpired) token of this kind, or null.
async function findToken(token, kind) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const { rows } = await q(
    `SELECT t.*, u.username FROM account_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.kind = $2 AND t.used_at IS NULL AND t.expires_at > now()`,
    [sha256(token), kind]
  )
  return rows[0] ?? null
}

/** Signs an account out everywhere: older cookie sessions stop working, app devices are removed. */
export async function revokeSessions(userId) {
  await q('UPDATE users SET sessions_valid_after = now() WHERE id = $1', [userId])
  await q('DELETE FROM api_tokens WHERE user_id = $1', [userId])
  await q('DELETE FROM push_devices WHERE user_id = $1', [userId])
}

// ---------- my email ----------

// Whether email works, so sign-up and Forgot password know what to offer.
accountRouter.get('/email-available', (req, res) => res.json({ emailAvailable: mailEnabled }))

// What the profile shows: my email (confirmed), one waiting for its link, and whether email works.
accountRouter.get('/recovery', requireAuth, async (req, res) => {
  const { rows } = await q('SELECT email, email_verified_at, must_change_password, has_password FROM users WHERE id = $1', [req.user.id])
  const { rows: apple } = await q('SELECT email FROM apple_accounts WHERE user_id = $1', [req.user.id])
  const { rows: pending } = await q(
    `SELECT email FROM account_tokens WHERE user_id = $1 AND kind = 'verify' AND used_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  )
  res.json({
    emailAvailable: mailEnabled,
    email: rows[0]?.email ?? null,
    emailVerifiedAt: rows[0]?.email_verified_at ?? null,
    pendingEmail: pending[0]?.email ?? null,
    mustChangePassword: Boolean(rows[0]?.must_change_password),
    hasPassword: rows[0]?.has_password !== false,
    appleAvailable: appleEnabled,
    appleLinked: Boolean(apple[0]),
  })
})

// Add or change my email: sends a confirmation link; the address is saved once it's clicked.
accountRouter.post('/email', requireAuth, async (req, res) => {
  if (!mailEnabled) return res.status(503).json({ error: 'Email isn’t set up yet. Try again soon.' })
  const email = normEmail(req.body?.email)
  if (!validEmail(email)) return res.status(400).json({ error: 'That doesn’t look like an email address' })
  const { rows: taken } = await q('SELECT id FROM users WHERE lower(email) = $1 AND id <> $2', [email, req.user.id])
  if (taken.length) return res.status(409).json({ error: 'That email is already on another account' })
  if (await sentRecently(req.user.id)) {
    return res.status(429).json({ error: 'That’s a lot of emails. Try again in an hour.' })
  }
  const token = await newToken(req.user.id, 'verify', email, VERIFY_HOURS * 60)
  const sent = await sendMail({
    to: email,
    subject: 'Confirm your email for The Dailies',
    text:
      `Hi @${req.user.username},\n\n` +
      `Confirm this email so you can reset your password on The Dailies if you ever forget it:\n\n` +
      `${PUBLIC_URL}/?verify=${token}\n\n` +
      `The link works for ${VERIFY_HOURS} hours. If you didn't add this email, you can ignore this message.\n`,
  })
  if (!sent) return res.status(502).json({ error: 'Couldn’t send the email. Try again in a minute.' })
  res.json({ ok: true, pendingEmail: email })
})

accountRouter.delete('/email', requireAuth, async (req, res) => {
  await q('UPDATE users SET email = NULL, email_verified_at = NULL WHERE id = $1', [req.user.id])
  await q(`UPDATE account_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [req.user.id])
  res.json({ ok: true })
})

// The link in the confirmation email. Works signed in or not (it may open in another browser).
accountRouter.post('/email/verify', async (req, res) => {
  if (tooMany(req, 'verify', 20, 15)) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' })
  const t = await findToken(req.body?.token, 'verify')
  if (!t) return res.status(400).json({ error: 'That link has expired or was already used. Add your email again from your profile.' })
  const { rows: taken } = await q('SELECT id FROM users WHERE lower(email) = $1 AND id <> $2', [t.email, t.user_id])
  if (taken.length) return res.status(409).json({ error: 'That email is already on another account' })
  await q('UPDATE users SET email = $2, email_verified_at = now() WHERE id = $1', [t.user_id, t.email])
  await q(`UPDATE account_tokens SET used_at = now() WHERE user_id = $1 AND kind = 'verify' AND used_at IS NULL`, [t.user_id])
  res.json({ ok: true, email: t.email, username: t.username })
})

// ---------- forgot password ----------

// By username or email. Always the same answer, so it can't be used to look accounts up.
accountRouter.post('/forgot', async (req, res) => {
  if (tooMany(req, 'forgot', 5, 15)) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' })
  const login = String(req.body?.login || '').trim().toLowerCase().replace(/^@/, '')
  const answer = { ok: true, emailAvailable: mailEnabled }
  if (!login || login.length > 254) return res.json(answer)
  const { rows } = await q(
    'SELECT id, username, email FROM users WHERE username = $1 OR lower(email) = $1 LIMIT 1',
    [login]
  )
  const u = rows[0]
  if (!u?.email || !mailEnabled || (await sentRecently(u.id))) return res.json(answer)
  const token = await newToken(u.id, 'reset', u.email, RESET_MINUTES)
  await sendMail({
    to: u.email,
    subject: 'Reset your password for The Dailies',
    text:
      `Hi @${u.username},\n\n` +
      `Someone asked to reset your password on The Dailies. Choose a new one here:\n\n` +
      `${PUBLIC_URL}/?reset=${token}\n\n` +
      `The link works once, for the next hour. If you didn't ask for this, you can ignore this email: ` +
      `your password stays the same.\n`,
  })
  res.json(answer)
})

// Whose password a reset link is for, so the page can say so before asking for a new one.
accountRouter.get('/reset', async (req, res) => {
  if (tooMany(req, 'reset', 20, 15)) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' })
  const t = await findToken(req.query.token, 'reset')
  if (!t) return res.status(400).json({ error: 'That reset link has expired or was already used. Ask for a new one.' })
  res.json({ username: t.username })
})

accountRouter.post('/reset', async (req, res) => {
  if (tooMany(req, 'reset', 20, 15)) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' })
  const password = String(req.body?.password || '')
  if (password.length < 6) return res.status(400).json({ error: 'Password needs 6+ characters' })
  const t = await findToken(req.body?.token, 'reset')
  if (!t) return res.status(400).json({ error: 'That reset link has expired or was already used. Ask for a new one.' })
  await q(
    'UPDATE users SET password_hash = $2, must_change_password = false, has_password = true WHERE id = $1',
    [t.user_id, await bcrypt.hash(password, 10)]
  )
  await q(`UPDATE account_tokens SET used_at = now() WHERE user_id = $1 AND kind = 'reset' AND used_at IS NULL`, [t.user_id])
  await revokeSessions(t.user_id)
  console.log(`account: password reset by email link for ${t.username}`)
  res.json({ ok: true, username: t.username })
})

// ---------- Sign in with Apple ----------
// The website and the iPhone app get an identity token from Apple and send it here with its
// one-time code. A known Apple account signs in; a new one picks a username first (the first call
// answers needsUsername, the second sends it); a new one whose Apple email matches an account's
// confirmed email signs in to that account and links it. Signed in, /apple/link adds Apple to
// my account. Apple-only accounts have no password (has_password false) until they set one.

const USERNAME = /^[a-z0-9_]{2,20}$/

// what the website needs to show the button (the app signs in as its bundle id)
accountRouter.get('/apple/config', (req, res) => {
  res.json(appleEnabled && appleClients.web ? { enabled: true, clientId: appleClients.web, redirectURI: `${PUBLIC_URL}/` } : { enabled: false })
})

async function appleIdentity(req) {
  if (!appleEnabled) throw Object.assign(new Error('Sign in with Apple isn’t set up yet'), { status: 503 })
  try {
    return await verifyIdentityToken(req.body?.identityToken, req.body?.nonce)
  } catch (err) {
    console.warn('apple: token rejected:', err.message)
    throw Object.assign(new Error('Apple didn’t confirm that sign-in. Try again.'), { status: 401 })
  }
}

async function linkApple(userId, who, code) {
  const refresh = await exchangeCode(code, who.clientId)
  await q(
    `INSERT INTO apple_accounts (user_id, sub, email, client_id, refresh_token) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET sub = EXCLUDED.sub, email = EXCLUDED.email, client_id = EXCLUDED.client_id,
       refresh_token = COALESCE(EXCLUDED.refresh_token, apple_accounts.refresh_token)`,
    [userId, who.sub, who.email, who.clientId, refresh]
  )
  // Apple vouches for the address (a private relay address works too): use it unless I have one
  if (who.email && who.emailVerified) {
    await q(
      `UPDATE users SET email = $2, email_verified_at = now()
        WHERE id = $1 AND email IS NULL AND NOT EXISTS (SELECT 1 FROM users o WHERE lower(o.email) = $2 AND o.id <> $1)`,
      [userId, who.email]
    )
  }
}

async function suggestUsername(who) {
  const base = (who.email && !who.privateEmail ? who.email.split('@')[0] : 'player').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'player'
  for (let i = 0; i < 20; i++) {
    // a real name first ("jamierivers"); a plain "player" always gets a number
    const name = i === 0 && base.length >= 2 && base !== 'player' ? base : `${base.slice(0, 14)}${Math.floor(100 + Math.random() * 9900)}`
    const { rows } = await q('SELECT 1 FROM users WHERE username = $1', [name])
    if (!rows.length && !isAdmin({ username: name })) return name
  }
  return ''
}

accountRouter.post('/apple', async (req, res) => {
  if (tooMany(req, 'apple', 30, 15)) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' })
  let who
  try {
    who = await appleIdentity(req)
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message })
  }
  const signIn = (u, created = false) => {
    setSession(res, u)
    res.json({ user: { id: u.id, username: u.username }, created })
  }

  const { rows: known } = await q(
    'SELECT u.id, u.username FROM apple_accounts a JOIN users u ON u.id = a.user_id WHERE a.sub = $1',
    [who.sub]
  )
  if (known.length) return signIn(known[0])

  // the same confirmed email as an existing account: that's them
  if (who.email && who.emailVerified) {
    const { rows: same } = await q(
      `SELECT u.id, u.username FROM users u WHERE lower(u.email) = $1 AND u.email_verified_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM apple_accounts a WHERE a.user_id = u.id)`,
      [who.email]
    )
    if (same.length) {
      await linkApple(same[0].id, who, req.body?.code)
      console.log(`apple: linked ${same[0].username} by matching email`)
      return signIn(same[0])
    }
  }

  // new: pick a username first
  const username = String(req.body?.username || '').trim().toLowerCase().replace(/^@/, '')
  if (!username) return res.json({ needsUsername: true, suggestion: await suggestUsername(who) })
  if (!USERNAME.test(username)) return res.status(400).json({ error: 'Username: 2-20 letters, numbers, or _' })
  if (isAdmin({ username })) return res.status(409).json({ error: 'That username is taken' })
  const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10) // never used to sign in
  let user
  try {
    const { rows } = await q(
      'INSERT INTO users (username, password_hash, has_password) VALUES ($1, $2, false) RETURNING id, username',
      [username, placeholder]
    )
    user = rows[0]
  } catch (e) {
    if (String(e).includes('unique') || String(e).includes('duplicate')) return res.status(409).json({ error: 'That username is taken' })
    throw e
  }
  await linkApple(user.id, who, req.body?.code)
  console.log(`apple: new account ${user.username}`)
  signIn(user, true)
})

// Add Apple to my account (from the profile).
accountRouter.post('/apple/link', requireAuth, async (req, res) => {
  let who
  try {
    who = await appleIdentity(req)
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message })
  }
  const { rows: other } = await q('SELECT user_id FROM apple_accounts WHERE sub = $1 AND user_id <> $2', [who.sub, req.user.id])
  if (other.length) return res.status(409).json({ error: 'That Apple ID is already linked to another account' })
  await linkApple(req.user.id, who, req.body?.code)
  res.json({ ok: true })
})

// Unlink Apple; only when there's a password to sign in with instead.
accountRouter.delete('/apple/link', requireAuth, async (req, res) => {
  const { rows } = await q('SELECT has_password FROM users WHERE id = $1', [req.user.id])
  if (!rows[0]?.has_password) return res.status(400).json({ error: 'Set a password first, so you can still sign in' })
  await q('DELETE FROM apple_accounts WHERE user_id = $1', [req.user.id])
  res.json({ ok: true })
})
