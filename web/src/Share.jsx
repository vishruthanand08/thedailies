import { useEffect, useState } from 'react'
import { api } from './api.js'

// Share a score or the day's crown as text (server/share.js writes it: my place, the game's
// own share and our address). The share sheet where there is one (phones, Safari),
// otherwise the clipboard. The text is fetched when the button appears, because browsers only
// open the share sheet or write the clipboard straight after a click.
export function ShareButton({ path, label = 'Share', className = 'btn small sharebtn' }) {
  const [text, setText] = useState(null)
  const [state, setState] = useState(null) // 'copied' | error message
  useEffect(() => {
    let live = true
    setText(null)
    api.get(path).then((d) => live && setText(d.text), () => {})
    return () => { live = false }
  }, [path])

  const share = async (e) => {
    e.stopPropagation()
    setState(null)
    let body = text
    if (!body) {
      try {
        body = (await api.get(path)).text
        setText(body)
      } catch (err) {
        return setState(err.message)
      }
    }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        return await navigator.share({ text: body })
      } catch (err) {
        if (err.name === 'AbortError') return // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(body)
      setState('copied')
      setTimeout(() => setState(null), 2500)
    } catch {
      setState('Couldn’t copy. Try again.')
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={share}>
        {state === 'copied' ? 'Copied! Send it to your friends' : `↗ ${label}`}
      </button>
      {state && state !== 'copied' && <span className="hint shareerr" role="alert">{state}</span>}
    </>
  )
}

/** What a shared link (?s=…) shows: who shared what. Null until loaded, or if it isn't valid. */
export function useSharePreview(token) {
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!token) return setPreview(null)
    api.get(`/share/preview/${encodeURIComponent(token)}`).then(setPreview, () => setPreview(null))
  }, [token])
  return preview
}

/** Above the sign-up form when someone arrives from a shared score. */
export function ShareTeaser({ preview }) {
  if (!preview) return null
  return (
    <div className="card shareteaser">
      {preview.kind === 'game' ? (
        <p>
          <span className="teaseremoji">{preview.emoji}</span> <b>@{preview.from}</b> got <b>{preview.display}</b> on {preview.gameName}.
          Sign up to see everyone’s scores and take them on.
        </p>
      ) : (
        <p>
          <span className="teaseremoji">👑</span> <b>@{preview.from}</b> is playing The Dailies.
          Sign up to see the board and come take their crown.
        </p>
      )}
    </div>
  )
}
