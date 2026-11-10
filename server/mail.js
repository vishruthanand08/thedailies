// Email through Resend (resend.com): password reset links and email confirmations. Set
// RESEND_API_KEY and MAIL_FROM (an address on a domain verified in Resend, e.g.
// "The Dailies <hello@thedailies.lol>"). With no key, production sends nothing and the site
// offers no email features (mailEnabled), while local dev prints each email to the console so
// the links can be followed.
const KEY = process.env.RESEND_API_KEY
const FROM = process.env.MAIL_FROM || 'The Dailies <hello@thedailies.lol>'
// Mail can only come from the verified domain, but replies go to the support inbox people already use.
const REPLY_TO = process.env.MAIL_REPLY_TO || 'thedailiessupport@gmail.com'
const PROD = process.env.NODE_ENV === 'production'

export const mailEnabled = Boolean(KEY) || !PROD

// Links in emails always point at this address, never at the request's Host header (which a
// caller controls).
export const PUBLIC_URL = (process.env.PUBLIC_URL || (PROD ? 'https://www.thedailies.lol' : 'http://localhost:5173')).replace(/\/$/, '')

/** Sends a plain-text email. Resolves to true when it was handed to Resend. */
export async function sendMail({ to, subject, text }) {
  if (!KEY) {
    if (!PROD) console.log(`\n--- email (dev, not sent) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-----------------------------\n`)
    return !PROD
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text }),
    })
    if (!res.ok) {
      console.warn(`mail: Resend said ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return false
    }
    return true
  } catch (err) {
    console.warn('mail: could not reach Resend:', err.message)
    return false
  }
}
