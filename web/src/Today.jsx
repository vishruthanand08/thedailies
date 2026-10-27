import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { inApp, nativeCapture, tellNative } from './native.js'
import GamePanel from './GamePanel.jsx'
import Suggestions from './Suggestions.jsx'

function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Games in the player's saved order; games added since they last arranged go at the end.
function arrange(games, order) {
  const at = new Map(order.map((id, i) => [id, i]))
  return games
    .map((g, i) => [g, at.has(g.id) ? at.get(g.id) : order.length + i])
    .sort((a, b) => a[1] - b[1])
    .map(([g]) => g)
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
  const [playing, setPlaying] = useState(null) // game open in the embedded panel
  const closePanel = useCallback(() => setPlaying(null), [])
  const canReadClipboard = Boolean(navigator.clipboard?.readText)
  const [backFrom, setBackFrom] = useState(null) // gameId to offer a paste for after a new-tab game
  const promptRef = useRef(null)

  // A game opened in a new tab: when the player comes back, offer to paste its result.
  // Kept in sessionStorage so it survives mobile browsers unloading this tab meanwhile.
  const AWAY_KEY = 'dailies.awayGame'
  const AWAY_MAX_MS = 3 * 60 * 60 * 1000
  const readAway = () => {
    try {
      const v = JSON.parse(sessionStorage.getItem(AWAY_KEY) || 'null')
      return v && Date.now() - v.at < AWAY_MAX_MS ? v : null
    } catch {
      return null
    }
  }
  const clearAway = useCallback(() => {
    setBackFrom(null)
    try {
      sessionStorage.removeItem(AWAY_KEY)
    } catch {
      // storage unavailable: the prompt just won't survive a reload
    }
  }, [])
  const leftForGame = (game) => {
    try {
      sessionStorage.setItem(AWAY_KEY, JSON.stringify({ id: game.id, at: Date.now(), hidden: false }))
    } catch {
      // storage unavailable
    }
  }

  useEffect(() => {
    // reloaded while away (mobile tab eviction): the player has been gone, offer it now
    const pending = readAway()
    if (pending?.hidden) setBackFrom(pending.id)
    // "left" = this page was hidden (tab switch) or lost focus (game in a window beside it);
    // "back" = visible and focused again
    const left = () => {
      const away = readAway()
      if (!away || away.hidden) return
      try {
        sessionStorage.setItem(AWAY_KEY, JSON.stringify({ ...away, hidden: true }))
      } catch {
        // storage unavailable
      }
    }
    const back = () => {
      const away = readAway()
      if (away?.hidden) setBackFrom(away.id)
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? left() : back())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', left)
    window.addEventListener('focus', back)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', left)
      window.removeEventListener('focus', back)
    }
  }, [])

  useEffect(() => {
    if (backFrom) requestAnimationFrame(() => promptRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }, [backFrom])

  useEffect(() => {
    api.get('/submissions/games').then((d) => setGames(d.games))
  }, [])

  // favorites pin games to the top; drag (or arrow keys on the handle) to rearrange
  const [prefs, setPrefs] = useState({ order: [], favorites: [] })
  const [prefsError, setPrefsError] = useState(null)
  useEffect(() => {
    api.get('/prefs').then(setPrefs).catch(() => {})
  }, [])
  const savePrefs = (patch) => {
    setPrefsError(null)
    api.put('/prefs', patch).catch(() => setPrefsError("Couldn't save your layout. Check your connection."))
  }
  const ordered = useMemo(() => arrange(games, prefs.order), [games, prefs.order])
  const favSet = useMemo(() => new Set(prefs.favorites), [prefs.favorites])
  const favGames = ordered.filter((g) => favSet.has(g.id))
  const otherGames = ordered.filter((g) => !favSet.has(g.id))
  // the latest order, updated as soon as a game moves (a drop can land before React re-renders)
  const orderIdsRef = useRef([])
  orderIdsRef.current = ordered.map((g) => g.id)
  const favSetRef = useRef(favSet)
  favSetRef.current = favSet

  const toggleFavorite = (game) => {
    const favorites = favSet.has(game.id) ? prefs.favorites.filter((id) => id !== game.id) : [...prefs.favorites, game.id]
    setPrefs((p) => ({ ...p, favorites }))
    savePrefs({ favorites })
  }

  // put `id` where `targetId` is; returns the new full order
  const moveGame = (id, targetId) => {
    const ids = [...orderIdsRef.current]
    const from = ids.indexOf(id)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1 || from === to) return null
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    orderIdsRef.current = ids
    setPrefs((p) => ({ ...p, order: ids }))
    return ids
  }

  const [draggingId, setDraggingId] = useState(null)
  const startDrag = (e, game) => {
    if (e.button !== 0) return
    e.preventDefault()
    const drag = { id: game.id, fav: favSetRef.current.has(game.id), last: null, x: e.clientX, y: e.clientY, moved: false }
    setDraggingId(game.id)

    const retarget = () => {
      // look through the fixed paste bar on phones to the tile underneath
      const target = document
        .elementsFromPoint(drag.x, drag.y)
        .map((el) => el.closest('[data-gameid]'))
        .find(Boolean)?.dataset.gameid
      if (!target || target === drag.id) {
        drag.last = null
        return
      }
      // ignore the tile we just swapped with until the pointer leaves it, so they don't flicker back and forth
      if (target === drag.last || favSetRef.current.has(target) !== drag.fav) return
      drag.last = target
      if (moveGame(drag.id, target)) drag.moved = true
    }
    // scroll while holding a tile near the top or bottom of the screen
    let raf
    const edge = 90
    const scroll = () => {
      const dy = drag.y < edge ? -12 : drag.y > window.innerHeight - edge ? 12 : 0
      if (dy) {
        window.scrollBy(0, dy)
        retarget()
      }
      raf = requestAnimationFrame(scroll)
    }
    raf = requestAnimationFrame(scroll)

    const move = (ev) => {
      drag.x = ev.clientX
      drag.y = ev.clientY
      retarget()
    }
    const end = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setDraggingId(null)
      if (drag.moved) savePrefs({ order: orderIdsRef.current })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  // arrow keys on the handle move a game one place within its group
  const nudge = (game, step) => {
    const fav = favSetRef.current
    const group = orderIdsRef.current.filter((id) => fav.has(id) === fav.has(game.id))
    const target = group[group.indexOf(game.id) + step]
    if (!target) return
    const ids = moveGame(game.id, target)
    if (ids) savePrefs({ order: ids })
  }

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
      clearAway()
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
  const backGame = backFrom && games.find((g) => g.id === backFrom)
  // nothing to offer once that game already has my score
  const showBackPrompt = backGame && !boardsByGame[backGame.id]?.some((e) => e.userId === me.id)

  return (
    <div>
      <div className="daterow">
        <button className="navbtn" onClick={() => load(shiftDate(date, -1))}>‹</button>
        <button className="navbtn" onClick={() => load(shiftDate(date, 1))} disabled={isToday}>›</button>
        <h2>{prettyDate(date, today)}</h2>
      </div>

      {isToday && !nativeCapture && (
        <div className="pastebox">
          {showBackPrompt && (
            <div className="backprompt" ref={promptRef} role="status">
              <span>
                Back from {backGame.emoji} {backGame.name}? Tap Share or Copy in the game, then paste your result.
              </span>
              {canReadClipboard && (
                <button className="btn coral small" onClick={pasteFromClipboard} disabled={busy}>
                  📋 Paste result
                </button>
              )}
              <button className="btn ghost small" onClick={clearAway} aria-label="Dismiss">✕</button>
            </div>
          )}
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
            <div key={c.userId} className={`crownrow${c.userId === me.id ? ' me' : ''}`}>
              <span>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
              <span>
                {c.username}{' '}
                <span className="sub">· {c.games} game{c.games === 1 ? '' : 's'}</span>
              </span>
              <span className="pts">{c.points} pts</span>
            </div>
          ))}
        </div>
      )}

      {prefsError && <div className="flash err gridflash" role="status">{prefsError}</div>}

      {[
        ['fav', '★ Favorites', favGames],
        ['all', favGames.length ? 'All games' : null, otherGames],
      ].map(([key, title, list]) =>
        list.length === 0 ? null : (
          <section key={key} className="gamegroup" aria-label={title ?? 'Games'}>
            {title && <h3 className="grouptitle">{title}</h3>}
            <div className="tilegrid">
              {list.map((g) => (
                <GameTile
                  key={g.id}
                  game={g}
                  entries={boardsByGame[g.id] ?? []}
                  me={me}
                  isToday={isToday}
                  favorite={favSet.has(g.id)}
                  dragging={draggingId === g.id}
                  onFavorite={toggleFavorite}
                  onDragStart={startDrag}
                  onNudge={nudge}
                  onRemove={remove}
                  onManual={submitManual}
                  onPlay={setPlaying}
                  onLeave={leftForGame}
                />
              ))}
            </div>
          </section>
        )
      )}
      {games.length > 0 && favGames.length === 0 && (
        <p className="hint layouthint">Tap ☆ to pin a game to the top. Drag ⠿ to move games around.</p>
      )}

      <Suggestions />

      {playing && <GamePanel game={playing} onClose={closePanel} onSaved={() => load(dateRef.current)} />}
    </div>
  )
}

