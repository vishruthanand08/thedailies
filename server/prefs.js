import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { gameById } from './parsers.js'

export const prefsRouter = Router()
prefsRouter.use(requireAuth)

// Keep only known game ids, once each, in the order given.
function cleanIds(list) {
  if (!Array.isArray(list)) return null
  return [...new Set(list.map(String))].filter((id) => gameById[id])
}

function parseIds(json) {
  try {
    return cleanIds(JSON.parse(json)) ?? []
  } catch {
    return []
  }
}

prefsRouter.get('/', async (req, res) => {
  const { rows } = await q('SELECT game_order, favorites FROM user_prefs WHERE user_id = $1', [req.user.id])
  const row = rows[0]
  res.json({ order: row ? parseIds(row.game_order) : [], favorites: row ? parseIds(row.favorites) : [] })
})

// Either field may be sent alone; the other keeps its stored value.
prefsRouter.put('/', async (req, res) => {
  const order = req.body.order === undefined ? undefined : cleanIds(req.body.order)
  const favorites = req.body.favorites === undefined ? undefined : cleanIds(req.body.favorites)
  if (order === null || favorites === null) return res.status(400).json({ error: 'Expected a list of games' })

  const { rows } = await q('SELECT game_order, favorites FROM user_prefs WHERE user_id = $1', [req.user.id])
  const next = {
    order: order ?? (rows[0] ? parseIds(rows[0].game_order) : []),
    favorites: favorites ?? (rows[0] ? parseIds(rows[0].favorites) : []),
  }
  await q(
    `INSERT INTO user_prefs (user_id, game_order, favorites, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET game_order = $2, favorites = $3, updated_at = now()`,
    [req.user.id, JSON.stringify(next.order), JSON.stringify(next.favorites)]
  )
  res.json(next)
})
