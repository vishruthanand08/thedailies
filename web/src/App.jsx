import { useEffect, useState } from 'react'
import { api } from './api.js'
import Auth from './Auth.jsx'
import Today from './Today.jsx'
import Feed from './Feed.jsx'
import Friends from './Friends.jsx'

export default function App() {
  const [me, setMe] = useState(undefined) // undefined = loading, null = signed out
  const [tab, setTab] = useState('today')

  useEffect(() => {
    api.get('/auth/me')
      .then((d) => setMe(d.user))
      .catch(() => setMe(null))
  }, [])

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
          <span className="pill">Daily</span>
          <span className="rest">board</span>
        </div>
        <div className="userchip">
          <span>@{me.username}</span>
          <button className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </header>

      <nav className="tabs">
        {[['today', 'Today'], ['feed', 'Feed'], ['friends', 'Friends']].map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'today' && <Today me={me} />}
      {tab === 'feed' && <Feed me={me} />}
      {tab === 'friends' && <Friends />}
    </div>
  )
}
