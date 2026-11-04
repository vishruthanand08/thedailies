import { q } from './db.js'
import { GAMES, CATEGORIES, gameById } from './parsers.js'

// Categories an admin has hidden (admin.js, the Categories card on the Admin tab). A hidden
// category's games leave Today and the scoring ⓘ, can't be scored (a pasted result is turned
// down), and their scores drop out of every board, crown, feed card, stat and the global
// leaderboard, past days included. Nothing is deleted: showing the category again brings all of
// it back. The list lives in `category_settings` and is kept in memory (one server), loaded at
// boot and after each change.
let hidden = new Set()

export async function loadHiddenCategories() {
  const { rows } = await q('SELECT category FROM category_settings WHERE hidden')
  hidden = new Set(rows.map((r) => r.category))
}

export async function setCategoryHidden(category, value, by) {
  await q(
    `INSERT INTO category_settings (category, hidden, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (category) DO UPDATE SET hidden = $2, updated_by = $3, updated_at = now()`,
    [category, value, by]
  )
  await loadHiddenCategories()
}

export const isCategoryHidden = (id) => hidden.has(id)
export const isGameHidden = (gameId) => hidden.has(gameById[gameId]?.category)
export const visibleGames = () => GAMES.filter((g) => !hidden.has(g.category))
export const visibleCategories = () => CATEGORIES.filter((c) => !hidden.has(c.id))
// score rows (anything with a game_id) without the hidden categories' games
export const visibleRows = (rows) => rows.filter((r) => !isGameHidden(r.game_id))
export const hiddenGameIds = () => GAMES.filter((g) => hidden.has(g.category)).map((g) => g.id)
