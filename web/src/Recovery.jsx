import { useEffect, useState } from 'react'
import { api } from './api.js'
import { appleSignInWorks } from './native.js'

// Account recovery on the website (server/account.js): an optional email on the profile, the
// links emails send (?verify= and ?reset=), Forgot password on the sign-in page, and the nudge
// to choose a new password after support hands out a temporary one.

const SUPPORT = 'thedailiessupport@gmail.com'
const supportLink = (username) =>
  `mailto:${SUPPORT}?subject=${encodeURIComponent('Reset my password')}&body=${encodeURIComponent(
    `Hi! I can't sign in to The Dailies.\n\nMy username: ${username || '(your username)'}\n\nTo help us check it's you, tell us a friend on your board or a recent score:\n`
  )}`

const params = () => new URLSearchParams(window.location.search)
const clearParam = (name) => {
  const p = params()
  p.delete(name)
  const q = p.toString()
  window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''))
}

export const resetTokenInUrl = () => params().get('reset')

let emailAvailableCache
export function useEmailAvailable() {
  const [available, setAvailable] = useState(emailAvailableCache ?? false)
  useEffect(() => {
    if (emailAvailableCache !== undefined) return
    api.get('/auth/email-available').then(
      (d) => setAvailable((emailAvailableCache = Boolean(d.emailAvailable))),
      () => {}
    )
  }, [])
  return available
}

// ---------- the reset link: choose a new password ----------

export function ResetPassword({ token, onDone }) {
  const [username, setUsername] = useState(null)
  const [error, setError] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.get(`/auth/reset?token=${encodeURIComponent(token)}`).then(
      (d) => setUsername(d.username),
      (err) => setError(err.message)
    )
  }, [token])

  const finish = () => {
    clearParam('reset')
    onDone()
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/reset', { token, password })
      setDone(true)
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
      <form className="card authcard" onSubmit={submit}>
        <h3 className="sectiontitle">🔑 Choose a new password</h3>
        {done ? (
          <>
            <div className="flash ok">Password changed ✓ Sign in with your new password.</div>
            <button type="button" className="btn coral" onClick={finish}>Sign in →</button>
          </>
        ) : username ? (
          <>
            <p className="hint" style={{ margin: 0 }}>For <b>@{username}</b>. This signs you out everywhere else.</p>
            {/* lets password managers save the new password for the right account */}
            <input type="text" autoComplete="username" value={username} readOnly hidden />
            <input
              className="input"
              type="password"
              placeholder="new password (6+ characters)"
              aria-label="New password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <div className="flash err">{error}</div>}
            <button className="btn coral" disabled={busy || password.length < 6}>
              {busy ? 'Saving…' : 'Save new password →'}
            </button>
          </>
        ) : error ? (
          <>
            <div className="flash err">{error}</div>
            <button type="button" className="btn" onClick={finish}>Back to sign in</button>
          </>
        ) : (
          <div className="hint">Checking your link…</div>
        )}
      </form>
    </div>
  )
}

// ---------- the confirmation link: ?verify= ----------

// Confirms the email from the link (signed in or not) and says how it went, once.
export function VerifyNotice() {
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    const token = params().get('verify')
    if (!token) return
    clearParam('verify')
    api.post('/auth/email/verify', { token }).then(
      (d) => setNotice({ kind: 'ok', msg: `Email confirmed ✓ ${d.email} can now reset @${d.username}'s password.` }),
      (err) => setNotice({ kind: 'err', msg: err.message })
    )
  }, [])
  if (!notice) return null
  return (
    <div className={`flash ${notice.kind} topnotice`} role="status">
      <span>{notice.msg}</span>
      <button className="iconbtn" aria-label="Dismiss" onClick={() => setNotice(null)}>✕</button>
    </div>
  )
}

// ---------- Forgot password (on the sign-in page) ----------

export function ForgotPassword({ initial, onBack }) {
  const [login, setLogin] = useState(initial || '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const emailAvailable = useEmailAvailable()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/forgot', { login })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card authcard" onSubmit={submit}>
      <h3 className="sectiontitle">🔑 Forgot your password?</h3>
      {sent ? (
        <div className="flash ok">
          If that account has a confirmed email, a reset link is on its way. It works for an hour.
        </div>
      ) : emailAvailable ? (
        <>
          <p className="hint" style={{ margin: 0 }}>Enter your username or email and we'll email you a link to choose a new one.</p>
          <input
            className="input"
            placeholder="username or email"
            aria-label="Username or email"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
          />
          {error && <div className="flash err">{error}</div>}
          <button className="btn coral" disabled={busy || !login.trim()}>{busy ? 'Sending…' : 'Email me a link →'}</button>
        </>
      ) : null}
      <p className="hint" style={{ margin: 0 }}>
        {emailAvailable ? 'No email on your account? ' : ''}
        <a className="linklike" href={supportLink(login.trim())}>Email support</a> and we'll help you back in.
      </p>
      <div className="authtoggle">
        <button type="button" className="linklike" onClick={onBack}>← Back to sign in</button>
      </div>
    </form>
  )
}

