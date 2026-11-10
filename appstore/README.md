# App Store submission kit

Everything to paste into App Store Connect for The Dailies (iPhone + Mac, one app record, universal purchase).
Screenshots are in `screenshots/iphone-6.9/` (1320×2868) and `screenshots/mac/` (2880×1800), both
gitignored; the previous set is in `screenshots/old-2026-10-27/`. How they're made is under Screenshots.

## App information

| Field | Value |
| --- | --- |
| Name | The Dailies |
| Subtitle (30 max) | Beat your friends every day |
| Bundle ID | lol.thedailies.app (share extension: lol.thedailies.app.share) |
| SKU | thedailies-1 |
| Primary category | Games › Puzzle |
| Secondary category | Social Networking |
| Price | Free |
| Privacy Policy URL | https://www.thedailies.lol/privacy |
| Support URL | https://www.thedailies.lol/support |
| Marketing URL | https://www.thedailies.lol |
| Copyright | 2026 Nicholas Pianfetti |
| Version | 1.0 (build 1) |

### Promotional text (170 max, editable any time)

New: just play and your score saves itself. Brag with one tap, get a nudge when friends have played, and take the daily crown. Free, no ads.

### Description

The Dailies turns the daily puzzles you already play into a friendly competition.

Just play. When you finish a game, your score saves itself and lands on your friends' leaderboard. See who won every game today, take the daily crown, keep your streak alive and cheer friends on in the feed.

• Scores save themselves: play any game in the app and your result is on the board when you finish, with Undo if you didn't mean it
• One leaderboard for word games, logic puzzles, geography and trivia games
• A daily crown for whoever scores the most points across every game, plus a crown for each kind of game
• Brag with one tap: share your score or your crown with a link that brings friends straight to the board
• A nudge when your friends have played and you haven't, and before your streak runs out
• All-time leaderboards with your friends, by game or overall
• A global leaderboard you can join, under your username or a fun name
• Your stats: streaks, wins, averages and personal bests
• A feed of your friends' days, with kudos and PB tags
• Stay signed in to your game accounts between plays
• Pin your favorite games and arrange the rest however you like
• Sign in with Apple, and add an email to get back in if you forget your password
• On Mac: the same boards, with keyboard shortcuts for days and pasting

No ads. No tracking. Your scores are only visible to the friends you accept, unless you choose to join the global leaderboard.

WORKS WITH
The Dailies reads the share text from popular daily games, including Wordle, Connections, Strands and The Mini from NYT Games; LinkedIn's Queens, Tango, Zip, Crossclimb, Pinpoint and Mini Sudoku; Worldle, Globle, Travle, GeoGuessr and TimeGuessr; Minute Cryptic; and more. You play each game on its publisher's own website.

The Dailies is an independent app and is not affiliated with, endorsed by, or sponsored by The New York Times Company, LinkedIn, or any other game publisher. Game names are trademarks of their respective owners.

### Subtitle and keywords

The name ("Dailies: Puzzle Leaderboard") and subtitle are searched as well as the keywords, so the
keywords never repeat their words (dailies, puzzle, leaderboard, daily, word, games, friends).

- Subtitle (30 max): `Daily word games with friends`
- Keywords (100 max, comma separated, no spaces): `crossword,trivia,geography,streak,score,brain,logic,compete,challenge,group,stats,quiz,sudoku,rank`

Keep game brand names (Wordle, NYT, LinkedIn, Queens, etc.) out of the name, subtitle, keywords and
screenshots' captions. Mentioning compatibility in the description later is generally fine, but not needed.

## App Privacy (the "nutrition label")

Data used to track you: **No**. Data linked to you, all for **App Functionality** only:

