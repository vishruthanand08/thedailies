import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

const RANGES = [['all', 'All time'], ['30', '30 days'], ['7', '7 days']]

// Shared by the Friends leaderboards and the You tab: my circle's stats for a range.
export function useStats(range) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    setError(null)
    api
      .get(`/submissions/stats${range === 'all' ? '' : `?days=${range}`}`)
      .then(setStats)
      .catch((err) => setError(err.message))
  }, [range])
  return { stats, error }
}

export function useGames() {
  const [games, setGames] = useState([])
  useEffect(() => {
    api.get('/submissions/games').then((d) => setGames(d.games))
  }, [])
  return useMemo(() => Object.fromEntries(games.map((g) => [g.id, g])), [games])
}

export function RangeRow({ range, onChange }) {
  return (
    <div className="rangerow" role="group" aria-label="Time range">
      {RANGES.map(([id, label]) => (
        <button
          key={id}
          className={`tab small${range === id ? ' active' : ''}`}
          aria-pressed={range === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// a metric's unit goes under the column header (times and Fermi's × carry their own)
export function unitFor(game) {
  return game && game.metricLabel !== 'time' && game.id !== 'fermi' ? <span className="unit">{game.metricLabel}</span> : null
}

const OVERALL_COLS = [
  ['points', 'Points', 'Daily points added up: in each game, last place gets 1 and each place higher gets 1 more'],
  ['crowns', '👑', 'Days won (with at least 2 players)'],
  ['wins', 'Wins', 'Games won (with at least 2 players)'],
  ['played', 'Played', 'Scores submitted'],
  ['streak', 'Streak', 'Days in a row with a score, up to today'],
]

// All-time (or recent) standings for me and my friends, on the Friends tab.
export default function Leaderboards({ me }) {
  const [range, setRange] = useState('all')
  const { stats, error } = useStats(range)
  const gameById = useGames()
  const [sortBy, setSortBy] = useState('points')
  const [gameId, setGameId] = useState(null)

  const overall = useMemo(() => {
    if (!stats) return []
    const rows = [...stats.overall]
    if (sortBy !== 'points') rows.sort((a, b) => b[sortBy] - a[sortBy] || b.points - a.points)
    return rows
  }, [stats, sortBy])

  // the picked game, or the one with the most scores in this range
  const gameBoards = stats?.games ?? []
  const busiest = [...gameBoards].sort(
    (a, b) => b.entries.reduce((n, e) => n + e.played, 0) - a.entries.reduce((n, e) => n + e.played, 0)
  )[0]
  const board = gameBoards.find((b) => b.gameId === gameId) ?? busiest
  const game = board && gameById[board.gameId]
  const unit = unitFor(game)

  return (
    <div className="card leaderboards">
      <div className="cardhead">
        <h3 className="sectiontitle">🏆 Leaderboard</h3>
        <RangeRow range={range} onChange={setRange} />
      </div>

      {error && <div className="flash err">{error}</div>}
      {!stats && !error && <div className="hint">loading…</div>}
      {stats && overall.length === 0 && (
        <p className="hint">No scores {range === 'all' ? 'yet' : 'in this range'}.</p>
      )}

      {stats && overall.length > 0 && (
        <>
          <div className="tablewrap">
            <table className="stattable">
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>Player</th>
                  {OVERALL_COLS.map(([key, label, title]) => (
                    <th key={key} className="num" aria-sort={sortBy === key ? 'descending' : 'none'}>
                      <button
                        className={`sortbtn${sortBy === key ? ' active' : ''}`}
                        title={title}
                        onClick={() => setSortBy(key)}
                      >
                        {label}
                        {sortBy === key ? ' ↓' : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overall.map((p, i) => (
                  <tr key={p.userId} className={p.userId === me.id ? 'me' : undefined}>
                    <td className="rank">{['🥇', '🥈', '🥉'][i] ?? i + 1}</td>
                    <td className="who">{p.username}</td>
                    <td className="num">{p.points}</td>
                    <td className="num">{p.crowns}</td>
                    <td className="num">{p.wins}</td>
                    <td className="num">{p.played}</td>
                    <td className="num">{p.streak ? `${p.streak}🔥` : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint small">
            Crowns and wins only count on days at least two of you played. Tap a column to sort.
          </p>

          {board && game && (
            <>
              <div className="gamepick">
                <div className="gameicon" style={{ background: game.color }}>{game.emoji}</div>
                <select
                  className="input"
                  aria-label="Game"
                  value={board.gameId}
                  onChange={(e) => setGameId(e.target.value)}
                >
                  {gameBoards.map((b) => (
                    <option key={b.gameId} value={b.gameId}>
                      {gameById[b.gameId]?.name ?? b.gameId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tablewrap">
                <table className="stattable">
                  <thead>
                    <tr>
                      <th className="rank">#</th>
                      <th>Player</th>
                      <th className="num">Wins</th>
                      <th className="num">Played</th>
                      <th className="num">Average{unit}</th>
                      <th className="num">Best{unit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.entries.map((e, i) => (
                      <tr key={e.userId} className={e.userId === me.id ? 'me' : undefined}>
                        <td className="rank">{['🥇', '🥈', '🥉'][i] ?? i + 1}</td>
                        <td className="who">{e.username}</td>
                        <td className="num">{e.wins}</td>
                        <td className="num">{e.played}</td>
                        <td className="num">{e.avgDisplay}</td>
                        <td className="num">{e.bestDisplay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint small">
                Ranked by wins, then average ({board.better === 'higher' ? 'higher' : 'lower'} is better).
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
