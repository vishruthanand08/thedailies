# The Dailies: native iOS and macOS app plan

This is the implementation plan for a coding agent. It turns thedailies.lol into an iPhone and Mac app where a score is saved by tapping the game's own Share button, with no copy and paste. Read `CLAUDE.md` first for the existing architecture. Research behind these decisions is summarized in "Decisions already made" below; do not re-litigate them.

## Goal

A user plays a game, taps the game's own Share button, and the score lands on their Dailies board. Three capture paths, in priority order:

1. **Share sheet** (iOS Share Extension, and an iOS Shortcut for friends who cannot install the app). Works from Safari, the NYT Games app and the LinkedIn app. This is the primary path.
2. **In-app game browser** (optional, developer's own devices): games opened inside the app in a WKWebView with an injected script that intercepts the share call. Only for games with no native app.
3. **Paste button** on the web app (already shipped, `web/src/Today.jsx`). Fallback for everyone.

## Decisions already made

- Plain SwiftUI, Swift 5.9+, iOS 17+ and macOS 14+, no third-party packages.
- The app's main screen is the existing React site in a WKWebView. No native re-implementation of the board, feed or friends tabs.
- Native code never submits by running `fetch` inside a hidden web view (JS is suspended when the view is offscreen or the app is backgrounded). All native submissions go through `URLSession` with a bearer token.
- Auth for native clients is a per-user API token stored in the Keychain and shared with the extension via an App Group. The browser cookie stays as it is.
- The in-app game browser is NOT the foundation. Reasons: Google sign-in is blocked by policy in every WKWebView (`disallowed_useragent`), most people play NYT and LinkedIn games in those companies' native apps, both services' terms prohibit scripts that modify their pages, and App Store guideline 5.2.2 would require their written authorization. It ships behind a Debug toggle, defaults to indie games only, and is never part of an App Store submission.
- Automatic capture without tapping Share (DOM observers, synthetic clicks) is out of scope for now. The game's built-in Share button is the trigger everywhere.
- Signing: free Apple ID (Personal Team) for now. That means 7-day provisioning, 3 apps per device, no push, no TestFlight, no App Store. Design nothing that needs push or iCloud.
- GeoGuessr stays manual entry. It has no share text and its terms bar unauthorized clients.
- No em dashes in any new user-facing strings or docs.

## Repository layout after this work

```
server/            existing API (Stage 0 changes here)
web/               existing React app (small Stage 0 and Stage 4 changes)
shortcuts/         Stage 1: Shortcut documentation and the request body it sends
apple/
  project.yml      XcodeGen spec (generated .xcodeproj is gitignored)
  Shared/          code compiled into both the app and the extension
  Dailies/         the app target (iOS + macOS, one multiplatform target)
  DailiesShare/    the iOS Share Extension target
  capture/         capture.js and its test harness (Stage 4)
docs/native-app-plan.md   this file
```

Add `apple/*.xcodeproj`, `apple/build/`, `apple/DerivedData/` to `.gitignore`.

Tooling: install XcodeGen (`brew install xcodegen`) and generate with `cd apple && xcodegen generate`. Build from the command line with `xcodebuild -project apple/Dailies.xcodeproj -scheme Dailies -destination 'platform=iOS Simulator,name=iPhone 16' build` and `-destination 'platform=macOS' build`. Both must compile with zero warnings before a stage is considered done.

---

## Stage 0: Backend and web app changes (half a day)

Everything later depends on this. No schema changes to existing tables; one new table.

### 0.1 API tokens

Add to `server/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens (user_id);
```

Token format: `dly_` + 32 random bytes as base64url (`crypto.randomBytes(32).toString('base64url')`). Store only `sha256(token)` hex in `token_hash`. The plaintext is returned exactly once at creation.

New routes in `server/auth.js` (all behind `requireAuth`):

- `POST /api/auth/tokens` body `{ name }` (1 to 40 chars, e.g. "Vishruth's iPhone"). Returns `{ token, id, name, created_at }`. Cap at 10 live tokens per user; return 400 "Too many devices, remove one first" beyond that.
- `GET /api/auth/tokens` returns `{ tokens: [{ id, name, created_at, last_used_at }] }` (never the hash).
- `DELETE /api/auth/tokens/:id` (own tokens only) returns `{ ok: true }`.

Change `requireAuth` in `server/auth.js` to accept either credential, bearer first:

```js
export async function requireAuth(req, res, next) {
  const h = req.get('authorization') || ''
  if (h.startsWith('Bearer dly_')) {
    const hash = sha256(h.slice(7))
    const { rows } = await q('SELECT u.id, u.username, t.id AS token_id FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1', [hash])
    if (!rows.length) return res.status(401).json({ error: 'That device token is no longer valid. Sign in again in the app.' })
    req.user = { id: rows[0].id, username: rows[0].username }
    req.tokenId = rows[0].token_id
    q('UPDATE api_tokens SET last_used_at = now() WHERE id = $1', [rows[0].token_id]).catch(() => {})
    return next()
  }
  // existing cookie path unchanged
}
```

`requireAuth` becomes async; Express 4 does not catch rejected promises from middleware, so wrap the body in try/catch and call `next(err)`. Check every `requireAuth` call site still works (`submissions.js`, `friends.js`, `auth.js /me`).

Add `POST /api/auth/logout` behaviour: unchanged (cookie only). Token revocation is explicit via DELETE.

### 0.2 Submission response shape

`POST /api/submissions` already returns `{ submission: { emoji, gameName, display, ... } }` on success and `{ error }` with 400/409 otherwise. Confirm the success body includes `gameId`, `gameName`, `emoji`, `display`, `puzzleDate`, `verified`. Native clients render the banner from exactly these fields; add any that are missing. Do not change the error strings; they are shown verbatim to users.

### 0.3 Web app: in-app mode

In `web/src/App.jsx` (or a tiny `web/src/native.js` helper):

```js
export const inApp = /TheDailiesApp\//.test(navigator.userAgent)
export const native = window.webkit?.messageHandlers?.dailies
export function tellNative(msg) { try { native?.postMessage(msg) } catch {} }
```

Messages the web app sends to native (all plain JSON objects with a `type`):

- `{ type: 'session', user: { id, username } | null }` whenever auth state is determined or changes (after `/api/auth/me`, login, register, logout).
- `{ type: 'open', url, gameId }` when the user taps Play on a tile while `inApp` is true (replaces opening a new tab). In normal browsers nothing changes.
- `{ type: 'token', token, name }` after the web app successfully creates a device token (see 0.4).

In `web/src/Today.jsx`, hide the paste bar when `inApp` is true and there is a native capture path; keep it visible on the web.

### 0.4 Device token handshake (web side)

When `inApp` is true and native asks for a token, the web app creates one. Native triggers this by evaluating `window.__dailies.issueToken("<device name>")` in the main web view while it is on screen (right after a `session` message with a user). Implement:

```js
window.__dailies = {
  async issueToken(name) {
    const d = await api.post('/auth/tokens', { name })
    tellNative({ type: 'token', token: d.token, name: d.name })
  },
}
```

If this fails (401, network), the web app posts `{ type: 'token', token: null, error }`.

### 0.5 Acceptance

- `curl -H "Authorization: Bearer dly_..." https://localhost:3001/api/auth/me` returns the user.
- A bearer POST to `/api/submissions` with `{ text }` works and the cookie path is unchanged.
- Existing web flows (login, paste, manual entry, friends) unchanged in a normal browser.
- Commit with message "Add device API tokens and in-app bridge".

---

## Stage 1: iOS Shortcut for friends (one evening)

Zero Apple cost, works from the NYT Games app, the LinkedIn app and Safari. Distributed as an iCloud link.

Create `shortcuts/README.md` describing how to build the Shortcut in the Shortcuts app (it cannot be generated as a file by code; document the steps and the exact request):

1. Shortcut name "Save to The Dailies". Enable "Show in Share Sheet", accept Text and URLs.
2. Action "Get Text from Input" (Shortcut Input). If empty, "Get Clipboard" as a fallback.
3. Action "Get Contents of URL": `https://www.thedailies.lol/api/submissions`, method POST, headers `Authorization: Bearer <token>` and `Content-Type: application/json`, request body JSON `{ "text": <text> }`.
4. Action "Get Dictionary Value" for `submission.display` and `error`; "Show Notification" with "<emoji> <gameName> <display> saved" or the error string.
5. The token is a text variable at the top of the Shortcut; the user pastes their token from the web app's new "Devices" section once.

Web app: add a "Devices" card in the Friends tab (or a small settings area) that lists tokens (`GET /api/auth/tokens`), creates one ("New device token", shows the plaintext once with a copy button), and deletes them. Link to the Shortcut's iCloud URL from there once it exists.

Acceptance: a share from the NYT Games app and from the LinkedIn app via the Shortcut produces a correct submission; a duplicate shows the server's 409 message as a notification.

---

## Stage 2: SwiftUI shell (iOS and macOS)

One multiplatform app target. Bundle ID `lol.thedailies.app`. Display name "The Dailies".

### 2.1 project.yml

```yaml
name: Dailies
options:
  bundleIdPrefix: lol.thedailies
  deploymentTarget: { iOS: "17.0", macOS: "14.0" }
settings:
  base:
    SWIFT_VERSION: "5.9"
    DEVELOPMENT_TEAM: ""   # set locally, do not commit a team id
targets:
  Dailies:
    type: application
    platform: [iOS, macOS]
    sources: [Dailies, Shared]
    entitlements:
      path: Dailies/Dailies.entitlements
      properties:
        com.apple.security.application-groups: [group.lol.thedailies]
        keychain-access-groups: [$(AppIdentifierPrefix)lol.thedailies.shared]
        com.apple.security.app-sandbox: true          # macOS
        com.apple.security.network.client: true       # macOS
    info:
      path: Dailies/Info.plist
      properties:
        CFBundleDisplayName: The Dailies
        NSAppTransportSecurity:
          NSAllowsLocalNetworking: true   # Debug only, see 2.6
  DailiesShare:
    type: app-extension
    platform: iOS
    sources: [DailiesShare, Shared]
    ... (Stage 3)
```

If App Groups or Keychain Sharing fail to provision on the Personal Team, stop and report; that changes Stage 3's token sharing to "extension holds its own token" (see 3.4).

### 2.2 Shared/

- `ServerConfig.swift`: `enum Server { case production, local }` with base URLs `https://www.thedailies.lol` and `http://localhost:5173`. Persisted in `UserDefaults(suiteName: "group.lol.thedailies")` under `server`. Local is only selectable in Debug builds.
- `Keychain.swift`: minimal SecItem wrapper for one generic-password item `dailies.token` in access group `lol.thedailies.shared`, storing `{ token, username, server }` as JSON. Functions `load()`, `save(_:)`, `clear()`.
- `DailiesAPI.swift`: `actor DailiesAPI` with `submit(text:) async throws -> SubmissionResult` and `me() async throws -> User`. Uses `URLSession.shared`, bearer header from Keychain, 15 s timeout, decodes `{ submission }` or `{ error }` into `SubmissionResult` / `DailiesError(message:)`. HTTP 401 maps to `.notSignedIn`, 409 to `.duplicate(message)`, 400 to `.rejected(message)`.
- `SubmissionQueue.swift`: an in-memory FIFO of pending share texts with dedupe (exact-string match within 60 s) and `flush()` called on foreground and after each enqueue. Persist pending items to the App Group `UserDefaults` so a share received while backgrounded is not lost.
- `Banner.swift`: a `Banner` model `{ kind: .ok | .err, text }` and a SwiftUI overlay view that auto-dismisses after 4 s.

### 2.3 Dailies/ app target

- `DailiesApp.swift`: `@main`, `WindowGroup { RootView() }`, `.onChange(of: scenePhase)` calling `SubmissionQueue.shared.flush()` when `.active`. On macOS add a second `WindowGroup(id: "game", for: URL.self)` for Stage 4.
- `MainWebView.swift`: `UIViewRepresentable` / `NSViewRepresentable` around one long-lived `WKWebView` owned by an `@Observable final class WebController` (never recreated on view updates; keep it in a `ZStack`, not conditionally rendered).
  - `WKWebViewConfiguration.applicationNameForUserAgent = "TheDailiesApp/1.0"` (keeps the default UA and appends the suffix).
  - `websiteDataStore = .default()` so login persists.
  - Message handler `dailies` added in `.page` content world. Handle `session`, `open`, `token` as defined in Stage 0.3.
  - Navigation policy: same-host links load in the view; any other host opens in the system browser (`UIApplication.open` / `NSWorkspace.open`). Target `_blank` links (`createWebViewWith`) are routed the same way.
  - Pull-to-refresh on iOS (`UIRefreshControl` on `scrollView`).
  - `reloadBoard()`: evaluates `window.dispatchEvent(new Event('dailies:refresh'))`; the web app's Today view listens for it and reloads the board. Add that listener in `Today.jsx`.
- Token handshake: on `session` with a user, if Keychain has no token for that `username` + server, evaluate `window.__dailies.issueToken(<device name>)` with `UIDevice.current.name` / `Host.current().localizedName`. On `token`, save to Keychain. On `session` with `null`, `Keychain.clear()` and best-effort `DELETE` of the old token id (store the id alongside the token for this).
- `RootView.swift`: `ZStack { MainWebView(); BannerOverlay() }`. In Debug builds, a gear button showing a `ServerPicker` sheet (production / local) that reloads the web view on change.
- Submissions from native (used by Stage 3 and 4) go through `SubmissionQueue.shared.enqueue(text)`; on each result the queue publishes a `Banner` ("🌀 Wend 0:15 saved ✓", or the server's error string) and calls `reloadBoard()`.

### 2.4 macOS specifics

Window min size 420x700. Menu item "Reload" (Cmd+R) and "Switch server" in Debug. The sandbox entitlement for outgoing network connections is required or every request fails silently.

### 2.5 Login inside the main web view

Nothing to build: the site uses username and password, and the cookie persists in the default data store. Confirm that after force-quitting, the user is still signed in.

### 2.6 Debug-only ATS exception

Put `NSAllowsLocalNetworking` behind an `Info.plist` preprocessor define or a separate `Info-Debug.plist` so release builds carry no ATS exception.

### 2.7 Acceptance

- App launches on iOS Simulator and macOS, shows the site, login survives relaunch.
- Tapping Play on a tile opens the game in Safari (Stage 4 changes this to the in-app browser for allowed games).
- Keychain contains a token after first login; `DailiesAPI.me()` succeeds with it.
- Enqueueing a hard-coded Wordle string from a Debug button produces the correct banner and the board refreshes.
- Commit "Add SwiftUI shell for iOS and macOS".

---

## Stage 3: iOS Share Extension

Bundle ID `lol.thedailies.app.share`. This is the primary capture path for games played in the NYT Games app, the LinkedIn app and Safari.

### 3.1 Info.plist

```xml
<key>NSExtension</key>
<dict>
  <key>NSExtensionPointIdentifier</key><string>com.apple.share-services</string>
  <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
  <key>NSExtensionAttributes</key>
  <dict>
    <key>NSExtensionActivationRule</key>
    <dict>
      <key>NSExtensionActivationSupportsText</key><true/>
      <key>NSExtensionActivationSupportsWebURLWithMaxCount</key><integer>1</integer>
    </dict>
  </dict>
</dict>
```

Entitlements: same App Group and keychain access group as the app.

### 3.2 ShareViewController

A plain `UIViewController` hosting a small SwiftUI view (do not use `SLComposeServiceViewController`; we need no compose box).

1. Collect inputs from `extensionContext.inputItems`: every attachment conforming to `public.plain-text` (as `String`) and `public.url` (as `URL`). Join as `text` + "\n" + `url` when both exist, trimmed, capped at 4000 chars. Some games pass the share text only in `NSExtensionItem.attributedContentText`; read that too.
2. If the Keychain has no token: show "Open The Dailies and sign in first" with a Done button. (Extensions cannot launch their containing app; do not try.)
3. Otherwise call `DailiesAPI.submit(text:)` directly (no queue; the extension is short-lived) and show the result: emoji, game name, display and "Saved" or the error string. Auto-complete the request after 1.5 s on success (`extensionContext.completeRequest`), on error leave a Done button.
4. On success write a flag `lastSubmissionAt` to the App Group `UserDefaults`; the app's `scenePhase` handler reloads the board when it changes.

### 3.3 Memory and time

Extensions have a ~120 MB limit and short lifetimes; `URLSession.shared` with a 15 s timeout is fine. Do not import WebKit in the extension.

### 3.4 Fallback if App Groups or keychain sharing are unavailable on the Personal Team

The extension shows a one-time "paste your device token" field (token from the web app's Devices card) and stores it in its own keychain. Everything else is identical.

### 3.5 Acceptance

- From the NYT Games app: finish Wordle, Share, pick The Dailies, see "🟩 Wordle 4/6 saved ✓". Same for Connections and the Mini.
- From the LinkedIn app: Queens, Tango, Zip, Pinpoint, Crossclimb, Mini Sudoku, Wend, Patches.
- From Safari: Worldle, Globle, Travle, Minute Cryptic, Costcodle, Fermi, MapTap, Krillion, EthnoGuessr.
- Record each game's exact share text in `apple/capture/fixtures/<gameId>.txt` and add them to a Node test script `server/parsers.test.mjs` (plain `node --test`) that asserts `detect()` identifies each fixture. This is the first test file in the repo; keep it dependency-free.
- Duplicate share shows the 409 message; stale share shows the date message.
- Commit "Add iOS Share Extension".

---

## Stage 4: In-app game browser with capture.js (optional, Debug-gated)

Only after Stages 0 to 3 are done and verified. This exists so the developer can play indie games inside the app without a share-sheet hop. It is off by default and never part of a submission.

### 4.1 Allowlist

```swift
enum GameHosts {
  static let indie: Set<String> = ["worldle.teuteuf.fr", "globle-game.com", "travle.earth", "www.minutecryptic.com", "minutecryptic.com", "costcodle.com", "fermi.gg", "maptap.gg", "krillion.io", "hbd.gg"]
  static let experimental: Set<String> = ["www.nytimes.com", "nytimes.com", "www.linkedin.com", "linkedin.com"]
}
```

`open` messages for hosts outside the active allowlist open the system browser. Experimental hosts are enabled by a Debug toggle labelled "Experimental: NYT and LinkedIn in-app (personal use only)". GeoGuessr is never allowlisted.

### 4.2 GameBrowserView

- Sheet on iOS (`.sheet` with `.presentationDetents([.large])`), separate window on macOS (`openWindow(id: "game", value: url)`).
- Its own `WKWebView` with its own `WKWebsiteDataStore(forIdentifier:)` (a fixed UUID stored in UserDefaults) so third-party cookies never mix with the Dailies session. No `applicationNameForUserAgent` suffix on this view; leave the default UA alone.
- Toolbar: Back, Reload, title (game name), Done. Links to hosts outside the allowlist open in the system browser.
- `WKUserScript(source: captureJS, injectionTime: .atDocumentStart, forMainFrameOnly: false, in: .page)` and `userContentController.add(handler, contentWorld: .page, name: "dailiesCapture")`.
- Never add `WKAppBoundDomains` to Info.plist; it disables injection on non-app-bound domains.
- On a `dailiesCapture` message: verify `message.frameInfo.securityOrigin.host` is in the active allowlist, then `SubmissionQueue.shared.enqueue(text)`. Show the banner inside the sheet/window as well as in the main window.

### 4.3 capture.js (apple/capture/capture.js)

Requirements, each is load-bearing:

- Wrap the entire file in an IIFE; declare nothing at top level (avoids "duplicate variable" errors when pages `document.write` into frames).
- Guard with a host allowlist check on `location.host` inside the script (the native allowlist is checked again on receipt). The allowlist is injected by substituting `__HOSTS__` before creating the `WKUserScript`.
- Wrap four primitives, saving originals first: `navigator.share`, `Clipboard.prototype.writeText`, `Clipboard.prototype.write` (extract the `text/plain` blob from each `ClipboardItem`), and `document.execCommand` for the `'copy'` command (read `window.getSelection().toString()` or the active element's selected text before delegating).
- On capture: `window.webkit.messageHandlers.dailiesCapture.postMessage({ text, via, href: location.href })` synchronously, in the same call stack as the user's click (no `await` before the post). `via` is one of `share | writeText | write | execCommand`.
- Behaviour after capture: for `navigator.share` return `Promise.resolve()` WITHOUT calling the original, so the system share sheet does not appear inside the app (the native banner is the feedback). For clipboard writes and execCommand, delegate to the original so the game's "Copied!" UI still works. Make this a flag `SUPPRESS_SHARE_SHEET` (default true) so it can be flipped during testing.
- Dedupe inside the script: ignore an identical text captured within 2 s (games often call share and copy back to back).
- Never read cookies, forms, localStorage or page content. The only data sent is the text the game passed to share or copy.
- Define the wrapped properties with `Object.defineProperty(..., { configurable: true, writable: true })` so a page that redefines them does not throw.

Test harness: `apple/capture/harness.html` loads capture.js with a stub `window.webkit.messageHandlers` that logs to the page, and buttons that call each primitive. Open it in a WKWebView in the Simulator (Debug menu "Open capture harness") and confirm all four paths log.

### 4.4 Web app change

`Today.jsx` Play link: when `inApp` is true, `onClick` prevents default and calls `tellNative({ type: 'open', url: game.url, gameId: game.id })`. Native decides whether that opens in-app or in Safari.

### 4.5 Acceptance

- Each indie game: Play opens the in-app browser, finishing and tapping Share produces the banner with no share sheet and no paste, and the board refreshes behind the sheet. Record which primitive each game used in `apple/capture/README.md`.
- With the experimental toggle on: Wordle and Connections (no login needed) capture correctly; note whether linkedin.com/games loads at all in the WKWebView, logged out and logged in with username and password, and whether any "browser not supported" wall appears. Do not attempt user-agent spoofing.
- Commit "Add optional in-app game browser with share capture".

---

## Experiments that gate decisions (do these in order, report results before continuing past a failure)

1. Personal Team: add App Groups and Keychain Sharing to a fresh target; does provisioning succeed? Gates Stage 3.4.
2. iOS 17 and macOS 14 WKWebView: does `typeof navigator.share === 'function'`, and does a wrapped call that posts to native and returns a resolved promise work from a button click? Gates capture.js design.
3. Does `window.__dailies.issueToken` round-trip a token into the Keychain on first login? Gates Stage 2 submit path.
4. Share from the NYT Games app and LinkedIn app to the extension: is the text identical to the web share text? Feed every fixture through `detect()`.
5. Only if Stage 4 experimental is enabled: linkedin.com/games/queens in a WKWebView, logged out and logged in.

## Out of scope for this pass

- App Store submission, TestFlight, account deletion endpoint, privacy policy, app icon polish. (If submission is ever pursued: remove Stage 4 entirely, add `DELETE /api/auth/account`, add a privacy policy URL, and expect 4.2 scrutiny.)
- Automatic capture without tapping Share.
- Push notifications (unavailable on a Personal Team anyway).
- Android.

## Definition of done for the whole plan

A friend with only the Shortcut, and the developer with the app and extension, can each finish Wordle in the NYT app, tap Share, and see their score on the board without ever opening a text box. Every supported game has a fixture in `apple/capture/fixtures/` that `server/parsers.test.mjs` recognizes.
