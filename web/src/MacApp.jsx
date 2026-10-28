import { useEffect, useState } from 'react'
import { api } from './api.js'
import { inApp } from './native.js'

// The Mac app, downloaded from the site (/download/mac, server/release.js). Offered to people on a
// Mac in a browser: once as a popup, and always on the You tab. iPads also say "Macintosh" but
// have a touch screen. Nothing shows until a release exists.
const onMac = !inApp && /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints < 2
const PROMPT_KEY = 'dailies.macPrompt'

let cached
function useMacRelease() {
  const [release, setRelease] = useState(cached ?? null)
  useEffect(() => {
    if (!onMac || cached !== undefined) return
    api.get('/app/mac').then(
      (r) => setRelease((cached = r)),
      () => (cached = null)
    )
  }, [])
  return onMac ? release : null
}

function remember() {
  try {
    localStorage.setItem(PROMPT_KEY, 'seen')
  } catch {}
}

function seen() {
  try {
    return localStorage.getItem(PROMPT_KEY) === 'seen'
  } catch {
    return false
  }
}

const PERKS = [
  ['🎮', 'Play every game and paste your score without leaving the app'],
  ['🔔', 'A notification when friends give you kudos or add you'],
  ['⌨️', '⌘⇧V pastes a result, ⌘N adds a score'],
]

export function MacAppPrompt() {
  const release = useMacRelease()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!release || seen()) return
    const timer = setTimeout(() => setOpen(true), 1200) // after the page has settled
    return () => clearTimeout(timer)
  }, [release])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    remember()
    setOpen(false)
  }

  if (!open) return null
  return (
    <div className="gamepanel-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="card macprompt" role="dialog" aria-modal="true" aria-labelledby="macprompt-title">
        <button className="iconbtn macprompt-close" aria-label="Close" onClick={close}>✕</button>
        <img className="macprompt-icon" src="/mac-icon.png" alt="" width="96" height="96" />
        <h3 id="macprompt-title">The Dailies for Mac</h3>
        <p className="macprompt-lede">Your games and your friends’ scores in their own window.</p>
        <ul className="macperks">
          {PERKS.map(([icon, text]) => (
            <li key={text}><span aria-hidden="true">{icon}</span>{text}</li>
          ))}
        </ul>
        <div className="macprompt-actions">
          <a className="btn" href="/download/mac" onClick={remember}>Download for Mac</a>
          <button className="btn ghost" onClick={close}>Not now</button>
        </div>
        <p className="macprompt-fine">Free · macOS 14 Sonoma or later · Version {release.version}</p>
      </div>
    </div>
  )
}

// On the You tab, for anyone who closed the popup.
export function MacAppCard() {
  const release = useMacRelease()
  if (!release) return null
  return (
    <div className="card maccard">
      <img src="/mac-icon.png" alt="" width="56" height="56" />
      <div className="maccard-text">
        <h3 className="sectiontitle">The Dailies for Mac</h3>
        <p>Play, paste and get kudos notifications in their own window.</p>
      </div>
      <a className="btn" href="/download/mac">Download</a>
    </div>
  )
}
