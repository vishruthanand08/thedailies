# Rename The Dailies to win leaderboard searches

The Dailies should launch as **"Dailies: Puzzle Leaderboard"** (27 characters) with the subtitle **"Word game tracker with friends"** (30). That puts five searchable nouns (dailies, puzzle, leaderboard, word game, tracker) and the social hook (friends) into the two fields Apple weights most. The current draft's name ("The Dailies", which is taken) and subtitle ("Beat your friends every day") index almost nothing anyone types. The niche is open: every direct competitor found (StreakSync, Daily Game League, Wurdle with Friends, Scordle) has **fewer than 10 ratings**. The only large rival, NYT Games, has a friends leaderboard that covers NYT games alone ([App Store: StreakSync](https://apps.apple.com/us/app/streaksync-puzzle-tracker/id6755203446); [TODAY](https://www.today.com/popculture/nyt-multi-game-leaderboard-rcna202155)). So the winnable ground is long-tail tracker and leaderboard terms, plus the cross-publisher pitch "all your daily games, one board", not head terms like "puzzle" or "wordle". Game brand names (Wordle, Connections, NYT, LinkedIn, Queens, GeoGuessr) belong only in the long description, as a factual compatibility list with a non-affiliation disclaimer. Guidelines 2.3.7, 4.1(c) and 5.2.1 make them a rejection risk in the name, subtitle, keywords, captions and event names ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). Switch the primary category from Games › Puzzle to Entertainment, with Games (Word, Puzzle) as secondary. Ask for ratings after the first crown or a 7-day streak. On thedailies.lol, add a Smart App Banner, universal links for `/?add=` invites, crawlable landing pages and a sitemap, none of which exist in the repo today. After launch, ratings and install velocity will move rank more than any wording change, because rivals sit at 1 to 6 ratings.

## Apple indexes five fields, and the draft wastes two of them

