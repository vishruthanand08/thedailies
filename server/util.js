// Each player's day rolls over at midnight where they are: their time zone comes from their
// browser or app (the X-Timezone header, saved on their account by requireAuth). US Eastern is
// the fallback for anyone the server hasn't heard a zone from yet (it matches NYT).
export const TZ = 'America/New_York'

const zoneOK = new Map()
export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  if (!zoneOK.has(tz)) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      zoneOK.set(tz, true)
    } catch {
      zoneOK.set(tz, false)
    }
  }
  return zoneOK.get(tz)
}

// Today's date (ISO) in a time zone; Eastern when it's missing or not a real zone.
export function todayISO(tz = TZ) {
  return new Date().toLocaleDateString('en-CA', { timeZone: isValidTimeZone(tz) ? tz : TZ })
}

// The hour (0-23) right now in a time zone.
export function hourIn(tz = TZ) {
  const zone = isValidTimeZone(tz) ? tz : TZ
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
}

// Date (ISO) of puzzle number `n`, given the date of puzzle #firstNumber.
export function dateForPuzzle(epochISO, n, firstNumber = 1) {
  const d = new Date(epochISO + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + (n - firstNumber))
  return d.toISOString().slice(0, 10)
}

export function daysApart(aISO, bISO) {
  const a = new Date(aISO + 'T12:00:00Z')
  const b = new Date(bISO + 'T12:00:00Z')
  return Math.round(Math.abs(a - b) / 86400000)
}

// "0:23" | "1:02:03" -> seconds
export function clockToSeconds(s) {
  const parts = s.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

export function secondsToClock(total) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function isValidISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
}
