import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { notify } from './push.js'

export const friendsRouter = Router()
friendsRouter.use(requireAuth)

const pair = (a, b) => (a < b ? [a, b] : [b, a])

// Everyone in my circle: accepted friends + pending in both directions.
friendsRouter.get('/', async (req, res) => {
  const me = req.user.id
  const { rows } = await q(
    `SELECT f.user_a, f.user_b, f.status, f.requested_by,
            ua.username AS username_a, ub.username AS username_b
       FROM friendships f
       JOIN users ua ON ua.id = f.user_a
       JOIN users ub ON ub.id = f.user_b
      WHERE f.user_a = $1 OR f.user_b = $1`,
    [me]
  )
  const friends = []
  const incoming = []
  const outgoing = []
  for (const r of rows) {
    const other =
      r.user_a === me
        ? { id: r.user_b, username: r.username_b }
        : { id: r.user_a, username: r.username_a }
    if (r.status === 'accepted') friends.push(other)
    else if (r.requested_by === me) outgoing.push(other)
    else incoming.push(other)
  }
  res.json({ friends, incoming, outgoing })
})

friendsRouter.post('/request', async (req, res) => {
  const me = req.user.id
  const username = String(req.body.username || '').trim().toLowerCase()
  const { rows } = await q('SELECT id, username FROM users WHERE username = $1', [username])
  if (!rows.length) return res.status(404).json({ error: `No user named "${username}"` })
  const target = rows[0]
  if (target.id === me) return res.status(400).json({ error: "That's you" })

  const [a, b] = pair(me, target.id)
  const existing = await q('SELECT * FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b])
  if (existing.rows.length) {
    const f = existing.rows[0]
    if (f.status === 'accepted') return res.status(409).json({ error: 'Already friends' })
    if (f.requested_by === me) return res.status(409).json({ error: 'Request already sent' })
    // They asked me first — mutual intent, auto-accept.
    await q('UPDATE friendships SET status = $3 WHERE user_a = $1 AND user_b = $2', [a, b, 'accepted'])
    res.json({ ok: true, accepted: true, user: target })
    return friendAccepted(target.id, req.user.username)
  }
  await q(
    'INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ($1, $2, $3, $4)',
    [a, b, 'pending', me]
  )
  res.json({ ok: true, accepted: false, user: target })
  notify(target.id, {
    title: 'Friend request',
    body: `${req.user.username} wants to be friends on The Dailies`,
    tab: 'friends',
    collapseId: `friend-${me}`,
  })
})

friendsRouter.post('/respond', async (req, res) => {
  const me = req.user.id
  const otherId = Number(req.body.userId)
  const accept = Boolean(req.body.accept)
  const [a, b] = pair(me, otherId)
  const { rows } = await q(
    'SELECT * FROM friendships WHERE user_a = $1 AND user_b = $2 AND status = $3',
    [a, b, 'pending']
  )
  if (!rows.length || rows[0].requested_by === me) {
    return res.status(404).json({ error: 'No pending request from them' })
  }
  if (accept) {
    await q('UPDATE friendships SET status = $3 WHERE user_a = $1 AND user_b = $2', [a, b, 'accepted'])
  } else {
    await q('DELETE FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b])
  }
  res.json({ ok: true })
  if (accept) friendAccepted(otherId, req.user.username)
})

friendsRouter.delete('/:userId', async (req, res) => {
  const [a, b] = pair(req.user.id, Number(req.params.userId))
  await q('DELETE FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b])
  res.json({ ok: true })
})

// "People you may know": friends of my friends (accepted friendships only, so sending someone a
// request doesn't reveal theirs), most mutual friends first, leaving out anyone I already have a
// friendship or request with and anyone I closed. ?via=<friend id> keeps to that friend's friends,
// for the list right after adding them.
friendsRouter.get('/suggestions', async (req, res) => {
  const me = req.user.id
  const via = Number.isInteger(Number(req.query.via)) && req.query.via ? Number(req.query.via) : null
  const { rows } = await q(
    `WITH mine AS (
       SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS id
         FROM friendships WHERE (user_a = $1 OR user_b = $1) AND status = 'accepted'
     ), linked AS (
       SELECT CASE WHEN f.user_a = m.id THEN f.user_b ELSE f.user_a END AS id, m.id AS via
         FROM friendships f JOIN mine m ON f.user_a = m.id OR f.user_b = m.id
        WHERE f.status = 'accepted'
     )
     SELECT l.id, u.username, count(*)::int AS mutual_count,
            array_agg(mu.username ORDER BY mu.username) AS mutuals
       FROM linked l
       JOIN users u ON u.id = l.id
       JOIN users mu ON mu.id = l.via
      WHERE l.id <> $1
        AND NOT EXISTS (SELECT 1 FROM friendships x
                         WHERE (x.user_a = $1 AND x.user_b = l.id) OR (x.user_a = l.id AND x.user_b = $1))
        AND NOT EXISTS (SELECT 1 FROM friend_suggestion_dismissals d WHERE d.user_id = $1 AND d.other_id = l.id)
      GROUP BY l.id, u.username
     HAVING $2::int IS NULL OR bool_or(l.via = $2::int)
      ORDER BY count(*) DESC, u.username
      LIMIT 12`,
    [me, via]
  )
  res.json({
    suggestions: rows.map((r) => ({ id: r.id, username: r.username, mutualCount: r.mutual_count, mutuals: r.mutuals.slice(0, 3) })),
  })
})

friendsRouter.post('/suggestions/dismiss', async (req, res) => {
  const other = Number(req.body?.userId)
  if (!Number.isInteger(other) || other === req.user.id) return res.status(400).json({ error: 'Pick someone to hide' })
  await q(
    'INSERT INTO friend_suggestion_dismissals (user_id, other_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.id, other]
  )
  res.json({ ok: true })
})

// Tells whoever sent the request that it was accepted.
function friendAccepted(requesterId, username) {
  return notify(requesterId, {
    title: 'New friend',
    body: `${username} accepted your friend request`,
    tab: 'friends',
    collapseId: `friend-${username}`,
  })
}

// Helper other routes use: ids of me + accepted friends.
export async function circleIds(userId) {
  const { rows } = await q(
    `SELECT user_a, user_b FROM friendships
      WHERE (user_a = $1 OR user_b = $1) AND status = 'accepted'`,
    [userId]
  )
  const ids = new Set([userId])
  for (const r of rows) ids.add(r.user_a === userId ? r.user_b : r.user_a)
  return [...ids]
}
