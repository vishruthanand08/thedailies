import { q } from './db.js'
import { todayISO, hourIn } from './util.js'
import { gameById } from './parsers.js'
import { hiddenGameIds, visibleRows } from './categories.js'
import { circleIds } from './friends.js'
import { buildBoards } from './scoring.js'
import { notify, pushEnabled } from './push.js'

// Reminders to play, at most two a day, in each player's own time zone, to anyone with a device:
//
// - midday (from MIDDAY_HOUR until the evening one): only when they haven't played and a friend
//   has: "maya and alex already played. Your turn 👀". Sent the first time a friend has played,
//   so it waits for one; none that day if no friend plays before the evening.
// - evening (REMINDER_HOUR): if they haven't played, one of a streak about to end, the race for
//   today's crown in their circle, their favorite games, or a plain reminder, varied day to day;
//   if they have played but skipped a favorite (a game they play on most days they play), that.
//
// What was sent is recorded per player and day (push_user_reminders for the evening,
// push_midday_nudges for midday), so a restart never sends one twice.

const REMINDER_HOUR = Number(process.env.PUSH_REMINDER_HOUR ?? 20)
const MIDDAY_HOUR = Number(process.env.PUSH_MIDDAY_HOUR ?? 13)

// A favorite: over the last FAVORITE_DAYS days, played on at least FAVORITE_SHARE of the days
// they played anything, and on at least FAVORITE_MIN days.
const FAVORITE_DAYS = 14
const FAVORITE_SHARE = 0.5
const FAVORITE_MIN = 3

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10))

