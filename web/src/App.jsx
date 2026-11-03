import { useEffect, useState } from 'react'
import { api } from './api.js'
import { tellNative } from './native.js'
import Auth from './Auth.jsx'
import Today from './Today.jsx'
import Feed from './Feed.jsx'
import Friends from './Friends.jsx'
import Profile from './Profile.jsx'
import Global from './Global.jsx'
import Admin from './Admin.jsx'
import { DesktopAppPrompt } from './DesktopApp.jsx'

export default function App() {
  const [me, setMe] = useState(undefined) // undefined = loading, null = signed out
  const [tab, setTab] = useState('today')
  // a player's day to open on the Feed, from tapping their name on Today: { userId, date, submissionId }
  const [feedFocus, setFeedFocus] = useState(null)
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

  // kudos I haven't seen yet: a count on the Feed tab, checked on each tab change and every minute
  const [unseen, setUnseen] = useState(0)
  useEffect(() => {
    if (!me) return
    const check = () => api.get('/feed/unseen').then((d) => setUnseen(d.count), () => {})
    check()
    const timer = setInterval(check, 60000)
    return () => clearInterval(timer)
  }, [me, tab])

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
        {/* your profile (stats, password, devices) lives here, not in the tabs */}
        <button
          className={`userchip${tab === 'you' ? ' active' : ''}`}
          onClick={() => setTab('you')}
          aria-label="Your profile"
          aria-current={tab === 'you' ? 'page' : undefined}
        >
          <span className="avatar small">{me.username[0]}</span>
          <span>@{me.username}</span>
        </button>
      </header>

      <nav className="tabs">
        {/* You stays as a hidden tab: the apps open the profile by clicking it (WebController.showTab,
            the Mac and Windows ⌘4), including app builds already out */}
        {[['today', 'Today'], ['feed', 'Feed'], ['friends', 'Friends'], ['global', 'Global'], ['you', 'You'], ...(me.admin ? [['admin', 'Admin']] : [])].map(([id, label]) => (
          <button
            key={id}
            hidden={id === 'you'}
            className={`tab${tab === id ? ' active' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'feed' && unseen > 0 && (
              <span className="tabbadge" aria-label={`${unseen} new kudos`}>{unseen}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'today' && <Today me={me} onOpenDay={(focus) => { setFeedFocus(focus); setTab('feed') }} />}
      {tab === 'feed' && <Feed me={me} onSeen={() => setUnseen(0)} focus={feedFocus} onFocused={() => setFeedFocus(null)} />}
      {tab === 'friends' && <Friends me={me} pendingAdd={pendingAdd} onPendingDone={consumePendingAdd} />}
      {tab === 'global' && <Global />}
      {tab === 'you' && <Profile me={me} onLogout={logout} />}
      {tab === 'admin' && me.admin && <Admin />}
      <DesktopAppPrompt />
    </div>
  )
}
