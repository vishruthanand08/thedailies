// All daily boards roll over on US Eastern time (matches NYT).
export const TZ = 'America/New_York'

export function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
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