function GameTile({
  game, entries, me, isToday, favorite, dragging,
  onFavorite, onDragStart, onNudge, onRemove, onManual, onPlay, onLeave,
}) {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')
  const [paidOpen, setPaidOpen] = useState(false)
  const mine = entries.find((e) => e.userId === me.id)

  return (
    <div className={`card tile${dragging ? ' dragging' : ''}`} data-gameid={game.id}>
      <div className="tilehead">
        <div className="gameicon" style={{ background: game.color }}>{game.emoji}</div>
        <div className="titles">
          <div className="name">
            {game.name}
            {game.paid && (
              <button
                className={`paidbadge${paidOpen ? ' open' : ''}`}
                title="Needs a subscription. Tap for ways to get it cheaper."
                aria-label={`${game.name} needs a subscription. Show ways to get it cheaper`}
                aria-expanded={paidOpen}
                onClick={() => setPaidOpen((v) => !v)}
              >
                $
              </button>
            )}
          </div>
          <a
            className="playlink"
            href={game.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // in the app, native decides between the in-app game browser and Safari
              if (inApp) {
                e.preventDefault()
                tellNative({ type: 'open', url: game.url, gameId: game.id, name: game.name })
                return
              }
              // on the site, games that allow framing open in a panel; cmd/ctrl-click still opens a tab
              if (game.embed && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) {
                e.preventDefault()
                onPlay(game)
                return
              }
              // a new tab: offer to paste the result when the player comes back
              if (isToday) onLeave(game)
            }}
          >
            Play ↗
          </a>
          {isToday && game.manual && !mine && (
            <button
              className="linklike addscore"
              aria-expanded={manualOpen}
              onClick={() => setManualOpen((v) => !v)}
            >
              + score
            </button>
          )}
        </div>
        <div className="right">
          <button
            className={`iconbtn star${favorite ? ' on' : ''}`}
            aria-pressed={favorite}
            aria-label={favorite ? `Unpin ${game.name} from favorites` : `Pin ${game.name} to favorites`}
            title={favorite ? 'Unfavorite' : 'Favorite'}
            onClick={() => onFavorite(game)}
          >
            {favorite ? '★' : '☆'}
          </button>
          <button
            className="iconbtn handle"
            aria-label={`Move ${game.name}. Drag, or use the arrow keys`}
            title="Drag to move"
            onPointerDown={(e) => onDragStart(e, game)}
            onKeyDown={(e) => {
              const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]
              if (!step) return
              e.preventDefault()
              const el = e.currentTarget
              onNudge(game, step)
              // reordering moves the tile's DOM node, which can drop focus
              requestAnimationFrame(() => el.focus())
            }}
          >
            ⠿
          </button>
        </div>
      </div>

      {paidOpen && game.paid && (
        <div className="paidinfo">
          <div className="what">{game.paid.what}</div>
          <ul>
            {game.paid.deals.map((d) => (
              <li key={d.label}>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer">{d.label} ↗</a>
                ) : (
                  d.label
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
