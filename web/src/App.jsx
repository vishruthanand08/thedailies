import { useEffect, useState } from 'react'
import { api } from './api.js'
import { tellNative } from './native.js'
import Auth from './Auth.jsx'
import Today from './Today.jsx'
import Feed from './Feed.jsx'
import Friends from './Friends.jsx'
import Profile from './Profile.jsx'

export default function App() {
  const [me, setMe] = useState(undefined) // undefined = loading, null = signed out
  const [tab, setTab] = useState('today')
  // ?add=username from an invite link — kept through login/signup, consumed in Friends
  const [pendingAdd, setPendingAdd] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('add')
    return p ? p.toLowerCase() : null
  })

  useEffect(() => {
    api.get('/auth/me')
      .then((d) => setMe(d.user))
      .catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (me && pendingAdd) setTab('friends')
  }, [me, pendingAdd])

  // keep the native shell's view of who is signed in current (login, signup, logout)
  useEffect(() => {
    if (me !== undefined) tellNative({ type: 'session', user: me ? { id: me.id, username: me.username } : null })
  }, [me])

  const consumePendingAdd = () => {
    setPendingAdd(null)
    window.history.replaceState(null, '', window.location.pathname)
  }

  if (me === undefined) return <div className="spin">loading…</div>
  if (me === null) return <Auth onAuth={setMe} />

  const logout = async () => {
    await api.post('/auth/logout')
    setMe(null)
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="pill">The</span>
          <span className="rest">Dailies</span>
        </div>
        <button className="userchip" onClick={() => setTab('you')} aria-label="Your profile">
          <span className="avatar small">{me.username[0]}</span>
          <span>@{me.username}</span>
        </button>
      </header>

      <nav className="tabs">
        {[['today', 'Today'], ['feed', 'Feed'], ['friends', 'Friends'], ['you', 'You']].map(([id, label]) => (
          <button
            key={id}
            className={`tab${tab === id ? ' active' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'today' && <Today me={me} />}
      {tab === 'feed' && <Feed me={me} />}
      {tab === 'friends' && <Friends me={me} pendingAdd={pendingAdd} onPendingDone={consumePendingAdd} />}
      {tab === 'you' && <Profile me={me} onLogout={logout} />}
    </div>
  )
}
