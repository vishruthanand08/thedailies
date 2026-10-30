# App Store product-page conversion and website-to-app SEO for The Dailies (as of Oct 2026)

Scope: a free iOS + Mac app with no ads or IAP. It is a friends leaderboard for daily web puzzles, with the website thedailies.lol (a React SPA on Express, server-written title and OG tags, invite links /?add=username). The draft listing has the subtitle "Beat your friends every day", 5 iPhone screenshots and 4 Mac screenshots.

## Screenshots, app previews and screenshot-text indexing

### Takeaway
A 6.9" iPhone set (1320×2868) and a 16:10 Mac set are enough. Apple scales them down for smaller devices. The first 1–3 portrait images are what searchers see, so screenshots 1–3 must sell the product alone: friends' leaderboard, crown or streak, paste-to-score. Use short, large, keyword-bearing captions at the top of each frame. Several ASO firms report, consistently but without official confirmation, that Apple has OCR-indexed screenshot caption text since June 2025.

### Cited Findings
- **iPhone 6.9" sizes:** 1320×2868, 1290×2796 or 1260×2736 portrait (landscape equivalents accepted). They are "Not required. If not provided, scaled screenshots for 6.5" are used." 6.5" (1284×2778 / 1242×2688) is required only if there is no 6.9" set. — [Apple, Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- **Mac sizes:** 16:10 only (1280×800, 1440×900, 2560×1600, 2880×1800), and they are required for Mac apps. Up to 10 screenshots per device size, in JPEG or PNG with no alpha or transparency. — [Apple, Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- **Search results:** "Depending on the orientation of your screenshots, the first one to three images will appear in search results when no app preview is available, so make sure these highlight the essence of your app. Focus each subsequent screenshot on a main benefit or feature." Apple also suggests at least one Dark Mode screenshot if the app supports it, and images "captured from your app's UI." — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)
- **App previews:** up to 3 per page, each up to 30 s, built from on-device footage. They "autoplay with muted audio when users view your product page, so make sure the first few seconds of your video are visually compelling." Poster frames show when video doesn't autoplay. — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)
- **Caption indexing (Appfigures):** Apple "is now extracting text from your app's screenshot captions and treating that text as part of your keyword metadata." Appfigures based this on analysis of "thousands of keywords" with no Apple statement. It found some apps ranking for keywords that appear only in screenshots, though that signal seemed weaker alone. Its advice:
  - captions at the top of the frame
  - high contrast and plain, large fonts
  - one keyword theme per screenshot
  - replace vague phrases like "Easy to Use"

  Appfigures saw no sign of description or preview-video indexing. Article dated June 2025 and modified June 2026. — [Appfigures, App Store algorithm update 2025](https://appfigures.com/resources/guides/app-store-algorithm-update-2025)
- **Other vendors:** they repeat the June 2025 OCR-indexing claim. One says captions in the first three screenshots carry the most weight, and one notes Apple "has not published a statement" confirming it. — [AppDrift](https://appdrift.co/blog/app-store-screenshot-text-indexing); [Phiture, ASO trends 2026](https://phiture.com/blog/aso-trends-in-2026/); [ConsultMyApp](https://consultmyapp.squarespace.com/blog/-is-apple-now-indexing-screenshot-titles-on-the-app-store)
- **SplitMetrics case studies on screenshot lifts:**
  - SongPop2: shorter captions and bolder graphics gave 10% better CVR, and most users converted after viewing the first two screenshots. — [SplitMetrics/FreshPlanet](https://splitmetrics.com/customers/freshplanet-optimizes-ios-screenshots/)
  - ZiMAD: shorter, experience-led captions instead of feature lists gave a 32% conversion lift. — [SplitMetrics/ZiMAD](https://splitmetrics.com/blog/designing-screenshots-a-guide-on-how-to-achieve-a-32-conversion-lift/)
  - OLBG: 61% conversion increase, with the first three screenshots having the biggest impact. — [casestudies.com/SplitMetrics OLBG](https://www.casestudies.com/company/splitmetrics/case-study/optimization-of-ios-screenshots-brings-61-conversion-boost)
  - Paper by FiftyThree: 33% more installs from screenshot A/B testing. — [SplitMetrics/FiftyThree](https://splitmetrics.com/blog/paper-by-fiftythree-how-to-get-33-more-installs-with-screenshots-ab-testing/)
- **Custom product pages:** since July 2025, keywords from the keyword field can be assigned to custom product pages (CPPs), which then appear in organic search for those keywords. CPPs don't add new keyword coverage, and each keyword links to one CPP. Third-party reports say the limit was raised from 35 to 70 CPPs around Oct 2025. — [AppTweak CPP guide](https://www.apptweak.com/en/aso-blog/guide-to-custom-product-pages-cpp?format=md); [Adapty](https://adapty.io/blog/custom-product-pages-app-store/); [Moburst](https://www.moburst.com/blog/custom-product-pages-the-complete-cpp-strategy-guide/)

### Inferences
- **Screenshot 1:** the crown or Today board with friends' avatars. Caption on a single benefit with a keyword, e.g. "Daily puzzle leaderboard with friends".
- **Screenshot 2:** paste-and-score. "Paste your Wordle-style result. Done." See the trademark caution in the Web SEO section.
- **Screenshot 3:** streaks and the feed with kudos. Stats and the per-game leaderboard can follow.
- Five iPhone screenshots is fine. Shots 1–3 do the work in search, and 4–5 matter only to people who open the page.
- A caption can repeat a word from the subtitle or keyword field. On the Appfigures theory this reinforces relevance. Each caption should still add one new theme: "daily puzzles", "streaks", "friends".
- Because the app has no money in it, a common indie ASO pattern is a caption or social-proof line like "Free. No ads." in screenshot 1 or 2. This is an inference, not a measured lift.
- **Preview video:** for a small launch it is optional. A 15–20 s clip (solve, paste, the board updates, the crown changes hands) could help, but an autoplaying video takes the first slot in search over screenshots 1–3. Ship screenshots first, and add video only if it can be A/B tested with Product Page Optimization.
- **Custom product pages:** a solo app can still use one CPP (e.g. a "Connections"-flavored or "LinkedIn games"-flavored page) as the target for invite and website traffic. It could also be linked to specific keywords.

### Gaps
- No Apple primary source confirms screenshot OCR indexing. It rests on vendor observation.
- No current (2025–26) controlled study on the conversion value of app preview videos for utility or social apps was found. Most data is older and from games.
- I could not confirm whether Mac App Store previews autoplay, or how many Mac screenshots appear in Mac App Store search. Mac search shows a single landscape image in my experience, but this is unverified.
- A cited "SplitMetrics 2024 report: captions +25–30% vs captionless" could not be verified.

## App icon

### Takeaway
Apple's guidance is a simple, recognizable icon with no fine detail, tested across options. I found no current quantitative icon-lift data worth citing.

### Cited Findings
- "Your app icon is one of the first elements of your app that users see… Work with a graphic designer to create an icon that is simple and recognizable. Try testing different options… To ensure the icon is legible in all sizes, avoid adding unnecessary visual details." — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)

### Inferences
- The icon (drawn by `apple/tools/make-icon.swift`) should read at about 60 px next to Wordle-clone and puzzle icons. A single bold glyph like a crown on lavender or yellow fits the brand and the "crown" mechanic.
- Product Page Optimization in App Store Connect can A/B test alternate icons, but they must ship in the binary. That is worth it only once traffic is meaningful (hundreds of page views a day).
- iOS 26's Liquid Glass and tinted or clear icon modes make a simple single-layer glyph safer still. This is an inference, not checked against Apple sources here.

### Gaps
- No credible 2025–26 study quantifying icon-test conversion lifts was found in this pass.

## Description, promotional text and What's New

### Takeaway
On iOS the description isn't indexed for App Store search and promotional text explicitly isn't. Use the first sentence of the description for conversion, promotional text for timely news (editable without a release), and What's New to answer feedback.

### Cited Findings
- "The first sentence of your description is the most important — this is what users can read without having to tap to read more." "Don't add unnecessary keywords to your description in an attempt to improve search results." Put accolades at the end or in promotional text, and leave prices out. — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)
- Promotional text is up to 170 characters and appears at the top of the description. "You can update promotional text at any time without having to submit a new version." "Promotional text doesn't affect your app's search ranking so it should not be used to display keywords." — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)
- Subtitle: 30 characters, shown below the name throughout the store. "Avoid generic descriptions… highlight features or typical uses." Keywords: 100 characters, comma-separated with no spaces. Avoid plurals of words already used, category names, the word "app", duplicates, and "unauthorized use of trademarked terms… competing app names." — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)
- What's New "appears on your product page and on the Updates tab". Use it to show "you've listened" to feedback, list changes by importance, and add call-to-action messaging. — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)
- Appfigures: "I haven't found any indication that app descriptions are being indexed." — [Appfigures](https://appfigures.com/resources/guides/app-store-algorithm-update-2025)
- Google indexes App Store (apps.apple.com) pages in Google Search. Backlinks to them can raise their Google ranking, which makes the description the main body text Google sees there (vendor claim). — [AppRadar, backlinks for apps](https://appradar.com/academy/backlinks-seo-for-apps)

### Inferences
- **Subtitle:** "Beat your friends every day" is benefit-led but has no searchable nouns. Something like "Daily puzzle leaderboards" or "Friends leaderboard for puzzles" puts searchable words into an indexed field. The friendly tagline can move to screenshot 1 or the promotional text.
- **First description line:** one sentence covering who, what and how. For example: "Paste your daily puzzle results and see who's winning: Wordle-style word games, Connections-style groups, the Mini, LinkedIn games, Worldle and more." Check this against the trademark caution in the Web SEO section.
- **Description length:** write it for Google as well. Plain-English game names and use cases help the apps.apple.com page rank on the web, though Apple's trademark rules still apply to what's claimed.
- **Promotional text:** rotate it with no release needed. Ideas: "New: Immaculate Grid for MLB, NFL & NBA", "Invite friends with one link", a season or challenge announcement.

### Gaps
- No primary Google source states how Google weighs the App Store description on apps.apple.com pages.

## In-app events

### Takeaway
In-app events suit a daily-games app well: weekly or monthly "Challenge" or "Competition" events, up to 31 days each. They show on the product page and in search. Event cards replace screenshots in search for people who have the app, and events can be searched directly and featured editorially. Event names have been reported as indexed.

### Cited Findings
- **Badges:** Challenge, Competition, Live Event, Major Update, New Season, Premiere, Special Event.
- **Metadata:** event name 30 characters (the actual event name, not a CTA), short description 50, long description 120. No unverifiable claims like "#1", no prices, and no text or logos in event media.
- **Limits:** up to 15 approved and 10 published events. An event lasts up to 31 days and can be promoted up to 14 days before it starts. Events are reviewed separately from app versions.
- **Where events appear:**
  - In search: for people who have the app, the event card appears alongside the app instead of screenshots, and users can search for events directly.
  - On the product page, ordered by start time.
  - In editorial selections and personalized recommendations on the Today, Games and Apps tabs.
  - Users can opt in to start notifications.

  — [Apple, In-app events](https://developer.apple.com/app-store/in-app-events/)
- Vendor field maps list in-app event titles among indexed iOS fields, with description and promotional text not indexed. — [AppScreenshotStudio indexed fields](https://appscreenshotstudio.com/tools/app-store-indexed-fields) (vendor, unverified by Apple)

### Inferences
- **Recurring events to run:**
  - "Wordle Week Showdown" style Competitions, e.g. "Crown Week". Avoid trademarked names in the event name.
  - "30-Day Streak Challenge" (Challenge badge).
  - "Sports Grid Season" (New Season, for when the Sports category is added).
- An event needs real in-app content: a deep link that opens a Challenge view showing the event period's standings. That is an app feature to build. A label on the existing board is not enough.
- Events give a free app a reason to submit featuring nominations on a cadence (next section).

### Gaps
- No data was found on install lift from in-app events for small or new apps specifically.

## Ratings and reviews

### Takeaway
The system review prompt is limited to 3 per 365 days. Trigger it after a happy moment: taking the crown, a streak milestone, a PB. Never ask during onboarding or paste flows. Ratings below about 4.0 hurt conversion sharply. Reply to low-star and bug reviews. Reset the summary rating only after fixing a real problem, since a new app with few ratings converts worse.

### Cited Findings
- "You can prompt for ratings up to three times in a 365-day period" using SKStoreReviewController. Modern API: `AppStore.requestReview(in:)` or SwiftUI `@Environment(\.requestReview)`. "Make the request when users are most likely to feel satisfaction… such as when they've completed an action, level, or task. Make sure not to interrupt their activity." — [Apple, Ratings and reviews](https://developer.apple.com/app-store/ratings-and-reviews/)
- **Summary rating reset:** the summary rating is per territory and can be reset with a new version, but "we recommend using this feature sparingly". "Having few ratings may discourage potential users from downloading your app." A reset keeps written reviews. — [Apple, Ratings and reviews](https://developer.apple.com/app-store/ratings-and-reviews/)
- **Replying to reviews:** you can respond to any review. The reviewer is notified and can update their review. Prioritize the lowest-star reviews and ones about technical issues in the current version. Mention fixes in release notes and reply to the related reviews. Use "Report a Concern" for spam or abuse. A rating can be used in marketing if it's current. Quoting a review needs the reviewer's permission. — [Apple, Ratings and reviews](https://developer.apple.com/app-store/ratings-and-reviews/)
- **Rating vs conversion:**
  - NP Digital (2024, 49 companies): relative conversion is 1.00 at 5★, 0.96 at 4.5★, 0.83 at 4★, 0.57 at 3★, 0.15 at 2★ and 0.08 at 1★. — [Neil Patel / NP Digital](https://neilpatel.com/marketing-stats/app-downloads-vs-ratings/)
  - Alchemer: going from 3 to 4 stars gives about an 89% conversion lift. 46% of consumers set 4★ as the minimum they'd consider. — [Alchemer](https://www.alchemer.com/resources/blog/mobile-ratings-good-bad-ugly/)
  - Both are vendor studies, not peer-reviewed.
- **Ranking:** ratings and reviews are commonly listed among App Store ranking factors, behind metadata relevance and download velocity, per vendors. — [SplitMetrics, App Store ranking factors (Sep 2025)](https://splitmetrics.com/blog/apple-app-store-ranking-factors/)

### Inferences
- **Trigger** (native `requestReview`): the first time the user wins a day's crown or hits a 7-day streak, and only after at least 3 days of use. Optionally a second time at a 30-day streak.
- **On the Mac,** `requestReview` also works but shares Apple's limit. The website can't prompt at all.
- **Ratings at launch:** seed early ratings from friends and TestFlight testers who install the release on day one. Ask in person or in the feed. Don't incentivize, since Apple forbids it.
- **On reset:** don't reset the rating at launch, because there's nothing to reset. Keep it as an option after a bad early bug.

### Gaps
- No primary Apple statement on how ratings count factors into search rank was found.

## Launch tactics for an indie free app

### Takeaway
Use a TestFlight public link (up to 10,000 testers) to build a group of friends who install on day one. Optionally list the app for pre-order (2–180 days ahead, with auto-download on release). Submit a Featuring Nomination at least 2 weeks, and up to 3 months, before launch. Go live on the App Store before Product Hunt or Reddit posts. Apple Ads (renamed from Search Ads in April 2025) can validate keywords cheaply.

### Cited Findings
- **TestFlight:** up to 10,000 external testers. The public link can be capped at 1–10,000 testers and turned off at any time. The first external build needs Beta App Review, plus a beta description and review info. — [Apple, TestFlight](https://developer.apple.com/testflight/); [App Store Connect Help, invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- **Pre-orders:**
  - New apps can set release 2–180 days after the pre-order is published.
  - On release the app auto-downloads to pre-orderers' devices and they get a notification. Pre-orders are discoverable in search, and on the Today, Games and Apps tabs if featured.
  - Apple doesn't tell pre-orderers about date changes.
  - The page doesn't say whether free apps qualify, though in practice they do (unverified).

  — [Apple, Pre-orders](https://developer.apple.com/app-store/pre-orders/)
- **Featuring Nominations** (App Store Connect):
  - Timing: give "a minimum of two weeks' notice", or nominate "up to three months in advance" for wider consideration. Nominations cover new apps, launches, updates and in-app events.
  - What editors weigh: UX, UI design, innovation, uniqueness, accessibility, localization, and the product page (screenshots, previews, description, positive ratings).
  - Featured apps get an email asking for promotional assets.
  - Placements include App of the Day, stories, collections, lists, in-app events, pre-orders and Editors' Choice.

  — [Apple, Getting featured](https://developer.apple.com/app-store/getting-featured/)
- **Apple Ads:** Apple renamed Search Ads to "Apple Ads" (announced April 14, 2025). Placements now include the Today tab and "You Might Also Like" on product pages, and Apple Ads registered with AdAttributionKit. — [AppleInsider](https://appleinsider.com/articles/25/04/14/apple-rebrands-its-advertising-business-as-apple-ads); [Search Engine Land](https://searchengineland.com/apple-search-ads-apple-ads-454356). A 2026 guide describes a simpler tier limited to search results placements that can't choose keywords or audiences. — [Search Engine Land, Apple Ads guide](https://searchengineland.com/apple-ads-what-to-know-463194)
- **Indie launch anecdotes** (not data):
  - Product Hunt rank depends more on copy, timing and follow-up than followers, and high rank can come with weak retention.
  - Reddit punishes promotion. Lead with solving a problem.
  - Make sure the App Store listing is live before posting.
  - Aim for 50–100 beta testers.

  — [dev.to launch strategy](https://dev.to/kanta13jp1/indie-dev-launch-strategy-getting-traction-on-producthunt-hackernews-and-reddit-18g6); [Indie app launch guide](https://screenshot-maker.pages.dev/blog/indie-app-launch-guide); [RevenueCat, treating TestFlight like a launch](https://www.revenuecat.com/blog/growth/joe-fabisevich-plinky-launched-podcast-2026)

### Inferences
- **Sequencing:**
  1. TestFlight public link for friend groups, 2–4 weeks before launch.
  2. Featuring nomination 3+ weeks before launch. Emphasize the native SwiftUI iPhone app, the Mac app, Dynamic Type and accessibility, and the "no ads, no tracking" angle, which matches editors' criteria.
  3. Launch day: a Show HN or Product Hunt post, plus value-first posts in puzzle communities. Read each subreddit's rules on self-promotion.
- **Product loop:** the core growth loop is the invite link. Each new player brings a friend group, so launch messaging should push "start a group" rather than solo downloads.
- **Apple Ads budget:** a small Apple Ads search campaign ($5–10/day for 1–2 weeks) shows which terms ("wordle leaderboard", "puzzle with friends", "daily games") have volume and convert. It needs Advanced to choose keywords, and bidding on competitor trademarks is risky.

### Gaps
- No hard 2025–26 data was found on pre-order conversion, or on install volumes from Product Hunt or Reddit for free iOS apps.
- I could not confirm whether "Apple Ads Basic" still exists under that name.

## Web SEO and website-to-App Store linkage

### Takeaway
Here is what thedailies.lol should do:
- Add a Smart App Banner meta tag to every page, with `app-argument` carrying the current URL, invite links included.
- Serve an apple-app-site-association file so `/?add=username` opens the app (the AASA `?` component matches query items).
- Make public pages (landing, per-game "leaderboard with friends" pages, privacy, support) render real HTML from the server. Add sitemap.xml, robots.txt and SoftwareApplication/MobileApplication JSON-LD.
- Link to the App Store URL prominently.

Web backlinks don't directly move App Store search rank. They help the apps.apple.com page rank on Google and send referral installs, which do count.

### Cited Findings
- **Smart App Banner:** put `<meta name="apple-itunes-app" content="app-id=…, app-argument=…">` in the `head` of each page where the banner should appear. `app-argument` is passed to the app as a URL (deep link). `affiliate-data` is optional. — [Apple, Promoting apps with Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)
- **SPA caveat:** one developer forum report says Safari takes `app-argument` from the initial HTML and does not update it after client-side navigation. This is a single report, not official. — [Apple Developer Forums thread 708680](https://developer.apple.com/forums/thread/708680)
- **Banner scope:** the banner appears in Safari on iOS, not in other iOS browsers' own UI or macOS Safari. It is not shown if the app is already installed and dismissals stick. This is from general documentation knowledge and should be confirmed on the Apple page. — [Apple, Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)
- **Universal Links:**
  - The AASA file goes at `https://<domain>/.well-known/apple-app-site-association`, served over HTTPS as JSON with no redirects.
  - The `applinks.details[].components` entries match `"/"` (path), `"?"` (query items, e.g. `{"add":"*"}`) and `"#"`, and support `"exclude": true`.
  - The entitlement is `applinks:thedailies.lol`, with `?mode=developer` to bypass Apple's CDN cache in development.
  - It works on macOS too.

  Note: the fetch returned only the page title, so these details come from known Apple docs. Verify against the page. — [Apple, Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- **Google on JavaScript sites:**
  - Googlebot renders JavaScript on 200 pages.
  - Google still recommends server-side rendering or prerendering, "since not all bots can run JavaScript".
  - Titles and meta descriptions set by JS must be unique.
  - Use real History-API URLs and `<a href>` links, not `#/` fragments.
  - Handle soft 404s with a JS redirect to a real 404 URL or a `noindex` meta tag.
  - Blocked JS isn't rendered.

  — [Google Search Central, JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- **Software app structured data:**
  - Required: `name`, `offers.price` (set to `0` for free), and one of `aggregateRating` or `review`.
  - Recommended: `applicationCategory`, e.g. `GameApplication`, `SocialNetworkingApplication` or `EntertainmentApplication`, and `operatingSystem`.
  - `MobileApplication` and `WebApplication` are supported subtypes. A rich result isn't guaranteed.

  — [Google, Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- **Backlinks and App Store rank:** vendor consensus is that Apple doesn't use backlinks as a direct App Store ranking factor. Only the resulting referral traffic and engagement help. Apple's App Store pages are indexed by Google, and backlinks to them raise their Google rank. A Google Play case study found backlinks gave weak ranking effects. — [AppRadar](https://appradar.com/academy/backlinks-seo-for-apps); [Kurve](https://kurve.co.uk/blog/backlinks-for-aso-app-rankings); [Yellowhead case study](https://www.yellowhead.com/blog/backlinks-impact-google-play-aso-case-study/)
- **Trademarks:** Apple forbids "unauthorized use of trademarked terms… competing app names" in keywords. — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)

### Inferences
- **Smart App Banner:** the server already injects meta at `<!-- server meta -->` in `server/meta.js`. That is the right place for the banner tag, with `app-argument` set to the full request URL. Invite links (`/?add=alice`) then reach the app even when the banner is tapped. The app should read the argument through its universal-link and `onOpenURL` handling. Since the server writes it on first paint, the forum's SPA-navigation issue matters less.
- **Universal Links:**
  - AASA components: `{"/":"/","?":{"add":"*"}}` for invites, and possibly `/` generally. Exclude `/privacy`, `/support`, `/download/*` and `/api/*`.
  - Add the Associated Domains entitlement to the iOS (and Mac) targets.
  - Express must serve the file with `application/json` before the SPA catch-all.
- **Static landing content:** the SPA's sign-in-first root gives Google little to index. Add server-rendered, crawlable pages: a home or landing hero with screenshots and App Store badge, `/games` listing the supported games with how scoring works, and perhaps one page per game. The `GAMES` registry can generate the per-game pages ("Connections leaderboard with friends").
- **Trademark wording:** write descriptively, e.g. "Track your Wordle scores with friends", and don't imply NYT affiliation. No NYT or LinkedIn logos, plus a disclaimer line. "Wordle" in web page copy describing compatibility is lower-risk than in App Store keywords, where Apple's rules bar it. This is a judgment call, not legal advice.
- **Sitemap and robots:** add sitemap.xml (landing, games pages, privacy, support) and a robots.txt that allows those and disallows `/api/`. Invite URLs should not be indexed: canonicalize `/?add=` to `/` or `noindex` them.
- **Structured data:** JSON-LD `SoftwareApplication` (co-typed `MobileApplication`) with `offers.price: 0`, `operatingSystem: "iOS, macOS"` and `applicationCategory: "GameApplication"` or `"SocialNetworkingApplication"`. Google requires a rating or review for the rich result, so add `aggregateRating` only once there's a genuine App Store rating to mirror. Leave out the rating until then.
- **OG image:** the existing OG image (`web/public/og.png`) and invite previews ("Add @username on The Dailies") already do the social-share job. Make sure the image is 1200×630 and readable at small sizes in iMessage previews.
- **Linking out:** use one canonical App Store link everywhere (website, Product Hunt, Reddit) so all referral installs and Google link equity go to the same apps.apple.com URL. A campaign token (`ct=`) lets App Store Connect attribute web traffic.

### Gaps
- The Apple Smart App Banner and associated-domains page bodies did not render in fetch. Syntax details are from known docs and should be verified.
- No primary Google statement on how apps.apple.com pages rank was found.
- No evidence was found that web traffic to the App Store URL boosts App Store search rank beyond the installs it produces.

## Mac App Store page differences

### Takeaway
Mac screenshots must be 16:10 (up to 2880×1800, max 10). The same product-page fields apply, including up to 3 previews. The Mac app is the website in a native shell, so Mac screenshots should show native touches (menus, ⌘ shortcuts, game panel) next to the board.

### Cited Findings
- 16:10 sizes only (1280×800, 1440×900, 2560×1600, 2880×1800) and required for Mac apps. Up to 10. — [Apple, Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- Screenshots and up to three app previews apply to "App Store and Mac App Store product pages." — [Apple, Creating your product page](https://developer.apple.com/app-store/product-page/)

### Inferences
- **Size:** use 2880×1800 with large captions. The Mac store shows screenshots wide, so a caption band at the top with the window below works.
- **Content:** show the board, the game panel with a puzzle, the Paste Result shortcut and the menu bar, so it reads as a Mac app rather than "a website".
- **Download builds:** the direct-download DailiesDirect build isn't affected by the Mac App Store listing. The website's Mac download offer (`MacApp.jsx`) may compete with the Mac App Store once it's live, so decide which one to promote.

### Gaps
- Whether Mac App Store previews autoplay, and how many Mac screenshots show in Mac search results, could not be confirmed from Apple sources in this pass.