Apple confirms that search matches text in the **name, subtitle, keyword field and the primary and secondary category**, and that the developer name is already searchable. It says outright that **promotional text "doesn't affect your app's search ranking"** ([Apple, App Store Search](https://developer.apple.com/app-store/search/)). The description is not treated as ranked text. Appfigures found "no indication that app descriptions are being indexed" ([Appfigures](https://appfigures.com/resources/guides/app-store-algorithm-update-2025)). The industry consensus is that the name outweighs the subtitle, which outweighs keywords, but Apple has never published weights ([AppTweak](https://www.apptweak.com/en/aso-blog/which-factors-influence-rankings-on-the-app-store)). Apple combines single words across the name, subtitle and keyword field within one locale. A word should therefore appear only once across all three, plurals count as duplicates, and filler words ("the", "with") and generic words ("app", "game") are wasted ([Apple, App Store Search](https://developer.apple.com/app-store/search/)). The limits are 30 characters for the name and subtitle, **100 bytes** for keywords, 170 for promotional text and 4,000 for the description ([ASC Help](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)). All the text below is ASCII, so characters equal bytes.

Two rules are **unconfirmed**. The first is screenshot-caption OCR indexing. Appfigures says Apple has extracted caption text since about June 2025. ConsultMyApp tested 64 screenshot-only phrases and found "no strong evidence" for it ([Appfigures](https://appfigures.com/resources/guides/app-store-algorithm-update-2025); [ConsultMyApp](https://consultmyapp.squarespace.com/blog/-is-apple-now-indexing-screenshot-titles-on-the-app-store)). Write captions with plain keywords anyway: it costs nothing. The second concerns Apple's LLM-generated App Store Tags. They are built from en-US metadata and shown in US search, but Apple doesn't say whether they affect ranking ([ASC Help, Manage app tags](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-tags)). That gives the description an indirect discovery role, so it should say "word games", "puzzles", "leaderboard" and "friends" in plain English.

Universal purchase matters for the split between platforms. **The name, subtitle and categories are shared between iPhone and Mac. Keywords, description, promotional text and screenshots are set per platform** ([ASC Help, App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)). So the Mac gets its own 100-byte keyword field. Custom product pages and Product Page Optimization work on iPhone and iPad only ([Apple, Custom product pages](https://developer.apple.com/app-store/custom-product-pages/)).

### Name and subtitle

The current draft has two problems. "The Dailies" is taken, and the subtitle has no searchable nouns. Any variant must also stand apart from the existing "Dailies" habit trackers and "The Daily: Puzzles & Games" ([App Store: Dailies](https://apps.apple.com/us/app/dailies-track-habits-rewards/id6502421000); [App Store: The Daily](https://apps.apple.com/us/app/the-daily-puzzles-games/id6763613128)). A brand-plus-descriptor name is not an exact match, so it should pass the uniqueness check. Only creating the App Store Connect record confirms that, and the record also reserves the name, so **create it now** ([Apple Dev Forums 809402](https://developer.apple.com/forums/thread/809402)). The home-screen name (`CFBundleDisplayName`, now "The Dailies" in `apple/project.yml`) is set separately and can stay as it is.

| Option | Text | Chars | Indexed words added | Trade-off |
|---|---|---|---|---|
| **Top pick: name** | `Dailies: Puzzle Leaderboard` | **27** | dailies, puzzle, leaderboard | Drops "The" (a filler word Apple ignores anyway) to fit "Leaderboard", the most relevant term and the one with least competition |
| Option 2: name | `The Dailies: Puzzle Tracker` | **27** | dailies, puzzle, tracker | Keeps the full brand; "tracker" matches competitor phrasing ("Puzzle Tracker", "score tracker") |
| Option 3: name | `The Dailies: Word Game Scores` | **29** | dailies, word, game, scores | Keeps the brand but spends space on "game", which a Games category already covers |
| **Top pick: subtitle** | `Word game tracker with friends` | **30** | word, game, tracker, friends | With the top-pick name, it covers "puzzle leaderboard", "word game tracker", "puzzle tracker" and "leaderboard with friends" |
| Alt subtitle (with option 2) | `Daily puzzle leaderboards` | **25** | daily, leaderboards | Use only with option 2. It repeats "puzzle", so swap it for "Word game leaderboards" (21) if you want no overlap |

Leaving "Wordle" out of the subtitle is deliberate. Scordle's "The score tracker for Wordle" got through review in 2022 and hasn't been re-reviewed since. Guideline 2.3.7 now says subtitles "should not … reference other apps", and a July 2025 rejection was over exactly that ([App Store: Scordle](https://apps.apple.com/us/app/scordle/id1616529464); [Apple Dev Forums 791158](https://developer.apple.com/forums/thread/791158)). The draft's tagline "Beat your friends every day" moves to screenshot 2.

### Keyword fields

Both fields assume the top-pick name and subtitle and an Entertainment + Games category pair. They contain no word from the name (dailies, puzzle, leaderboard), the subtitle (word, game, tracker, with, friends) or the categories (entertainment, games), no trademarks, no spaces and no internal repeats, all checked by script.

**iOS (98/100):**
```
daily,streak,score,stats,crossword,logic,brain,trivia,geography,compete,challenge,rank,group,sport
```

**Mac (100/100):**
```
daily,streak,score,stats,crossword,logic,brain,trivia,geography,compete,rank,group,desktop,sport,map
```

The Mac field swaps "challenge" for "desktop" and "map". Mac keyword data is thin, and ASO tools rarely track Mac ranks, so optimize iOS first ([aso.dev](https://aso.dev/metadata/editor/)). **Unconfirmed:** whether Apple treats "daily" as a duplicate of "Dailies". Apple lists plurals as duplicates, but "dailies" is an unusual plural. "daily" is the most valuable word here ("daily puzzle", "daily word game"), so keep it until a test shows it's redundant. If you pick option 2 or 3, rebuild the field: option 2 frees "leaderboard" and "word", option 3 frees "leaderboard" and "tracker".

A further 100 characters is available through the vendor-reported cross-localization trick. The US storefront reportedly also indexes Spanish (Mexico), though words don't combine across locales ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-benefit-from-cross-localization-on-the-app-store); [MobileAction](https://www.mobileaction.co/blog/app-store-cross-localization/)). Apple has never documented this, and the last vendor tests date from 2022, so treat it as optional and **unconfirmed**. If you use it, give es-MX the same name and subtitle and this keyword set (94 characters): `quiz,map,flag,country,baseball,football,basketball,sudoku,riddle,mind,rival,club,record,league`.

The current draft's field (`daily,puzzle,leaderboard,friends,word,crossword,…`) would now repeat the name and subtitle in four words, and "puzzle" also repeats the Games › Puzzle subcategory. It needs replacing.

## Entertainment fits a tracker better than Games › Puzzle

Apple defines Games as apps that "provide single or multiplayer interactive activities for entertainment purposes" and calls an inappropriate category a 2.3 violation. It also puts "score trackers" and "fantasy sports companions" under Sports rather than Games, which shows Apple files companion apps by what they do ([Apple, Categories](https://developer.apple.com/app-store/categories/)). The Dailies hosts no games. Players play on the publishers' sites. Putting a Games primary under Puzzle invites a reviewer question and places the app in Puzzle subcategory charts against Wordscapes and NYT Games, which it can't climb. The closest real competitor, Daily Game League, uses **Entertainment**, and StreakSync uses Utilities ([App Store: Daily Game League](https://apps.apple.com/us/app/daily-game-league/id6550890849)).

**Recommendation: primary Entertainment, secondary Games with subcategories Word and Puzzle.** Apple allows Games subcategories when Games is the secondary category, and both categories are indexed ([ASC Help](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information); [Apple, App Store Search](https://developer.apple.com/app-store/search/)). The secondary category keeps the word "games" searchable without a claim to be one. Social Networking is the strongest alternative, since "friends leaderboard" is social. Its charts are dominated by giant apps, though, and Entertainment matches the competitor that chose deliberately. The cost of leaving Games primary is real: no Games-tab placement and no presence in the iOS 26 Games app ([Phiture](https://phiture.com/blog/app-store-ios-26-updates-aso/)). For an app this small, avoiding a review dispute is worth more. Whether subcategories are indexed when Games is secondary is **unconfirmed**. One required change: the Mac primary category must match Xcode's `LSApplicationCategoryType`, which `apple/project.yml` sets to `public.app-category.games` in three places, so change it to `public.app-category.entertainment` ([ASC Help](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)).

## Name the games only in the description, behind a disclaimer

NYT enforces actively, but every documented action targets clones, copied gameplay or puzzle archives. That includes GitHub DMCA notices against nearly 2,000 Wordle forks in 2024 and a cease-and-desist over a Connections archive in November 2024 ([PC Gamer](https://www.pcgamer.com/games/puzzle/nearly-2000-wordle-clones-targeted-as-nyt-issues-dmca-takedown); [Nieman Lab](https://niemanlab.org/reading/the-new-york-times-is-trying-to-shut-down-a-popular-connections-puzzle-creator)). No action against score trackers was found, but that absence doesn't prove NYT tolerates them. NYT holds WORDLE and CONNECTIONS registrations for apps and online games, and LinkedIn has filed for ZIP and TANGO ([Markinton](https://markinton.com/trademark/connections-98788251); [Markinton](https://markinton.com/trademark/zip-99060408)). NYT now sells its own friends leaderboard, which gives it more reason to object than it had in 2022. The defensible pattern is nominative: The Dailies' value in the first lines, a factual list of compatible games lower down, game names spelled correctly, and no logos or publisher colors anywhere ([Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)). Wurdle with Friends and Scordle both got through with brand names in the description. Both were reviewed in 2022, so they are weak precedent ([App Store: Wurdle with Friends](https://apps.apple.com/us/app/wurdle-with-friends/id1616260888)). No 2025–2026 approval or rejection of a tracker over a description mention was found.

Only the first sentence shows before "more", which makes it the most important line ([Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)). Paste this opening (sentence one is 81 characters):

```
The Dailies turns the daily puzzles you already play into a friendly competition.

Play your puzzles, paste the result, and see where you rank among friends today and all time. Win the daily crown, keep your streak alive, and cheer friends on in the feed.

• One leaderboard for word games, logic puzzles, geography and sports games
• A daily crown for whoever scores the most points across every game, plus a crown for each kind of game
• All-time leaderboards with your friends, by game or overall
• Your stats: streaks, wins, averages and personal bests
• A feed of your friends' days, with kudos and PB tags
• Share straight from a game's share sheet on iPhone, or press Paste
• Pin your favorite games and arrange the rest however you like
• Invite friends with a link
• On Mac: the same boards, with keyboard shortcuts for days and pasting

No ads. No tracking. Your scores are only visible to the friends you accept.

WORKS WITH
The Dailies reads the share text from popular daily games, including Wordle, Connections, Strands and The Mini from NYT Games; LinkedIn's Queens, Tango, Zip, Crossclimb, Pinpoint and Mini Sudoku; Worldle, Globle, Travle, GeoGuessr and TimeGuessr; Immaculate Grid for MLB, NFL and NBA; Poeltl; Minute Cryptic; and more. You play each game on its publisher's own website.

The Dailies is an independent app and is not affiliated with, endorsed by, or sponsored by The New York Times Company, LinkedIn, or any other game publisher. Game names are trademarks of their respective owners.
```

Every game in the "Works with" list is in the `GAMES` registry in `server/parsers.js` as of this writing. Update the list when games are added or removed. This fixes two problems in the current draft: the duplicate bullet ("Games grouped by kind" repeats the first line) and the missing compatibility list and disclaimer. The same nominative rules should cover What's New ("Added support for X" is fine). In-app event names and promotional text should carry no brands.

### Promotional text

Promotional text has no ranking value, can be edited without a release, and shows above the description ([Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)). Use it for conversion and news.

Launch version (152/170):
```
All your daily games, one board. Paste a result, see where you rank among friends, take the crown and keep your streak alive. Free, no ads, no tracking.
```

Rotation example for a later update (146/170):
```
New: sports grids for baseball, football and basketball. Invite your friends with one link and see who takes the crown. Free, no ads, no tracking.
```

## The first three screenshots do the selling

Apple says the first one to three portrait screenshots appear in search results when there is no preview video ([Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)). SplitMetrics case studies found most users decide within the first two or three frames, and shorter, experience-led captions lifted conversion 10–32% ([SplitMetrics/FreshPlanet](https://splitmetrics.com/customers/freshplanet-optimizes-ios-screenshots/); [SplitMetrics/ZiMAD](https://splitmetrics.com/blog/designing-screenshots-a-guide-on-how-to-achieve-a-32-conversion-lift/)). Put a large, high-contrast caption at the top of each frame with one theme per frame. Captions carry no trademarks. Game names may appear only as plain row labels inside The Dailies' own UI, with no publisher logos, tiles or Wordle green-and-yellow. Apple recommends at least one Dark Mode shot, and screenshot 4 or 5 is a good candidate. The existing 1320×2868 set covers every iPhone size ([Apple, Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)). Captions have no character limit. The counts below are for legibility.

| # | Screen | Headline (chars) | Sub-line (chars) |
|---|---|---|---|
| 1 | Today | `Every daily puzzle. One board.` (30) | `Word, logic, geography and sports` (33) |
| 2 | Leaderboard | `Beat your friends every day` (27) | `Take the crown, game by game` (28) |
| 3 | Play and paste | `Play, tap Share, tap Paste` (26) | `Your score lands on the board` (29) |
| 4 | Stats | `Streaks, wins and personal bests` (32) | `Your stats across every game` (28) |
| 5 | Feed | `Cheer on friends in the feed` (28) | `Kudos, PBs and daily streaks` (28) |

Screenshot 1 has to explain the cross-game value, so make sure it shows several categories and friends' names. Skip a preview video for launch: an autoplaying video would replace screenshots 1–3 in search. For the four Mac screenshots (2880×1800, 16:10), show native touches like the menus, ⌘ shortcuts and the game panel, so the app doesn't read as "just the website".

## Ratings and install velocity outrank wording at this scale

Apple confirms that downloads, ratings and reviews affect ranking ([Apple, App Store Search](https://developer.apple.com/app-store/search/)). Rating also drives conversion. In NP Digital's 49-company study, a 4-star app converted at **0.83×** a 5-star app and a 3-star app at **0.57×** ([NP Digital](https://neilpatel.com/marketing-stats/app-downloads-vs-ratings/)). Since rivals hold 1–6 ratings, an estimated 20–50 genuine ratings would put The Dailies ahead of all of them on tracker terms.

The repo has no review prompt yet. The system prompt shows at most **three times per 365 days**, and Apple advises asking after a satisfying moment without interrupting the user ([Apple, Ratings and reviews](https://developer.apple.com/app-store/ratings-and-reviews/)). Call SwiftUI's `@Environment(\.requestReview)` only after the user has posted scores on at least three separate days. Trigger it the first time they win the day's crown, or reach a 7-day streak if that comes first. Show it when Today or the Feed has finished loading, never during sign-in, the paste flow, the share extension or the game browser. Ask a second time at a 30-day streak. The Mac build can use the same rule. Reply to every low-star review, and don't incentivize ratings.

**Launch sequence.** Create the App Store Connect record now to hold the name. Open a TestFlight public link (up to 10,000 testers) to existing friend groups 2–4 weeks before launch, so a cohort installs and rates on day one ([Apple, TestFlight](https://developer.apple.com/testflight/)). Submit a Featuring Nomination at least two weeks ahead, or up to three months for wider consideration. Lead with what editors weigh: native SwiftUI, Dynamic Type and accessibility, the Mac app, and no ads or tracking ([Apple, Getting featured](https://developer.apple.com/app-store/getting-featured/)). A pre-order page (2–180 days) auto-installs the app on release. Whether free apps qualify is **unconfirmed** in Apple's page ([Apple, Pre-orders](https://developer.apple.com/app-store/pre-orders/)). Wait until the listing is live, then post to Product Hunt, Show HN and puzzle subreddits, leading with the problem ("one board for the group chat's dailies") and following each subreddit's self-promotion rules. Spend $5–10/day on Apple Ads for 1–2 weeks to learn real search popularity for "puzzle leaderboard", "word game tracker" and "daily puzzle", and don't bid on trademarks. Free popularity data for these terms couldn't be found, and the only measured figure is "wordle" at 72/100 traffic and 62/100 difficulty ([Applyra](https://www.applyra.io/tools/keywords/ios/us/wordle)). The real growth loop is the invite link, so launch copy should say "start a group", not "download". Later, add a recurring in-app event such as **"Crown Week"** (10 characters, within the 30-character event-name limit). Events show in search and on the product page, and vendors report the event name as indexed, but each one needs a real in-app view of its standings ([Apple, In-app events](https://developer.apple.com/app-store/in-app-events/)).

## Five fixes on thedailies.lol turn web traffic into installs

Backlinks don't directly move App Store rank. The installs they send do, and Google indexes apps.apple.com pages, so links to the listing help it rank on the web ([AppRadar](https://appradar.com/academy/backlinks-seo-for-apps)). Web search for "wordle leaderboard with friends" mostly turns up stale 2022 hobby projects and Discord bots, so a current, crawlable multi-game page has an opening. That ranking potential is **unverified**: no real SERP or volume data was available. The repo currently has no Smart App Banner, no `apple-app-site-association` file, no Associated Domains entitlement, no robots.txt and no sitemap.

**Smart App Banner.** In `server/meta.js`'s `metaFor()`, add `<meta name="apple-itunes-app" content="app-id=<id>, app-argument=<full request URL>">` once the app ID exists. Because the server writes it into the initial HTML, the reported Safari problem with client-side navigation in single-page apps doesn't apply here ([Apple, Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners); [Apple Dev Forums 708680](https://developer.apple.com/forums/thread/708680)). An invite URL then reaches the app intact. Leave it off `/privacy` and `/support`. The banner shows only in iOS Safari and is hidden once the app is installed. That scope comes from documentation the research fetch couldn't render, so confirm it.

**Universal links for invites.** Serve `/.well-known/apple-app-site-association` as `application/json` from Express, ahead of the SPA catch-all, with no redirects. The `applinks.details[].components` entry should match path `/` with query `{"add":"*"}`, and exclude `/api/*`, `/download/*`, `/privacy` and `/support`. Add `applinks:thedailies.lol` and `applinks:www.thedailies.lol` (the listing URLs use www) to the iOS and Mac entitlements, and handle the URL in `onOpenURL`/`onContinueUserActivity` so the native Friends screen sends the request. The syntax is from Apple's associated-domains documentation, which the research fetch only partly rendered, so **verify it** ([Apple, Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)).

**Crawlable landing pages.** The sign-in-first root gives crawlers little to read. Google renders JavaScript but still recommends server rendering, unique titles and real `<a href>` links ([Google Search Central](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)). Generate pages on the server from the `GAMES` registry: a landing page with screenshots and the App Store badge, a `/games` index, and one page per game ("Connections leaderboard with friends", explaining how scoring works and linking to the publisher). Descriptive game names are lower risk on the web than in App Store metadata, but keep the disclaimer and no logos there too. Add `SoftwareApplication` + `MobileApplication` JSON-LD with `offers.price: 0` and `operatingSystem: "iOS, macOS"`. Google requires a rating for the rich result, so add `aggregateRating` only once real App Store ratings exist ([Google, Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)).

**Sitemap and robots.** Serve `robots.txt` that allows the public pages, disallows `/api/` and points to `sitemap.xml`. The sitemap should list the landing page, the games pages, `/privacy` and `/support`. Give invite URLs a canonical of `/` (or `noindex`) so usernames aren't indexed. Use one App Store URL everywhere (site, Product Hunt, Reddit) with a `ct=` campaign token so App Store Connect attributes the web installs. Decide whether Mac visitors see the Mac App Store link or the DailiesDirect download in `MacApp.jsx`, because offering both splits installs and ratings.

## Conclusion

This listing doesn't need clever copy. It needs the store's few indexed slots spent on what people actually type ("puzzle", "leaderboard", "word game", "tracker", "friends"), with the brand names people know kept to the one field where naming them is defensible. The constraint that matters most is behavioral. A field of rivals with single-digit ratings means the first 50 honest ratings and a few hundred invite-driven installs will decide rank more than any keyword. That makes the review prompt and universal-link invites ranking work as much as product work. The biggest open risk isn't ASO. A future NYT or LinkedIn complaint would most likely target brand use in metadata or the in-app browser, not the score parsing. Keeping brands out of indexed fields, and keeping the App Review notes explicit that games load unmodified on the publishers' own sites, is the cheapest insurance available.
