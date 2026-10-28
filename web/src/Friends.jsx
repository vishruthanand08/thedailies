import { useEffect, useState } from 'react'
import { api } from './api.js'
import Leaderboards from './Leaderboards.jsx'

// survives StrictMode's double-mount so an invite only fires one request
let inviteHandledFor = null

export default function Friends({ me, pendingAdd, onPendingDone }) {
  const [data, setData] = useState(null)
  const [name, setName] = useState('')
  const [flash, setFlash] = useState(null)
  const [copied, setCopied] = useState(false)
  // a friend just added (accepted, or both asked): their friends come up first, to keep going
  const [justAdded, setJustAdded] = useState(null)
  const [version, setVersion] = useState(0) // refreshes suggestions when the friend list changes

  const load = () => api.get('/friends').then((d) => {
    setData(d)
    setVersion((v) => v + 1)
  })
  const added = (d) => {
    if (d.accepted) setJustAdded(d.user)
  }
  useEffect(() => {
    load()
    // arrived via an invite link (/?add=username) — send the request automatically
    if (pendingAdd && me && inviteHandledFor !== `${me.username}>${pendingAdd}`) {
      inviteHandledFor = `${me.username}>${pendingAdd}`
      if (pendingAdd === me.username) {
        onPendingDone?.()
        return
      }
      api.post('/friends/request', { username: pendingAdd })
        .then((d) => {
          setFlash({
            kind: 'ok',
            msg: d.accepted ? `You and ${d.user.username} are now friends 🤝` : `Friend request sent to ${d.user.username} ✓`,
          })
          added(d)
        })
        .catch((err) => setFlash({ kind: 'err', msg: err.message }))
        .finally(() => {
          load()
          onPendingDone?.()
        })
    }
  }, [])

  const inviteLink = `${window.location.origin}/?add=${me.username}`
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFlash({ kind: 'ok', msg: `Copy it manually: ${inviteLink}` })
    }
  }

  const add = async (e) => {
    e.preventDefault()
    setFlash(null)
    try {
      const d = await api.post('/friends/request', { username: name })
      setFlash({ kind: 'ok', msg: d.accepted ? `You and ${d.user.username} are now friends 🤝` : `Request sent to ${d.user.username}` })
      added(d)
      setName('')
      load()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    }
  }

  const respond = async (user, accept) => {
    await api.post('/friends/respond', { userId: user.id, accept })
    if (accept) setJustAdded(user)
    load()
  }

  const remove = async (userId, username) => {
    if (!confirm(`Remove ${username}?`)) return
    await api.del(`/friends/${userId}`)
    load()
  }

  if (!data) return <div className="spin">loading…</div>

  return (
    <div className="friends">
      {/* finding friends first: by name, by link, then requests and suggestions */}
      <form className="card" onSubmit={add}>
        <h3 className="sectiontitle">Add a friend</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            placeholder="their username"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn coral" disabled={!name.trim()}>Add</button>
        </div>
        {flash && <div className={`flash ${flash.kind}`} style={{ marginTop: 10 }}>{flash.msg}</div>}
        <p className="hint" style={{ marginBottom: 0 }}>
          Your leaderboard is you + your friends. Everyone sees their own circle.
        </p>
      </form>

      <div className="card">
        <h3 className="sectiontitle">Your invite link</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            readOnly
            value={inviteLink}
            aria-label="Your invite link"
            onFocus={(e) => e.target.select()}
          />
          <button className="btn" type="button" onClick={copyInvite}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Send it to a friend — when they open it and sign in, it friend-requests you automatically.
        </p>
      </div>

      {data.incoming.length > 0 && (
        <div className="card">
          <h3 className="sectiontitle">Requests</h3>
          {data.incoming.map((u) => (
            <div key={u.id} className="friendrow">
              <div className="avatar">{u.username[0]}</div>
              <span>{u.username}</span>
              <div className="actions">
                <button className="btn small" onClick={() => respond(u, true)}>Accept</button>
                <button className="btn ghost small" onClick={() => respond(u, false)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {justAdded && (
        <PeopleYouMayKnow
          key={`via-${justAdded.id}`}
          via={justAdded}
          version={version}
          onChanged={load}
          onShowAll={() => setJustAdded(null)}
        />
      )}

      {!justAdded && <PeopleYouMayKnow key="all" version={version} onChanged={load} />}

      {/* keyed by the friend count, so it reloads when a friend is added or removed */}
      {data.friends.length > 0 ? (
        <Leaderboards key={data.friends.length} me={me} />
      ) : (
        <div className="card">
          <h3 className="sectiontitle">🏆 Leaderboard</h3>
          <p className="hint" style={{ margin: 0 }}>Add a friend to see who's winning, all time and by game.</p>
        </div>
      )}

      <div className="card">
        <h3 className="sectiontitle">Friends ({data.friends.length})</h3>
        {data.friends.length === 0 && <p className="hint">No friends yet — add them by username at the top.</p>}
        {data.friends.map((u) => (
          <div key={u.id} className="friendrow">
            <div className="avatar">{u.username[0]}</div>
            <span>{u.username}</span>
            <div className="actions">
              <button className="btn ghost small" onClick={() => remove(u.id, u.username)}>Remove</button>
            </div>
          </div>
        ))}
        {data.outgoing.length > 0 && (
          <>
            <h3 className="sectiontitle" style={{ marginTop: 14 }}>Pending</h3>
            {data.outgoing.map((u) => (
              <div key={u.id} className="friendrow">
                <div className="avatar">{u.username[0]}</div>
                <span>{u.username}</span>
                <span className="hint" style={{ marginLeft: 'auto' }}>waiting…</span>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  )
}

// "People you may know": friends of your friends, most friends in common first (server/friends.js).
// With `via`, just that friend's friends, shown right after adding them. Three at a time: hiding
// one brings up the next.
const SHOWN = 3
function PeopleYouMayKnow({ via, version, onChanged, onShowAll }) {
  const [list, setList] = useState(null)
  const [state, setState] = useState({}) // id -> 'sent' | 'friends' | error message

  useEffect(() => {
    api.get(`/friends/suggestions${via ? `?via=${via.id}` : ''}`).then((d) => setList(d.suggestions), () => setList([]))
  }, [via?.id, version])

  if (!list) return null
  if (list.length === 0) {
    // after adding someone, say why nothing shows rather than vanishing
    return via ? (
      <div className="card">
        <h3 className="sectiontitle">Friends of {via.username}</h3>
        <p className="hint" style={{ margin: 0 }}>
          No one new to add from {via.username}'s friends.{' '}
          <button className="linklike" onClick={onShowAll}>See all suggestions</button>
        </p>
      </div>
    ) : null
  }

  const add = async (u) => {
    try {
      const d = await api.post('/friends/request', { username: u.username })
      setState((s) => ({ ...s, [u.id]: d.accepted ? 'friends' : 'sent' }))
      if (d.accepted) onChanged()
    } catch (err) {
      setState((s) => ({ ...s, [u.id]: err.message }))
    }
  }

  const hide = async (u) => {
    setList((l) => l.filter((x) => x.id !== u.id))
    api.post('/friends/suggestions/dismiss', { userId: u.id }).catch(() => {})
  }

  const why = (u) => {
    const names = u.mutuals
    if (u.mutualCount === 1) return `Friends with ${names[0]}`
    if (u.mutualCount === 2) return `Friends with ${names[0]} and ${names[1]}`
    return `Friends with ${names[0]} and ${u.mutualCount - 1} more`
  }

  return (
    <div className="card suggestcard">
      <div className="cardhead">
        <h3 className="sectiontitle">{via ? `Friends of ${via.username}` : 'People you may know'}</h3>
        {via && <button className="linklike" onClick={onShowAll}>See all</button>}
      </div>
      {list.slice(0, SHOWN).map((u) => {
        const st = state[u.id]
        return (
          <div key={u.id} className="friendrow">
            <div className="avatar">{u.username[0]}</div>
            <div className="who">
              <span className="name">{u.username}</span>
              <span className="hint" title={why(u)}>{why(u)}</span>
            </div>
            <div className="actions">
              {st === 'sent' && <span className="hint">Requested ✓</span>}
              {st === 'friends' && <span className="hint">Friends 🤝</span>}
              {st && st !== 'sent' && st !== 'friends' && <span className="hint">{st}</span>}
              {!st && (
                <>
                  <button className="btn small" onClick={() => add(u)}>Add</button>
                  <button className="iconbtn" aria-label={`Hide ${u.username}`} title="Hide" onClick={() => hide(u)}>✕</button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
