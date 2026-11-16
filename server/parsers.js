import { clockToSeconds, secondsToClock, dateForPuzzle } from './util.js'

// Each game: metadata for the frontend tiles + a parse(text) that returns
// { puzzleNumber?, date?, metric, display } or null when the text isn't this game.
// `better`: 'lower' | 'higher'. `epoch`: date of puzzle #first (null = can't
// derive a date from the puzzle number, so no staleness check).
// `manual`: game also accepts a typed-in score (stored as unverified).
// `embed`: the site can be played in an iframe on thedailies.lol (checked 2026-10-26; NYT, LinkedIn,
// Krillion, EthnoGuessr, GeoGuessr, Plain and Perceptle refuse framing, and Worldle/Travle/Noillirk ask
// not to be framed).
// `category`: one of CATEGORIES (the Today page groups games by it, and each has its own daily
// crown and all-time standings).
// `paid`: { what, deals: [{ label, url|null }] } for games behind a subscription; the tile shows a $
// badge that opens these. Free-with-an-account games (GeoGuessr's daily) don't get one.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseLongDate(text) {
  // "Oct 25, 2026" / "October 25, 2026"
  const m = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (!m) return null
  const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  if (mi === -1) return null
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
}

// "October 26" with no year (MapTap, WorldGuessr): assume the current year in US Eastern
function yearlessDate(monthName, day) {
  const mi = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase())
  if (mi === -1) return null
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 4)
  return `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// GeoGuessr's share date: "2026/11/11" or "2026-11-11", or "11/11/2026" / "11.11.2026" in US or UK
// order. When both orders make a date, the one nearest today (US Eastern) wins.
function geoDate(s) {
  let m = s.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (m) return isoDate(m[1], m[2], m[3])
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (!m) return null
  const options = [isoDate(m[3], m[1], m[2]), isoDate(m[3], m[2], m[1])].filter(Boolean)
  const today = Date.parse(new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))
  options.sort((a, b) => Math.abs(Date.parse(a) - today) - Math.abs(Date.parse(b) - today))
  return options[0] ?? null
}
function isoDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function num(s) {
  return parseInt(String(s).replace(/,/g, ''), 10)
}

// A whole number written in any locale's style: "1,971", "1.971", "1 971" (a no-break or narrow
// space too) or "1'971". Games format their numbers with the player's device locale.
const INT = String.raw`\d{1,3}(?:[,.'\u00A0\u202F ]\d{3})+|\d+`
function localInt(s) {
  return parseInt(String(s).replace(/\D/g, ''), 10)
}

// Reading shares loosely. The smaller games keep changing the punctuation, emoji, words and line
// breaks around their results ("Plain #25 — ✈️ 6,120 m" became "Plain #26 ✈️ 4,158 m"; "Noillirk:
// The Daily Climb | No. 45 - 6,763m" became "Noillirk 🎈 The Daily Climb · No. 51 · 1,048m"), so a
// parser should only require what identifies the result: the game's name, its puzzle number a
// short way after the name ("#30", "No. 51", on the next line…), and the score's shape somewhere
// after that ("5,478 m", "262/500"). Anything else in between may change without breaking it.
//
// numbered(text, name): the puzzle number after the name (no digits in between), and the text
// after it, where the score is; null when the name or number isn't there.
// `bare`: the number may stand alone ("Wordle 1,971", "Immaculate Grid 1319"), in the device's
// number style.
function numbered(text, name, gap = 60, { bare = false } = {}) {
  const mark = bare ? '(?:#|\\bNo\\.?|\\bNº)?' : '(?:#|\\bNo\\.?|\\bNº)'
  const digits = bare ? `(${INT})` : '(\\d[\\d,]*)'
  const m = text.match(new RegExp(`${name}[^\\d]{0,${gap}}?${mark}\\s*${digits}`, 'iu'))
  if (!m) return null
  return { number: localInt(m[1]), rest: text.slice(m.index + m[0].length) }
}
// The first distance in the text, in meters: "5,478 m", "6 120m", "12 km"
function meters(text) {
  const m = text.match(new RegExp(`(${INT})\\s*(km|m)\\b`, 'i'))
  return m ? localInt(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1) : null
}
// The first "N/max" in the text (max optional): "262/500", "4 / 6"
function outOf(text, max = String.raw`\d[\d,]*`) {
  const m = text.match(new RegExp(`(${INT}|X|😛)\\s*\\/\\s*(${max})(?!\\d)`, 'iu'))
  return m ? { got: m[1], max: m[2] } : null
}
// The first number in the text
function firstInt(text) {
  const m = text.match(new RegExp(`(${INT})`))
  return m ? localInt(m[1]) : null
}

const SQUARES = new Set(['🟨', '🟩', '🟦', '🟪'])

function linkedinGame(id, name, emoji, color, url, epochDate, kind) {
  return {
    id, category: 'linkedin', name, emoji, color, url,
    metricLabel: kind === 'guesses' ? 'guesses' : 'time',
    better: 'lower',
    epoch: epochDate ? { date: epochDate, first: 1 } : null,
    dateTolerance: 3, // our LinkedIn epoch constants are best-effort
    manual: false,
    parse(text) {
      // "Queens #925 | 0:50 👑", "Mini Sudoku #457 | 1:20 ✏️": the name (spaces optional), the
      // number, then the first time (or "N guesses") anywhere after it
      const n = numbered(text, `\\b${name.replace(/\s+/g, '\\s*')}\\b`, 10)
      if (!n) return null
      if (kind === 'guesses') {
        const g = n.rest.match(/(\d+)\s*guess/i)
        if (!g) return null
        const guesses = num(g[1])
        return { puzzleNumber: n.number, metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
      }
      const t = n.rest.match(/(\d+:\d{2}(?::\d{2})?)/)
      if (!t) return null
      const secs = clockToSeconds(t[1])
      return { puzzleNumber: n.number, metric: secs, display: secondsToClock(secs) }
    },
  }
}

// Order is the default order of the groups on Today; players can collapse and reorder them.
// `symbol` is the SF Symbol the iPhone/Mac app shows, `emoji` what the website shows.
export const CATEGORIES = [
  { id: 'nyt', name: 'NYT Games', symbol: 'newspaper.fill', emoji: '📰' },
  { id: 'linkedin', name: 'LinkedIn', symbol: 'briefcase.fill', emoji: '💼' },
  { id: 'geography', name: 'Geography', symbol: 'globe.americas.fill', emoji: '🌍' },
  { id: 'words', name: 'Words & Trivia', symbol: 'textformat', emoji: '🔤' },
  { id: 'sports', name: 'Sports', symbol: 'sportscourt.fill', emoji: '🏅' },
]

// Immaculate Grid (sports-reference.com), one grid per sport (named "MLB Grid" etc. to fit a tile),
// each numbered from its own launch.
// Verified from sports-reference's code and a real baseball share (2026-10-28):
// "⚾️ Immaculate Grid 1305 0/9:\nRarity: 900\n⬜️⬜️⬜️…\nPlay at:\nhttps://…/immaculate-grid/play".
// Football is the same with 🏈 (and /play/football), men's basketball "🏀 Immaculate Grid (Men's)".
// Rarity adds each cell's pick rate, 100 for a missed cell, so 900 is nine misses and lower is
// rarer; ranked by cells right, then rarity: metric = correct × 1000 + (900 − rarity).
function immaculateGrid({ id, name, emoji, color, url, mens, epoch }) {
  return {
    id, category: 'sports', name, emoji, color, url, metricLabel: 'grid points', better: 'higher',
    epoch: { date: epoch, first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // "⚾️ Immaculate Grid 1319 6/9:"; the emoji says which sport (baseball and football titles
      // are otherwise the same), "(Men's)" / "(Women's)" which basketball
      const h = text.match(/(⚾|🏈|🏀|🏒)\uFE0F?[^\n]{0,6}?Immaculate Grid/iu)
      if (!h || h[1] !== emoji) return null
      const n = numbered(text.slice(h.index), 'Immaculate Grid', 20, { bare: true })
      if (!n) return null
      const label = text.slice(h.index, h.index + 40).match(/\((Men|Women)['’]?s\)/i)?.[1] ?? ''
      if (/women/i.test(label) || mens !== /men/i.test(label)) return null
      const s = outOf(n.rest, '9')
      if (!s || !/^\d$/.test(s.got)) return null
      const m = [null, null, null, n.number, s.got]
      // The header's N/9 also counts answers found later in Keep Guessing, which the grid shows as
      // ⬜️, so when the grid is there its 🟩 are the score.
      const cells = Array.from(text).filter((c) => c === '🟩' || c === '⬜')
      const correct = cells.length === 9 ? cells.filter((c) => c === '🟩').length : num(m[4])
      const r = text.match(/Rarity:\s*([\d,]+)/i)
      const rarity = r ? Math.min(900, num(r[1])) : 900
      return {
        puzzleNumber: num(m[3]),
        metric: correct * 1000 + (900 - rarity),
        display: `${correct}/9 · ${rarity}`,
      }
    },
  }
}

const BONUS_PAID = {
  what: 'Bonus puzzles are part of an NYT Games subscription (a few are free).',
  deals: [
    { label: 'Free if your school or workplace has an NYT pass (sign in with that email)', url: 'https://www.nytimes.com/passes' },
    { label: 'Intro offers, or split an All Access Family plan with up to 3 friends', url: 'https://www.nytimes.com/subscription/games' },
  ],
}
// An NYT bonus puzzle's share: its title, then "Bonus <Month D, YYYY>" (the week's drop date) close by
function bonusShare(text, title) {
  const head = text.match(new RegExp(title, 'i'))
  if (!head) return null
  const rest = text.slice(head.index + head[0].length)
  const date = parseLongDate(rest.slice(0, 50))
  return date ? { date, rest } : null
}

export const GAMES = [
  {
    id: 'worldle', category: 'geography', name: 'Worldle', emoji: '🗺️', color: '#AFE3C0',
    url: 'https://worldle.teuteuf.fr', metricLabel: 'guesses', better: 'lower',
    epoch: { date: '2022-01-22', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, 'Worldle')
      if (!n) return null
      // 😛 instead of the guesses: a lifesaver was used, so it counts as a miss
      const s = outOf(n.rest, '6')
      if (!s || !/^([1-6]|X|😛)$/i.test(s.got)) return null
      const miss = !/^[1-6]$/.test(s.got)
      const d = n.rest.match(/\((\d{2})\.(\d{2})\.(\d{4})\)/)
      const date = d ? `${d[3]}-${d[2]}-${d[1]}` : null
      return { puzzleNumber: n.number, date, metric: miss ? 7 : num(s.got), display: `${s.got.toUpperCase()}/6` }
    },
  },
  // NYT's weekly bonus puzzles (a new set every Wednesday, played from the Bonus Puzzles hub, part of
  // an NYT Games subscription). Each is on The Dailies one day a week (`bonusDay`), and only that
  // week's puzzle counts. Shares read "<title>\nBonus November 11, 2026\n\n…".
  {
    id: 'wordleinone', category: 'nyt', name: 'Wordle in 1', emoji: '1️⃣', color: '#D3EBC6',
    url: 'https://www.nytimes.com/games/bonus/hub', metricLabel: 'time', better: 'lower',
    // From a real share (2026-11-16) and nytimes.com's code: several Wordles, each to be solved in
    // one guess from the clues; a square per word (🟩 solved, 💡 revealed) and the total time when
    // the timer is on ("🟩🟩🟩🟩🟩 0:26"). Ranked by words revealed, then time: each 💡 adds an hour,
    // and no timer counts as the slowest.
    bonusDay: 2, epoch: null, dateTolerance: 6, manual: false, paid: BONUS_PAID,
    parse(text) {
      const b = bonusShare(text, 'Wordle\\s+in\\s+(?:1|one)\\b')
      if (!b) return null
      const solved = (b.rest.match(/🟩/gu) ?? []).length
      const revealed = (b.rest.match(/💡/gu) ?? []).length
      if (solved + revealed === 0) return null
      const t = b.rest.match(/(\d+:\d{2}(?::\d{2})?)/)
      const secs = t ? clockToSeconds(t[1]) : null
      return {
        date: b.date,
        metric: revealed * 3600 + (secs ?? 3599),
        display: `${solved}/${solved + revealed}${secs != null ? ` · ${secondsToClock(secs)}` : ''}`,
      }
    },
  },
  {
    id: 'connections3x3', category: 'nyt', name: 'Connections 3x3', emoji: '🟨', color: '#F1E2A6',
    url: 'https://www.nytimes.com/games/bonus/hub', metricLabel: 'mistakes', better: 'lower',
    // From a real share (2026-11-16) and nytimes.com's code: Connections with three groups of three,
    // a row of three squares per guess ("Connections 3x3\nBonus September 2, 2026\n\n🟨🟨🟨\n🟪🟪🟪\n🟦🟦🟦").
    bonusDay: 4, epoch: null, dateTolerance: 6, manual: false, paid: BONUS_PAID,
    parse(text) {
      const b = bonusShare(text, 'Connections\\s*3\\s*[x×]\\s*3')
      if (!b) return null
      let solved = 0
      let mistakes = 0
      for (const line of b.rest.split('\n')) {
        const cells = Array.from(line.trim()).filter((ch) => SQUARES.has(ch))
        if (cells.length !== 3) continue
        if (cells.every((c) => c === cells[0])) solved++
        else mistakes++
      }
      if (solved + mistakes === 0) return null
      const failed = solved < 3
      return {
        date: b.date,
        metric: failed ? 4 : mistakes,
        display: failed ? 'Failed' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`,
      }
    },
  },
  {
    id: 'wordle', category: 'nyt', name: 'Wordle', emoji: '🟩', color: '#C8E6B8',
    url: 'https://www.nytimes.com/games/wordle', metricLabel: 'guesses', better: 'lower',
    epoch: { date: '2021-06-19', first: 0 }, dateTolerance: 1, manual: false,
    parse(text) {
      // "Wordle 1,971 4/6*": the number in the device's style ("1.971", "1 971", "1'971")
      const n = numbered(text, '\\bWordle\\b', 10, { bare: true })
      if (!n) return null
      const s = n.rest.match(/^[^\n\d]{0,10}?([1-6X])\s*\/\s*6(\*)?/i)
      if (!s) return null
      const guesses = s[1].toUpperCase() === 'X' ? 7 : num(s[1])
      return { puzzleNumber: n.number, metric: guesses, display: `${s[1].toUpperCase()}/6${s[2] || ''}` }
    },
  },
  {
    id: 'connections', category: 'nyt', name: 'Connections', emoji: '🟪', color: '#D9C7F2',
    url: 'https://www.nytimes.com/games/connections', metricLabel: 'mistakes', better: 'lower',
    epoch: { date: '2023-06-12', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // "Connections\nPuzzle #1249" (or on one line), then one row of four squares per guess
      const n = numbered(text, '\\bConnections\\b', 20)
      if (!n) return null
      let solved = 0
      let mistakes = 0
      for (const line of n.rest.split('\n')) {
        const cells = Array.from(line.trim()).filter((ch) => SQUARES.has(ch))
        if (cells.length !== 4) continue
        if (cells.every((c) => c === cells[0])) solved++
        else mistakes++
      }
      if (solved + mistakes === 0) return null
      const failed = solved < 4
      return {
        puzzleNumber: n.number,
        metric: failed ? 5 : mistakes,
        display: failed ? 'Failed' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`,
      }
    },
  },
  {
    id: 'strands', category: 'nyt', name: 'Strands', emoji: '🧵', color: '#C5E4E7',
    url: 'https://www.nytimes.com/games/strands', metricLabel: 'hints', better: 'lower',
    // Real share 2026-10-27: "Strands #968\n“Who ya gonna call?”\n💡🔵💡🔵\n🟡🔵🔵💡\n🔵💡💡🔵"
    // (🔵 theme word, 🟡 spangram, 💡 a hint used). Fewer hints is better.
    epoch: { date: '2024-03-04', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, '\\bStrands\\b', 10)
      if (!n) return null
      const hints = Array.from(n.rest).filter((ch) => ch === '💡').length
      return {
        puzzleNumber: n.number,
        metric: hints,
        display: hints === 0 ? 'No hints' : `${hints} hint${hints === 1 ? '' : 's'}`,
      }
    },
  },
  {
    id: 'mini', category: 'nyt', name: 'The Mini', emoji: '✏️', color: '#BBD8F7',
    url: 'https://www.nytimes.com/crosswords/game/mini', metricLabel: 'time', better: 'lower',
    epoch: null, dateTolerance: 1, manual: false,
    paid: {
      what: 'Needs an NYT Games subscription (since Aug 2025).',
      deals: [
        { label: 'Free if your school or workplace has an NYT pass (sign in with that email)', url: 'https://www.nytimes.com/passes' },
        { label: 'Many public libraries give out free NYT access codes. Ask yours.', url: null },
        { label: 'Intro offers, or split an All Access Family plan with up to 3 friends', url: 'https://www.nytimes.com/subscription/games' },
      ],
    },
    parse(text) {
      // The share link: older mini.html?d=…&t=… or current shared/v2/mini-xwd.html?d=…&t=…&c=…
      // (t = solve time in seconds; parameters may come in any order)
      const link = text.match(/mini(?:-xwd)?\.html\?(\S+)/i)
      if (link) {
        const q = link[1].replace(/&amp;/g, '&')
        const d = q.match(/(?:^|&)d=(\d{4}-\d{2}-\d{2})/)
        const t = q.match(/(?:^|&)t=(\d+)/)
        if (d && t && num(t[1]) > 0 && num(t[1]) < 24 * 3600) {
          const secs = num(t[1])
          return { date: d[1], metric: secs, display: secondsToClock(secs) }
        }
      }
      const m = text.match(/Mini Crossword in (\d+:\d{2})/i)
      if (!m) return null
      const d = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      const date = d
        ? `${d[3]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`
        : parseLongDate(text)
      const secs = clockToSeconds(m[1])
      return { date, metric: secs, display: secondsToClock(secs) }
    },
  },

  linkedinGame('queens', 'Queens', '👑', '#F2D4A7', 'https://www.linkedin.com/games/queens', '2024-05-01', 'time'),
  linkedinGame('tango', 'Tango', '🌗', '#F7E8B0', 'https://www.linkedin.com/games/tango', '2024-10-08', 'time'),
  linkedinGame('zip', 'Zip', '🏁', '#F4C2C2', 'https://www.linkedin.com/games/zip', '2025-03-18', 'time'),
  linkedinGame('crossclimb', 'Crossclimb', '🪜', '#C9E8E5', 'https://www.linkedin.com/games/crossclimb', '2024-05-01', 'time'),
  // Epochs below derived from real shares on 2026-10-26 (Wend #140, Mini Sudoku #441,
  // Patches #223), so they're exact — no need for the factory's loose tolerance.
  { ...linkedinGame('wend', 'Wend', '🌀', '#CFE0F5', 'https://www.linkedin.com/games/wend', '2026-06-09', 'time'), dateTolerance: 1 },
  { ...linkedinGame('minisudoku', 'Mini Sudoku', '🧮', '#E6DCF5', 'https://www.linkedin.com/games/mini-sudoku', '2025-08-12', 'time'), dateTolerance: 1 },
  { ...linkedinGame('patches', 'Patches', '🧶', '#F5D0DC', 'https://www.linkedin.com/games/patches', '2026-03-18', 'time'), dateTolerance: 1 },
  {
    ...linkedinGame('pinpoint', 'Pinpoint', '📌', '#D4E6F7', 'https://www.linkedin.com/games/pinpoint', '2024-05-01', 'guesses'),
    parse(text) {
      const n = numbered(text, '\\bPinpoint\\b', 10)
      if (!n) return null
      const m = [null, n.number]
      const rest = n.rest
      // box format: "🤔 🤔 📌 ⬜ ⬜ (3/5)", or (X/5) for a miss
      const box = rest.match(/\(\s*([1-5X])\s*\/\s*5\s*\)/i)
      if (box) {
        if (box[1].toUpperCase() === 'X') return { puzzleNumber: m[1], metric: 6, display: 'Missed' }
        const guesses = num(box[1])
        return { puzzleNumber: m[1], metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
      }
      const g = rest.match(/(\d+)\s*guess/i)
      if (g) {
        const guesses = num(g[1])
        return { puzzleNumber: m[1], metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
      }
      // Fallback: position of 📌 among the five boxes ("📌 ⬜ ⬜ ⬜ ⬜")
      const row = rest.split('\n').find((l) => l.includes('📌'))
      if (row) {
        const cells = Array.from(row.trim()).filter((c) => c === '📌' || c === '⬜' || c === '🟦')
        const idx = cells.indexOf('📌')
        if (idx !== -1) return { puzzleNumber: m[1], metric: idx + 1, display: `${idx + 1} guess${idx === 0 ? '' : 'es'}` }
      }
      return { puzzleNumber: m[1], metric: 6, display: 'Missed' }
    },
  },

  {
    id: 'minutecryptic', category: 'words', name: 'Minute Cryptic', emoji: '🔍', color: '#DCCCF0',
    url: 'https://www.minutecryptic.com', embed: true, metricLabel: 'hints', better: 'lower',
    // Verified from a real share 2026-10-26: "Minute Cryptic - 26 October, 2026\n"<clue>" (4)\n
    // 🟣🟣🟣🟣🟣🟣🟣\n🏆 0 hints – 1 under the community par (...)". Par is the same for
    // everyone on a given day, so ranking by hints is equivalent to ranking vs par.
    epoch: null, dateTolerance: 1, manual: false,
    parse(text) {
      // "Minute Cryptic - 26 October, 2026" (or "October 26, 2026"), then "N hints" somewhere after
      const head = text.match(/Minute Cryptic(?!\s*Mini)/i)
      if (!head) return null
      const rest = text.slice(head.index + head[0].length)
      const top = rest.slice(0, 40)
      const dm = top.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}),?\s+(\d{4})/)
      const md = !dm && top.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/)
      const d = dm ? { day: dm[1], month: dm[2], year: dm[3] } : md ? { day: md[2], month: md[1], year: md[3] } : null
      if (!d) return null
      const mi = MONTHS.indexOf(d.month.slice(0, 3).toLowerCase())
      if (mi === -1) return null
      const h = rest.match(/(\d+)\s*hints?\b/i)
      if (!h) return null
      const hints = num(h[1])
      const par = rest.match(/(\d+)\s+(under|over)\s+(?:the\s+)?(?:community\s+)?par/i) || rest.match(/\b(at|on)\s+(?:the\s+)?(?:community\s+)?par/i)
      const vsPar = !par ? '' : par[1] === 'at' || par[1] === 'on' ? ' · par' : ` · ${par[2].toLowerCase() === 'under' ? '−' : '+'}${par[1]} par`
      return {
        date: `${d.year}-${String(mi + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
        metric: hints,
        display: `${hints} hint${hints === 1 ? '' : 's'}${vsPar}`,
      }
    },
  },

  {
    id: 'geoguessr', category: 'geography', name: 'GeoGuessr Daily', emoji: '🌍', color: '#B8E0C8',
    url: 'https://www.geoguessr.com/daily-challenges', metricLabel: 'points', better: 'higher',
    // From geoguessr.com's code (2026-11-11), its own share: "GeoGuessr Daily · 11/11/2026 · 18,234 🥈",
    // a row of squares per round (with "Show round details", "3,612 pts · …" under each), "Now it's
    // your turn! 👇", "www.geoguessr.com/dc/<code>". The date and number follow the account's
    // locale (11/11/2026 US or UK order, 2026/11/11); Platinum is "🌟 25,000 🌟". Older pastes came
    // from the GGShare extension ("Total: 18,234").
    epoch: null, dateTolerance: 1, manual: true,
    parse(text) {
      // "GeoGuessr Daily · 11/11/2026 · 18,234 🥈": the date near the name, then the first number
      // after the date is the total, whatever separators sit between
      const head = text.match(/GeoGuessr\s+Daily/i)
      if (head) {
        const rest = text.slice(head.index + head[0].length)
        const d = rest.slice(0, 30).match(/\d{4}[/.-]\d{1,2}[/.-]\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/)
        const total = d && firstInt(rest.slice(d.index + d[0].length))
        if (total != null) {
          const pts = Math.min(25000, total)
          return { date: geoDate(d[0]), metric: pts, display: `${pts.toLocaleString('en-US')} pts` }
        }
      }
      if (!/geoguessr/i.test(text)) return null
      const m = text.match(/total:?\s*([\d,]+)/i) || text.match(/([\d,]{3,6})\s*(?:points|pts)/i)
      if (!m) return null
      const pts = num(m[1])
      return { date: parseLongDate(text), metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
  {
    id: 'globle', category: 'geography', name: 'Globle', emoji: '🌎', color: '#A9D7B4',
    url: 'https://globle-game.com', embed: true, metricLabel: 'guesses', better: 'lower',
    epoch: null, dateTolerance: 1, manual: false,
    parse(text) {
      if (!/#globle/i.test(text) && !/globle-game\.com/i.test(text)) return null
      // "Today's guesses: 7" (new) or the "🟧🟥🟩 = 6" line (old);
      // never "Avg. Guesses: 9.1" — the (?!\.) guard rejects decimals
      const m =
        text.match(/today'?s guesses:?\s*(\d+)/i) ||
        text.match(/=\s*(\d+)\s*$/m) ||
        text.match(/(?<!avg\W{0,3})guesses:?\s*=?\s*(\d+)(?!\.)/i)
      if (!m) return null
      const guesses = num(m[1])
      return { date: parseLongDate(text), metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
    },
  },
  {
    id: 'travle', category: 'geography', name: 'Travle', emoji: '🧭', color: '#F2C7A7',
    url: 'https://travle.earth', metricLabel: 'extra guesses', better: 'lower',
    // From travle.earth's code (2026-11-11): "#travle #1428 (hard mode) +2 (Perfect)", tags in any
    // order after the number, "(3 away)" for a miss. The main game's #1 was 2022-12-15; regional
    // variants (#travle_usa, #travle_gbr, …) are numbered from their own launches, so they get no
    // date check.
    epoch: { date: '2022-12-15', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const m = text.match(/#?travle(_[a-z]+)?[^\d\n]{0,10}?#\s*([\d,]+)([^\n]*)/i)
      if (!m) return null
      const puzzleNumber = m[1] ? undefined : num(m[2])
      const tail = m[3]
      const plus = tail.match(/\+(\d+)/)
      if (plus) {
        const extra = num(plus[1])
        const perfect = /perfect/i.test(tail)
        return { puzzleNumber, metric: extra, display: perfect ? 'Perfect' : `+${extra}` }
      }
      const away = tail.match(/\((\d+)\s*away\)/i)
      const dist = away ? num(away[1]) : 1
      return { puzzleNumber, metric: 20 + dist, display: 'DNF' }
    },
  },

  {
    id: 'chainle', category: 'words', name: 'Chainle', emoji: '🔗', color: '#C9E4F2',
    url: 'https://chainle.io', embed: true, metricLabel: 'points', better: 'higher',
    // Verified from a real share 2026-10-28: "Chainle #70 · 3,560 🔗\nBeat 59% of players\n🟩🟥🟨🟧🟩\n
    // https://chainle.io". From chainle.io's own code: each round (one square) is worth up to
    // 1,000 points (🟩 90%+, 🟨 60%+, 🟧 30%+, 🟥 less) and #1 was 2026-08-20. Its "today" comes
    // from its server, hence the day's tolerance. Unlimited and archive plays have no number.
    epoch: { date: '2026-08-20', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // unlimited and archive plays say "Chainle Unlimited" or have no number
      const n = numbered(text, 'Chainle', 20)
      if (!n) return null
      const points = firstInt(n.rest)
      if (points == null) return null
      return { puzzleNumber: n.number, metric: points, display: points.toLocaleString('en-US') }
    },
  },

  {
    id: 'perceptle', category: 'words', name: 'Perceptle', emoji: '👁️', color: '#E2D9F6',
    url: 'https://perceptle.com', metricLabel: 'points', better: 'higher',
    // Verified from a real share 2026-10-28: "Perceptle #103 - F (31)\n🔢 0  🎯 1  📐 45  🥁 10  ✂️ 100\n
    // https://perceptle.com". From perceptle.com's own code: five tests each 0-100, the score is
    // their average (grades S 95+, A 85+, B 70+, C 55+, D 40+, F), #1 was 2026-07-18, and Fridays
    // add 🃏 after the number.
    epoch: { date: '2026-07-18', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, 'Perceptle')
      if (!n) return null
      const s = n.rest.match(/\((\d{1,3})\)/)
      if (!s) return null
      const score = num(s[1])
      const grade = n.rest.slice(0, s.index).match(/\b([SABCDF])\b/)
      return { puzzleNumber: n.number, metric: score, display: grade ? `${score} · ${grade[1]}` : `${score}` }
    },
  },

  {
    id: 'sizeitup', category: 'words', name: 'Size It Up', emoji: '📏', color: '#F4CFC9',
    url: 'https://magnitudle.com/size-it-up', embed: true, metricLabel: 'points', better: 'higher',
    // Verified from real shares and magnitudle.com's own code (buildGameSharePayload). Since
    // 2026-11-03: "Magnitudle — Size It Up\n2026-11-03\n\nScore: 250/500", five rows of 🟥/⬜ with each
    // round's 0-100, the link. The Geography and Pop Culture editions ("Size It Up: Geography") are
    // other puzzles, and Unlimited and Practice add " · Unlimited" to the date line, so none of those
    // match. Before that (2026-10-30) the share was "Size It Up\nOverall Score 222", with no date.
    epoch: null, dateTolerance: 1, manual: false,
    parse(text) {
      // not the other editions ("Size It Up: Geography", "Size It Up: Pop Culture") or Unlimited,
      // Practice and archive plays (a note line at the end since 2026-11-16, on the date line before)
      const head = text.match(/Size It Up(?!\s*:)/i)
      if (!head || /\b(unlimited|practice|archive)\b/i.test(text)) return null
      const rest = text.slice(head.index + head[0].length)
      const top = rest.slice(0, 40)
      const date = top.match(/(\d{4}-\d{2}-\d{2})/)
      const number = top.match(/#\s*(\d+)/)
      const s = outOf(rest)
      if (s && (date || number)) {
        const pts = localInt(s.got)
        return { puzzleNumber: number ? num(number[1]) : undefined, date: date ? date[1] : null, metric: pts, display: `${pts} pts` }
      }
      const old = rest.match(/^\s*Overall Score\s+([\d,]+)/i)
      if (!old) return null
      const pts = num(old[1])
      return { metric: pts, display: `${pts} pts` }
    },
  },
  {
    id: 'plain', category: 'words', name: 'Plain', emoji: '✈️', color: '#CFE3F5',
    url: 'https://playplain.app/play', metricLabel: 'meters', better: 'higher',
    // Verified from a real share 2026-11-03 ("Plain #17 — ✈️ 4,558 m", one dot per round, the Golden
    // round, "Top 63% today", a challenge link) and playplain.app's own code: puzzle #1 is
    // PUZZLE_EPOCH_DATE 2026-10-18, days count in UTC, and the best possible flight is 10,000 m.
    // It refuses framing (X-Frame-Options: DENY), so Play opens a new tab on the website.
    epoch: { date: '2026-10-18', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, '\\bPlain\\b', 20)
      if (!n) return null
      const m = meters(n.rest)
      if (m == null) return null
      return { puzzleNumber: n.number, metric: m, display: `${m.toLocaleString('en-US')} m` }
    },
  },
  {
    id: 'noillirk', category: 'words', name: 'Noillirk', emoji: '🧗', color: '#C9E6F2',
    url: 'https://playdaily.org/noillirk', metricLabel: 'meters', better: 'higher',
    // Verified from real shares: 2026-11-04 "Noillirk daily #39 - 3,913m" (10 m a point then), and
    // since about 2026-11-10 "Noillirk: The Daily Climb | No. 45 - 6,763m" (playdaily.org's code and
    // help: 7 prompts worth up to 100 points, 20 m a point, a perfect climb 14 km). Daily #1 was
    // 2026-09-27 and it resets at midnight UTC. Only the daily counts: Classic and Endless shares say
    // "The Classic Climb" / "The Endless Climb" and have no number. Framed by another site it puts up
    // a "Play on the official site" card, so Play opens a new tab on the website.
    epoch: { date: '2026-09-27', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // only the daily has a number ("No. 51", "daily #39"); Classic and Endless shares don't
      const n = numbered(text, 'Noillirk')
      if (!n) return null
      const m = meters(n.rest)
      if (m == null) return null
      return { puzzleNumber: n.number, metric: m, display: `${m.toLocaleString('en-US')} m` }
    },
  },
  {
    id: 'poople', category: 'words', name: 'Poople', emoji: '💩', color: '#E8D3BE',
    url: 'https://poople.io', embed: true, metricLabel: 'extra guesses', better: 'lower',
    // Verified from a real share 2026-10-30: "Poople #442 15/6", one row per word (🟫 a letter
    // matching POOP, ⬜ not), then "https://poople.io/". From poople.io's own code: change one letter
    // at a time until the word is POOP; 15 is the guesses used and 6 the shortest path, so the metric
    // is the extra guesses (its own stats average the same). #1 was 2025-08-15; it resets 08:00 UTC.
    epoch: { date: '2025-08-15', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, 'Poople')
      if (!n) return null
      const s = outOf(n.rest)
      if (!s || !/^\d+$/.test(s.got)) return null
      const used = num(s.got)
      const best = num(s.max)
      return { puzzleNumber: n.number, metric: Math.max(0, used - best), display: `${used}/${best}` }
    },
  },

  {
    id: 'dailytens', category: 'words', name: 'Daily Tens', emoji: '🔟', color: '#F6E3A9',
    url: 'https://dailytens.com', embed: true, metricLabel: 'answers', better: 'higher',
    // Verified from a real share 2026-10-28 ("DailyTens #905", then five rows of two cells,
    // "https://dailytens.com/?ref=…") and dailytens.com's own code: name all ten entries on a top-10
    // list before five wrong guesses; 🏆 is an entry found, ❌ one missed. Numbers run daily from
    // #905 on 2026-10-28. Archive plays link to /archive/<date>, so they don't count for today.
    epoch: { date: '2024-05-07', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, 'Daily\\s*Tens', 10)
      if (!n || /dailytens\.com\/archive\//i.test(text)) return null
      const found = (n.rest.match(/🏆/g) ?? []).length
      const missed = (n.rest.match(/❌/g) ?? []).length
      if (found + missed !== 10) return null
      return { puzzleNumber: n.number, metric: found, display: `${found}/10` }
    },
  },

  {
    id: 'eraly', category: 'words', name: 'Eraly', emoji: '⏳', color: '#EBD9B9',
    url: 'https://eraly.io', embed: true, metricLabel: 'points', better: 'higher',
    // Verified from a real share 2026-11-10 ("Eraly #26 · I travelled to 1582 AD\n▰▰▰▰▱▱▱▱▱▱ 295/700\n
    // 🟦🟨🟥🟧🟧🟥🟧\nhttps://eraly.io") and eraly.io's own code: seven moments in history, guess each
    // year for 100 (exact), 85, 60, 30 or 10 points; the squares are those bands. #1 was 2026-10-16
    // (LAUNCH, in the player's own day). Archive plays say "(Archive)", so they don't count; a 🎃
    // after the number is the Halloween puzzle. No framing headers, and it loads in an iframe.
    epoch: { date: '2026-10-16', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, 'Eraly', 20)
      if (!n || /^\s*\(Archive\)/i.test(n.rest)) return null
      const s = outOf(n.rest, '700')
      if (!s) return null
      const points = localInt(s.got)
      if (!(points <= 700)) return null
      return { puzzleNumber: n.number, metric: points, display: `${points}/700` }
    },
  },

  {
    id: 'costcodle', category: 'words', name: 'Costcodle', emoji: '🛒', color: '#F4B8B8',
    url: 'https://costcodle.com', embed: true, metricLabel: 'guesses', better: 'lower',
    // From costcodle.com's own code (2026-11-11): since V2 (2026-11-10) the guess-the-price game is
    // "Classic" ("Costcodle Classic #1149 3/6", rows of ⬆️/⬇️/✅, "Play now at https://www.costcodle.com")
    // and the default tab is a new mode, "Costcodle Checkout #N", which isn't this game. Numbers run
    // daily: 2023-09-21 is #2. Older shares had no "Classic".
    epoch: { date: '2023-09-20', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // Checkout ("Costcodle Checkout #2", five prices) is another game
      if (/Costcodle\s+Checkout/i.test(text)) return null
      const n = numbered(text, 'Costcodle', 20)
      if (!n) return null
      const s = outOf(n.rest, '6')
      if (!s || !/^([1-6]|X)$/i.test(s.got)) return null
      const guesses = s.got.toUpperCase() === 'X' ? 7 : num(s.got)
      return { puzzleNumber: n.number, metric: guesses, display: `${s.got.toUpperCase()}/6` }
    },
  },
  {
    id: 'fermi', category: 'words', name: 'Fermi', emoji: '🔢', color: '#E3C9F0',
    url: 'https://fermi.gg', embed: true, metricLabel: 'avg multiple', better: 'lower',
    // Verified live 2026-10-26: "Fermi · No. 92\n01  1.56×\n...\n1.19× score · top 3%"
    epoch: { date: '2026-07-27', first: 1 }, dateTolerance: 1, manual: true,
    parse(text) {
      if (!/fermi/i.test(text)) return null
      const n = text.match(/No\.?\s*0*(\d+)/i)
      // the overall score line ("1.19× score · top 3%"), never a per-question multiple; 1,000× and up
      // has a thousands comma
      const s = text.match(/([\d.,]+)\s*[x×]\s*score/i)
      if (!s) return null
      const mult = parseFloat(s[1].replace(/,/g, ''))
      if (Number.isNaN(mult)) return null
      return { puzzleNumber: n ? num(n[1]) : undefined, metric: mult, display: `${mult}×` }
    },
  },
  {
    id: 'maptap', category: 'geography', name: 'MapTap', emoji: '📍', color: '#F7D9B8',
    url: 'https://maptap.gg', embed: true, metricLabel: 'points', better: 'higher',
    // Verified live 2026-10-26: "www.maptap.gg October 26\n75🤗 69😁 ...\nFinal score: 457". From
    // maptap.gg's code (2026-11-11) the first word is "www.maptap.gg", "https://maptap.gg" or "MapTap"
    // (link hidden). Only the daily starts that way: a player's map ("<title> by <author>", a
    // /m/<id> link) and best-of rounds ("?bestof=") have no date line and don't count.
    epoch: null, dateTolerance: 1, manual: true,
    parse(text) {
      const h = text.match(/(?:^|\n)\s*(?:(?:https?:\/\/)?(?:www\.)?maptap\.gg|MapTap)\s+([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)/i)
      if (!h || /maptap\.gg\/m\/|bestof=/i.test(text)) return null
      const m = text.match(/final score:?\s*([\d,]+)/i)
      if (!m) return null
      const pts = num(m[1])
      // the date has no year ("October 26"): assume the current year
      return { date: yearlessDate(h[1], h[2]), metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
  {
    id: 'krillion', category: 'words', name: 'Krillion', emoji: '🐳', color: '#B8D4F0',
    url: 'https://krillion.io', metricLabel: 'score', better: 'higher',
    // Verified live 2026-10-26: "Krillion #103 🦐\n365\n\n🏮🦑🫧🐟🦑🦑🦑"; by 2026-11-11 krillion.io's
    // code puts it on one line, "Krillion #119 🦐 365  🏮🦑…" (then "  https://krillion.io" if the
    // player keeps the link on). The score comes right after the number and the shrimp. Archive
    // ("Krillion ⟲ #") and unlimited ("Krillion ∞ #") plays don't match.
    epoch: { date: '2026-07-16', first: 1 }, dateTolerance: 1, manual: true,
    parse(text) {
      // archive ("Krillion ⟲ #") and unlimited ("Krillion ∞ #") plays don't count
      if (/Krillion\s*[⟲∞]/u.test(text)) return null
      const n = numbered(text, 'Krillion', 20)
      if (!n) return null
      const v = firstInt(n.rest)
      if (v == null) return null
      return { puzzleNumber: n.number, metric: v, display: `${v.toLocaleString()}` }
    },
  },
  {
    id: 'timeguessr', category: 'geography', name: 'TimeGuessr', emoji: '⏳', color: '#F2E1B8',
    url: 'https://timeguessr.com/play?mode=daily', metricLabel: 'points', better: 'higher',
    // Real share 2026-10-27: "TimeGuessr #1245 — 28,325/50,000\n\n1️⃣ 🏆779 · 📅 48y · 🌍 2500.1mi ..."
    epoch: { date: '2026-10-27', first: 1245 }, dateTolerance: 1, manual: false,
    parse(text) {
      // only the daily has a number ("TimeGuessr 28,325/50,000" is another mode)
      const n = numbered(text, 'TimeGuessr', 20)
      if (!n) return null
      const s = outOf(n.rest, '50,?000')
      if (!s) return null
      const pts = localInt(s.got)
      return { puzzleNumber: n.number, metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
  {
    id: 'worldguessr', category: 'geography', name: 'WorldGuessr', emoji: '🗺️', color: '#BFE3D0',
    url: 'https://www.worldguessr.com/daily', metricLabel: 'points', better: 'higher',
    // Real share 2026-10-27: "My WorldGuessr Daily Score · Oct 27\n6280 / 15000  ·  Beat 43% players
    // worldwide\n🔴🟡🟢\nhttps://www.worldguessr.com/daily". The date has no year.
    epoch: null, dateTolerance: 1, manual: false,
    parse(text) {
      if (!/worldguessr/i.test(text)) return null
      const m = text.match(/([\d,]+)\s*\/\s*15,?000/) || text.match(/([\d,]+)\s*\/\s*([\d,]+)/)
      if (!m) return null
      const pts = num(m[1])
      // the date is in the device's style: "Nov 11" (US) or "11 Nov" (UK and most others)
      const md = text.match(/Daily Score\s*[·•-]?\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)/i)
      const dm = !md && text.match(/Daily Score\s*[·•-]?\s*(\d{1,2})\.?\s+([A-Za-z]{3,9})\b/i)
      const date = md ? yearlessDate(md[1], md[2]) : dm ? yearlessDate(dm[2], dm[1]) : null
      return { date, metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
  immaculateGrid({
    id: 'gridmlb', name: 'MLB Grid', emoji: '⚾', color: '#D6E4F5',
    url: 'https://www.sports-reference.com/immaculate-grid/play', mens: false, epoch: '2023-04-03', // #1305 on 2026-10-28
  }),
  immaculateGrid({
    id: 'gridnfl', name: 'NFL Grid', emoji: '🏈', color: '#DCEBD2',
    url: 'https://www.sports-reference.com/immaculate-grid/play/football', mens: false, epoch: '2023-07-20', // #1197 on 2026-10-28
  }),
  immaculateGrid({
    id: 'gridnba', name: 'NBA Grid', emoji: '🏀', color: '#F7D9C2',
    url: 'https://www.sports-reference.com/immaculate-grid/play/basketball/mens', mens: true, epoch: '2023-07-25', // #1192 on 2026-10-28
  }),

  {
    id: 'poeltl', category: 'sports', name: 'Poeltl', emoji: '⛹️', color: '#F3E1B5',
    url: 'https://poeltl.nbpa.com', metricLabel: 'guesses', better: 'lower',
    // Verified from a real share 2026-10-28: "Poeltl #1707 | X/8 | 00:00:38" and a grid of rows.
    // Guess the NBA player in 8; X is a miss (→ 9). Puzzle numbers run daily: #1707 on 2026-10-28.
    epoch: { date: '2022-02-25', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const n = numbered(text, 'Poeltl', 20) ?? (() => { const m = text.match(/Poeltl\s+(\d+)\s*\|/i); return m && { number: num(m[1]), rest: text.slice(m.index + m[0].length) } })()
      if (!n) return null
      const s = outOf(n.rest, '8')
      if (!s || !/^([1-8]|X)$/i.test(s.got)) return null
      const miss = s.got.toUpperCase() === 'X'
      return { puzzleNumber: n.number, metric: miss ? 9 : num(s.got), display: `${s.got.toUpperCase()}/8` }
    },
  },
  {
    id: 'dailyholes', category: 'sports', name: 'Daily Holes', emoji: '⛳', color: '#CFE8C9',
    url: 'https://dailyholes.com', embed: true, metricLabel: 'to par', better: 'lower',
    // Verified from a real share 2026-11-04 ("Daily Holes — Round #308\nGorsecombe Common · +5 (42)",
    // a square per hole, longest drive, the beat-my-score link) and dailyholes.com's own code: a new
    // nine at midnight New York time, round #1 was 2026-01-01; the score is strokes against the
    // course's par ("E" for level). Practice and Wild Three shares have no "Round #", so don't count.
    epoch: { date: '2026-01-01', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // "Daily Holes — Round #315 · ON FIRE\nBriarwood Links · +2 (38)": practice and Wild Three
      // shares have no round number
      const n = numbered(text, 'Daily Holes', 30)
      if (!n) return null
      const m = n.rest.match(/([+\-−]?\d+|\bE)\s*\((\d+)\)/i)
      if (!m) return null
      const toPar = /^e$/i.test(m[1]) ? 0 : Number(m[1].replace('−', '-'))
      const shown = toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : String(toPar)
      return { puzzleNumber: n.number, metric: toPar, display: `${shown} (${m[2]})` }
    },
  },

  {
    id: 'ethnoguessr', category: 'geography', name: 'EthnoGuessr', emoji: '🧬', color: '#D8D3F2',
    url: 'https://hbd.gg/play/', metricLabel: 'avg points', better: 'higher',
    // Verified from a real share 2026-10-26: "I scored an average of 1133 over 10 rounds
    // in today's EthnoGuessr! Can you beat my score of 3002 points on round 4? ..."
    // The score is the 10-round AVERAGE, not the bragged best round.
    epoch: null, dateTolerance: null, manual: true,
    parse(text) {
      if (!/ethnoguessr/i.test(text)) return null
      // only the average: any other number in the text is the best round (or a different game)
      const avg = text.match(/average of ([\d,]+)/i)
      if (!avg) return null
      const pts = num(avg[1])
      return { metric: pts, display: `${pts.toLocaleString()} avg` }
    },
  },
]

// Points (server/points.js): each result is worth 0-100. `perfect` scores 100, `par` (a typical
// result for the game itself, not for any group) 50 and `zero` or worse 0, on a curve that costs
// little near perfect and more further away. Values are in the game's metric (times in seconds).
// `failAt`: the metric from which a result is a fail, so the scoring table can say "Failed".
// Admins can override perfect/par/zero (game_scoring table); new values only affect new scores.
const SCORING = {
  wordle: { perfect: 1, par: 4, zero: 7, failAt: 7 },
  worldle: { perfect: 1, par: 3, zero: 7, failAt: 7 },
  costcodle: { perfect: 1, par: 4, zero: 7, failAt: 7 },
  // five rounds of up to 1,000; 3,560 beat 59% of players on #70, so a typical day is ~3,300
  chainle: { perfect: 5000, par: 3300, zero: 1000 },
  // five rounds of 0-100; a real day was 222 (rounds 31, 67, 2, 35, 87)
  sizeitup: { perfect: 450, par: 250, zero: 50 },
  // meters of a 10,000 m best; a real day was 4,558 m, "Top 63% today"
  plain: { perfect: 9000, par: 5000, zero: 1000 },
  // 20 m a point since 2026-11-10 (a perfect daily is 14 km); scores before then were on half the scale
  noillirk: { perfect: 14000, par: 7000, zero: 1000 },
  // guesses beyond the shortest path; the best is 0, a few extra is a typical day
  poople: { perfect: 0, par: 4, zero: 15 },
  // entries found out of 10
  dailytens: { perfect: 10, par: 6, zero: 0 },
  // seven rounds of 10-100; most days land around 250-350, 600+ is a near-perfect run, 70 is every guess far off
  eraly: { perfect: 600, par: 300, zero: 70 },
  // the average of five 0-100 tests; S is 95+, C (55) a middling day
  perceptle: { perfect: 95, par: 55, zero: 10 },
  // guesses out of 8, a miss is 9
  poeltl: { perfect: 1, par: 5, zero: 9, failAt: 9 },
  // strokes against the nine's par; a real day was +5
  dailyholes: { perfect: -5, par: 3, zero: 15 },
  // cells right × 1000 + (900 − rarity): 9/9 at rarity 100 is 9,800; 5/9 at 500 is 5,400; 0/9 is 0
  gridmlb: { perfect: 9800, par: 5400, zero: 0 },
  gridnfl: { perfect: 9800, par: 5400, zero: 0 },
  gridnba: { perfect: 9800, par: 5400, zero: 0 },
  pinpoint: { perfect: 1, par: 3, zero: 6, failAt: 6 },
  connections: { perfect: 0, par: 1.5, zero: 4, failAt: 4 },
  strands: { perfect: 0, par: 1, zero: 6 },
  minutecryptic: { perfect: 0, par: 1, zero: 5 },
  travle: { perfect: 0, par: 2, zero: 8, failAt: 21 },
  globle: { perfect: 1, par: 8, zero: 25 },
  fermi: { perfect: 1, par: 1.6, zero: 4 },
  mini: { perfect: 20, par: 45, zero: 180 },
  // total seconds for the week's words (+1 h per word revealed); a real run was 0:26
  wordleinone: { perfect: 15, par: 60, zero: 600 },
  connections3x3: { perfect: 0, par: 1, zero: 3, failAt: 4 },
  queens: { perfect: 5, par: 30, zero: 180 },
  tango: { perfect: 13, par: 30, zero: 180 },
  zip: { perfect: 3, par: 10, zero: 120 },
  crossclimb: { perfect: 15, par: 45, zero: 180 },
  minisudoku: { perfect: 20, par: 90, zero: 360 },
  patches: { perfect: 6, par: 30, zero: 120 },
  wend: { perfect: 10, par: 45, zero: 180 },
  maptap: { perfect: 1000, par: 600, zero: 0 },
  geoguessr: { perfect: 25000, par: 12500, zero: 0 },
  timeguessr: { perfect: 50000, par: 25000, zero: 0 },
  worldguessr: { perfect: 15000, par: 6500, zero: 0 },
  ethnoguessr: { perfect: 5000, par: 1500, zero: 0 },
  krillion: { perfect: 1000, par: 300, zero: 0 },
}
for (const game of GAMES) game.scoring = SCORING[game.id]

export const gameById = Object.fromEntries(GAMES.map((g) => [g.id, g]))

export function detect(text) {
  for (const game of GAMES) {
    try {
      const parsed = game.parse(text)
      if (parsed) return { game, parsed }
    } catch {
      // a malformed variant of one game shouldn't block the others
    }
  }
  return null
}

export function expectedDate(game, parsed) {
  if (parsed.date) return parsed.date
  if (parsed.puzzleNumber != null && game.epoch) {
    return dateForPuzzle(game.epoch.date, parsed.puzzleNumber, game.epoch.first)
  }
  return null
}