function dayBefore(date, n = 1) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** "Wordle", "Wordle and Queens", "Wordle, Queens and Zip" */
function list(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function names(usernames) {
  if (usernames.length <= 2) return list(usernames)
  return `${usernames[0]}, ${usernames[1]} and ${usernames.length - 2} other${usernames.length === 3 ? '' : 's'}`
}

// the same player gets a different reminder from one day to the next
function pick(options, userId, today) {
  const day = Math.round(new Date(`${today}T12:00:00Z`).getTime() / 86400000)
  return options[(day + userId) % options.length]
}

/** Games played today (visible ones). */
async function playedToday(userId, today) {
  const { rows } = await q(
    `SELECT game_id FROM submissions WHERE user_id = $1 AND puzzle_date = $2 AND game_id <> ALL($3::text[])`,
    [userId, today, hiddenGameIds()]
  )
  return new Set(rows.map((r) => r.game_id))
}

/** Days in a row played, ending yesterday. */
async function streakToYesterday(userId, today) {
  const { rows } = await q(
    `SELECT DISTINCT puzzle_date FROM submissions
      WHERE user_id = $1 AND puzzle_date < $2 AND puzzle_date >= $3 AND game_id <> ALL($4::text[])`,
    [userId, today, dayBefore(today, 400), hiddenGameIds()]
  )
  const days = new Set(rows.map((r) => iso(r.puzzle_date)))
  let n = 0
  for (let d = dayBefore(today); days.has(d); d = dayBefore(d)) n += 1
  return n
}

/** The games they play most: on most of the recent days, most played first. */
async function favorites(userId, today) {
  const args = [userId, today, dayBefore(today, FAVORITE_DAYS), hiddenGameIds()]
  const where = 'user_id = $1 AND puzzle_date < $2 AND puzzle_date >= $3 AND game_id <> ALL($4::text[])'
  const { rows } = await q(
    `SELECT game_id, count(DISTINCT puzzle_date)::int AS days FROM submissions
      WHERE ${where} GROUP BY game_id ORDER BY days DESC, game_id`,
    args
  )
  const { rows: active } = await q(`SELECT count(DISTINCT puzzle_date)::int AS days FROM submissions WHERE ${where}`, args)
  const need = Math.max(FAVORITE_MIN, Math.ceil(active[0].days * FAVORITE_SHARE))
  return rows.filter((r) => r.days >= need && gameById[r.game_id]).map((r) => r.game_id)
}

/** The most played games over the last month, for the "your games are waiting" reminder. */
async function mostPlayed(userId, today, limit = 3) {
  const { rows } = await q(
    `SELECT game_id, count(*)::int AS n FROM submissions
      WHERE user_id = $1 AND puzzle_date < $2 AND puzzle_date >= $3 AND game_id <> ALL($4::text[])
      GROUP BY game_id ORDER BY n DESC, game_id LIMIT $5`,
    [userId, today, dayBefore(today, 30), hiddenGameIds(), limit + 2]
  )
  return rows.filter((r) => gameById[r.game_id]).slice(0, limit).map((r) => r.game_id)
}

/** Today's board in their circle (friends only, not them). */
async function friendsToday(userId, today) {
  const ids = (await circleIds(userId)).filter((id) => id !== userId)
  if (!ids.length) return { players: [], crown: [] }
  const { rows } = await q(
    `SELECT s.*, u.username FROM submissions s JOIN users u ON u.id = s.user_id
      WHERE s.puzzle_date = $1 AND s.user_id = ANY($2)`,
    [today, ids]
  )
  const visible = visibleRows(rows)
  const { crown } = buildBoards(visible)
  // friends who played, most games first
  const games = new Map()
  for (const r of visible) games.set(r.username, (games.get(r.username) ?? 0) + 1)
  const players = [...games.entries()].sort((a, b) => b[1] - a[1]).map(([username]) => username)
  return { players, crown }
}

const gameNames = (ids) => ids.map((id) => gameById[id].name)

/** The midday nudge, or null when no friend has played yet. */
export async function middayFor(userId, today) {
  const { players } = await friendsToday(userId, today)
  if (!players.length) return null
  const who = names(players)
  const one = players.length === 1
  return pick(
    [
      { title: 'Your friends are playing', body: `${who} already played today. Your turn 👀` },
      { title: `${one ? `${players[0]} is` : 'Your friends are'} on the board`, body: `${who} ${one ? 'has' : 'have'} posted today. Don’t let them get comfortable.` },
      { title: 'The board is filling up', body: `${who} already played. Come see how you stack up.` },
    ],
    userId,
    today
  )
}

/** The evening reminder for someone who hasn't played today. */
export async function eveningFor(userId, today) {
  const streak = await streakToYesterday(userId, today)
  // a streak worth keeping always comes first: it's what people mind losing
  if (streak >= 3) {
    return { title: `🔥 Your ${streak}-day streak ends at midnight`, body: 'One game keeps it going. Play now.' }
  }
  const options = []
  const { crown } = await friendsToday(userId, today)
  if (crown.length) {
    const top = crown[0]
    options.push({
      title: `👑 ${top.username} leads today with ${Math.round(top.points)} pts`,
      body: 'Still time to take the crown. Puzzles reset at midnight.',
    })
  }
  const mine = gameNames(await mostPlayed(userId, today))
  if (mine.length) {
    options.push({
      title: `${list(mine)} ${mine.length === 1 ? 'is' : 'are'} waiting`,
      body: 'You haven’t played today. Puzzles reset at midnight.',
    })
  }
  if (streak >= 1) {
    options.push({ title: `Make it ${streak + 1} days in a row`, body: 'Play a game before midnight to keep your streak going 🔥' })
  }
  if (!options.length) {
    options.push({ title: 'Still time to play', body: 'You haven’t posted a score today. Today’s puzzles reset at midnight.' })
  }
  return pick(options, userId, today)
}

/** The evening reminder for someone who played but skipped a favorite, or null. */
export async function skippedFor(userId, today, played) {
  const skipped = gameNames((await favorites(userId, today)).filter((id) => !played.has(id)).slice(0, 3))
  if (!skipped.length) return null
  const one = skipped.length === 1
  return {
    title: `You haven’t done ${list(skipped)} today`,
    body: one ? 'You usually do. It resets at midnight.' : 'You usually do. They reset at midnight.',
  }
}

async function claim(table, userId, today) {
  const { rows } = await q(
    `INSERT INTO ${table} (user_id, puzzle_date) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id`,
    [userId, today]
  )
  return rows.length > 0
}

async function alreadySent(table, userId, today) {
  const { rows } = await q(`SELECT 1 FROM ${table} WHERE user_id = $1 AND puzzle_date = $2`, [userId, today])
  return rows.length > 0
}

export async function remindIfDue() {
  const { rows: players } = await q(
    `SELECT DISTINCT d.user_id, u.timezone FROM push_devices d JOIN users u ON u.id = d.user_id`
  )
  const sent = { midday: 0, evening: 0 }
  for (const p of players) {
    const hour = hourIn(p.timezone)
    if (hour < MIDDAY_HOUR) continue
    const today = todayISO(p.timezone)
    const slot = hour >= REMINDER_HOUR ? 'evening' : 'midday'
    const table = slot === 'evening' ? 'push_user_reminders' : 'push_midday_nudges'
    if (await alreadySent(table, p.user_id, today)) continue

    const played = await playedToday(p.user_id, today)
    let message
    if (slot === 'midday') message = played.size ? null : await middayFor(p.user_id, today)
    else message = played.size ? await skippedFor(p.user_id, today, played) : await eveningFor(p.user_id, today)
    // the evening is decided once: nothing to say means nothing that day
    if (!message && slot === 'midday') continue
    if (!(await claim(table, p.user_id, today)) || !message) continue

    await notify(p.user_id, { ...message, tab: 'today', collapseId: `reminder-${today}` })
    sent[slot] += 1
  }
  if (sent.midday || sent.evening) console.log(`push: reminders sent (midday ${sent.midday}, evening ${sent.evening})`)
}

export function startReminders() {
  if (!pushEnabled) return
  const tick = () => remindIfDue().catch((err) => console.warn('push reminder:', err.message))
  setInterval(tick, 5 * 60 * 1000).unref()
  tick()
}
