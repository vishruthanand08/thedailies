import { useEffect, useState } from 'react'
import { api } from './api.js'
import { inApp } from './native.js'

// The desktop apps, downloaded from the site (/download/mac or /download/windows,
// server/release.js). Offered to people on a Mac or a Windows PC in a browser: once as a popup,
// and always on the You tab. iPads also say "Macintosh" but have a touch screen. Nothing shows
// until a release exists. Inside either app (user agent TheDailiesApp/) none of this shows.
const ua = navigator.userAgent
const PLATFORMS = {
  mac: {
    name: 'Mac',
    promptKey: 'dailies.macPrompt',
    perks: [
      ['🎮', 'Play every game and paste your score without leaving the app'],
      ['🔔', 'A notification when friends give you kudos or add you'],
      ['⌨️', '⌘⇧V pastes a result, ⌘N adds a score'],
    ],
    requires: 'macOS 14 Sonoma or later',
    card: 'Play, paste and get kudos notifications in their own window.',
  },
  windows: {
    name: 'Windows',
    promptKey: 'dailies.windowsPrompt',
    perks: [
      ['🎮', 'Play every game, NYT and LinkedIn included, without leaving the app'],
      ['📋', 'Paste your score straight from the game'],
      ['⌨️', 'Ctrl+Shift+V pastes a result, Ctrl+N adds a score'],
    ],
    requires: 'Windows 10 or later',
    // the installer isn't code-signed yet, so SmartScreen asks first
    note: 'If Windows says it protected your PC, choose More info, then Run anyway.',
    card: 'Play every game and paste your scores in their own window.',
  },
}
const platformId = inApp
  ? null
  : /Macintosh/.test(ua) && navigator.maxTouchPoints < 2
    ? 'mac'
    : /Windows NT/.test(ua)
      ? 'windows'
      : null
const platform = platformId && PLATFORMS[platformId]

let cached
function useRelease() {
  const [release, setRelease] = useState(cached ?? null)
  useEffect(() => {
    if (!platform || cached !== undefined) return
    api.get(`/app/${platformId}`).then(
      (r) => setRelease((cached = r)),
      () => (cached = null)
    )
  }, [])
  return platform ? release : null
}

function remember() {
  try {
    localStorage.setItem(platform.promptKey, 'seen')
  } catch {}
}

function seen() {
  try {
    return localStorage.getItem(platform.promptKey) === 'seen'
  } catch {
    return false
  }
}

export function DesktopAppPrompt() {
  const release = useRelease()
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
        <h3 id="macprompt-title">The Dailies for {platform.name}</h3>
        <p className="macprompt-lede">Your games and your friends’ scores in their own window.</p>
        <ul className="macperks">
          {platform.perks.map(([icon, text]) => (
            <li key={text}><span aria-hidden="true">{icon}</span>{text}</li>
          ))}
        </ul>
        <div className="macprompt-actions">
          <a className="btn" href={`/download/${platformId}`} onClick={remember}>Download for {platform.name}</a>
          <button className="btn ghost" onClick={close}>Not now</button>
        </div>
        <p className="macprompt-fine">Free · {platform.requires} · Version {release.version}</p>
        {platform.note && <p className="macprompt-fine">{platform.note}</p>}
      </div>
    </div>
  )
}

// On the You tab, for anyone who closed the popup.
export function DesktopAppCard() {
  const release = useRelease()
  if (!release) return null
  return (
    <div className="card maccard">
      <img src="/mac-icon.png" alt="" width="56" height="56" />
      <div className="maccard-text">
        <h3 className="sectiontitle">The Dailies for {platform.name}</h3>
        <p>{platform.card}</p>
      </div>
      <a className="btn" href={`/download/${platformId}`}>Download</a>
    </div>
  )
}
