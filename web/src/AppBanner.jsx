import { useState } from 'react'
import { inApp } from './native.js'

// Points people on the website to the iPhone app's App Store listing. Safari on an iPhone or iPad
// already shows Apple's own banner (the apple-itunes-app tag server/meta.js writes, which also says
// Open once the app is installed), so this one is for every other iPhone browser (Chrome, and the
// in-app browsers of Messages links opened from Instagram, WhatsApp…) and for computers. Never in
// our own apps, and not on Android (there's no Android app). Closing it hides it for two weeks.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6827838654'

const ua = navigator.userAgent
// iPadOS Safari says "Macintosh" but has a touch screen
const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
const android = /Android/.test(ua)
const otherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Snapchat|Twitter|LinkedInApp|WhatsApp|Line\//.test(ua)
const iosSafari = ios && /Safari\//.test(ua) && !otherIosBrowser
export const offerIphoneApp = !inApp && !android

const KEY = 'dailies.appBannerClosed'
const TWO_WEEKS = 14 * 24 * 3600 * 1000

function closedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) || 0) < TWO_WEEKS
  } catch {
    return false
  }
}

export function AppBanner() {
  const [hidden, setHidden] = useState(() => !offerIphoneApp || iosSafari || closedRecently())
  if (hidden) return null

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {}
    setHidden(true)
  }

  return (
    <div className="appbanner" role="region" aria-label="The Dailies iPhone app">
      <img src="/apple-touch-icon.png" alt="" className="appbanner-icon" />
      <div className="appbanner-text">
        <b>{ios ? 'The Dailies app' : 'The Dailies is on iPhone'}</b>
        <span>Just play. Your score saves itself.</span>
      </div>
      <a className="btn small appbanner-get" href={APP_STORE_URL} target="_blank" rel="noreferrer">
        {ios ? 'Get' : 'Get the app'}
      </a>
      <button type="button" className="appbanner-close" onClick={close} aria-label="Close">×</button>
    </div>
  )
}

/** A quiet "Get the iPhone app" link, under the sign-in form. */
export function AppStoreLink() {
  if (!offerIphoneApp) return null
  return (
    <div className="authtoggle legal">
      <a href={APP_STORE_URL} target="_blank" rel="noreferrer">Get the iPhone app</a>
    </div>
  )
}
