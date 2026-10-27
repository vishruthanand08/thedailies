import { gameById } from './parsers.js'

// Competition ranking ("1-2-2-4") per game, then points = N - rank + 1
// where N = number of players who submitted that game that day.
// The daily crown is the sum of points across games; each category gets its own crown from just
// its games (categoryCrowns: { nyt: [...], linkedin: [...], ... }, only categories someone played).
export function buildBoards(rows) {
  const byGame = new Map()
  for (const row of rows) {
    if (!byGame.has(row.game_id)) byGame.set(row.game_id, [])
    byGame.get(row.game_id).push(row)
  }

  const boards = []
  const crownPoints = new Map() // user_id -> { points, games }
  const categoryPoints = new Map() // category -> user_id -> { points, games }

  for (const [gameId, subs] of byGame) {
    const game = gameById[gameId]
    if (!game) continue
    const dir = game.better === 'higher' ? -1 : 1
    subs.sort((a, b) => dir * (a.metric - b.metric))

    const n = subs.length
    const entries = subs.map((s, i) => {
      const rank = i > 0 && s.metric === subs[i - 1].metric ? null : i + 1
      return { ...s, rank }
    })
    // propagate tied ranks
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].rank === null) entries[i].rank = entries[i - 1].rank
    }
    for (const e of entries) {
      e.points = n - e.rank + 1
      const c = crownPoints.get(e.user_id) || { points: 0, games: 0 }
      c.points += e.points
      c.games += 1
      crownPoints.set(e.user_id, c)
      if (!categoryPoints.has(game.category)) categoryPoints.set(game.category, new Map())
      const cat = categoryPoints.get(game.category)
      const cc = cat.get(e.user_id) || { points: 0, games: 0 }
      cc.points += e.points
      cc.games += 1
      cat.set(e.user_id, cc)
    }
    boards.push({
      gameId,
      entries: entries.map((e) => ({
        userId: e.user_id,
        username: e.username,
        display: e.display,
        metric: e.metric,
        rank: e.rank,
        points: e.points,
        verified: e.verified,
        submissionId: e.id,
      })),
    })
  }

  const usernames = new Map(rows.map((r) => [r.user_id, r.username]))
  const rank = (points) => [...points.entries()]
    .map(([userId, c]) => ({ userId, username: usernames.get(userId), points: c.points, games: c.games }))
    .sort((a, b) => b.points - a.points || b.games - a.games)
  const crown = rank(crownPoints)
  const categoryCrowns = Object.fromEntries([...categoryPoints].map(([cat, points]) => [cat, rank(points)]))

  return { boards, crown, categoryCrowns }
}
