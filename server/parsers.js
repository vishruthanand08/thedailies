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
      const re = new RegExp(`(?:^|\\n)\\s*${name}\\s+#([\\d,]+)\\s*(?:\\|\\s*([^\\n]*))?`, 'i')
      const m = text.match(re)
      if (!m) return null
      const rest = m[2] || text
      if (kind === 'guesses') {
        const g = rest.match(/(\d+)\s*guess/i) || text.match(/(\d+)\s*guess/i)
        if (!g) return null
        const guesses = num(g[1])
        return { puzzleNumber: num(m[1]), metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
      }
      const t = rest.match(/(\d+:\d{2}(?::\d{2})?)/) || text.match(/(\d+:\d{2}(?::\d{2})?)/)
      if (!t) return null
      const secs = clockToSeconds(t[1])
      return { puzzleNumber: num(m[1]), metric: secs, display: secondsToClock(secs) }
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
      const m = text.match(/(⚾|🏈|🏀)\uFE0F?\s*Immaculate Grid\s*(\((?:Men|Women)['’]?s\))?\s*#?(\d+)\s+(\d)\s*\/\s*9/i)
      if (!m) return null
      // the emoji says which sport (baseball and football titles are otherwise the same)
      if (m[1] !== emoji) return null
      const label = m[2] ?? ''
      if (/women/i.test(label) || mens !== /men/i.test(label)) return null
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

export const GAMES = [
  {
    id: 'worldle', category: 'geography', name: 'Worldle', emoji: '🗺️', color: '#AFE3C0',
    url: 'https://worldle.teuteuf.fr', metricLabel: 'guesses', better: 'lower',
    epoch: { date: '2022-01-22', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      // 😛 instead of the guesses: a lifesaver was used, so it counts as a miss
      const m = text.match(new RegExp(`#Worldle\\s+#(${INT})\\s*(?:\\((\\d{2})\\.(\\d{2})\\.(\\d{4})\\))?\\s+([1-6X]|😛)\\s*\\/\\s*6`, 'iu'))
      if (!m) return null
      const miss = !/^[1-6]$/.test(m[5])
      const date = m[2] ? `${m[4]}-${m[3]}-${m[2]}` : null
      return { puzzleNumber: localInt(m[1]), date, metric: miss ? 7 : num(m[5]), display: `${m[5].toUpperCase()}/6` }
    },
  },
  {
    id: 'wordle', category: 'nyt', name: 'Wordle', emoji: '🟩', color: '#C8E6B8',
    url: 'https://www.nytimes.com/games/wordle', metricLabel: 'guesses', better: 'lower',
    epoch: { date: '2021-06-19', first: 0 }, dateTolerance: 1, manual: false,
    parse(text) {
      // the number is in the device's style: "1,971", "1.971", "1 971", "1'971"
      const m = text.match(new RegExp(`(?:^|\\s)Wordle\\s+#?(${INT})\\s+([1-6X])\\s*\\/\\s*6(\\*)?`, 'i'))
      if (!m) return null
      const guesses = m[2].toUpperCase() === 'X' ? 7 : num(m[2])
      return { puzzleNumber: localInt(m[1]), metric: guesses, display: `${m[2].toUpperCase()}/6${m[3] || ''}` }
    },
  },
  {
    id: 'connections', category: 'nyt', name: 'Connections', emoji: '🟪', color: '#D9C7F2',
    url: 'https://www.nytimes.com/games/connections', metricLabel: 'mistakes', better: 'lower',
    epoch: { date: '2023-06-12', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const m = text.match(/Connections\s*\n\s*Puzzle\s+#([\d,]+)/i)
      if (!m) return null
      let solved = 0
      let mistakes = 0
      for (const line of text.split('\n')) {
        const cells = Array.from(line.trim()).filter((ch) => SQUARES.has(ch))
        if (cells.length !== 4) continue
        if (cells.every((c) => c === cells[0])) solved++
        else mistakes++
      }
      const failed = solved < 4
      return {
        puzzleNumber: num(m[1]),
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
      const m = text.match(/(?:^|\n)\s*Strands\s+#([\d,]+)/i)
      if (!m) return null
      const hints = Array.from(text).filter((ch) => ch === '💡').length
      return {
        puzzleNumber: num(m[1]),
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
      const m = text.match(/(?:^|\n)\s*Pinpoint\s+#([\d,]+)/i)
      if (!m) return null
      // box format: "🤔 🤔 📌 ⬜ ⬜ (3/5)", or (X/5) for a miss
      const box = text.match(/\(\s*([1-5X])\s*\/\s*5\s*\)/i)
      if (box) {
        if (box[1].toUpperCase() === 'X') return { puzzleNumber: num(m[1]), metric: 6, display: 'Missed' }
        const guesses = num(box[1])
        return { puzzleNumber: num(m[1]), metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
      }
      const g = text.match(/(\d+)\s*guess/i)
      if (g) {
        const guesses = num(g[1])
        return { puzzleNumber: num(m[1]), metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
      }
      // Fallback: position of 📌 among the five boxes ("📌 ⬜ ⬜ ⬜ ⬜")
      const row = text.split('\n').find((l) => l.includes('📌'))
      if (row) {
        const cells = Array.from(row.trim()).filter((c) => c === '📌' || c === '⬜' || c === '🟦')
        const idx = cells.indexOf('📌')
        if (idx !== -1) return { puzzleNumber: num(m[1]), metric: idx + 1, display: `${idx + 1} guess${idx === 0 ? '' : 'es'}` }
      }
      return { puzzleNumber: num(m[1]), metric: 6, display: 'Missed' }
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
      const m = text.match(/Minute Cryptic\s*[-–—]\s*(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})/i)
      if (!m) return null
      const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
      if (mi === -1) return null
      const h = text.match(/(\d+)\s*hints?\b/i)
      if (!h) return null
      const hints = num(h[1])
      const par = text.match(/(\d+)\s+(under|over)\s+(?:the\s+)?(?:community\s+)?par/i) || text.match(/\b(at|on)\s+(?:the\s+)?(?:community\s+)?par/i)
      const vsPar = !par ? '' : par[1] === 'at' || par[1] === 'on' ? ' · par' : ` · ${par[2].toLowerCase() === 'under' ? '−' : '+'}${par[1]} par`
      return {
        date: `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`,
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
      const d = text.match(new RegExp(`GeoGuessr Daily\\s*[·•]\\s*([^·•\\n]+?)\\s*[·•]\\s*(?:🌟\\s*)?(${INT})`, 'u'))
      if (d) {
        const pts = Math.min(25000, localInt(d[2]))
        return { date: geoDate(d[1]), metric: pts, display: `${pts.toLocaleString('en-US')} pts` }
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
      const m = text.match(/#travle(_[a-z]+)?\s+#([\d,]+)([^\n]*)/i)
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
      const m = text.match(/Chainle\s+#([\d,]+)\s*[·•|\-–—]\s*([\d,]+)\s*🔗/i)
      if (!m) return null
      const points = num(m[2])
      return { puzzleNumber: num(m[1]), metric: points, display: points.toLocaleString('en-US') }
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
      const m = text.match(/Perceptle\s+#([\d,]+)(?:\s*🃏)?\s*[-–—]\s*([SABCDF])\s*\((\d{1,3})\)/i)
      if (!m) return null
      const score = num(m[3])
      return { puzzleNumber: num(m[1]), metric: score, display: `${score} · ${m[2].toUpperCase()}` }
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
      const m = text.match(/^\s*Magnitudle\s*[—–-]\s*Size It Up[ \t]*\n[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*\n\s*Score:\s*([\d,]+)\s*\/\s*[\d,]+/i)
      if (m) {
        const pts = num(m[2])
        return { date: m[1], metric: pts, display: `${pts} pts` }
      }
      const old = text.match(/^\s*Size It Up\s*\n\s*Overall Score\s+([\d,]+)/i)
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
      // "Plain #26 ✈️ 4,158 m" (since 2026-11-12; a "—" before the plane until then), the meters in
      // the player's locale: "6,120 m", "6.120 m", "6 120 m"
      const m = text.match(new RegExp(`^\\s*Plain\\s+#(\\d+)\\s*[—–-]?\\s*(?:✈️?\\s*)?(${INT})\\s*m\\b`))
      if (!m) return null
      const meters = localInt(m[2])
      return { puzzleNumber: num(m[1]), metric: meters, display: `${meters.toLocaleString('en-US')} m` }
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
      // 10,000 m and up is shared rounded to km ("12 km"), and numbers are in the player's locale
      const m = text.match(new RegExp(`^\\s*Noillirk(?::\\s*The\\s+Daily\\s+Climb\\s*\\|\\s*No\\.\\s*|\\s+daily\\s+#)(\\d+)\\s*[—–-]\\s*(${INT})\\s*(km|m)\\b`, 'i'))
      if (!m) return null
      const meters = localInt(m[2]) * (m[3].toLowerCase() === 'km' ? 1000 : 1)
      return { puzzleNumber: num(m[1]), metric: meters, display: `${meters.toLocaleString('en-US')} m` }
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
      const m = text.match(/Poople\s+#([\d,]+)\s+(\d+)\s*\/\s*(\d+)/i)
      if (!m) return null
      const used = num(m[2])
      const best = num(m[3])
      return { puzzleNumber: num(m[1]), metric: Math.max(0, used - best), display: `${used}/${best}` }
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
      const m = text.match(/DailyTens\s+#([\d,]+)/i)
      if (!m || /dailytens\.com\/archive\//i.test(text)) return null
      const found = (text.match(/🏆/g) ?? []).length
      const missed = (text.match(/❌/g) ?? []).length
      if (found + missed !== 10) return null
      return { puzzleNumber: num(m[1]), metric: found, display: `${found}/10` }
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
      const m = text.match(/Eraly\s+#([\d,]+)/i)
      if (!m || /Eraly\s+#[\d,]+\s*\(Archive\)/i.test(text)) return null
      const s = text.match(/(\d{1,3})\s*\/\s*700/)
      if (!s) return null
      const points = num(s[1])
      if (points > 700) return null
      return { puzzleNumber: num(m[1]), metric: points, display: `${points}/700` }
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
      const m = text.match(/Costcodle\s+(?:Classic\s+)?#\s*([\d,]+)\s+([1-6X])\s*\/\s*6/i)
      if (!m) return null
      const guesses = m[2].toUpperCase() === 'X' ? 7 : num(m[2])
      return { puzzleNumber: num(m[1]), metric: guesses, display: `${m[2].toUpperCase()}/6` }
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
      const m = text.match(/Krillion\s+#([\d,]+)\s*(?:🦐)?\s*([\d,]+)(?![\d,])/iu)
      if (!m) return null
      const v = num(m[2])
      return { puzzleNumber: num(m[1]), metric: v, display: `${v.toLocaleString()}` }
    },
  },
  {
    id: 'timeguessr', category: 'geography', name: 'TimeGuessr', emoji: '⏳', color: '#F2E1B8',
    url: 'https://timeguessr.com/play?mode=daily', metricLabel: 'points', better: 'higher',
    // Real share 2026-10-27: "TimeGuessr #1245 — 28,325/50,000\n\n1️⃣ 🏆779 · 📅 48y · 🌍 2500.1mi ..."
    epoch: { date: '2026-10-27', first: 1245 }, dateTolerance: 1, manual: false,
    parse(text) {
      const m = text.match(/TimeGuessr\s+#([\d,]+)\s*[—–-]?\s*([\d,]+)\s*\/\s*([\d,]+)/i)
      if (!m) return null
      const pts = num(m[2])
      return { puzzleNumber: num(m[1]), metric: pts, display: `${pts.toLocaleString()} pts` }
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
      const m = text.match(/Poeltl\s+#?\s*([\d,]+)\s*\|\s*([1-8X])\s*\/\s*8/i)
      if (!m) return null
      const miss = m[2].toUpperCase() === 'X'
      return { puzzleNumber: num(m[1]), metric: miss ? 9 : num(m[2]), display: `${m[2].toUpperCase()}/8` }
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
      const m = text.match(/Daily Holes\s*[—–-]\s*Round\s*#(\d+)[\s\S]*?·\s*([+\-−]?\d+|E)\s*\((\d+)\)/i)
      if (!m) return null
      const toPar = /^e$/i.test(m[2]) ? 0 : Number(m[2].replace('−', '-'))
      const shown = toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : String(toPar)
      return { puzzleNumber: num(m[1]), metric: toPar, display: `${shown} (${m[3]})` }
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
