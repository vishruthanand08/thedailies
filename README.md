# Dailyboard

One leaderboard for every daily game your group plays — Wordle, NYT Mini, Connections,
LinkedIn games (Queens, Tango, Zip, Pinpoint, Crossclimb), GeoGuessr daily, Worldle, Globle,
Travle, Costcodle, Fermi, MapTap, Krillion, Noillirk, EthnoGuessr.

Paste the share text from any game's share button → a hardcoded parser verifies the format
**and that it's today's puzzle** → it lands on your friends leaderboard. No AI, no cost.

## How it works

- **Friends, not groups** — add friends by username; your leaderboard is you + your friends.
- **Per-game boards + daily crown** — for each game, 1st of N players gets N points, 2nd gets
  N−1, etc. Sum across games = the daily crown. Playing more games earns more points.
- **Feed** — reverse-chron stream of everyone's submitted scores, raw share text attached as
  the receipt.
- **Verification** — parsers check the share-string format and derive the puzzle's date from
  its number (Wordle #, Connections #, LinkedIn #s) or embedded date (Mini, Worldle, Globle).
  Stale pastes are rejected. Fermi, MapTap, and Krillion share formats were captured live
  on 2026-10-26. Games with no reliable share text (GeoGuessr without GGShare, Noillirk,
  EthnoGuessr) also allow manual entry, shown with a `~manual` badge.
- Day rolls over on US Eastern time (matches NYT).

## Dev

```bash
npm install && npm --prefix web install
npm run dev        # API on :3001, Vite on :5173 (proxies /api)
```

No database setup needed locally — it uses embedded Postgres (PGlite) in `./data/`.

## Deploy (Railway)

1. `railway login` (Nick's account), `railway init` in this repo.
2. Add a **Postgres** service to the project; Railway injects `DATABASE_URL`.
3. Set `JWT_SECRET` to something random on the app service.
4. `railway up` — Nixpacks runs `npm install`, `npm run build` (builds the frontend into
   `web/dist`, which the API serves), then `npm start`.

## Adding a game

Add one entry to `server/parsers.js`: metadata (name, emoji, color, url, better: lower/higher)
plus a `parse(text)` that returns `{ puzzleNumber?, date?, metric, display }` or `null`.
That's it — tiles, boards, feed, and scoring pick it up automatically.
