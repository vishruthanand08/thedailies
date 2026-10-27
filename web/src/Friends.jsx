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

  const load = () => api.get('/friends').then(setData)
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
        .then((d) =>
          setFlash({
            kind: 'ok',
            msg: d.accepted ? `You and ${d.user.username} are now friends 🤝` : `Friend request sent to ${d.user.username} ✓`,
          })
        )
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
      setName('')
      load()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    }
  }

  const respond = async (userId, accept) => {
    await api.post('/friends/respond', { userId, accept })
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
      {data.incoming.length > 0 && (
        <div className="card">
          <h3 className="sectiontitle">Requests</h3>
          {data.incoming.map((u) => (
            <div key={u.id} className="friendrow">
              <div className="avatar">{u.username[0]}</div>
              <span>{u.username}</span>
              <div className="actions">
                <button className="btn small" onClick={() => respond(u.id, true)}>Accept</button>
                <button className="btn ghost small" onClick={() => respond(u.id, false)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.friends.length > 0 ? (
        <Leaderboards me={me} />
      ) : (
        <div className="card">
          <h3 className="sectiontitle">🏆 Leaderboard</h3>
          <p className="hint" style={{ margin: 0 }}>Add a friend to see who's winning, all time and by game.</p>
        </div>
      )}

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

      <div className="card">
        <h3 className="sectiontitle">Friends ({data.friends.length})</h3>
        {data.friends.length === 0 && <p className="hint">No friends yet — add them by username above.</p>}
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
