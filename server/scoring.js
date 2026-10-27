import { gameById } from './parsers.js'
import { pointsFor } from './points.js'

// Each game's board ranks by the actual result (competition ranking, "1-2-2-4"). Points come
// from the result alone: 0-100 per score (server/points.js), saved when the score was posted.
// The daily crown is the sum of a player's points; a tie goes to whoever played fewer games
// (more per game), and a tie on both shares the place. Each category gets its own crown from
// just its games (categoryCrowns: { nyt: [...], linkedin: [...], ... }, only categories someone played).
export function buildBoards(rows) {
  const byGame = new Map()
  for (const row of rows) {
    if (!byGame.has(row.game_id)) byGame.set(row.game_id, [])
    byGame.get(row.game_id).push(row)
  }

  const boards = []
  const crownPoints = new Map() // user_id -> { points, games }
  const categoryPoints = new Map() // category -> user_id -> { points, games }
  const add = (map, userId, points) => {
    const c = map.get(userId) || { points: 0, games: 0 }
    c.points += points
    c.games += 1
    map.set(userId, c)
  }

  for (const [gameId, subs] of byGame) {
    const game = gameById[gameId]
    if (!game) continue
    const dir = game.better === 'higher' ? -1 : 1
    subs.sort((a, b) => dir * (a.metric - b.metric))

    const entries = subs.map((s, i) => ({ ...s, rank: i + 1, points: s.points ?? pointsFor(gameId, s.metric) }))
    // tied results share the higher rank
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].metric === entries[i - 1].metric) entries[i].rank = entries[i - 1].rank
    }
    for (const e of entries) {
      add(crownPoints, e.user_id, e.points)
      if (!categoryPoints.has(game.category)) categoryPoints.set(game.category, new Map())
      add(categoryPoints.get(game.category), e.user_id, e.points)
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
  const rank = (points) => {
    const list = [...points.entries()]
      .map(([userId, c]) => ({ userId, username: usernames.get(userId), points: c.points, games: c.games }))
      .sort((a, b) => b.points - a.points || a.games - b.games)
    list.forEach((c, i) => {
      const prev = list[i - 1]
      c.rank = prev && prev.points === c.points && prev.games === c.games ? prev.rank : i + 1
    })
    return list
  }
  const crown = rank(crownPoints)
  const categoryCrowns = Object.fromEntries([...categoryPoints].map(([cat, points]) => [cat, rank(points)]))

  return { boards, crown, categoryCrowns }
}
