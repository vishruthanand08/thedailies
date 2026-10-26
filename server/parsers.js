import { clockToSeconds, secondsToClock, dateForPuzzle } from './util.js'

// Each game: metadata for the frontend tiles + a parse(text) that returns
// { puzzleNumber?, date?, metric, display } or null when the text isn't this game.
// `better`: 'lower' | 'higher'. `epoch`: date of puzzle #first (null = can't
// derive a date from the puzzle number, so no staleness check).
// `manual`: game also accepts a typed-in score (stored as unverified).

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseLongDate(text) {
  // "Oct 25, 2026" / "October 25, 2026"
  const m = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (!m) return null
  const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  if (mi === -1) return null
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
}

function num(s) {
  return parseInt(String(s).replace(/,/g, ''), 10)
}

const SQUARES = new Set(['🟨', '🟩', '🟦', '🟪'])

function linkedinGame(id, name, emoji, color, url, epochDate, kind) {
  return {
    id, name, emoji, color, url,
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

export const GAMES = [
  {
    id: 'worldle', name: 'Worldle', emoji: '🗺️', color: '#AFE3C0',
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
    id: 'wordle', name: 'Wordle', emoji: '🟩', color: '#C8E6B8',
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
    id: 'connections', name: 'Connections', emoji: '🟪', color: '#D9C7F2',
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
    id: 'mini', name: 'The Mini', emoji: '✏️', color: '#BBD8F7',
    url: 'https://www.nytimes.com/crosswords/game/mini', metricLabel: 'time', better: 'lower',
    epoch: null, dateTolerance: 1, manual: false,
    parse(text) {
      const url = text.match(/mini\.html\?d=(\d{4}-\d{2}-\d{2})&(?:amp;)?t=(\d+)/i)
      if (url) {
        const secs = num(url[2])
        return { date: url[1], metric: secs, display: secondsToClock(secs) }
      }
      const m = text.match(/Mini Crossword in (\d+:\d{2})/i)
      if (!m) return null
      const d = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      const date = d ? `${d[3]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}` : null
      const secs = clockToSeconds(m[1])
      return { date, metric: secs, display: secondsToClock(secs) }
    },
  },

  linkedinGame('queens', 'Queens', '👑', '#F2D4A7', 'https://www.linkedin.com/games/queens', '2024-05-01', 'time'),
  linkedinGame('tango', 'Tango', '🌗', '#F7E8B0', 'https://www.linkedin.com/games/tango', '2024-10-08', 'time'),
  linkedinGame('zip', 'Zip', '🏁', '#F4C2C2', 'https://www.linkedin.com/games/zip', '2025-03-18', 'time'),
  linkedinGame('crossclimb', 'Crossclimb', '🪜', '#C9E8E5', 'https://www.linkedin.com/games/crossclimb', '2024-05-01', 'time'),
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
    id: 'geoguessr', name: 'GeoGuessr Daily', emoji: '🌍', color: '#B8E0C8',
    url: 'https://www.geoguessr.com/daily-challenges', metricLabel: 'points', better: 'higher',
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
    id: 'globle', name: 'Globle', emoji: '🌎', color: '#A9D7B4',
    url: 'https://globle-game.com', metricLabel: 'guesses', better: 'lower',
    epoch: null, dateTolerance: 1, manual: false,
    parse(text) {
      if (!/#globle/i.test(text) && !/globle-game\.com/i.test(text)) return null
      const m = text.match(/guesses:?\s*=?\s*(\d+)/i) || text.match(/=\s*(\d+)/)
      if (!m) return null
      const guesses = num(m[1])
      return { date: parseLongDate(text), metric: guesses, display: `${guesses} guess${guesses === 1 ? '' : 'es'}` }
    },
  },
  {
    id: 'travle', name: 'Travle', emoji: '🧭', color: '#F2C7A7',
    url: 'https://travle.earth', metricLabel: 'extra guesses', better: 'lower',
    epoch: null, dateTolerance: null, manual: false,
    parse(text) {
      const m = text.match(/#travle\s+#([\d,]+)(?:\s+\+(\d+))?/i)
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
    id: 'costcodle', name: 'Costcodle', emoji: '🛒', color: '#F4B8B8',
    url: 'https://costcodle.com', metricLabel: 'guesses', better: 'lower',
    epoch: null, dateTolerance: null, manual: false,
    parse(text) {
      const m = text.match(/Costcodle\s+#([\d,]+)\s+([1-6X])\/6/i)
      if (!m) return null
      const guesses = m[2].toUpperCase() === 'X' ? 7 : num(m[2])
      return { puzzleNumber: num(m[1]), metric: guesses, display: `${m[2].toUpperCase()}/6` }
    },
  },
  {
    id: 'fermi', name: 'Fermi', emoji: '🔢', color: '#E3C9F0',
    url: 'https://fermi.gg', metricLabel: 'avg multiple', better: 'lower',
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
    id: 'maptap', name: 'MapTap', emoji: '📍', color: '#F7D9B8',
    url: 'https://maptap.gg', metricLabel: 'points', better: 'higher',
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
        if (md) {
          const mi = MONTHS.indexOf(md[1].slice(0, 3).toLowerCase())
          if (mi !== -1) {
            const year = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 4)
            date = `${year}-${String(mi + 1).padStart(2, '0')}-${String(md[2]).padStart(2, '0')}`
          }
        }
      }
      return { date, metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
  {
    id: 'krillion', name: 'Krillion', emoji: '🐳', color: '#B8D4F0',
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
    id: 'noillirk', name: 'Noillirk', emoji: '🪸', color: '#F4C7D8',
    url: 'https://noillirk.com', metricLabel: 'points', better: 'higher',
    // noillirk.com was on daily #12 on 2026-10-26 → #1 = 2026-10-15 (share text unverified)
    epoch: { date: '2026-10-15', first: 1 }, dateTolerance: 1, manual: true,
    parse(text) {
      if (!/noillirk/i.test(text)) return null
      const n = text.match(/#(\d+)/)
      const m = text.match(/([\d,]+)\s*(?:pts|points)/i) || text.match(/^\s*([\d,]+)\s*$/m)
      if (!m) return null
      const v = num(m[1])
      return { puzzleNumber: n ? num(n[1]) : undefined, metric: v, display: `${v.toLocaleString()}` }
    },
  },
  {
    id: 'ethnoguessr', name: 'EthnoGuessr', emoji: '🧬', color: '#D8D3F2',
    url: 'https://ethnoguessr.com', metricLabel: 'points', better: 'higher',
    epoch: null, dateTolerance: null, manual: true,
    parse(text) {
      if (!/ethnoguessr/i.test(text)) return null
      const nums = [...text.matchAll(/([\d,]{3,7})/g)].map((m) => num(m[1])).filter((v) => v > 0)
      if (!nums.length) return null
      const pts = Math.max(...nums)
      return { metric: pts, display: `${pts.toLocaleString()} pts` }
    },
  },
]

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
