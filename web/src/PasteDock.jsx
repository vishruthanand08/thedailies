import { useEffect, useRef, useState } from 'react'
import { nativeClipboard, readNativeClipboard } from './native.js'

// Today's floating Paste button, bottom right: one click reads the result the game just copied
// and saves it. Where the browser won't hand over the clipboard (Firefox, or permission refused)
// a small box opens above it to paste into. ⌘V / Ctrl+V anywhere on Today saves the clipboard
// too, with no prompt. Messages and the "back from a game?" prompt stack above the button.
// In the Mac app the app reads the clipboard, Edit › Paste Result presses this button and
// File › Add Score… opens the box.
const canRead = nativeClipboard || Boolean(navigator.clipboard?.readText)
// the ⌘V tip, once, for computers (a phone has no keyboard shortcut)
const TIP_KEY = 'dailies.pasteTip'
const hasKeyboard = window.matchMedia?.('(pointer: fine)').matches
const pasteKeys = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V'
function tipSeen() {
  try {
    return localStorage.getItem(TIP_KEY) === 'seen'
  } catch {
    return true // no storage: don't show it on every visit
  }
}
const readClipboard = () => (nativeClipboard ? readNativeClipboard() : navigator.clipboard.readText())

// also on the game panel's Paste button (GamePanel.jsx), and drawn the same in the Mac app
export function ClipboardIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="8.5" y="2" width="7" height="4.5" rx="1.5" fill="var(--yellow)" stroke="currentColor" strokeWidth="2" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function PasteDock({ busy, flash, onDismissFlash, onSubmit, backGame, onDismissBack }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [hint, setHint] = useState(null)
  const textRef = useRef(null)
  const submitRef = useRef(onSubmit)
  submitRef.current = onSubmit
  const hideTipRef = useRef(null)
  const pasteRef = useRef(null)
  const [tip, setTip] = useState(() => hasKeyboard && !tipSeen())
  const hideTip = () => {
    setTip(false)
    try {
      localStorage.setItem(TIP_KEY, 'seen')
    } catch {}
  }
  hideTipRef.current = hideTip

  useEffect(() => {
    if (open) textRef.current?.focus()
  }, [open])

  // a saved score's message goes away on its own; errors stay until the next try
  useEffect(() => {
    if (flash?.kind !== 'ok') return
    const timer = setTimeout(onDismissFlash, 6000)
    return () => clearTimeout(timer)
  }, [flash, onDismissFlash])

  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      const pasted = e.clipboardData?.getData('text') ?? ''
      if (!pasted.trim()) return
      e.preventDefault()
      hideTipRef.current() // they've found it
      submitRef.current(pasted)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onMenuPaste = () => pasteRef.current()
    const onMenuBox = () => {
      setHint(null)
      setOpen(true)
    }
    document.addEventListener('paste', onPaste)
    document.addEventListener('keydown', onKey)
    window.addEventListener('dailies:paste', onMenuPaste)
    window.addEventListener('dailies:pastebox', onMenuBox)
    return () => {
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('dailies:paste', onMenuPaste)
      window.removeEventListener('dailies:pastebox', onMenuBox)
    }
  }, [])

  const openBox = (msg) => {
    setHint(msg)
    setOpen(true)
  }

  const paste = async () => {
    onDismissFlash()
    if (!canRead) return openBox(null)
    let clip
    try {
      clip = (await readClipboard()) ?? ''
    } catch {
      return openBox('Your browser didn’t share the clipboard. Paste your result here instead.')
    }
    if (!clip.trim()) return openBox('Your clipboard is empty. Tap Share or Copy in the game first, or paste it here.')
    if (await onSubmit(clip)) setOpen(false)
  }
  pasteRef.current = paste

  const add = async (e) => {
    e.preventDefault()
    if (await onSubmit(text)) {
      setText('')
      setOpen(false)
    }
  }

  return (
    <div className="pastedock">
      {flash && (
        <div className={`flash ${flash.kind} pastetoast`} role="status">
          <span>{flash.msg}</span>
          <button className="iconbtn" aria-label="Dismiss" onClick={onDismissFlash}>✕</button>
        </div>
      )}

      {tip && !flash && !backGame && !open && (
        <div className="pastetip" role="note">
          <span>Tip: press <kbd>{pasteKeys}</kbd> anywhere here to paste a result.</span>
          <button className="iconbtn" aria-label="Got it" onClick={hideTip}>✕</button>
        </div>
      )}

      {backGame && !open && (
        <div className="backprompt" role="status">
          <span>Back from {backGame.emoji} {backGame.name}? Tap Share or Copy in the game, then press Paste.</span>
          <button className="iconbtn" aria-label="Dismiss" onClick={onDismissBack}>✕</button>
        </div>
      )}

      {open && (
        <form className="card pastebox" onSubmit={add}>
          <div className="pastebox-head">
            <h3>Paste your result</h3>
            <button type="button" className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          </div>
          {hint && <p className="hint">{hint}</p>}
          <textarea
            ref={textRef}
            className="input"
            placeholder="Wordle 1,234 3/6…"
            aria-label="Your game result"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds, Shift+Enter is a new line
              if (e.key === 'Enter' && !e.shiftKey) add(e)
            }}
          />
          <button className="btn" type="submit" disabled={busy || !text.trim()}>Add score</button>
        </form>
      )}

      <button
        className="pastefab"
        onClick={paste}
        disabled={busy}
        aria-label="Paste your result"
        title="Paste your result (or press ⌘V / Ctrl+V)"
      >
        <ClipboardIcon />
        <span className="pastefab-label">{busy ? 'Saving…' : 'Paste'}</span>
      </button>
    </div>
  )
}