| Category | Type | Why |
| --- | --- | --- |
| Identifiers | User ID | the username |
| User Content | Gameplay Content | scores and pasted share text |
| User Content | Other User Content | game suggestions |
| Other Data | Other Data Types | the device name of signed-in app devices |
| Contact Info | Email Address | account recovery (optional; Sign in with Apple's email too) |

Not collected: name, phone, location, health, financial, browsing history, purchases, diagnostics, ads data.
These match `apple/Dailies/PrivacyInfo.xcprivacy`.

## Age rating questionnaire

Answer "None" to all violence, sexual, drug, gambling and horror items. Then:

- User-generated content / social features: **Yes** (usernames, friend scores, game suggestions)
- Unrestricted web access: **No** (the in-app browser only opens the listed game sites; other links go to Safari)
- Messaging/chat: **No**

Expect a 13+ rating.

## App Review information

- **Sign-in required:** Yes. Create a demo account on the live site first (see steps), with 2 friends and a few
  scores, and enter its username and password here.
- **Contact:** your name, phone and email.
- **Notes for the reviewer** (paste as is):

> The Dailies is a leaderboard for daily puzzle games played with friends. Tap Play on any game to open that
> game's own website in an in-app browser. To save the player's score, the in-app browser reads the result the
> game itself shares when the player finishes (the same text the game's Share or Copy button produces, which the
> app also presses once the game shows it). Nothing else on the page is read or changed. If that doesn't work,
> the player taps the game's Share button and then our Paste button. On iPhone, the share extension does the same
> from a game's share sheet.
>
> Demo account: <username> / <password>. It has two friends and scores for today, so the Today, Friends and
> You tabs show real data.
>
> User-generated content is limited to usernames, scores and game suggestions, visible only to accepted
> friends. Users can remove a friend at any time (Friends tab), report a user or problem from the You tab
> (emails support), and delete their account in the app (You tab › Delete account).

## Screenshots

Marketing frames, not bare captures: a short benefit-led caption (4–8 words, key word on the site's yellow
highlighter) over the real app in a frame with the site's outline and hard shadow. The first three carry
the pitch, since App Store search results show only those. Upload in this order.

**iPhone (1320×2868; App Store Connect scales them for smaller iPhones):**

| # | File | Caption |
|---|---|---|
| 1 | `01-today.png` | Beat your friends at **every** daily game |
| 2 | `02-saved.png` | Just play. Your score **saves itself**. |
| 3 | `03-leaderboard.png` | See who won **every** game |
| 4 | `04-brag.png` | **Brag** with one tap (the real share text and link preview, as chat bubbles) |
| 5 | `05-feed.png` | Cheer on your **friends** |
| 6 | `06-reminders.png` | Never break your **streak** (the real notification texts) |
| 7 | `07-games.png` | **30+** daily games in one place (a graphic of the games, no phone) |
| 8 | `08-friends.png` | Add friends with **one link** (from the 2026-11-04 set) |

**Header and search results (creative assets, App Store on iOS 27+):** `creative/header-3840x1646.png`
(21:9: the name and "Every daily game. One leaderboard." in the middle third, which every device shows;
phones and game tiles toward the edges) and `creative/search-3840x2560.png` (3:2: "Beat your friends at
your daily puzzles" over the crown, a score saving itself and a game's board). Without a search results
asset, search shows the first three screenshots, so those carry the pitch too.

**Remaking the 1.7 set:** `make-listing.mjs` + `render.sh` (see the top of each). Demo data goes in its own
database (`PGLITE_DIR=<scratch>/shotsdb`, a server on port 3002 with `ADMIN_USERNAMES=nobody` and
`PUBLIC_URL=https://www.thedailies.lol`), so the dev database is never touched; the app is launched with
`-dailiesLocalURL http://localhost:3002`. The Saved banner is real: `-dailiesOpenGame https://chainle.io`
with `-dailiesGameEval` writing today's Chainle share to the clipboard, which ResultCatcher catches (open the
game three times first so the guide card is gone, and give the demo account a confirmed email so Add an
email doesn't show).

**Mac (2880×1800):** `01-today` Every daily game, **one window** · `02-play` Play right **in the app** ·
`03-feed` Cheer on your **friends** · `04-friends` Add friends with **one link**.

**Remaking them** (local server with demo data, so no real accounts show):
1. Fill today with demo scores and kudos for alex/maya/jules/sam/priya (stop the dev API first; PGlite allows
   one process). Restart it with `ADMIN_USERNAMES` not listing alex, so no Admin tab shows.
2. iPhone: a freshly erased iPhone Pro Max Simulator (1320×2868) with `simctl status_bar … --time 9:41`,
   launched with `-dailiesServer local -dailiesScreenshots YES` (hides the debug gear and the notification
   prompt, and shows Paste as it looks with a result copied) plus `-dailiesTab feed|friends`,
   `-dailiesGame wordle`, `-dailiesAddSheet YES` or `-dailiesOpenGame <url>`. Save to `shots-raw/<name>.png`.
3. Mac: the DailiesDirect Debug app at a 1440×900 window (2880×1800 on Retina), captured by window id. Save
   to `mac-raw/<name>.png`.
4. `node appstore/screenshot-kit/make-iphone.mjs <scratch dir>` and `make-mac.mjs <scratch dir>` write the
   pages; render each with headless Chrome at the exact size (`--window-size=1320,2868` or `2880,1800`,
   `--force-device-scale-factor=1`). The scripts lay `https://thedailies.lol/?add=alex` over the local
   invite link.

## Release checklist

1. Membership approved (developer.apple.com/account › Membership details); note the Team ID.
2. A working support email: thedailiessupport@gmail.com for now. It is on `/support`, `/privacy`
   and the You tab's "Report a problem" link.
3. Demo account on the live site: `appreview`, friends with `demo_sam` and `demo_alex` (passwords kept
   out of the repo). Give all three fresh scores on the day you submit.
4. App Store Connect › Apps › + › New App: iOS + macOS, name The Dailies, bundle ID lol.thedailies.app,
   SKU thedailies-1.
5. `cd apple && DAILIES_TEAM=<team id> DAILIES_PUSH=-Push xcodegen generate`, open in Xcode, pick the team
   (automatic signing turns on the Push Notifications capability for the app ID).
   Any iOS Device › Product › Archive › Distribute App › App Store Connect; then the same with My Mac.
   Archive the **Dailies** scheme for the App Store (no updater). **DailiesDirect** is the website download
   with Sparkle (apple/tools/release-mac.sh) and must never be uploaded to App Store Connect.
   Bump `CURRENT_PROJECT_VERSION` in `project.yml` for every later upload.
6. Push key (once): developer.apple.com › Keys › + › Apple Push Notifications service (APNs), Sandbox &
   Production. Download the .p8 (it can only be downloaded once) and note its Key ID. On Railway's app
   service set `APNS_KEY` (the .p8 file's contents), `APNS_KEY_ID` and `APNS_TEAM_ID`, then redeploy.
7. TestFlight on your own phone: sign in, allow notifications, Play, Paste, the share sheet, and have a
   friend give you kudos.
8. Fill in the listing from this file, attach the screenshots, then Submit for Review.

Already set: no non-exempt encryption (`ITSAppUsesNonExemptEncryption = NO`, so no export question),
Mac app category (Games), Mac sandbox with network access, iPhone-only (no iPad screenshots needed),
privacy manifests, account deletion, and both Release builds compile.
