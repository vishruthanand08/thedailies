import { api } from './api.js'

// Bridge to the native iOS/macOS shell (apple/). In a normal browser all of this is inert.
export const inApp = /TheDailiesApp\//.test(navigator.userAgent)
export const native = window.webkit?.messageHandlers?.dailies

// The shell sets this at document start when it has a way to save scores without
// pasting (share extension on iOS, in-app game browser); the paste bar hides then.
export const nativeCapture = inApp && Boolean(window.__dailiesNative?.capture)

export function tellNative(msg) {
  try {
    native?.postMessage(msg)
  } catch {
    // not in the app, or the handler went away
  }
}

// Native calls window.__dailies.issueToken("<device name>") after a session message
// with a user and no stored token; the token comes back as a 'token' message.
if (inApp) {
  window.__dailies = {
    async issueToken(name) {
      try {
        const d = await api.post('/auth/tokens', { name })
        tellNative({ type: 'token', token: d.token, id: d.id, name: d.name })
      } catch (err) {
        tellNative({ type: 'token', token: null, error: err.message })
      }
    },
  }
}
