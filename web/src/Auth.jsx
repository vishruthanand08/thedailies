import { useState } from 'react'
import { api } from './api.js'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const d = await api.post(`/auth/${mode}`, { username, password })
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
        {error && <div className="flash err">{error}</div>}
        <button className="btn coral" disabled={busy}>
          {mode === 'login' ? 'Sign in →' : 'Create account →'}
        </button>
        <div className="authtoggle">
          {mode === 'login' ? (
            <>New here? <button type="button" className="linklike" onClick={() => setMode('register')}>Make an account</button></>
          ) : (
            <>Already in? <button type="button" className="linklike" onClick={() => setMode('login')}>Sign in</button></>
          )}
        </div>
      </form>
    </div>
  )
}
