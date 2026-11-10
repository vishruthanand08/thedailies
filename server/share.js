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
// Like other daily games' shares: a line with my place ("🥇 I'm 1st on The Dailies with:"), the
// game's own share text with its links taken out, and our address. Links shared before
// 2026-11-10 carried an invite (/?add=<me>&s=<token>, the token signed with JWT_SECRET:
// `g<submission id>` or `c<user id>x<yyyymmdd>`); those still work, through readShareToken and
// sharePreview below (the sign-up teaser, link previews and the instant friendship).

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

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function ordinal(n) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

// "🥇 I'm 1st on The Dailies with:" (a medal for the top three), "I was 4th … on Mon, Nov 9 with:"
function placeLine(rank, date, today) {
  const medal = MEDALS[rank] ? `${MEDALS[rank]} ` : ''
  if (date === today) return `${medal}I’m ${ordinal(rank)} on The Dailies with:`
  return `${medal}I was ${ordinal(rank)} on The Dailies ${when(date, today)} with:`
}

// A game's share without its links (the game's own address, ref links), so ours is the one link.
function withoutLinks(text) {
  return text
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*/gi, '') // lnkd.in/wend
    .replace(/^[ \t]*(?:[a-z0-9-]+\.)+[a-z]{2,}[ \t]*$/gim, '') // a line that's just chainle.io
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function when(date, today) {
  if (date === today) return 'today'
  const d = new Date(`${date}T12:00:00Z`)
  return `on ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`
}

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

  // the game's own share, links out; a share that was only a link (or a typed-in score) gets a line
  const own = mine.shareText ? withoutLinks(mine.shareText) : ''
  const result = own.length > 3 ? own : `${game.emoji} ${game.name} ${mine.display}`
  res.json({ text: `${placeLine(mine.rank, date, today)}\n${result}\n${PUBLIC_URL}`, url: PUBLIC_URL })
})

shareRouter.get('/crown', requireAuth, async (req, res) => {
  const today = todayISO(req.user.tz)
  const date = isValidISODate(String(req.query.date || '')) ? req.query.date : today
  const { crown } = await dayBoard(req.user.id, date)
  const mine = crown.find((c) => c.userId === req.user.id)
  if (!mine) return res.status(404).json({ error: 'Play a game first, then share your crown.' })

  // my games that day, most points first: "🟩 Wordle 3/6"
  const { rows } = await q(
    `SELECT game_id, display, points FROM submissions WHERE user_id = $1 AND puzzle_date = $2`,
    [req.user.id, date]
  )
  const games = visibleRows(rows)
    .filter((r) => gameById[r.game_id])
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .map((r) => `${gameById[r.game_id].emoji} ${gameById[r.game_id].name} ${r.display}`)
  const pts = `${Math.round(mine.points)} pts from ${mine.games} game${mine.games === 1 ? '' : 's'}`
  // the top three, then how many more, so a big day stays a short message
  const shown = games.length > 3 ? [...games.slice(0, 3), `+${games.length - 3} more`] : games
  const text = [placeLine(mine.rank, date, today), pts, ...shown, PUBLIC_URL].join('\n')
  res.json({ text, url: PUBLIC_URL })
})
