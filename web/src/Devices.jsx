import { useEffect, useState } from 'react'
import { api, timeAgo } from './api.js'

// iCloud link to the "Save to The Dailies" Shortcut (see shortcuts/README.md); empty until published
const SHORTCUT_URL = ''

// Device tokens let the iOS Shortcut, the app and its share extension save scores without pasting.
export default function Devices() {
  const [tokens, setTokens] = useState(null)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState(null) // { name, token } shown once after creation
  const [copied, setCopied] = useState(false)
  const [flash, setFlash] = useState(null)

  const load = () => api.get('/auth/tokens').then((d) => setTokens(d.tokens))
  useEffect(() => {
    load()
  }, [])

  const create = async (e) => {
    e.preventDefault()
    setFlash(null)
    try {
      const d = await api.post('/auth/tokens', { name })
      setFresh({ name: d.name, token: d.token })
      setCopied(false)
      setName('')
      load()
    } catch (err) {
      setFlash(err.message)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fresh.token)
      setCopied(true)
    } catch {
      setFlash('Copy failed. Select the token and copy it by hand.')
    }
  }

  const remove = async (id) => {
    await api.del(`/auth/tokens/${id}`)
    if (fresh && tokens.find((t) => t.id === id)?.name === fresh.name) setFresh(null)
    load()
  }

  return (
    <form className="card" onSubmit={create}>
      <h3 className="sectiontitle">Devices</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        A device token lets the "Save to The Dailies" Shortcut or the app save scores straight from a
        game's Share button.
        {SHORTCUT_URL && (
          <>
            {' '}
            <a className="playlink" href={SHORTCUT_URL} target="_blank" rel="noreferrer">Get the Shortcut ↗</a>
          </>
        )}
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          className="input"
          placeholder="device name, e.g. My iPhone"
          aria-label="New device name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn coral" disabled={!name.trim()} style={{ whiteSpace: 'nowrap' }}>
          New device token
        </button>
      </div>
      {flash && <div className="flash err" style={{ marginTop: 10 }}>{flash}</div>}

      {fresh && (
        <div className="flash ok" style={{ marginTop: 10 }}>
          <div>Token for {fresh.name}. Copy it now, it won't be shown again.</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <input
              className="input"
              readOnly
              value={fresh.token}
              aria-label={`Device token for ${fresh.name}`}
              onFocus={(e) => e.target.select()}
            />
            <button className="btn" type="button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        </div>
      )}

      {tokens?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {tokens.map((t) => (
            <div key={t.id} className="friendrow">
              <div className="avatar">📱</div>
              <span>
                {t.name}
                <span className="hint">
                  {' '}· {t.last_used_at ? `used ${timeAgo(t.last_used_at)}` : 'never used'}
                </span>
              </span>
              <div className="actions">
                <button className="btn ghost small" type="button" onClick={() => remove(t.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </form>
  )
}
