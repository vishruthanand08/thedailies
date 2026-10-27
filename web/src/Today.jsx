import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { inApp, nativeCapture, tellNative } from './native.js'

function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function prettyDate(iso, today) {
  if (iso === today) return 'Today'
  if (iso === shiftDate(today, -1)) return 'Yesterday'
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export default function Today({ me }) {
  const [games, setGames] = useState([])
  const [board, setBoard] = useState(null)
  const [date, setDate] = useState(null) // null until first load
  const [text, setText] = useState('')
  const [flash, setFlash] = useState(null) // {kind, msg}
  const [busy, setBusy] = useState(false)
  const textRef = useRef(null)
  const canReadClipboard = Boolean(navigator.clipboard?.readText)

  useEffect(() => {
    api.get('/submissions/games').then((d) => setGames(d.games))
  }, [])

  const load = (d) => {
    api.get(`/submissions/board${d ? `?date=${d}` : ''}`).then((resp) => {
      setBoard(resp)
      setDate(resp.date)
    })
  }
  useEffect(() => load(null), [])

  // the native shell fires this after it saves a score from the share sheet or game browser
  const dateRef = useRef(null)
  dateRef.current = date
  useEffect(() => {
    const refresh = () => load(dateRef.current)
    window.addEventListener('dailies:refresh', refresh)
    return () => window.removeEventListener('dailies:refresh', refresh)
  }, [])

  // On mobile the paste bar is fixed to the bottom; lift it above the iOS
  // keyboard, which covers the layout viewport instead of resizing it.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--kb', `${covered}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.style.removeProperty('--kb')
    }
  }, [])

  const boardsByGame = useMemo(() => {
    const m = {}
    for (const b of board?.boards ?? []) m[b.gameId] = b.entries
    return m
  }, [board])

  const submit = async (value = text) => {
    if (!value.trim()) return
    setBusy(true)
    setFlash(null)
    try {
      const d = await api.post('/submissions', { text: value })
      setFlash({ kind: 'ok', msg: `${d.submission.emoji} ${d.submission.gameName} — ${d.submission.display} added ✓` })
      setText('')
      load(date)
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    } finally {
      setBusy(false)
    }
  }

  // One tap: read the share text the game just copied and submit it.
  const pasteFromClipboard = async () => {
    setFlash(null)
    let clip
    try {
      clip = await navigator.clipboard.readText()
    } catch {
      textRef.current?.focus()
      setFlash({ kind: 'err', msg: "Couldn't read your clipboard — paste it into the box instead." })
      return
    }
    if (!clip.trim()) {
      setFlash({ kind: 'err', msg: 'Clipboard is empty — tap Share in the game first.' })
      return
    }
    submit(clip)
  }

  const submitManual = async (gameId, value) => {
    setFlash(null)
    try {
      const d = await api.post('/submissions', { gameId, value })
      setFlash({ kind: 'ok', msg: `${d.submission.emoji} ${d.submission.gameName} — ${d.submission.display} added (manual)` })
      load(date)
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    }
  }

  const remove = async (id) => {
    await api.del(`/submissions/${id}`)
    load(date)
  }

  if (!board) return <div className="spin">loading…</div>
  const today = board.today
  const isToday = date === today

  return (
    <div>
      <div className="daterow">
        <button className="navbtn" onClick={() => load(shiftDate(date, -1))}>‹</button>
        <button className="navbtn" onClick={() => load(shiftDate(date, 1))} disabled={isToday}>›</button>
        <h2>{prettyDate(date, today)}</h2>
      </div>

      {isToday && !nativeCapture && (
        <div className="pastebox">
          <div className="row">
            <textarea
              ref={textRef}
              className="input"
              placeholder="Paste a result, or tap 📋"
              aria-label="Paste your game result"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {canReadClipboard && !text.trim() ? (
              <button className="btn coral" onClick={pasteFromClipboard} disabled={busy}>
                📋 Paste
              </button>
            ) : (
              <button className="btn coral" onClick={() => submit()} disabled={busy || !text.trim()}>
                Add ↑
              </button>
            )}
          </div>
          {flash && <div className={`flash ${flash.kind}`} role="status">{flash.msg}</div>}
        </div>
      )}

      {board.crown.length > 0 && (
        <div className="card crowncard">
          <h3>👑 Daily crown</h3>
          {board.crown.map((c, i) => (
            <div key={c.userId} className={`crownrow${i === 0 ? ' first' : ''}`}>
              <span>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
              <span>
                {c.username}
                {c.userId === me.id ? ' (you)' : ''}{' '}
                <span className="sub">· {c.games} game{c.games === 1 ? '' : 's'}</span>
              </span>
              <span className="pts">{c.points} pts</span>
            </div>
          ))}
        </div>
      )}

      <div className="tilegrid">
        {games.map((g) => (
          <GameTile
            key={g.id}
            game={g}
            entries={boardsByGame[g.id] ?? []}
            me={me}
            isToday={isToday}
            onRemove={remove}
            onManual={submitManual}
          />
        ))}
      </div>
    </div>
  )
}

function GameTile({ game, entries, me, isToday, onRemove, onManual }) {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')
  const mine = entries.find((e) => e.userId === me.id)

  return (
    <div className="card tile">
      <div className="tilehead">
        <div className="gameicon" style={{ background: game.color }}>{game.emoji}</div>
        <div>
          <div className="name">{game.name}</div>
          <a
            className="playlink"
            href={game.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // in the app, native decides between the in-app game browser and Safari
              if (!inApp) return
              e.preventDefault()
              tellNative({ type: 'open', url: game.url, gameId: game.id, name: game.name })
            }}
          >
            Play ↗
          </a>
        </div>
        {isToday && game.manual && !mine && (
          <div className="right">
            <button className="btn ghost small" onClick={() => setManualOpen((v) => !v)}>
              + score
            </button>
          </div>
        )}
      </div>

      {manualOpen && !mine && (
        <div className="manualrow">
          <input
            className="input"
            type="number"
            placeholder={game.metricLabel}
            aria-label={`${game.name} ${game.metricLabel}`}
            value={manualVal}
            onChange={(e) => setManualVal(e.target.value)}
          />
          <button
            className="btn small"
            onClick={() => {
              onManual(game.id, Number(manualVal))
              setManualOpen(false)
              setManualVal('')
            }}
            disabled={manualVal === ''}
          >
            Add
          </button>
        </div>
      )}

      {game.note && entries.length === 0 && <div className="hint">{game.note}</div>}
      {entries.length === 0 ? (
        <div className="noscores">No scores yet{isToday ? ' — be first' : ''}</div>
      ) : (
        entries.map((e) => (
          <div key={e.userId} className={`boardrow${e.userId === me.id ? ' me' : ''}`}>
            <span className="rank">{['🥇', '🥈', '🥉'][e.rank - 1] ?? `${e.rank}.`}</span>
            <span>
              {e.username}
              {!e.verified && <span className="unverified"> ~manual</span>}
            </span>
            <span className="score">{e.display}</span>
            {e.userId === me.id && isToday && (
              <button
                className="del"
                title="Delete my score"
                aria-label={`Delete my ${game.name} score`}
                onClick={() => onRemove(e.submissionId)}
              >
                ✕
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
