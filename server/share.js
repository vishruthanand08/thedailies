import crypto from 'node:crypto'
import { Router } from 'express'
import { q } from './db.js'
import { requireAuth, JWT_SECRET } from './auth.js'
import { circleIds } from './friends.js'
import { gameById } from './parsers.js'
import { buildBoards } from './scoring.js'
import { visibleRows, isGameHidden } from './categories.js'
import { todayISO, isValidISODate } from './util.js'
import { PUBLIC_URL } from './mail.js'

// Sharing a score: the website and the apps ask for the text (GET /game/:gameId, GET /crown),
// written here so every client says the same thing, and hand it to the share sheet or clipboard.
// Each text ends in a link, /?add=<me>&s=<token>: an invite (the friend request is accepted at
// once, since the sharer sent the link) that also opens the shared game's board. The token is
// signed (HMAC with JWT_SECRET), so a link only ever shows what its sharer chose to share:
// `g<submission id>` for a game score, `c<user id>x<yyyymmdd>` for the day's crown.

const sign = (body) => crypto.createHmac('sha256', JWT_SECRET).update(`share:${body}`).digest('base64url').slice(0, 12)

export function shareToken(body) {
  return `${body}-${sign(body)}`
}

/** { kind: 'game', submissionId } or { kind: 'crown', userId, date }, or null if it isn't genuine. */
export function readShareToken(raw) {
  const m = /^([gc][0-9x]{1,40})-([A-Za-z0-9_-]{12})$/.exec(String(raw || ''))
  if (!m) return null
  const expected = Buffer.from(sign(m[1]))
  const given = Buffer.from(m[2])
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  const body = m[1]
  if (body[0] === 'g' && /^g\d+$/.test(body)) return { kind: 'game', submissionId: Number(body.slice(1)) }
  const c = /^c(\d+)x(\d{4})(\d{2})(\d{2})$/.exec(body)
  if (c) return { kind: 'crown', userId: Number(c[1]), date: `${c[2]}-${c[3]}-${c[4]}` }
  return null
}

/** What a share link shows anyone (no sign-in): who shared, and the score or crown. */
export async function sharePreview(raw) {
  const token = readShareToken(raw)
  if (!token) return null
  if (token.kind === 'game') {
    const { rows } = await q(
      `SELECT s.user_id, s.game_id, s.display, s.puzzle_date, u.username FROM submissions s
         JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [token.submissionId]
    )
    const s = rows[0]
    const game = s && gameById[s.game_id]
    if (!game || isGameHidden(game.id)) return null
    return {
      kind: 'game', from: s.username, userId: s.user_id, gameId: game.id, gameName: game.name, emoji: game.emoji,
      display: s.display, date: s.puzzle_date instanceof Date ? s.puzzle_date.toISOString().slice(0, 10) : String(s.puzzle_date),
    }
  }
  const { rows } = await q('SELECT username FROM users WHERE id = $1', [token.userId])
  if (!rows.length) return null
  return { kind: 'crown', from: rows[0].username, userId: token.userId, date: token.date }
}

// ---- the text ----

const link = (username, token) => `${PUBLIC_URL}/?add=${encodeURIComponent(username)}&s=${token}`

function names(list) {
  const at = list.map((n) => `@${n}`)
  if (at.length <= 2) return at.join(' and ')
  return `${at.slice(0, 2).join(', ')} and ${at.length - 2} other${at.length === 3 ? '' : 's'}`
}

function when(date, today) {
  if (date === today) return 'today'
  const d = new Date(`${date}T12:00:00Z`)
  return `on ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`
}

// the same score always gets the same line, so sharing twice doesn't change the joke
const pick = (lines, seed) => lines[Math.abs(seed) % lines.length]

const DARES = ['Think you can beat it?', 'Your move 👀', 'Prove me wrong:', 'Bet you can’t beat it:', 'Come get some:']

async function dayBoard(userId, date) {
  const ids = await circleIds(userId)
  const { rows } = await q(
    `SELECT s.*, u.username FROM submissions s JOIN users u ON u.id = s.user_id
      WHERE s.puzzle_date = $1 AND s.user_id = ANY($2)`,
    [date, ids]
  )
  return buildBoards(visibleRows(rows))
}

export const shareRouter = Router()

// anyone with the link: what it shares (the sign-up page shows it)
shareRouter.get('/preview/:token', async (req, res) => {
  const preview = await sharePreview(req.params.token)
  if (!preview) return res.status(404).json({ error: 'That share link has expired.' })
  const { userId, ...shown } = preview
  res.json(shown)
})

shareRouter.get('/game/:gameId', requireAuth, async (req, res) => {
  const game = gameById[req.params.gameId]
  if (!game || isGameHidden(game.id)) return res.status(404).json({ error: 'Unknown game' })
  const today = todayISO(req.user.tz)
  const date = isValidISODate(String(req.query.date || '')) ? req.query.date : today
  const { boards } = await dayBoard(req.user.id, date)
  const entries = boards.find((b) => b.gameId === game.id)?.entries ?? []
  const mine = entries.find((e) => e.userId === req.user.id)
  if (!mine) return res.status(404).json({ error: `Play ${game.name} first, then share your score.` })

  const day = when(date, today)
  const beaten = entries.filter((e) => e.rank > mine.rank).map((e) => e.username)
  const above = entries.filter((e) => e.rank < mine.rank)
  let line
  if (beaten.length && !above.length) line = `I beat ${names(beaten)} at ${game.name} ${day} 😤`
  else if (beaten.length) line = `I beat ${names(beaten)} at ${game.name} ${day}. @${above[above.length - 1].username}, you’re next 👀`
  else if (entries.length === 1) line = `First one in on ${game.name} ${day} 🏁`
  else line = `Took an L on ${game.name} ${day} 😅`

  const header = mine.shareText || `${game.emoji} ${game.name} ${mine.display}`
  const url = link(req.user.username, shareToken(`g${mine.submissionId}`))
  res.json({ text: `${header}\n\n${line}\n${pick(DARES, mine.submissionId)} ${url}`, url })
})

shareRouter.get('/crown', requireAuth, async (req, res) => {
  const today = todayISO(req.user.tz)
  const date = isValidISODate(String(req.query.date || '')) ? req.query.date : today
  const { crown } = await dayBoard(req.user.id, date)
  const mine = crown.find((c) => c.userId === req.user.id)
  if (!mine) return res.status(404).json({ error: 'Play a game first, then share your crown.' })

  const day = when(date, today)
  const pts = `${mine.points} pts from ${mine.games} game${mine.games === 1 ? '' : 's'}`
  const others = crown.filter((c) => c.userId !== req.user.id)
  let text
  if (mine.rank === 1 && others.length) {
    text = `👑 I won The Dailies ${day}: ${pts}, ahead of ${names(others.map((c) => c.username))}.\nCome take my crown:`
  } else if (mine.rank === 1) {
    text = `👑 Top of The Dailies ${day} with ${pts}.\nCome take my crown:`
  } else {
    text = `I’m #${mine.rank} of ${crown.length} on The Dailies ${day} with ${pts}.\nCatch me if you can:`
  }
  const url = link(req.user.username, shareToken(`c${req.user.id}x${date.replaceAll('-', '')}`))
  res.json({ text: `${text} ${url}`, url })
})
