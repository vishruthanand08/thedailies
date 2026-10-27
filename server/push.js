import http2 from 'node:http2'
import crypto from 'node:crypto'
import { Router } from 'express'
import { q } from './db.js'
import { requireAuth } from './auth.js'
import { todayISO, TZ } from './util.js'

// Push notifications to the iPhone and Mac apps through Apple's push service (APNs), using a
// token-based .p8 key. Configure with APNS_KEY (the .p8 file's contents), APNS_KEY_ID and
// APNS_TEAM_ID; APNS_TOPIC defaults to the app's bundle id. Without a key, nothing is sent.
const KEY = process.env.APNS_KEY?.replace(/\\n/g, '\n')
const KEY_ID = process.env.APNS_KEY_ID
const TEAM_ID = process.env.APNS_TEAM_ID
const TOPIC = process.env.APNS_TOPIC || 'lol.thedailies.app'
export const pushEnabled = Boolean(KEY && KEY_ID && TEAM_ID)

// APNS_HOST points both environments at a stand-in server, for trying this out locally
const HOSTS = process.env.APNS_HOST
  ? { production: process.env.APNS_HOST, sandbox: process.env.APNS_HOST }
  : { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' }
// hour (Eastern, 0-23) of the evening reminder for anyone who hasn't posted a score today
const REMINDER_HOUR = Number(process.env.PUSH_REMINDER_HOUR ?? 20)

export const pushRouter = Router()
pushRouter.use(requireAuth)

// The app sends its device token after the player allows notifications (and on each launch,
// since tokens can change). env is "sandbox" for Xcode builds, "production" for App Store ones.
pushRouter.post('/devices', async (req, res) => {
  const token = String(req.body?.token || '')
  const platform = req.body?.platform === 'macos' ? 'macos' : 'ios'
  const env = req.body?.env === 'sandbox' ? 'sandbox' : 'production'
  if (!/^[0-9a-f]{32,200}$/i.test(token)) return res.status(400).json({ error: 'That isn’t a device token' })
  await q(
    `INSERT INTO push_devices (token, user_id, platform, env) VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
       env = EXCLUDED.env, updated_at = now()`,
    [token.toLowerCase(), req.user.id, platform, env]
  )
  res.json({ ok: true })
})

// Signing out of the app stops its notifications.
pushRouter.delete('/devices', async (req, res) => {
  await q('DELETE FROM push_devices WHERE token = $1 AND user_id = $2', [String(req.body?.token || '').toLowerCase(), req.user.id])
  res.json({ ok: true })
})

// ---------- sending ----------

let jwt = { token: null, at: 0 }
// APNs wants a fresh provider token at most hourly and at least every 20 minutes
function providerToken() {
  const now = Math.floor(Date.now() / 1000)
  if (jwt.token && now - jwt.at < 40 * 60) return jwt.token
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b64({ alg: 'ES256', kid: KEY_ID })}.${b64({ iss: TEAM_ID, iat: now })}`
  const sig = crypto.sign('sha256', Buffer.from(body), { key: KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  jwt = { token: `${body}.${sig}`, at: now }
  return jwt.token
}

const sessions = {}
function session(env) {
  const s = sessions[env]
  if (s && !s.closed && !s.destroyed) return s
  const fresh = http2.connect(HOSTS[env])
  fresh.on('error', () => {}) // a dropped connection is reopened on the next send
  fresh.unref()
  sessions[env] = fresh
  return fresh
}

function sendOne(device, payload, { collapseId, threadId } = {}) {
  return new Promise((resolve) => {
    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${device.token}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': TOPIC,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    }
    if (collapseId) headers['apns-collapse-id'] = collapseId
    if (threadId) payload.aps['thread-id'] = threadId
    let req
    try {
      req = session(device.env).request(headers)
    } catch {
      return resolve()
    }
    let status = 0
    let body = ''
    req.setTimeout(10000, () => req.close())
    req.on('response', (h) => (status = h[':status']))
    req.on('data', (d) => (body += d))
    req.on('end', async () => {
      // the app was deleted or the token is stale: stop sending to it
      if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(body))) {
        await q('DELETE FROM push_devices WHERE token = $1', [device.token]).catch(() => {})
      } else if (status !== 200) {
        console.warn(`push: ${status} ${body}`)
      }
      resolve()
    })
    req.on('error', () => resolve())
    req.end(JSON.stringify(payload))
  })
}

/**
 * Notifies every device a user has signed in on. `tab` tells the app where to open when the
 * notification is tapped (feed, friends, today). Never throws: a failed push mustn't fail the
 * request that caused it.
 */
export async function notify(userId, { title, body, tab, badge, collapseId, threadId }) {
  if (!pushEnabled) return
  try {
    const { rows } = await q('SELECT token, env FROM push_devices WHERE user_id = $1', [userId])
    const aps = { alert: { title, body }, sound: 'default' }
    if (badge != null) aps.badge = badge
    await Promise.all(rows.map((d) => sendOne(d, { aps: { ...aps }, tab }, { collapseId, threadId })))
  } catch (err) {
    console.warn('push:', err.message)
  }
}

/** Kudos on a day, summed up so several in a row replace each other: "alex and maya gave you kudos". */
export async function notifyKudos(ownerId, date) {
  if (!pushEnabled) return
  const { rows } = await q(
    `SELECT u.username FROM day_kudos k JOIN users u ON u.id = k.giver_id
      WHERE k.owner_id = $1 AND k.puzzle_date = $2 ORDER BY k.created_at DESC`,
    [ownerId, date]
  )
  if (!rows.length) return
  const names = rows.map((r) => r.username)
  const who = names.length <= 2 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`
  const { rows: unseen } = await q('SELECT count(*)::int AS n FROM day_kudos WHERE owner_id = $1 AND NOT seen', [ownerId])
  const day = date === todayISO() ? 'today' : 'your day'
  await notify(ownerId, {
    title: '👏 Kudos',
    body: `${who} gave you kudos for ${day}`,
    tab: 'feed',
    badge: unseen[0].n,
    collapseId: `kudos-${date}`,
    threadId: 'kudos',
  })
}

// ---------- the evening reminder ----------

// Once a day at REMINDER_HOUR Eastern: everyone with a device who hasn't posted a score today.
// The day is recorded in push_reminders so a restart doesn't send it twice.
async function remindIfDue() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  if (hour < REMINDER_HOUR) return
  const today = todayISO()
  const { rows: claimed } = await q(
    'INSERT INTO push_reminders (puzzle_date) VALUES ($1) ON CONFLICT DO NOTHING RETURNING puzzle_date',
    [today]
  )
  if (!claimed.length) return // already sent today
  const { rows } = await q(
    `SELECT DISTINCT d.user_id FROM push_devices d
      WHERE NOT EXISTS (SELECT 1 FROM submissions s WHERE s.user_id = d.user_id AND s.puzzle_date = $1)`,
    [today]
  )
  for (const r of rows) {
    await notify(r.user_id, {
      title: 'Still time to play',
      body: 'You haven’t posted a score today. Today’s puzzles reset at midnight.',
      tab: 'today',
      collapseId: `reminder-${today}`,
    })
  }
  console.log(`push: evening reminder sent to ${rows.length}`)
}

export function startReminders() {
  if (!pushEnabled) return
  const tick = () => remindIfDue().catch((err) => console.warn('push reminder:', err.message))
  setInterval(tick, 5 * 60 * 1000).unref()
  tick()
}
