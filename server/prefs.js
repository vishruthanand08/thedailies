import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { gameById, CATEGORIES } from './parsers.js'

export const prefsRouter = Router()
prefsRouter.use(requireAuth)

const categoryIds = new Set(CATEGORIES.map((c) => c.id))
// Groups that can be collapsed: the categories plus the Favorites section.
const collapsibleIds = new Set([...categoryIds, 'favorites'])

// Each pref is a JSON list of known ids (unknown ones are dropped, so removed games or
// categories never break a saved layout): field in the API -> column, allowed ids.
const FIELDS = {
  order: { column: 'game_order', valid: (id) => Boolean(gameById[id]) },
  favorites: { column: 'favorites', valid: (id) => Boolean(gameById[id]) },
  categoryOrder: { column: 'category_order', valid: (id) => categoryIds.has(id) },
  collapsed: { column: 'collapsed', valid: (id) => collapsibleIds.has(id) },
}
const COLUMNS = Object.values(FIELDS).map((f) => f.column).join(', ')

// Keep only known ids, once each, in the order given.
function clean(list, valid) {
  if (!Array.isArray(list)) return null
  return [...new Set(list.map(String))].filter(valid)
}

function parse(json, valid) {
  try {
    return clean(JSON.parse(json), valid) ?? []
  } catch {
    return []
  }
}

async function load(userId) {
  const { rows } = await q(`SELECT ${COLUMNS} FROM user_prefs WHERE user_id = $1`, [userId])
  return Object.fromEntries(
    Object.entries(FIELDS).map(([key, f]) => [key, rows[0] ? parse(rows[0][f.column], f.valid) : []])
  )
}

prefsRouter.get('/', async (req, res) => {
  res.json(await load(req.user.id))
})

// Any subset of the fields may be sent; the rest keep their stored values.
prefsRouter.put('/', async (req, res) => {
  const next = await load(req.user.id)
  for (const [key, f] of Object.entries(FIELDS)) {
    if (req.body[key] === undefined) continue
    const ids = clean(req.body[key], f.valid)
    if (ids === null) return res.status(400).json({ error: `Expected a list for ${key}` })
    next[key] = ids
  }
  const values = Object.keys(FIELDS).map((key) => JSON.stringify(next[key]))
  await q(
    `INSERT INTO user_prefs (user_id, ${COLUMNS}, updated_at) VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET game_order = $2, favorites = $3, category_order = $4, collapsed = $5, updated_at = now()`,
    [req.user.id, ...values]
  )
  res.json(next)
})
