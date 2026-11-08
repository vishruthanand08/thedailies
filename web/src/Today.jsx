import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api.js'
import { inApp, nativeCapture, tellNative } from './native.js'
import GamePanel from './GamePanel.jsx'
import PasteDock from './PasteDock.jsx'
import ScoringInfo from './ScoringInfo.jsx'
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

const HOWTO_KEY = 'dailies.howto'
const pasteKeys = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V'

// For new players: the three steps, since "paste your result" isn't obvious the first time.
function HowItWorks({ onClose }) {
  return (
    <div className="card howto" role="note" aria-label="How The Dailies works">
      <div className="howto-head">
        <h3>How it works</h3>
        <button className="iconbtn" aria-label="Close how it works" onClick={onClose}>✕</button>
      </div>
      <ol>
        <li><b>Play</b> a game: tap <b>Play</b> on any game below.</li>
        <li>When you finish, tap the game's own <b>Share</b> or <b>Copy</b> button to copy your result.</li>
        <li>Come back and press <b>Paste</b> (bottom right) or {pasteKeys}. Your score lands on the board.</li>
      </ol>
      <p className="hint">Each result earns up to 100 points. Most points across the day wins the crown 👑</p>
    </div>
  )
}

// Most daily games put out the next puzzle at midnight where the player is.
function untilLocalMidnight() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now
}

