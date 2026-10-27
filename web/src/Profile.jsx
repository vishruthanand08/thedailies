import { useEffect, useState } from 'react'
import { api } from './api.js'
import { RangeRow, unitFor, useGames, useStats } from './Leaderboards.jsx'
import Devices, { showDevices } from './Devices.jsx'

// The You tab: my own stats, plus account things (password, log out, devices).
export default function Profile({ me, onLogout }) {
  const [range, setRange] = useState('all')
  const { stats, error } = useStats(range)
  const gameById = useGames()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.get('/auth/profile').then(setProfile).catch(() => {})
  }, [])

  const mine = stats?.overall.find((p) => p.userId === me.id)
  const myGames = (stats?.games ?? [])
    .map((b) => ({ gameId: b.gameId, better: b.better, ...b.entries.find((e) => e.userId === me.id) }))
    .filter((g) => g.played)
    .sort((a, b) => b.played - a.played || b.wins - a.wins)

  const since = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const topGame = myGames[0] && gameById[myGames[0].gameId]
  const tiles = mine && [
    ['Points', mine.points],
    ['👑 Crowns', mine.crowns],
    ['Game wins', mine.wins],
    ['Scores', mine.played],
    ['Days played', mine.daysPlayed],
    ['Streak', mine.streak ? `${mine.streak}🔥` : 0],
    ['Best streak', mine.bestStreak],
    [topGame ? `Most played: ${topGame.name}` : 'Most played', topGame?.emoji ?? '–'],
  ]

  return (
    <div className="profile">
      <div className="card profilehead">
        <div className="avatar big">{me.username[0]}</div>
        <div className="who">
          <div className="name">@{me.username}</div>
          {since && <div className="hint">Playing since {since}</div>}
        </div>
        <button className="btn ghost small" onClick={onLogout}>Log out</button>
      </div>

      <div className="card">
        <div className="cardhead">
          <h3 className="sectiontitle">📊 Your stats</h3>
          <RangeRow range={range} onChange={setRange} />
        </div>
        {error && <div className="flash err">{error}</div>}
        {!stats && !error && <div className="hint">loading…</div>}
        {stats && !mine && (
          <p className="hint">No scores {range === 'all' ? 'yet' : 'in this range'}. Add some on the Today tab.</p>
        )}
        {tiles && (
          <>
            <div className="stattiles">
              {tiles.map(([label, value]) => (
                <div key={label} className="stattile">
                  <div className="value">{value}</div>
                  <div className="label">{label}</div>
                </div>
              ))}
            </div>
            <p className="hint small">Crowns and wins count days and games you beat at least one friend.</p>
          </>
        )}
      </div>

      {myGames.length > 0 && (
        <div className="card">
          <h3 className="sectiontitle">By game</h3>
          <div className="tablewrap">
            <table className="stattable">
              <thead>
                <tr>
                  <th>Game</th>
                  <th className="num">Played</th>
                  <th className="num">Wins</th>
                  <th className="num">Average</th>
                  <th className="num">Best</th>
                </tr>
              </thead>
              <tbody>
                {myGames.map((g) => {
                  const game = gameById[g.gameId]
                  const unit = unitFor(game)
                  return (
                    <tr key={g.gameId}>
                      <td className="who">
                        {game?.emoji}{'\u00a0'}{game?.name ?? g.gameId}
                      </td>
                      <td className="num">{g.played}</td>
                      <td className="num">{g.wins}</td>
                      <td className="num">{g.avgDisplay}{unit}</td>
                      <td className="num">{g.bestDisplay}{unit}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ChangePassword />
      {showDevices && <Devices />}
    </div>
  )
}

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setFlash(null)
    try {
      await api.post('/auth/password', { current, next })
      setFlash({ kind: 'ok', msg: 'Password changed ✓' })
      setCurrent('')
      setNext('')
      setOpen(false)
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="cardhead">
        <h3 className="sectiontitle">🔒 Password</h3>
        {!open && (
          <button
            className="btn ghost small"
            onClick={() => {
              setOpen(true)
              setFlash(null)
            }}
          >
            Change password
          </button>
        )}
      </div>
      {open && (
        <form className="suggestform" onSubmit={submit}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            aria-label="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="New password (6+ characters)"
            aria-label="New password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <div className="row">
            <button className="btn coral small" type="submit" disabled={busy || !current || next.length < 6}>
              Save
            </button>
            <button className="btn ghost small" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {flash && <div className={`flash ${flash.kind}`} role="status" style={{ marginTop: 10 }}>{flash.msg}</div>}
    </div>
  )
}
