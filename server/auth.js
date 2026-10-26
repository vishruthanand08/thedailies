import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { q } from './db.js'

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

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE]
  if (!token) return res.status(401).json({ error: 'Not signed in' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Session expired — sign in again' })
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

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } })
})
