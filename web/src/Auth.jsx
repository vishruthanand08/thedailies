import { useState } from 'react'
import { api } from './api.js'
import { inApp } from './native.js'
import { AppleSignIn, ForgotPassword, useEmailAvailable } from './Recovery.jsx'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login') // login | register | forgot
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('') // at sign-up, for getting back in; confirmed afterwards
  const emailAvailable = useEmailAvailable()
  const [pickingName, setPickingName] = useState(false) // new Apple account choosing a username
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const signingUp = mode === 'register'
      const d = await api.post(`/auth/${mode}`, signingUp && emailAvailable ? { username, password, email } : { username, password })
      // the account is ready to play now; the confirmation email follows (the banner offers a resend)
      if (signingUp && emailAvailable && email.trim()) await api.post('/auth/email', { email }).catch(() => {})
      onAuth(d.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="pill">The</span>
          <span className="rest">Dailies</span>
        </div>
      </header>

      <div className="hero">
        <h1>
          Beat your friends
          <br />
          at <span className="accent">everything</span>
        </h1>
        <p>One leaderboard for Wordle, Queens, GeoGuessr, and every other daily you're addicted to.</p>
      </div>

      {mode !== 'forgot' && <AppleSignIn onAuth={onAuth} onPicking={setPickingName} />}
      {pickingName ? null : mode === 'forgot' ? <ForgotPassword initial={username} onBack={() => setMode('login')} /> : (
      <form className="card authcard" onSubmit={submit}>
        <input
          className="input"
          placeholder="username"
          aria-label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <input
          className="input"
          type="password"
          placeholder="password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'register' && emailAvailable && (
          <input
            className="input"
            type="email"
            placeholder="email (for password resets)"
            aria-label="Email, to get back in if you forget your password"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        )}
        {error && <div className="flash err">{error}</div>}
        <button className="btn coral" disabled={busy || (mode === 'register' && emailAvailable && !email.trim())}>
          {mode === 'login' ? 'Sign in →' : 'Create account →'}
        </button>
        <div className="authtoggle">
          {mode === 'login' ? (
            <>
              New here? <button type="button" className="linklike" onClick={() => setMode('register')}>Make an account</button>
              {' · '}
              <button type="button" className="linklike" onClick={() => { setError(null); setMode('forgot') }}>Forgot password?</button>
            </>
          ) : (
            <>Already in? <button type="button" className="linklike" onClick={() => setMode('login')}>Sign in</button></>
          )}
        </div>
        {/* app-only until the app ships: the pages describe the iPhone/Mac app */}
        {inApp && <div className="authtoggle legal">
          <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> ·{' '}
          <a href="/support" target="_blank" rel="noreferrer">Support</a>
        </div>}
      </form>
      )}
    </div>
  )
}
