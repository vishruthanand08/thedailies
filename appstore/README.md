# App Store submission kit

Everything to paste into App Store Connect for The Dailies (iPhone + Mac, one app record, universal purchase).
Screenshots are in `screenshots/iphone-6.9/` (1320×2868) and `screenshots/mac/` (2880×1800), both
gitignored. Regenerate them against the local demo data with the `-dailiesScreenshots YES` launch flag
(iPhone Pro Max Simulator; on the Mac, capture the window and pad it onto a 2880×1800 canvas).

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
| Copyright | 2026 <your legal name> |
| Version | 1.0 (build 1) |

### Promotional text (170 max, editable any time)

Your daily puzzle habit, now a friendly competition. Paste your result, climb the board, keep your streak.

### Description

The Dailies turns the daily games you already play into a friendly competition.

Play your daily puzzles right inside the app, tap the game's Share button, then tap Paste. The Dailies reads
your score, checks it's today's puzzle, and puts you on a leaderboard with your friends.

• One board for all your dailies: word games, logic puzzles, geography games and more
• Games grouped by kind: word games, logic puzzles, geography and more
• A daily crown for whoever does best across every game that day, plus a winner for each kind of game
• All-time leaderboards with your friends, by game or overall
• Your own stats: streaks, wins, averages and personal bests
• Pin your favorite games to the top and arrange the rest however you like
• Share straight from a game's share sheet on iPhone
• Invite friends with a link

No ads. No tracking. Your scores are only visible to the friends you accept.

### Keywords (100 max, comma separated, no spaces after commas, no trademarks)

daily,puzzle,leaderboard,friends,word,crossword,geography,streak,score,brain,logic,compete,challenge

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

Not collected: contact info, location, health, financial, browsing history, purchases, diagnostics, ads data.
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
> game's own website in an in-app browser. The page is shown unmodified: we don't inject scripts or change it.
> When finished, the player taps the game's own Share or Copy button and then our Paste button at the bottom;
> the app reads only that pasted text to record the score. On iPhone, the share extension does the same from
> a game's share sheet.
>
> Demo account: <username> / <password>. It has two friends and scores for today, so the Today, Friends and
> You tabs show real data.
>
> User-generated content is limited to usernames, scores and game suggestions, visible only to accepted
> friends. Users can remove a friend at any time (Friends tab), report a user or problem from the You tab
> (emails support), and delete their account in the app (You tab › Delete account).

## Screenshots

- **iPhone 6.9"** (required): use the five in `screenshots/iphone-6.9/` in order. Apple scales them for
  smaller iPhones.
- **Mac** (required, 1–10): use the four in `screenshots/mac/` in order (2880×1800).

## Release checklist

1. Membership approved (developer.apple.com/account › Membership details); note the Team ID.
2. A working support email (support@thedailies.lol doesn't exist yet). It is on `/support`, `/privacy`
   and the You tab's "Report a problem" link.
3. Demo account on the live site with two friends and scores for the day you submit.
4. App Store Connect › Apps › + › New App: iOS + macOS, name The Dailies, bundle ID lol.thedailies.app,
   SKU thedailies-1.
5. `cd apple && DAILIES_TEAM=<team id> DAILIES_PUSH=-Push xcodegen generate`, open in Xcode, pick the team
   (automatic signing turns on the Push Notifications capability for the app ID).
   Any iOS Device › Product › Archive › Distribute App › App Store Connect; then the same with My Mac.
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