// ---------- the profile's Email card ----------

export function EmailCard() {
  const [info, setInfo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const load = () => api.get('/auth/recovery').then(setInfo, () => {})
  useEffect(() => {
    load()
  }, [])

  if (!info?.emailAvailable) return null

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setFlash(null)
    try {
      const d = await api.post('/auth/email', { email })
      setFlash({ kind: 'ok', msg: `Check ${d.pendingEmail} for a link to confirm it.` })
      setEditing(false)
      setEmail('')
      load()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Remove your email? You won’t be able to reset your password by email.')) return
    await api.del('/auth/email')
    setFlash(null)
    load()
  }

  return (
    <div className="card">
      <div className="cardhead">
        <h3 className="sectiontitle">✉️ Email</h3>
        {!editing && (
          <button className="btn ghost small" onClick={() => { setEditing(true); setFlash(null) }}>
            {info.email ? 'Change' : 'Add email'}
          </button>
        )}
      </div>
      {info.email ? (
        <p className="hint" style={{ margin: 0 }}>
          <b>{info.email}</b> ✓ confirmed. If you forget your password, we'll send a reset link here.{' '}
          <button className="linklike" onClick={remove}>Remove</button>
        </p>
      ) : (
        <p className="hint" style={{ margin: 0 }}>
          Add an email so you can reset your password if you forget it. It's only used for that.
        </p>
      )}
      {info.pendingEmail && info.pendingEmail !== info.email && !editing && (
        <p className="hint" style={{ margin: '8px 0 0' }}>Waiting for you to confirm <b>{info.pendingEmail}</b>: check your inbox.</p>
      )}
      {editing && (
        <form className="suggestform" onSubmit={send} style={{ marginTop: 10 }}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <div className="row">
            <button className="btn coral small" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send confirmation'}</button>
            <button type="button" className="btn ghost small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
      {flash && <div className={`flash ${flash.kind}`} role="status" style={{ marginTop: 10 }}>{flash.msg}</div>}
    </div>
  )
}

// ---------- the account banner (top of every tab but the profile) ----------

// One nudge at a time, most important first:
// 1. signed in with a temporary password from support: choose your own
// 2. an email waiting to be confirmed (new sign-ups): check your inbox, or resend
// 3. no email (accounts from before emails): add one, or "Not now" for a week
const LATER_KEY = 'dailies.emailNudgeLater'
const LATER_DAYS = 7
const laterUntil = () => {
  try {
    return Number(localStorage.getItem(LATER_KEY)) || 0
  } catch {
    return 0
  }
}

export function AccountNudge({ me, onOpenProfile }) {
  const [info, setInfo] = useState(null)
  const [hidden, setHidden] = useState(() => laterUntil() > Date.now())
  const [sent, setSent] = useState(null) // message after a resend

  useEffect(() => {
    api.get('/auth/recovery').then(setInfo, () => {})
  }, [me.mustChangePassword])

  if (me.mustChangePassword) {
    return (
      <div className="card nudgecard" role="status">
        <span>🔑 You signed in with a temporary password. Choose your own now.</span>
        <button className="btn coral small" onClick={onOpenProfile}>Change password</button>
      </div>
    )
  }
  if (!info?.emailAvailable || info.email) return null

  if (info.pendingEmail) {
    const resend = async () => {
      try {
        await api.post('/auth/email', { email: info.pendingEmail })
        setSent('Sent again ✓ Check your inbox (and spam).')
      } catch (err) {
        setSent(err.message)
      }
    }
    return (
      <div className="card nudgecard" role="status">
        <span>✉️ Confirm your email: we sent a link to <b>{info.pendingEmail}</b>.{sent ? ` ${sent}` : ''}</span>
        {!sent && <button className="btn small" onClick={resend}>Resend</button>}
        <button className="btn ghost small" onClick={onOpenProfile}>Change email</button>
      </div>
    )
  }

  if (hidden) return null
  const later = () => {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now() + LATER_DAYS * 86400000))
    } catch {
      // storage unavailable: it just shows again next time
    }
    setHidden(true)
  }
  return (
    <div className="card nudgecard" role="status">
      <span>✉️ Add an email so you can always get back into your account if you forget your password.</span>
      <button className="btn coral small" onClick={onOpenProfile}>Add email</button>
      <button className="btn ghost small" onClick={later}>Not now</button>
    </div>
  )
}

