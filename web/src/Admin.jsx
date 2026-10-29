import { useEffect, useState } from 'react'
import { api } from './api.js'

// Admins only (the server checks too): each game's scoring values, the game suggestions, and
// deleting a user's account.
export default function Admin() {
  return (
    <div className="admin">
      <ScoringEditor />
      <SuggestionsAdmin />
      <UsersAdmin />
    </div>
  )
}

const when = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'

// Look an account up first, then type its name to delete it and everything it has (the same as
// Delete account on its own You tab). It can't be undone, so the lookup says what goes with it.
function UsersAdmin() {
  const [name, setName] = useState('')
  const [user, setUser] = useState(null)
  const [confirm, setConfirm] = useState('')
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)

  const lookUp = async (e) => {
    e.preventDefault()
    setFlash(null)
    setUser(null)
    setConfirm('')
    try {
      setUser(await api.get(`/admin/users/${encodeURIComponent(name.trim().replace(/^@/, ''))}`))
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    }
  }

  const remove = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const d = await api.del(`/admin/users/${encodeURIComponent(user.username)}`, { confirm })
      setFlash({ kind: 'ok', msg: `Deleted @${d.username} and everything tied to the account.` })
      setUser(null)
      setName('')
      setConfirm('')
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 className="sectiontitle">🧹 Delete a user</h3>
      <p className="hint small">Look someone up by username. Deleting removes their scores, friendships, kudos, suggestions and devices for good.</p>
      <form className="adminfind" onSubmit={lookUp}>
        <input className="input" placeholder="username" value={name} onChange={(e) => setName(e.target.value)} aria-label="Username to look up" />
        <button className="btn" disabled={!name.trim()}>Look up</button>
      </form>
      {flash && <div className={`flash ${flash.kind}`} style={{ marginTop: 10 }}>{flash.msg}</div>}
      {user && (
        <div className="adminuser">
          <div className="who">
            <div className="avatar">{user.username[0]}</div>
            <div>
              <b>@{user.username}</b>
              <div className="sub">Joined {when(user.createdAt)} · last score {when(user.lastScoreAt)}</div>
            </div>
          </div>
          <ul className="adminfacts">
            <li><b>{user.scores}</b> scores</li>
            <li><b>{user.friends.length}</b> friends{user.friends.length ? `: ${user.friends.join(', ')}` : ''}</li>
            {user.pending.length > 0 && <li><b>{user.pending.length}</b> pending: {user.pending.join(', ')}</li>}
            <li><b>{user.kudos}</b> kudos given or received</li>
            <li><b>{user.suggestions}</b> game suggestions</li>
            <li><b>{user.devices}</b> signed-in app devices</li>
          </ul>
          {user.admin ? (
            <p className="hint">Admins can't be deleted here.</p>
          ) : (
            <form className="adminfind" onSubmit={remove}>
              <input
                className="input"
                placeholder={`type ${user.username} to confirm`}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-label={`Type ${user.username} to confirm`}
              />
              <button className="btn danger" disabled={busy || confirm.trim().toLowerCase() !== user.username}>
                {busy ? 'Deleting…' : 'Delete for good'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// Same curve as server/points.js, so the preview matches what a score would get.
function pointsFor(r, metric) {
  const span = r.zero - r.perfect
  const u = (metric - r.perfect) / span
  if (!Number.isFinite(u)) return null
  if (u <= 0) return 100
  if (u >= 1) return 0
  const a = (r.par - r.perfect) / span
  return Math.round(u <= a ? 100 - 50 * (u / a) ** 1.5 : 50 * (1 - ((u - a) / (1 - a)) ** 1.5))
}

// times are typed as m:ss, everything else as plain numbers
const isTime = (g) => g.metricLabel === 'time'
const show = (g, v) => (isTime(g) ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : String(v))
function read(g, text) {
  const t = String(text).trim()
  if (isTime(g)) {
    const m = t.match(/^(\d+):(\d{1,2})$/)
    if (m) return Number(m[1]) * 60 + Number(m[2])
  }
  return t === '' ? NaN : Number(t.replace(/,/g, ''))
}

function ScoringEditor() {
  const [games, setGames] = useState(null)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState(null)
  const load = () =>
    api.get('/admin/scoring').then((d) => setGames(d.games)).catch((err) => setError(err.message))
  useEffect(() => {
    load()
    api.get('/submissions/games').then((d) => setCategories(d.categories ?? []))
  }, [])

  return (
    <div className="card">
      <h3 className="sectiontitle">⚙️ Scoring</h3>
      <p className="hint small">
        Each score is worth 0 to 100: <b>perfect</b> or better is 100, <b>par</b> is 50, <b>zero</b> or worse is 0.
        Changes only apply to scores posted after you save; earlier scores keep their points. Times are m:ss.
      </p>
      {error && <div className="flash err">{error}</div>}
      {!games && !error && <div className="hint">loading…</div>}
      {games &&
        categories.map((c) => (
          <section key={c.id} className="admingroup">
            <h4>{c.emoji} {c.name}</h4>
            {games.filter((g) => g.category === c.id).map((g) => (
              <ScoringRow key={g.id} game={g} onSaved={load} />
            ))}
          </section>
        ))}
    </div>
  )
}

function ScoringRow({ game, onSaved }) {
  const [form, setForm] = useState({ perfect: show(game, game.perfect), par: show(game, game.par), zero: show(game, game.zero) })
  const [tryText, setTryText] = useState('')
  const [msg, setMsg] = useState(null)
  const values = { perfect: read(game, form.perfect), par: read(game, form.par), zero: read(game, form.zero) }
  const changed = values.perfect !== game.perfect || values.par !== game.par || values.zero !== game.zero
  const tryValue = read(game, tryText)
  const tryPoints = tryText && Number.isFinite(tryValue) ? pointsFor(values, tryValue) : null

  const save = async () => {
    setMsg(null)
    try {
      await api.put(`/admin/scoring/${game.id}`, values)
      setMsg({ kind: 'ok', text: 'Saved. New scores use these values.' })
      onSaved()
    } catch (err) {
      setMsg({ kind: 'err', text: err.message })
    }
  }
  const reset = async () => {
    setMsg(null)
    await api.del(`/admin/scoring/${game.id}`)
    setForm({ perfect: show(game, game.defaults.perfect), par: show(game, game.defaults.par), zero: show(game, game.defaults.zero) })
    setMsg({ kind: 'ok', text: 'Back to the default values.' })
    onSaved()
  }

  const field = (key, label) => (
    <label className="adminfield">
      <span>{label}</span>
      <input
        className="input"
        inputMode={isTime(game) ? 'text' : 'decimal'}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  )

  return (
    <div className="adminrow">
      <div className="adminname">
        <b>{game.emoji} {game.name}</b>
        <span className="sub">
          {game.metricLabel}, {game.better} is better{game.failAt != null ? ` · ${show(game, game.failAt)}+ is a fail` : ''}
        </span>
        {game.custom && game.edited && (
          <span className="sub">changed by {game.edited.by} · default {show(game, game.defaults.perfect)} / {show(game, game.defaults.par)} / {show(game, game.defaults.zero)}</span>
        )}
      </div>
      <div className="adminfields">
        {field('perfect', 'Perfect (100)')}
        {field('par', 'Par (50)')}
        {field('zero', 'Zero (0)')}
        <label className="adminfield">
          <span>Try a result</span>
          <input className="input" value={tryText} placeholder={isTime(game) ? '1:05' : ''} onChange={(e) => setTryText(e.target.value)} />
        </label>
        <span className="trypoints" aria-live="polite">{tryPoints != null ? `${tryPoints} pts` : ''}</span>
      </div>
      <div className="adminactions">
        <button className="btn small" disabled={!changed} onClick={save}>Save</button>
        {game.custom && <button className="linklike" onClick={reset}>Reset to default</button>}
        {msg && <span className={`flash inline ${msg.kind}`}>{msg.text}</span>}
      </div>
    </div>
  )
}

function SuggestionsAdmin() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const load = () =>
    api.get('/admin/suggestions').then((d) => setList(d.suggestions)).catch((err) => setError(err.message))
  useEffect(() => {
    load()
  }, [])

  const setStatus = async (s, status) => {
    await api.patch(`/admin/suggestions/${s.id}`, { status })
    load()
  }
  const remove = async (s) => {
    setConfirming(null)
    await api.del(`/admin/suggestions/${s.id}`)
    load()
  }

  return (
    <div className="card">
      <h3 className="sectiontitle">💡 Game suggestions</h3>
      <p className="hint small">Everyone's suggestions, most votes first. Added ones show “Added ✓” to players.</p>
      {error && <div className="flash err">{error}</div>}
      {list?.length === 0 && <p className="hint">No suggestions yet.</p>}
      {list?.length > 0 && (
        <ul className="suggestlist">
          {list.map((s) => (
            <li key={s.id} className={s.status === 'added' ? 'added' : undefined}>
              <span className="votecount" title="Votes">▲ {s.votes}</span>
              <div className="what">
                <div>
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer nofollow">{s.name}</a> : <b>{s.name}</b>}
                  <span className="sub"> · {s.by}</span>
                  {s.status === 'added' && <span className="addedtag">Added ✓</span>}
                </div>
                {s.note && <div className="sub">{s.note}</div>}
              </div>
              <div className="adminactions">
                {s.status === 'added' ? (
                  <button className="btn small ghost" onClick={() => setStatus(s, 'open')}>Reopen</button>
                ) : (
                  <button className="btn small" onClick={() => setStatus(s, 'added')}>Mark added</button>
                )}
                {confirming === s.id ? (
                  <button className="btn small danger" onClick={() => remove(s)}>Delete for good?</button>
                ) : (
                  <button className="btn small ghost" onClick={() => setConfirming(s.id)}>Remove</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