function prettyDate(iso, today) {
  if (iso === today) return 'Today'
  if (iso === shiftDate(today, -1)) return 'Yesterday'
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export default function Today({ me, onOpenDay }) {
  const [games, setGames] = useState([])
  const [board, setBoard] = useState(null)
  const [date, setDate] = useState(null) // null until first load
  const [flash, setFlash] = useState(null) // {kind, msg}
  const dismissFlash = useCallback(() => setFlash(null), [])
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(null) // game open in the embedded panel
  const closePanel = useCallback(() => setPlaying(null), [])
  const [backFrom, setBackFrom] = useState(null) // gameId to offer a paste for after a new-tab game
  // the "How it works" card, until it's closed or the first score is saved (on this browser)
  const [showHowTo, setShowHowTo] = useState(() => {
    try {
      return localStorage.getItem(HOWTO_KEY) !== 'done'
    } catch {
      return false
    }
  })
  const finishHowTo = useCallback(() => {
    setShowHowTo(false)
    try {
      localStorage.setItem(HOWTO_KEY, 'done')
    } catch {
      // storage unavailable
    }
  }, [])

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
    api.get('/submissions/games').then((d) => {
      setGames(d.games)
      setCategories(d.categories ?? [])
    })
  }, [])

  // favorites pin games to the top; drag (or arrow keys on the handle) to rearrange
  const [categories, setCategories] = useState([])
  const [prefs, setPrefs] = useState({ order: [], favorites: [], categoryOrder: [], collapsed: [] })
  const [prefsError, setPrefsError] = useState(null)
  useEffect(() => {
    api.get('/prefs').then((p) => setPrefs((old) => ({ ...old, ...p }))).catch(() => {})
  }, [])
  const savePrefs = (patch) => {
    setPrefsError(null)
    api.put('/prefs', patch).catch(() => setPrefsError("Couldn't save your layout. Check your connection."))
  }
  const ordered = useMemo(() => arrange(games, prefs.order), [games, prefs.order])
  const favSet = useMemo(() => new Set(prefs.favorites), [prefs.favorites])
  // favorites keep the order they were pinned in (and rearranged to); a favorite stays in its
  // category too, so it shows up in both places
  const favGames = useMemo(() => {
    const byId = Object.fromEntries(games.map((g) => [g.id, g]))
    return prefs.favorites.map((id) => byId[id]).filter(Boolean)
  }, [games, prefs.favorites])
  const orderedCategories = useMemo(() => arrange(categories, prefs.categoryOrder ?? []), [categories, prefs.categoryOrder])
  const collapsed = useMemo(() => new Set(prefs.collapsed ?? []), [prefs.collapsed])
  const [query, setQuery] = useState('') // the game search under the crown
  const [only, setOnly] = useState('all') // the filter beside it: one group's games, or all
  const [filterOpen, setFilterOpen] = useState(false)
  const groups = [
    { id: 'favorites', title: '★ Favorites', games: favGames, movable: false },
    ...orderedCategories.map((c) => ({
      id: c.id, title: `${c.emoji} ${c.name}`, movable: true,
      games: ordered.filter((g) => g.category === c.id),
    })),
  ].filter((group) => group.games.length > 0)
  const search = query.trim().toLowerCase()
  const filtered = only !== 'all' && groups.some((group) => group.id === only)
  const shownGroups = groups
    .filter((group) => !filtered || group.id === only)
    .map((group) => (search ? { ...group, games: group.games.filter((g) => g.name.toLowerCase().includes(search)) } : group))
    .filter((group) => group.games.length > 0)
  // games only move within their group. Favorites are ordered by the favorites list itself and
  // categories by the game order, so rearranging one never reshuffles the other.
  const gameCategoryRef = useRef({})
  gameCategoryRef.current = Object.fromEntries(games.map((g) => [g.id, g.category]))
  // the latest lists, updated as soon as a game moves (a drop can land before React re-renders)
  const orderIdsRef = useRef([])
  orderIdsRef.current = ordered.map((g) => g.id)
  const favIdsRef = useRef([])
  favIdsRef.current = favGames.map((g) => g.id)
  const groupIds = (group) =>
    group === 'favorites' ? favIdsRef.current : orderIdsRef.current.filter((id) => gameCategoryRef.current[id] === group)

  const toggleFavorite = (game) => {
    const favorites = favSet.has(game.id) ? prefs.favorites.filter((id) => id !== game.id) : [...prefs.favorites, game.id]
    setPrefs((p) => ({ ...p, favorites }))
    savePrefs({ favorites })
  }

  // put `id` where `targetId` is within `group`; returns the prefs patch to save
  const moveGame = (id, targetId, group) => {
    const fav = group === 'favorites'
    const ids = [...(fav ? favIdsRef.current : orderIdsRef.current)]
    const from = ids.indexOf(id)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1 || from === to) return null
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    if (fav) favIdsRef.current = ids
    else orderIdsRef.current = ids
    const patch = fav ? { favorites: ids } : { order: ids }
    setPrefs((p) => ({ ...p, ...patch }))
    return patch
  }

  // `${group}:${gameId}`, since a favorite appears twice
  const [draggingKey, setDraggingKey] = useState(null)
  const startDrag = (e, game, group) => {
    if (e.button !== 0) return
    e.preventDefault()
    const drag = { id: game.id, group, last: null, x: e.clientX, y: e.clientY, moved: false }
    setDraggingKey(`${group}:${game.id}`)

    const retarget = () => {
      // look through the floating Paste button to the tile underneath
      const target = document
        .elementsFromPoint(drag.x, drag.y)
        .map((el) => el.closest(`[data-group="${drag.group}"] [data-gameid]`))
        .find(Boolean)?.dataset.gameid
      if (!target || target === drag.id) {
        drag.last = null
        return
      }
      // ignore the tile we just swapped with until the pointer leaves it, so they don't flicker back and forth
      if (target === drag.last) return
      drag.last = target
      if (moveGame(drag.id, target, drag.group)) drag.moved = true
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
      setDraggingKey(null)
      if (drag.moved) {
        savePrefs(drag.group === 'favorites' ? { favorites: favIdsRef.current } : { order: orderIdsRef.current })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  // arrow keys on the handle move a game one place within its group
  const nudge = (game, step, group) => {
    const ids = groupIds(group)
    const target = ids[ids.indexOf(game.id) + step]
    if (!target) return
    const patch = moveGame(game.id, target, group)
    if (patch) savePrefs(patch)
  }

  const toggleCollapsed = (id) => {
    const next = collapsed.has(id) ? [...collapsed].filter((x) => x !== id) : [...collapsed, id]
    setPrefs((p) => ({ ...p, collapsed: next }))
    savePrefs({ collapsed: next })
  }

  const categoryIdsRef = useRef([])
  categoryIdsRef.current = orderedCategories.map((c) => c.id)
  const moveCategory = (id, targetId) => {
    const ids = [...categoryIdsRef.current]
    const from = ids.indexOf(id)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1 || from === to) return null
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    categoryIdsRef.current = ids
    setPrefs((p) => ({ ...p, categoryOrder: ids }))
    return ids
  }
  const [draggingCategory, setDraggingCategory] = useState(null)
  const startCategoryDrag = (e, id) => {
    if (e.button !== 0) return
    e.preventDefault()
    const drag = { id, last: null, moved: false }
    setDraggingCategory(id)
    const move = (ev) => {
      const target = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .map((el) => el.closest('[data-categoryid]'))
        .find(Boolean)?.dataset.categoryid
      if (!target || target === id) {
        drag.last = null
        return
      }
      if (target === drag.last) return
      drag.last = target
      if (moveCategory(id, target)) drag.moved = true
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setDraggingCategory(null)
      if (drag.moved) savePrefs({ categoryOrder: categoryIdsRef.current })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }
  const nudgeCategory = (id, step) => {
    const ids = categoryIdsRef.current
    const target = ids[ids.indexOf(id) + step]
    if (!target) return
    const next = moveCategory(id, target)
    if (next) savePrefs({ categoryOrder: next })
  }

  // the crown card can show the overall standings or one category's
  const [crownScope, setCrownScope] = useState('all')
  const [crownAll, setCrownAll] = useState(false) // the whole standings, not just the top five

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

  // the Mac app's Go menu: a day back or forward, or 0 for today (never past today)
  const todayRef = useRef(null)
  todayRef.current = board?.today
  useEffect(() => {
    const onDay = (e) => {
      const days = Number(e.detail) || 0
      const current = dateRef.current
      if (!days || !current) return load(null)
      const next = shiftDate(current, days)
      if (todayRef.current && next > todayRef.current) return
      load(next)
    }
    window.addEventListener('dailies:day', onDay)
    return () => window.removeEventListener('dailies:day', onDay)
  }, [])

  // a new day's puzzles at local midnight: bring the board up to date by itself
  useEffect(() => {
    let timer
    const arm = () => {
      timer = setTimeout(() => {
        if (dateRef.current === todayRef.current) load(null)
        arm()
      }, untilLocalMidnight() + 2000)
    }
    arm()
    return () => clearTimeout(timer)
  }, [])

  // The paste button floats at the bottom; lift it (and its box) above the iOS
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

  // true when it saved, so the paste box can clear itself
  const submit = async (value) => {
    if (!value.trim()) return false
    setBusy(true)
    setFlash(null)
    try {
      const d = await api.post('/submissions', { text: value })
      setFlash({ kind: 'ok', msg: `${d.submission.emoji} ${d.submission.gameName} — ${d.submission.display} added ✓` })
      clearAway()
      finishHowTo() // they've got it
      load(null) // today, where the new score is

      return true
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
      return false
    } finally {
      setBusy(false)
    }
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

      {/* on every day: a pasted result always counts for its own day, so after saving the
          board comes to today */}
      {!nativeCapture && (
        <PasteDock
          busy={busy}
          flash={flash}
          onDismissFlash={dismissFlash}
          onSubmit={submit}
          backGame={showBackPrompt ? backGame : null}
          onDismissBack={clearAway}
        />
      )}

      {showHowTo && isToday && <HowItWorks onClose={finishHowTo} />}

      {/* always at the top, even before anyone has played */}
      <div className="card crowncard">
        <div className="crownhead">
          <h3>👑 Daily crown <ScoringInfo /></h3>
          {board.crown.length > 0 && <div className="scopechips" role="group" aria-label="Standings for">
            {[{ id: 'all', name: 'Overall' }, ...orderedCategories].map((c) => (
              <button
                key={c.id}
                className={`scopechip${crownScope === c.id ? ' active' : ''}`}
                aria-pressed={crownScope === c.id}
                onClick={() => setCrownScope(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>}
        </div>
        {board.crown.length === 0 ? (
          <p className="hint crownempty">
            {isToday ? 'No scores yet today. Play a game to take the lead.' : 'Nobody played this day.'}
          </p>
        ) : (crownScope === 'all' ? board.crown : board.categoryCrowns?.[crownScope] ?? []).length === 0 && (
          <p className="hint crownempty">Nobody has played these games {isToday ? 'yet today' : 'this day'}.</p>
        )}
        {(() => {
          const all = crownScope === 'all' ? board.crown : board.categoryCrowns?.[crownScope] ?? []
          const short = leaders(all, 5, (c) => c.userId === me.id)
          const row = (c) => {
            const rank = c.rank ?? all.indexOf(c) + 1
            return (
              <div key={c.userId} className={`crownrow${c.userId === me.id ? ' me' : ''}`}>
                <span className="rank">{['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}.`}</span>
                <span>
                  {c.username}{' '}
                  <span className="sub">· {c.games} game{c.games === 1 ? '' : 's'}</span>
                </span>
                <span className="pts">{c.points} pts</span>
              </div>
            )
          }
          return (
            <>
              {(crownAll ? all : short.top).map(row)}
              {!crownAll && short.me && <>
                {short.gap && <div className="boardgap" aria-hidden="true">⋯</div>}
                {row(short.me)}
              </>}
              <MoreToggle
                open={crownAll} hidden={short.hidden} total={all.length}
                onToggle={() => setCrownAll(!crownAll)}
                label={crownAll ? 'Show the top five' : `Show all ${all.length} players`}
              />
            </>
          )
        })()}
      </div>

      {prefsError && <div className="flash err gridflash" role="status">{prefsError}</div>}

      <div className="searchrow">
        <input
          className="input gamesearch"
          type="search"
          placeholder="Search games"
          aria-label="Search games"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        />
        <button
          className={`filterbtn${filtered ? ' on' : ''}`}
          aria-expanded={filterOpen}
          aria-label="Filter games by category"
          title="Filter by category"
          onClick={() => setFilterOpen((v) => !v)}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M2.5 4h15l-6 7v5l-3 1.5V11z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {filtered && <span className="filtername">{groups.find((group) => group.id === only).title}</span>}
        </button>
      </div>
      {filterOpen && (
        <div className="scopechips filterchips" role="group" aria-label="Show games in">
          {[{ id: 'all', title: 'All games' }, ...groups].map((group) => (
            <button
              key={group.id}
              className={`scopechip${(group.id === 'all' ? !filtered : only === group.id) ? ' active' : ''}`}
              aria-pressed={group.id === 'all' ? !filtered : only === group.id}
              onClick={() => setOnly(group.id)}
            >
              {group.title}
            </button>
          ))}
        </div>
      )}
      {search && shownGroups.length === 0 && <p className="hint nomatch">No games match “{query.trim()}”{filtered ? ' in this group' : ''}.</p>}

      {shownGroups.map((group) => {
        // searching or filtering opens the groups shown so a match is never hidden in a collapsed one
        const open = search !== '' || filtered || !collapsed.has(group.id)
        return (
          <section
            key={group.id}
            className={`gamegroup${draggingCategory === group.id ? ' dragging' : ''}`}
            aria-label={group.title}
            data-categoryid={group.movable ? group.id : undefined}
            data-group={group.id}
          >
            <div className="grouphead">
              <button
                className="grouptoggle"
                aria-expanded={open}
                onClick={() => toggleCollapsed(group.id)}
              >
                <span className={`chevron${open ? ' open' : ''}`} aria-hidden="true">›</span>
                <span className="grouptitle">{group.title}</span>
                <span className="groupcount">{group.games.length}</span>
              </button>
              {group.movable && (
                <button
                  className="iconbtn handle"
                  aria-label={`Move the ${group.title.replace(/^\S+ /, '')} group. Drag, or use the arrow keys`}
                  title="Drag to move this group"
                  onPointerDown={(e) => startCategoryDrag(e, group.id)}
                  onKeyDown={(e) => {
                    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]
                    if (!step) return
                    e.preventDefault()
                    const el = e.currentTarget
                    nudgeCategory(group.id, step)
                    requestAnimationFrame(() => el.focus())
                  }}
                >
                  ⠿
                </button>
              )}
            </div>
            {open && (
              <div className="tilegrid">
                {group.games.map((g) => (
                  <GameTile
                    key={g.id}
                    game={g}
                    entries={boardsByGame[g.id] ?? []}
                    me={me}
                    isToday={isToday}
                    favorite={favSet.has(g.id)}
                    dragging={draggingKey === `${group.id}:${g.id}`}
                    onFavorite={toggleFavorite}
                    onDragStart={(e, game) => startDrag(e, game, group.id)}
                    onNudge={(game, step) => nudge(game, step, group.id)}
                    onRemove={remove}
                    onManual={submitManual}
                    onPlay={setPlaying}
                    onLeave={leftForGame}
                    onOpenDay={(e) => onOpenDay({ userId: e.userId, date, submissionId: e.submissionId })}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
      {games.length > 0 && favGames.length === 0 && (
        <p className="hint layouthint">Tap a game to play it. ☆ pins it to the top, ⠿ moves it.</p>
      )}

      <Suggestions />

      {playing && <GamePanel game={playing} onClose={closePanel} onSaved={() => { finishHowTo(); load(null) }} />}
    </div>
  )
}

// a share without its link lines, which only lead back to the game
// A short board: the first `top` rows, plus mine underneath when I'm further down, so you always
// see your own place. `gap`: rows between the top and me that aren't shown (a ⋯ goes there).
function leaders(all, top, isMe) {
  const head = all.slice(0, top)
  const at = all.findIndex(isMe)
  if (at < top) return { top: head, me: null, gap: false, hidden: all.length - head.length }
  return { top: head, me: all[at], gap: at > top, hidden: all.length - head.length - 1 }
}

// "Show all 8" / "Show less" under a short board
function MoreToggle({ open, hidden, total, onToggle, label }) {
  if (!hidden && !open) return null
  return (
    <button className="boardmore" aria-expanded={open} onClick={onToggle} aria-label={label}>
      {open ? 'Show less' : `Show all ${total}`} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
  )
}

// A played game's full board: everyone's result with what they pasted (the iPhone app's game page).
function BoardPanel({ game, entries, me, isToday, onClose, onOpenDay, onPlay }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // a portal still passes clicks up to the tile in React, so stop them here
  return createPortal(
    <div
      className="gamepanel-backdrop"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="card infopanel boardpanel" role="dialog" aria-modal="true" aria-labelledby={`board-${game.id}`}>
        <div className="infohead">
          <div className="tilehead">
            <div className="gameicon" style={{ background: game.color }}>{game.emoji}</div>
            <div className="titles">
              <h3 id={`board-${game.id}`}>{game.name}</h3>
              <div className="hint">Ranked by {game.metricLabel}, {game.better === 'higher' ? 'higher' : 'lower'} is better</div>
            </div>
          </div>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {isToday && (
          <a className="btn boardplay" href={game.url} target="_blank" rel="noreferrer" onClick={(e) => onPlay(e)}>
            Open {game.name} ↗
          </a>
        )}
        <ol className="boardfull">
          {entries.map((e) => {
            const share = shareBody(e.shareText)
            return (
              // who and how they did on the left, what they pasted beside it
              <li key={e.userId} className={`boardentry${e.userId === me.id ? ' me' : ''}`}>
                <div className="entrywho">
                  <div className="entryname">
                    <span className="rank">{['🥇', '🥈', '🥉'][e.rank - 1] ?? `${e.rank}.`}</span>
                    <span className="who">{e.username}</span>
                  </div>
                  <div className="score">{e.display}{!e.verified && <span className="unverified"> ~manual</span>}</div>
                  <button className="linklike feedlink" onClick={() => { onClose(); onOpenDay(e) }}>
                    Feed →
                  </button>
                </div>
                {share ? <pre className="sharetext">{share}</pre> : <p className="hint sharenone">Typed in, nothing pasted.</p>}
              </li>
            )
          })}
        </ol>
      </div>
    </div>,
    document.body,
  )
}

function shareBody(text) {
  if (!text) return null
  const body = text
    .split('\n')
    .filter((line) => !/^\s*(https?:\/\/|www\.)\S*\s*$/i.test(line))
    .join('\n')
    .trim()
  return body || null
}

// "Next in 4h 12m", ticking; seconds in the last hour
function NextDrop() {
  const [left, setLeft] = useState(untilLocalMidnight)
  useEffect(() => {
    const timer = setInterval(() => setLeft(untilLocalMidnight()), 1000)
    return () => clearInterval(timer)
  }, [])
  const secs = Math.max(0, Math.floor(left / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const label = h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s`
  return (
    <span className="nextdrop" title="You've played today's. The next one comes out at midnight." aria-label={`Next puzzle in ${label}`}>
      Next in {label}
    </span>
  )
}

function GameTile({
  game, entries, me, isToday, favorite, dragging,
  onFavorite, onDragStart, onNudge, onRemove, onManual, onPlay, onLeave, onOpenDay,
}) {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')
  const [paidOpen, setPaidOpen] = useState(false)
  const [boardAll, setBoardAll] = useState(false) // every score, not just the top three
  const [opened, setOpened] = useState(() => new Set()) // names clicked open to show their paste
  const [detail, setDetail] = useState(false) // the full board with everyone's pastes
  const toggleShare = (id) => setOpened((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const mine = entries.find((e) => e.userId === me.id)
  const short = leaders(entries, 3, (e) => e.userId === me.id)

  // Play: in the app, native decides between the in-app game browser and Safari; on the site,
  // games that allow framing open in a panel (cmd/ctrl-click still opens a tab), others a new tab
  const play = (e, viaLink) => {
    if (inApp) {
      e.preventDefault()
      tellNative({ type: 'open', url: game.url, gameId: game.id, name: game.name, emoji: game.emoji, color: game.color })
      return
    }
    const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0
    if (game.embed && !newTab) {
      e.preventDefault()
      onPlay(game)
      return
    }
    // a new tab: offer to paste the result when the player comes back
    if (isToday) onLeave(game)
    if (!viaLink) window.open(game.url, '_blank', 'noopener')
  }

  return (
    <div
      className={`card tile playable${dragging ? ' dragging' : ''}`}
      data-gameid={game.id}
      // the whole card plays the game, or once you've played (or on a past day) opens the full
      // board with everyone's pastes; its own buttons and links keep their jobs. Keyboard users
      // get the same through the Play link and the names.
      onClick={(e) => {
        if (e.target.closest('button, a, input, textarea, .sharedrop, .manualrow, .paidinfo')) return
        if (!isToday || mine) setDetail(true)
        else play(e, false)
      }}
    >
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
          {/* played today: the time until the next puzzle instead of Play (the card still opens it) */}
          {isToday && mine ? (
            <NextDrop />
          ) : (
            <a
              className="playlink"
              href={game.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => play(e, true)}
            >
              Play ↗
            </a>
          )}
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
      ) : (<>{
        [...(boardAll ? entries : short.top), ...(!boardAll && short.me ? [null, short.me] : [])].map((e) => {
          // null: the ⋯ between the top three and my own row further down
          if (!e) return short.gap ? <div key="gap" className="boardgap" aria-hidden="true">⋯</div> : null
          const share = shareBody(e.shareText)
          const open = opened.has(e.userId)
          return (
            <div key={e.userId}>
            <div className={`boardrow${e.userId === me.id ? ' me' : ''}`}>
              <span className="rank">{['🥇', '🥈', '🥉'][e.rank - 1] ?? `${e.rank}.`}</span>
              <span>
                {/* a name drops down what they pasted */}
                <button
                  className="whobtn"
                  aria-expanded={open}
                  title={`What ${e.userId === me.id ? 'you' : e.username} pasted`}
                  onClick={() => toggleShare(e.userId)}
                >
                  {e.username}
                </button>
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
            {open && (
              <div className="sharedrop">
                {share ? <pre className="sharetext">{share}</pre> : <p className="hint sharenone">Typed in, so there's nothing pasted to show.</p>}
                <button className="linklike feedlink" onClick={() => onOpenDay(e)}>
                  {e.userId === me.id ? 'Your' : `${e.username}'s`} day on the Feed →
                </button>
              </div>
            )}
            </div>
          )
        })}
        <MoreToggle
          open={boardAll} hidden={short.hidden} total={entries.length}
          onToggle={() => setBoardAll(!boardAll)}
          label={boardAll ? `Show the top three for ${game.name}` : `Show all ${entries.length} ${game.name} scores`}
        />
      </>)}
      {detail && (
        <BoardPanel
          game={game} entries={entries} me={me} isToday={isToday}
          onClose={() => setDetail(false)}
          onOpenDay={onOpenDay}
          onPlay={(e) => {
            setDetail(false)
            play(e, true)
          }}
        />
      )}
    </div>
  )
}
