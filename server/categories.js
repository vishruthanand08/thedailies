import { q } from './db.js'
import { GAMES, CATEGORIES, gameById } from './parsers.js'

// Categories and single games an admin has hidden (admin.js, the Categories card on the Admin
// tab). A hidden game, or every game in a hidden category, leaves Today and the scoring ⓘ, can't
// be scored (a pasted result is turned down), and its scores drop out of every board, crown, feed
// card, stat and the global leaderboard, past days included. Nothing is deleted: showing it again
// brings all of it back. The lists live in `category_settings` and `game_settings` and are kept in
// memory (one server), loaded at boot and after each change.
let hidden = new Set()
let hiddenGames = new Set()

export async function loadHiddenCategories() {
  const [cats, games] = await Promise.all([
    q('SELECT category FROM category_settings WHERE hidden'),
    q('SELECT game_id FROM game_settings WHERE hidden'),
  ])
  hidden = new Set(cats.rows.map((r) => r.category))
  hiddenGames = new Set(games.rows.map((r) => r.game_id))
}

export async function setCategoryHidden(category, value, by) {
  await q(
    `INSERT INTO category_settings (category, hidden, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (category) DO UPDATE SET hidden = $2, updated_by = $3, updated_at = now()`,
    [category, value, by]
  )
  await loadHiddenCategories()
}

export async function setGameHidden(gameId, value, by) {
  await q(
    `INSERT INTO game_settings (game_id, hidden, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (game_id) DO UPDATE SET hidden = $2, updated_by = $3, updated_at = now()`,
    [gameId, value, by]
  )
  await loadHiddenCategories()
}

export const isCategoryHidden = (id) => hidden.has(id)
// hidden on its own (whatever its category is set to)
export const isGameSwitchedOff = (gameId) => hiddenGames.has(gameId)
// hidden either way: on its own or with its category
export const isGameHidden = (gameId) => hiddenGames.has(gameId) || hidden.has(gameById[gameId]?.category)
export const visibleGames = () => GAMES.filter((g) => !isGameHidden(g.id))
// a category with every game hidden goes too
export const visibleCategories = () =>
  CATEGORIES.filter((c) => !hidden.has(c.id) && GAMES.some((g) => g.category === c.id && !isGameHidden(g.id)))
// score rows (anything with a game_id) without the hidden games
export const visibleRows = (rows) => rows.filter((r) => !isGameHidden(r.game_id))
export const hiddenGameIds = () => GAMES.filter((g) => isGameHidden(g.id)).map((g) => g.id)
