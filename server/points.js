import { q } from './db.js'
import { GAMES, gameById } from './parsers.js'

// Current perfect/par/zero per game: the defaults in parsers.js, then any admin overrides.
let rules = {}

export async function loadRules() {
  const next = Object.fromEntries(GAMES.map((g) => [g.id, { ...g.scoring, custom: false }]))
  const { rows } = await q('SELECT game_id, perfect, par, zero FROM game_scoring')
  for (const r of rows) {
    if (next[r.game_id]) next[r.game_id] = { ...next[r.game_id], perfect: r.perfect, par: r.par, zero: r.zero, custom: true }
  }
  rules = next
}

export const rulesFor = (gameId) => rules[gameId]
export const allRules = () => rules

// 0-100: perfect 100, par 50, zero 0. Each side of par is a curve (t^1.5), so a result just off
// perfect (or just past par) loses a little and each further step loses more. Works for games
// where lower is better and higher is better alike, since it only measures how far along the
// way from perfect to zero the result is.
export function pointsFor(gameId, metric, r = rules[gameId]) {
  if (!r) return 0
  const span = r.zero - r.perfect
  const u = (metric - r.perfect) / span // 0 at perfect, 1 at zero
  if (u <= 0) return 100
  if (u >= 1) return 0
  const a = (r.par - r.perfect) / span // where par sits on the way
  const pts = u <= a ? 100 - 50 * (u / a) ** 1.5 : 50 * (1 - ((u - a) / (1 - a)) ** 1.5)
  return Math.round(pts)
}

// perfect, par and zero must run in the game's direction (lower or higher is better)
export function checkRules(gameId, { perfect, par, zero }) {
  const game = gameById[gameId]
  if (!game) return 'No such game'
  if (![perfect, par, zero].every(Number.isFinite)) return 'Perfect, par and zero must all be numbers'
  const ok = game.better === 'lower' ? perfect < par && par < zero : perfect > par && par > zero
  if (!ok) {
    return game.better === 'lower'
      ? 'For this game lower is better, so perfect must be below par, and par below zero'
      : 'For this game higher is better, so perfect must be above par, and par above zero'
  }
  return null
}

export async function saveRules(gameId, values, username) {
  await q(
    `INSERT INTO game_scoring (game_id, perfect, par, zero, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (game_id) DO UPDATE SET perfect = $2, par = $3, zero = $4, updated_by = $5, updated_at = now()`,
    [gameId, values.perfect, values.par, values.zero, username]
  )
  await loadRules()
}

export async function resetRules(gameId) {
  await q('DELETE FROM game_scoring WHERE game_id = $1', [gameId])
  await loadRules()
}

// Scores from before points were saved get theirs once, with the values in force at launch.
export async function backfillPoints() {
  const { rows } = await q('SELECT id, game_id, metric FROM submissions WHERE points IS NULL')
  for (const r of rows) {
    await q('UPDATE submissions SET points = $1 WHERE id = $2', [pointsFor(r.game_id, r.metric), r.id])
  }
  if (rows.length) console.log(`points: scored ${rows.length} older scores`)
}
