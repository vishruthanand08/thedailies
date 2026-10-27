# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Dailies: a friends leaderboard for daily web games (Wordle, Connections, NYT Mini, LinkedIn games, Worldle, GeoGuessr, etc.). Users paste a game's share text; a hardcoded regex parser identifies the game, extracts the score, and checks it is today's puzzle. No AI or external APIs are involved.

## Commands

```bash
npm install && npm --prefix web install   # two separate package trees: root (API) and web/ (Vite + React)
npm run dev        # API on :3001 (node --watch) + Vite on :5173; Vite proxies /api to :3001
npm run build      # installs web deps and builds the frontend into web/dist
npm start          # production: the Express server serves web/dist and the API on one port
```

There is no linter or TypeScript. `npm test` (`node --test server/parsers.test.mjs`) checks that every real share in `apple/capture/fixtures/<gameId>.txt` is detected as that game; add a fixture only from an actual share. To check a parser against a sample share string:

```bash
node --input-type=module -e "import {detect} from './server/parsers.js'; console.log(detect(\`Wordle 1,234 3/6\`))"
```

Native app (`apple/`, see `docs/native-app-plan.md`), XcodeGen-generated (the `.xcodeproj` is gitignored):

```bash
cd apple && xcodegen generate     # export DAILIES_TEAM=<team id> first to sign; never commit a team id
xcodebuild -project apple/Dailies.xcodeproj -scheme Dailies -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath apple/build/DerivedData build
```

Debug builds accept launch arguments for scripted Simulator runs: `-dailiesServer local`, `-dailiesEval "<js>"` (runs once after the first page load), `-dailiesTestWordle YES`, and for the in-app game browser `-dailiesInAppGames NO`, `-dailiesExperimentalGames NO` (both on by default in Debug), `-dailiesOpenGame <url>`, `-dailiesOpenHarness YES`, `-dailiesGameEval "<js>"` (full list in `apple/Dailies/DebugMenu.swift`). On the Mac use `/usr/bin/log`, because zsh has a `log` builtin. Logs: `xcrun simctl spawn booted log show --info --predicate 'subsystem == "lol.thedailies"'`.

## Architecture

**Backend (`server/`, Express, ESM, plain SQL):**
- `db.js`: if `DATABASE_URL` is set it uses `pg` (Railway Postgres), otherwise embedded PGlite stored in `./data/pg` (gitignored, so local dev needs no setup). Both sit behind the same `q(text, params)` helper, so SQL must work on both. `schema.sql` runs on every boot with `CREATE ... IF NOT EXISTS`. There is no migration system, so changing an existing table needs a manual plan.
- `auth.js`: bcrypt + JWT in an httpOnly cookie (`db_token`). `requireAuth` (async) also accepts `Authorization: Bearer dly_...` device tokens from the `api_tokens` table (sha256-hashed, max 10 per user, managed at `/api/auth/tokens`) and checks them before the cookie. It sets `req.user = { id, username }`. The `JWT_SECRET` env var is required in production.
- `friends.js`: `friendships` stores one row per pair, normalized so `user_a < user_b` (use the `pair()` helper). `circleIds(userId)` (self + accepted friends) defines who appears on a user's board and feed.
- `submissions.js`: `POST /api/submissions` accepts either `{ text }` (parsed and verified) or `{ gameId, value }` (manual entry, allowed only when `game.manual`, stored with `verified=false`). Each user gets one submission per game per `puzzle_date` (enforced by a DB unique constraint and checked before insert, returning 409).
- `scoring.js`: `buildBoards(rows)` uses competition ranking (1-2-2-4) per game. Points per game are `N - rank + 1`, where N is the number of players who submitted that game. The daily "crown" is the sum of a user's points across games.
- `util.js`: all "today" logic uses **US Eastern** (`America/New_York`, `todayISO()`). Dates are passed around as ISO `YYYY-MM-DD` strings.

**Parsers (`server/parsers.js`) are the core of the app.** `GAMES` is the single registry: the frontend gets tile metadata from `GET /api/submissions/games`, and boards, feed, and scoring all key off `game.id`. Each entry has:
- `parse(text)`: returns `{ puzzleNumber?, date?, metric, display }`, or `null` if the text isn't this game.
- `better`: `'lower' | 'higher'`, which sets the sort direction for `metric`.
- `epoch: { date, first }`: the date of puzzle `#first`, used to derive the puzzle's date from its number. If it is `null`, the date can only come from text embedded in the share.
- `dateTolerance`: the number of days the derived date may differ from today. If no date can be derived, the staleness check is skipped.
- `manual`: also accept a typed-in score.
- `embed`: the site allows being framed, so Play on the website opens it in `GamePanel.jsx` (iframe plus a clipboard Paste button). Only games verified to render in an iframe get this; NYT, LinkedIn, Krillion, EthnoGuessr and GeoGuessr refuse framing, and Worldle/Travle ask not to be framed.

`detect()` tries each game **in array order** and returns the first non-null result, with exceptions swallowed per game. A new or loosened regex can therefore steal another game's share text, so put specific patterns before general ones. LinkedIn games share a single `linkedinGame()` factory. Their epoch dates are best-effort, which is why they have `dateTolerance: 3`. Failed puzzles are mapped to a worse-than-max metric (e.g. Wordle `X` → 7, failed Connections → 5).

Adding a game = adding one `GAMES` entry. No frontend change is needed.

**Frontend (`web/src/`, React 18 + Vite, no router or state library):** `App.jsx` switches between the tabs `today`, `feed`, and `friends` using local state. `api.js` wraps `fetch('/api' + path)` and throws `Error(data.error)` on non-2xx responses. Server error messages are written to be shown to users directly. Invite links (`/?add=username`) are held in `App` across login and consumed by `Friends.jsx`, which sends the request. `native.js` is the bridge to the iOS/macOS shell. It is inert in normal browsers. In the app (user agent contains `TheDailiesApp/`) it reports the session, issues a device token on request, and routes Play through native.

**Native app (`apple/`):** a SwiftUI shell around the site in one long-lived `WKWebView` (`WebController`). Native submissions never go through the web view. They use `DailiesAPI` (`URLSession` + bearer token from the shared keychain) via `SubmissionQueue`. The iOS share extension (`DailiesShare/`) posts directly with the same token. The Debug-only in-app game browser (`GameBrowser.swift`) injects `apple/capture/capture.js` into allowlisted game sites (`GameHosts.swift`) to catch the game's own share/copy text and enqueue it. Create web views in `onAppear`, not in a SwiftUI view's init, because SwiftUI may build views more than once.

## Deploy

Railway (Nixpacks): `npm install` → `npm run build` → `npm start`. A Postgres service provides `DATABASE_URL`, and `JWT_SECRET` must be set on the app service.
