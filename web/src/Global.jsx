import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import ScoringInfo from './ScoringInfo.jsx'

const SHOWN = 5 // like the daily crown: the top five and me, then Show all (up to the top 25)

// The global leaderboard: today's crowns across everyone who joined, overall then each
// category. Anyone can look; joining (under your username or a fun name like "Zesty Zebra") puts
// you on it. Only pasted (verified) scores count. Built by server/global.js.
export default function Global() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get('/global').then(setData).catch((err) => setError(err.message))
  }, [])
  useEffect(load, [load])

  const save = async (path, body) => {
    setBusy(true)
    setError(null)
    try {
      await api.post(path, body)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data) return error ? <div className="flash err">{error}</div> : <div className="spin">Loading…</div>

  // not joined yet: the invitation comes first. Joined: the boards come first, your settings last.
  const join = <JoinCard me={data.me} busy={busy} onSave={save} />
  return (
    <div className="global">
      {!data.me.joined && join}
      {error && <div className="flash err">{error}</div>}
      <Standings
        title="Global crown" emoji="🌐" yellow
        board={data.overall}
        empty="Nobody on the global board has a pasted score yet today."
      />
      {data.categories.map((c) => (
        <Standings key={c.id} title={c.name} emoji={c.emoji} board={c} empty="Nobody yet today." />
      ))}
      {data.me.joined && join}
    </div>
  )
}

function JoinCard({ me, busy, onSave }) {
  const [anonymous, setAnonymous] = useState(false)

  if (!me.joined) {
    return (
      <div className="card joincard">
        <button className="btn joinbtn" disabled={busy} onClick={() => onSave('/global/join', { anonymous })}>
          Join the Global leaderboard
        </button>
        <label className="checkrow">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span>Anonymize my name</span>
        </label>
      </div>
    )
  }

  return (
    <div className="card joincard joined">
      <p>
        You're on the global board {me.anonymous ? <>as <b>{me.alias}</b></> : 'under your username'}.
      </p>
      <div className="actions">
        <button className="btn small ghost" disabled={busy} onClick={() => onSave('/global/join', { anonymous: !me.anonymous })}>
          {me.anonymous ? 'Use my username' : 'Anonymize my name'}
        </button>
        <button className="btn small ghost" disabled={busy} onClick={() => onSave('/global/leave')}>
          Leave
        </button>
      </div>
    </div>
  )
}

// One crown: the top five plus my row further down, then Show all for the rest of the top 25.
function Standings({ title, emoji, board, empty, yellow }) {
  const [all, setAll] = useState(false)
  const { top, mine, total } = board
  const meAt = top.findIndex((r) => r.me)
  const shown = all ? top : top.slice(0, SHOWN)
  // further down than what's shown: my row under a ⋯
  const me = !all && meAt >= SHOWN ? top[meAt] : mine
  const hidden = top.length - shown.length - (me && !all && meAt >= SHOWN ? 1 : 0)

  return (
    <div className={`card globalcard${yellow ? ' crowncard' : ''}`}>
      <div className="crownhead">
        <h3>{emoji} {title}{yellow && <> <ScoringInfo /></>}</h3>
        {total > 0 && <span className="hint">{total} {total === 1 ? 'player' : 'players'} today</span>}
      </div>
      {total === 0 ? (
        <p className="hint crownempty">{empty}</p>
      ) : (
        <>
          {shown.map((r) => <Row key={`${r.rank}-${r.name}-${r.me}`} r={r} />)}
          {me && <>
            <div className="boardgap" aria-hidden="true">⋯</div>
            <Row r={me} />
          </>}
          {(hidden > 0 || all) && (
            <button className="boardmore" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'Show less' : `Show top ${top.length}`} <span aria-hidden="true">{all ? '▴' : '▾'}</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}

// a fun-name row reads a little differently from a username, so nobody mistakes one for the other
function Row({ r }) {
  const name = r.me ? `${r.name} (you)` : r.name
  return (
    <div className={`crownrow${r.me ? ' me' : ''}${r.anonymous ? ' anon' : ''}`}>
      <span className="rank">{['🥇', '🥈', '🥉'][r.rank - 1] ?? `${r.rank}.`}</span>
      <span>
        {name} <span className="sub">· {r.games} game{r.games === 1 ? '' : 's'}</span>
      </span>
      <span className="pts">{r.points} pts</span>
    </div>
  )
}
