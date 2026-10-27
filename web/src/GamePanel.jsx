import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// Plays an `embed` game in an iframe on the site. A page can't see inside another site's iframe,
// so the score comes from the clipboard: the game's Share/Copy puts it there, one tap saves it.
export default function GamePanel({ game, onClose, onSaved }) {
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false) // clipboard unreadable: fall back to a paste box
  const [text, setText] = useState('')
  const closeRef = useRef(null)
  const boxRef = useRef(null)
  const canReadClipboard = Boolean(navigator.clipboard?.readText)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  useEffect(() => {
    if (manual) boxRef.current?.focus()
  }, [manual])

  const submit = async (value) => {
    if (!value.trim()) return
    setBusy(true)
    setFlash(null)
    try {
      const d = await api.post('/submissions', { text: value })
      setFlash({ kind: 'ok', msg: `${d.submission.emoji} ${d.submission.gameName} ${d.submission.display} saved ✓` })
      setText('')
      setManual(false)
      onSaved()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    } finally {
      setBusy(false)
    }
  }

  const paste = async () => {
    setFlash(null)
    let clip
    try {
      clip = await navigator.clipboard.readText()
    } catch {
      setManual(true)
      setFlash({ kind: 'err', msg: "Couldn't read your clipboard. Paste the result into the box." })
      return
    }
    if (!clip.trim()) {
      setFlash({ kind: 'err', msg: `Clipboard is empty. Tap Share or Copy in ${game.name} first.` })
      return
    }
    submit(clip)
  }

  return (
    <div className="gamepanel-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gamepanel" role="dialog" aria-modal="true" aria-label={`Play ${game.name}`}>
        <div className="gamepanel-head">
          <div className="gameicon" style={{ background: game.color }}>{game.emoji}</div>
          <div className="name">{game.name}</div>
          <a className="playlink" href={game.url} target="_blank" rel="noreferrer">New tab ↗</a>
          <button ref={closeRef} className="btn ghost small" onClick={onClose} aria-label={`Close ${game.name}`}>
            ✕
          </button>
        </div>

        <iframe
          className="gamepanel-frame"
          src={game.url}
          title={game.name}
          allow="clipboard-write; web-share; fullscreen"
        />

        <div className="gamepanel-foot">
          {flash && <div className={`flash ${flash.kind}`} role="status">{flash.msg}</div>}
          {manual || !canReadClipboard ? (
            <div className="row">
              <textarea
                ref={boxRef}
                className="input"
                placeholder={`Paste your ${game.name} result`}
                aria-label={`Paste your ${game.name} result`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="btn coral" onClick={() => submit(text)} disabled={busy || !text.trim()}>
                Add ↑
              </button>
            </div>
          ) : (
            <div className="row">
              <span className="hint">Finished? Tap Share or Copy in the game, then</span>
              <button className="btn coral" onClick={paste} disabled={busy}>📋 Paste result</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
