import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

// Sign in with Apple, the parts that talk to Apple (the routes are in account.js).
//
// Setup (env): APPLE_TEAM_ID; APPLE_SERVICE_ID, the Services ID the website signs in with (e.g.
// lol.thedailies.web); APPLE_SIWA_KEY_ID and APPLE_SIWA_KEY, a "Sign in with Apple" key (.p8
// contents) used to swap the one-time code for a refresh token and to revoke it when an account
// is deleted (App Store rule). The iPhone app signs in as its bundle id. Without APPLE_TEAM_ID
// Sign in with Apple is off. APPLE_JWKS_URL points key lookups at a stand-in, for local tests.
const TEAM = process.env.APPLE_TEAM_ID
const SERVICE_ID = process.env.APPLE_SERVICE_ID
const BUNDLE_ID = process.env.APNS_TOPIC || 'lol.thedailies.app'
const KEY_ID = process.env.APPLE_SIWA_KEY_ID
const KEY = process.env.APPLE_SIWA_KEY?.replace(/\\n/g, '\n')
const ISSUER = 'https://appleid.apple.com'
const JWKS_URL = process.env.APPLE_JWKS_URL || 'https://appleid.apple.com/auth/keys'

export const appleEnabled = Boolean(TEAM)
/** The client ids a token may be for: the app, and the website when it has a Services ID. */
export const appleClients = { app: BUNDLE_ID, web: SERVICE_ID || null }

let keys = null
let keysAt = 0
async function appleKey(kid) {
  if (!keys || Date.now() - keysAt > 3600_000 || !keys.some((k) => k.kid === kid)) {
    const res = await fetch(JWKS_URL)
    if (!res.ok) throw new Error(`Apple keys: ${res.status}`)
    keys = (await res.json()).keys
    keysAt = Date.now()
  }
  const jwk = keys.find((k) => k.kid === kid)
  if (!jwk) throw new Error('Unknown Apple key')
  return crypto.createPublicKey({ key: jwk, format: 'jwk' })
}

/**
 * Checks an identity token from Apple and returns who it is:
 * { sub, email?, emailVerified, privateEmail, clientId }. Throws if it isn't valid.
 */
export async function verifyIdentityToken(token, nonce) {
  if (typeof token !== 'string' || token.length > 5000) throw new Error('No Apple token')
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded?.header?.kid) throw new Error('Not an Apple token')
  const audience = Object.values(appleClients).filter(Boolean)
  const claims = jwt.verify(token, await appleKey(decoded.header.kid), {
    algorithms: ['RS256'],
    issuer: ISSUER,
    audience,
  })
  // the website passes a nonce through Apple, so a token can't be replayed into another sign-in
  if (nonce && claims.nonce !== crypto.createHash('sha256').update(nonce).digest('hex') && claims.nonce !== nonce) {
    throw new Error('Apple token nonce mismatch')
  }
  const yes = (v) => v === true || v === 'true'
  return {
    sub: String(claims.sub),
    email: claims.email ? String(claims.email).toLowerCase() : null,
    emailVerified: yes(claims.email_verified),
    privateEmail: yes(claims.is_private_email),
    clientId: claims.aud,
  }
}

function clientSecret(clientId) {
  return jwt.sign({}, KEY, {
    algorithm: 'ES256',
    keyid: KEY_ID,
    issuer: TEAM,
    audience: ISSUER,
    subject: clientId,
    expiresIn: '5m',
  })
}

const canTalkToApple = () => Boolean(TEAM && KEY_ID && KEY)

/** Swaps a sign-in's one-time code for a refresh token (kept so it can be revoked). Null if it can't. */
export async function exchangeCode(code, clientId) {
  if (!canTalkToApple() || typeof code !== 'string' || !code) return null
  try {
    const res = await fetch(`${ISSUER}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret(clientId), code, grant_type: 'authorization_code' }),
    })
    if (!res.ok) {
      console.warn(`apple: code exchange said ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return null
    }
    return (await res.json()).refresh_token ?? null
  } catch (err) {
    console.warn('apple: code exchange failed:', err.message)
    return null
  }
}

/** Tells Apple an account is gone (when it's deleted). Never throws. */
export async function revokeToken(refreshToken, clientId) {
  if (!canTalkToApple() || !refreshToken) return
  try {
    const res = await fetch(`${ISSUER}/auth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret(clientId), token: refreshToken, token_type_hint: 'refresh_token',
      }),
    })
    if (!res.ok) console.warn(`apple: revoke said ${res.status}`)
  } catch (err) {
    console.warn('apple: revoke failed:', err.message)
  }
}