// ---------- Sign in with Apple (website) ----------
// Apple's own script opens Apple's sign-in in a popup and hands back a signed token, which the
// server checks (server/appleid.js). A new Apple account picks a username in a second step.

let appleConfigCache
export function useAppleConfig() {
  const [config, setConfig] = useState(appleConfigCache ?? null)
  useEffect(() => {
    if (appleConfigCache !== undefined || !appleSignInWorks) return
    api.get('/auth/apple/config').then((d) => setConfig((appleConfigCache = d.enabled ? d : null)), () => {})
  }, [])
  return config
}

const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
let appleScript
function loadAppleScript() {
  appleScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = APPLE_JS
    s.onload = () => resolve(window.AppleID)
    s.onerror = () => {
      appleScript = null
      reject(new Error('Couldn’t reach Apple. Check your connection.'))
    }
    document.head.appendChild(s)
  })
  return appleScript
}

// Apple's popup: resolves to { identityToken, code, nonce }, or null if they closed it.
async function askApple(config) {
  const AppleID = await loadAppleScript()
  const nonce = crypto.randomUUID()
  AppleID.auth.init({ clientId: config.clientId, scope: 'name email', redirectURI: config.redirectURI, usePopup: true, nonce })
  try {
    const r = await AppleID.auth.signIn()
    return { identityToken: r.authorization.id_token, code: r.authorization.code, nonce }
  } catch (err) {
    if (err?.error === 'popup_closed_by_user' || err?.error === 'user_cancelled_authorize') return null
    throw new Error('Apple sign-in didn’t finish. Try again.')
  }
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 17 20" width="15" height="18" aria-hidden="true">
      <path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z" />
    </svg>
  )
}

/** "Continue with Apple" on the sign-in page; a new Apple account chooses its username next. */
export function AppleSignIn({ onAuth, onPicking }) {
  const config = useAppleConfig()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(null) // the Apple sign-in, waiting for a username
  const [username, setUsername] = useState('')

  if (!config) return null

  const finish = async (body) => {
    const d = await api.post('/auth/apple', body)
    if (d.needsUsername) {
      onPicking?.(true)
      setPending(body)
      setUsername(d.suggestion || '')
      return
    }
    onAuth(d.user)
  }

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const got = await askApple(config)
      if (got) await finish(got)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const pick = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await finish({ ...pending, username })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    return (
      <form className="card authcard" onSubmit={pick}>
        <h3 className="sectiontitle">Pick a username</h3>
        <p className="hint" style={{ margin: 0 }}>It's how friends find you. Letters, numbers and _.</p>
        <input
          className="input"
          placeholder="username"
          aria-label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoFocus
        />
        {error && <div className="flash err">{error}</div>}
        <button className="btn coral" disabled={busy || username.trim().length < 2}>{busy ? 'Creating…' : 'Start playing →'}</button>
      </form>
    )
  }

  return (
    <div className="applesignin">
      <button type="button" className="btn applebtn" onClick={start} disabled={busy}>
        <AppleLogo /> {busy ? 'Signing in…' : 'Continue with Apple'}
      </button>
      {error && <div className="flash err">{error}</div>}
      <div className="ordivider"><span>or with a username</span></div>
    </div>
  )
}

/** The profile's Apple card: link Apple to an existing account, or unlink it. */
export function AppleCard() {
  const config = useAppleConfig()
  const [info, setInfo] = useState(null)
  const [flash, setFlash] = useState(null)
  const load = () => api.get('/auth/recovery').then(setInfo, () => {})
  useEffect(() => {
    load()
  }, [])
  if (!config || !info) return null

  const link = async () => {
    setFlash(null)
    try {
      const got = await askApple(config)
      if (!got) return
      await api.post('/auth/apple/link', got)
      setFlash({ kind: 'ok', msg: 'Apple linked ✓ You can sign in with Apple from now on.' })
      load()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    }
  }
  const unlink = async () => {
    if (!confirm('Unlink Apple? You’ll sign in with your username and password.')) return
    try {
      await api.del('/auth/apple/link')
      setFlash(null)
      load()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    }
  }

  return (
    <div className="card">
      <div className="cardhead">
        <h3 className="sectiontitle"><AppleLogo /> Sign in with Apple</h3>
        {info.appleLinked
          ? info.hasPassword && <button className="btn ghost small" onClick={unlink}>Unlink</button>
          : <button className="btn small applebtn" onClick={link}><AppleLogo /> Link Apple</button>}
      </div>
      <p className="hint" style={{ margin: 0 }}>
        {info.appleLinked
          ? 'Linked ✓ Sign in with one tap, no password to remember.'
          : 'Link your Apple ID to sign in with one tap, on the website and the app.'}
      </p>
      {flash && <div className={`flash ${flash.kind}`} role="status" style={{ marginTop: 10 }}>{flash.msg}</div>}
    </div>
  )
}
