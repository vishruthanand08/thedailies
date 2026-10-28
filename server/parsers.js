import { clockToSeconds, secondsToClock, dateForPuzzle } from './util.js'

// Each game: metadata for the frontend tiles + a parse(text) that returns
// { puzzleNumber?, date?, metric, display } or null when the text isn't this game.
// `better`: 'lower' | 'higher'. `epoch`: date of puzzle #first (null = can't
// derive a date from the puzzle number, so no staleness check).
// `manual`: game also accepts a typed-in score (stored as unverified).
// `embed`: the site can be played in an iframe on thedailies.lol (checked 2026-10-26; NYT, LinkedIn,
// Krillion, EthnoGuessr and GeoGuessr refuse framing, and Worldle/Travle ask not to be framed).
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

function num(s) {
  return parseInt(String(s).replace(/,/g, ''), 10)
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
]

export const GAMES = [
  {
    id: 'worldle', category: 'geography', name: 'Worldle', emoji: '🗺️', color: '#AFE3C0',
    url: 'https://worldle.teuteuf.fr', metricLabel: 'guesses', better: 'lower',
    epoch: { date: '2022-01-22', first: 1 }, dateTolerance: 1, manual: false,
    parse(text) {
      const m = text.match(/#Worldle\s+#([\d,]+)\s*(?:\((\d{2})\.(\d{2})\.(\d{4})\))?\s+([1-6X])\/6/i)
      if (!m) return null
      const guesses = m[5].toUpperCase() === 'X' ? 7 : num(m[5])
      const date = m[2] ? `${m[4]}-${m[3]}-${m[2]}` : null
      return { puzzleNumber: num(m[1]), date, metric: guesses, display: m[5].toUpperCase() === 'X' ? 'X/6' : `${m[5]}/6` }
    },
  },
  {
    id: 'wordle', category: 'nyt', name: 'Wordle', emoji: '🟩', color: '#C8E6B8',
    url: 'https://www.nytimes.com/games/wordle', metricLabel: 'guesses', better: 'lower',
    epoch: { date: '2021-06-19', first: 0 }, dateTolerance: 1, manual: false,
    parse(text) {
      const m = text.match(/(?:^|\s)Wordle\s+([\d,]+)\s+([1-6X])\/6(\*)?/i)
      if (!m) return null
      const guesses = m[2].toUpperCase() === 'X' ? 7 : num(m[2])
      return { puzzleNumber: num(m[1]), metric: guesses, display: `${m[2].toUpperCase()}/6${m[3] || ''}` }
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
    note: 'GeoGuessr has no official share text — tap “+ score”, or paste GGShare extension text.',
    epoch: null, dateTolerance: null, manual: true,
    parse(text) {
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
    epoch: null, dateTolerance: null, manual: false,
    parse(text) {
      // covers regional variants too: #travle_usa, #travle_gb, ...
      const m = text.match(/#travle(?:_[a-z]+)?\s+#([\d,]+)(?:\s+\+(\d+))?/i)
      if (!m) return null
      if (m[2] != null) {
        const extra = num(m[2])
        const perfect = /perfect/i.test(text)
        return { puzzleNumber: num(m[1]), metric: extra, display: perfect ? 'Perfect' : `+${extra}` }
      }
      const away = text.match(/\((\d+)\s*away\)/i)
      const dist = away ? num(away[1]) : 1
      return { puzzleNumber: num(m[1]), metric: 20 + dist, display: 'DNF' }
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
    id: 'costcodle', category: 'words', name: 'Costcodle', emoji: '🛒', color: '#F4B8B8',
    url: 'https://costcodle.com', embed: true, metricLabel: 'guesses', better: 'lower',
    epoch: null, dateTolerance: null, manual: false,
    parse(text) {
      const m = text.match(/Costcodle\s+#([\d,]+)\s+([1-6X])\/6/i)
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
      // the overall score line, not the per-question multiples
      const s = text.match(/([\d.]+)\s*[x×]\s*score/i) || [...text.matchAll(/([\d.]+)\s*[x×]/gi)].pop()
      if (!s) return null
      const mult = parseFloat(s[1])
      if (Number.isNaN(mult)) return null
      return { puzzleNumber: n ? num(n[1]) : undefined, metric: mult, display: `${mult}×` }
    },
  },
  {
    id: 'maptap', category: 'geography', name: 'MapTap', emoji: '📍', color: '#F7D9B8',
    url: 'https://maptap.gg', embed: true, metricLabel: 'points', better: 'higher',
    // Verified live 2026-10-26: "www.maptap.gg October 26\n75🤗 69😁 ...\nFinal score: 457"
    epoch: null, dateTolerance: 1, manual: true,
    parse(text) {
      if (!/maptap/i.test(text)) return null
      const m = text.match(/final score:?\s*([\d,]+)/i) || text.match(/([\d,]+)\s*\/\s*1,?000/) || text.match(/score:?\s*([\d,]+)/i)
      if (!m) return null
      const pts = num(m[1])
      // share date has no year ("October 26") — assume the current year
      let date = parseLongDate(text)
      if (!date) {
        const md = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)/)
        if (md) date = yearlessDate(md[1], md[2])
      }
      return { date, metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
  {
    id: 'krillion', category: 'words', name: 'Krillion', emoji: '🐳', color: '#B8D4F0',
    url: 'https://krillion.io', metricLabel: 'score', better: 'higher',
    // Verified live 2026-10-26: "Krillion #103 🦐\n365\n\n🏮🦑🫧🐟🦑🦑🦑"
    epoch: { date: '2026-07-16', first: 1 }, dateTolerance: 1, manual: true,
    parse(text) {
      const m = text.match(/Krillion\s+#([\d,]+)/i)
      if (!m) {
        if (!/krillion/i.test(text)) return null
        const loose = text.match(/([\d,]+)\s*(?:m\b|meters|pts|points)/i)
        if (!loose) return null
        const v = num(loose[1])
        return { metric: v, display: `${v.toLocaleString()}` }
      }
      // score is the standalone number line, not the dive number
      const s = text.match(/^\s*([\d,]+)\s*$/m)
      if (!s) return null
      const v = num(s[1])
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
      const md = text.match(/Daily Score\s*[·•-]?\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)/i)
      return { date: md ? yearlessDate(md[1], md[2]) : null, metric: pts, display: `${pts.toLocaleString()} pts` }
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
      const avg = text.match(/average of ([\d,]+)/i)
      if (avg) {
        const pts = num(avg[1])
        return { metric: pts, display: `${pts.toLocaleString()} avg` }
      }
      const nums = [...text.matchAll(/([\d,]{3,7})/g)].map((m) => num(m[1])).filter((v) => v > 0)
      if (!nums.length) return null
      const pts = Math.max(...nums)
      return { metric: pts, display: `${pts.toLocaleString()} pts` }
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
