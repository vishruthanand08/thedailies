# Trademark and App Review risk of naming third-party games in The Dailies' App Store listing (as of Oct 2026)

Research, not legal advice. Trademark-status facts below come mostly from third-party aggregators of USPTO data, not USPTO TSDR directly. Check them there before relying on them.

## What do the current App Store Review Guidelines say (2.3.7, 4.1, 5.2.1, 5.2.2, 4.2, 4.7)?

### Takeaway
The guidelines draw the line by field. Brand names are effectively barred from the **name/icon** (4.1(c), unless the owner approves), the **subtitle** ("should not ... reference other apps", 2.3.7) and the **keyword field** (Apple's product-page guidance lists "Unauthorized use of trademarked terms" and "Competing app names" under "Do not use"). The **description** is not explicitly barred, but 5.2.1 ("Don't use protected third-party material such as trademarks ... without permission") gives a reviewer grounds to object if they choose to. 5.2.2 (permission under a third-party service's terms) is the guideline most relevant to the in-app game browser.

### Cited Findings
- **2.3.7 (Accurate Metadata), verbatim:** "Choose a unique app name, assign keywords that accurately describe your app, and don't try to pack any of your metadata with trademarked terms, popular app names, pricing information, or other irrelevant phrases just to game the system. App names must be limited to 30 characters. Metadata such as app names, subtitles, screenshots, and previews should not include prices, terms, or descriptions that are not specific to the metadata type. App subtitles ... must follow our standard metadata rules and should not include inappropriate content, reference other apps, or make unverifiable product claims. Apple may modify inappropriate keywords at any time or take other appropriate steps to prevent abuse." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **4.1 Copycats:** "(a) ... Don't simply copy the latest popular app on the App Store, or make some minor changes to another app's name or UI and pass it off as your own. In addition to risking an intellectual property infringement claim..." "(b) Submitting apps which impersonate other apps or services is considered a violation of the Developer Code of Conduct and may result in removal from the Apple Developer Program." "(c) You cannot use another developer's icon, brand, or product name in your app's icon or name, without approval from the developer." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **5.2.1:** "Don't use protected third-party material such as trademarks, copyrighted works, or patented ideas in your app without permission, and don't include misleading, false, or copycat representations, names, or metadata in your app bundle or developer name." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **5.2.2 Third-Party Sites/Services:** "If your app uses, accesses, monetizes access to, or displays content from a third-party service, ensure that you are specifically permitted to do so under the service's terms of use. Authorization must be provided upon request." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **2.3.10:** "Make sure your app metadata is focused on the app itself and its experience. Don't include irrelevant information." (Its main concern is other mobile platforms.) — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **4.2 Minimum Functionality:** "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." **4.2.2:** "Other than catalogs, apps shouldn't primarily be marketing materials, advertisements, web clippings, content aggregators, or a collection of links." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **4.7 intro:** covers HTML5/JS "mini apps and mini games" offered inside an app: "You are responsible for all such software offered in your app, including ensuring that such software complies with these Guidelines and all applicable laws." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple's product-page guidance on keywords, under "Do not use":** "Unauthorized use of trademarked terms, celebrity names, and other protected words and phrases"; "Terms that are not relevant to the app"; "Competing app names". Apple calls improper keyword use "a common reason for App Store rejections." — [Apple: Creating your product page](https://developer.apple.com/app-store/product-page/)
- **Same page, on the description:** "Don't add unnecessary keywords to your description in an attempt to improve search results." It does not ban naming other products. — [Apple: Creating your product page](https://developer.apple.com/app-store/product-page/)
- **Same page, on promotional text:** "You can update promotional text at any time without having to submit a new version of your app ... promotional text doesn't affect your app's search ranking so it should not be used to display keywords." — [Apple: Creating your product page](https://developer.apple.com/app-store/product-page/)

### Inferences
- **Keyword field:** "wordle", "connections", "nyt", "linkedin", "queens", "geoguessr" and similar are the highest-risk placement, and they buy little. Apple's guidance names this practice explicitly, and Apple can silently modify keywords. Even generic-sounding marks like "connections", "zip" or "tango" are risky when they plainly target the game.
- **Name, icon, subtitle:** a brand here is near-certain rejection under 4.1(c) and 2.3.7. The current draft already avoids this.
- **Screenshots:** 2.3.7 names screenshots as metadata. Brand logos or the game's own UI in screenshots would be a 4.1/5.2.1 problem. Showing The Dailies' own UI with plain game names as list labels (for example "Wordle 3/6" on a leaderboard row) is lower risk but not zero. Showing NYT/LinkedIn logos or game tiles is high risk.
- **Promotional text:** the same rules apply, but it changes without review of a new build. A brand name added there later is still reviewable and reportable, and gives no search benefit.
- **In-app event names:** the guidelines text gathered here doesn't cover them. They are metadata and appear in search, so treat them like the subtitle: no third-party brands.

### Gaps
- The fetched guidelines page showed no "last updated" date. I did not confirm whether a 2025–2026 revision changed the wording of 2.3.7, 4.1 or 5.2.x. The text above is what was live when fetched (Oct 2026).
- Apple's specific rules for in-app event metadata weren't fetched.

## Can the description use "compatible with X" / "works with X" phrasing?

### Takeaway
There is real precedent. Approved apps have named Wordle in their subtitle and description, and one July 2025 rejection was resolved with a "for [Brand]" suffix plus a non-affiliation disclaimer. Apple tolerates descriptive, nominative use more than keyword stuffing. Enforcement is inconsistent, though, and the safest pattern is a factual mention in the description body with a disclaimer.

### Cited Findings
- **Scordle** (developer Rayne Hugo), live on the US App Store. Subtitle: "The score tracker for Wordle". Description: "The Wordle tracker you didn't know you needed ... a social score tracker for Wordle". It has no affiliation disclaimer, and its last version was 1.3.0 on 04/26/2022, so it was approved under the 2022 rules and hasn't been re-reviewed since. — [App Store: Scordle](https://apps.apple.com/us/app/scordle/id1616529464)
- **Wurdle with Friends** (One Step LLC) deliberately misspells the name ("Compete in Wurdle with friends") and states: "This app is not affiliated with Wordle. It is purely meant as a tracker for your scores to share with your friends." Last version 0.1.3, 10/19/2022. — [App Store: Wurdle with Friends](https://apps.apple.com/us/app/wurdle-with-friends/id1616260888)
- **July 2025 developer forum thread:** a device-remote app was rejected under 2.3.7 for a trademarked brand in its subtitle. Its description already said it was not associated with the trademark owner. After an appeal, the fix was to add "for [Brand]" as a suffix to the app name and remove the trademark from the subtitle, and the app was approved. — [Apple Developer Forums 791158](https://developer.apple.com/forums/thread/791158)
- Another developer forum thread complains of a 2.3.7 rejection for keywords in the app name while competitors with similar names stayed live, an example of inconsistent enforcement. — [Apple Developer Forums 111168](https://developer.apple.com/forums/thread/111168)
- A third-party ASO source claims Apple scans automatically for known brand terms in metadata. This is unverified vendor content. — [appdrift / ASO guide](https://appdrift.co/blog/ios-app-store-keywords-field)

### Inferences
- The July 2025 "for GoPro" outcome applies to hardware accessories, where the brand is necessary to explain the product. A single-brand accessory is a stronger case than a multi-game tracker, so don't count on getting "for Wordle" into the name. The Dailies is multi-game, and its name doesn't need a brand.
- The two Wordle tracker apps are from 2022 and haven't been updated since. They show only that the description and subtitle got through in 2022. Re-review today, after NYT's enforcement and more scrutiny of 2.3.7, could go differently. Subtitle mentions now conflict with the explicit "should not ... reference other apps" wording in 2.3.7.
- **Recommended description pattern** (nominative, factual, plain text, no logos):
  - "Works with the share text from popular daily puzzles, including Wordle, Connections, Strands and The Mini from NYT Games; LinkedIn's Queens, Tango and Zip; Worldle; GeoGuessr; Immaculate Grid; and more."
  - Then a disclaimer: "The Dailies is an independent app and is not affiliated with, endorsed by, or sponsored by The New York Times Company, LinkedIn, or any game publisher. All game names are trademarks of their respective owners. Games are played on their publishers' own websites."
  - Place the list lower in the description, not in the first sentence, so the opening describes The Dailies' own value and the list doesn't read as stuffing.
  - Avoid "Wordle leaderboard", "NYT Games tracker" or similar phrasing that makes the brand the product.
- Keep game names out of the first ~3 lines, which are visible before "more", to reduce the impression of trading on the brand.

### Gaps
- I found no Reddit or forum report specifically of a Wordle or NYT-adjacent tracker being rejected for a description mention, and none of one being approved in 2025–2026.
- I did not find nominative-fair-use case law tied to App Store listings. That is the general US doctrine (using a mark to refer to the owner's own product, with no implied endorsement), but it is uncited here.

## What is NYT's enforcement history around Wordle, Connections and Strands?

### Takeaway
NYT enforces actively, through DMCA, cease-and-desist letters and trademark complaints, against **clones, playable copies and puzzle archives**: anything that reproduces gameplay or puzzle content or uses "Wordle" as a game's name. Every documented action targets copying the game or its puzzles. I found no action against score-tracker or stats apps that only parse share text. NYT owns WORDLE and CONNECTIONS registrations covering apps and online games.

### Cited Findings
- **Jan 11–12, 2022:** Apple removed many Wordle clone apps from the App Store, many within an hour of each other. Among them was Zach Shakked's paid clone, released Jan 10 and pulled Jan 12. Apple confirmed the removals to USA Today but gave no reasons or app names. This happened before NYT bought Wordle, so Apple acted on its own under its copycat rules. — [Macworld](https://www.macworld.com/article/574594/wordle-app-store-coptcats-removed.html); [Fortune](https://fortune.com/2022/01/12/apple-removes-several-wordle-apps-word-play-games); [TechCrunch](https://techcrunch.com/2022/01/12/wordle-is-being-punished-by-app-stores-for-choosing-the-open-web/)
- **NYT bought Wordle in Jan 2022** for a reported seven-figure sum. — [AP via KATV, Mar 12 2024](https://katv.com/news/offbeat/nyt-fighting-off-wordle-copycats-with-several-takedown-notices-word-guessing-game-new-york-times-look-alikes-digital-millenium-copycat-act-github-trademark-battle)
- **Jan 2024 to Mar 2024:** NYT filed DMCA notices on GitHub. 404 Media reported two repos DMCA'd in January. In March, a notice against Chase Wackerfuss's "Reactle" (react-wordle) also sought removal of its forks, reported as nearly 2,000. The notice claimed copyright in gameplay elements such as "the 5x6 grid" and "green tiles to indicate correct guesses." Wackerfuss took the repo down rather than fight. — [Gizmodo](https://gizmodo.com/nyt-dmca-takedown-request-wordle-clones-reactle-1851320538); [404 Media](https://404media.co/nytimes-files-copyright-takedowns-against-hundreds-of-wordle-clones); [PC Gamer](https://www.pcgamer.com/games/puzzle/nearly-2000-wordle-clones-targeted-as-nyt-issues-dmca-takedown); [Engadget](https://www.engadget.com/the-new-york-times-is-cracking-down-on-wordle-clones-100004668.html)
- **Mar 2024:** NYT also hit sites. The German spinoff at wordle.at (now "Gridgames") says it was removed after a "complaint with reference to US trademark law." NYT spokesperson: "hundreds of websites began popping up with knock-off 'Wordle' games that used The Times' 'Wordle' trademark." The Times said it has "no issue with people creating similar word games that do not infringe its Wordle 'trademarks or copyrighted gameplay.'" IP professor Robert Brauneis (GWU) called parts of the DMCA approach "a little bit shaky ground", because trademark claims don't belong in a DMCA notice. — [AP via KATV, Mar 12 2024](https://katv.com/news/offbeat/nyt-fighting-off-wordle-copycats-with-several-takedown-notices-word-guessing-game-new-york-times-look-alikes-digital-millenium-copycat-act-github-trademark-battle)
- **Nov 20, 2024 (The Verge):** NYT sent a cease-and-desist alleging trademark and copyright infringement to Anthony Salazar (Swellgarfo), whose site let people make custom Connections puzzles and hosted an archive of past NYT puzzles built from NYT's API. Salazar agreed to take down the archive. NYT noted the official archive requires a subscription. A later report says a Strands-related archive was taken down after a DMCA notice. That one comes from a mirror and is unconfirmed. — [Nieman Lab reprint of The Verge](https://niemanlab.org/reading/the-new-york-times-is-trying-to-shut-down-a-popular-connections-puzzle-creator); [search summary of Verge coverage](https://itiger.com/news/2485232129)
- **WORDLE marks (aggregator data):** Serial 97208238 (Class 9, software), registered Aug 15, 2023. Serial 97248806 (Class 41, online games), reported registered Nov 4, 2025 as Reg. No. 8007319, first use Oct 1 2021. Serial 98106712 (multi-class), pending. Serial 97510050 (Class 28, board games), suspended or live, with sources conflicting. — [Markinton 97248806](https://markinton.com/trademark/wordle-97248806); [Markinton 97208238](https://markinton.com/trademark/wordle-97208238); [TrademarkElite 97510050](https://www.trademarkelite.com/trademark/trademark-detail/97510050/WORDLE)
- **CONNECTIONS marks:** Serial 98788251, filed Oct 7 2024, reported registered May 27 2025 in Classes 9 (mobile app for puzzles and word games) and 41 (online puzzle and word games). Serial 98441402, filed Mar 8 2024, status reported inconsistently. A CONNECTIONS design mark, 98441385, reported registered Dec 2024. — [Markinton 98788251](https://markinton.com/trademark/connections-98788251); [TrademarkDir 98441402](https://trademarkdir.com/trademark/connections-98441402)
- **Competitive context:** NYT's own Games app added friend leaderboards for Wordle, Connections, Spelling Bee and the Mini, reported May 1 2025. A third-party friends leaderboard therefore overlaps a feature NYT itself sells. — [GearDiary, May 1 2025](https://geardiary.com/2025/05/01/new-york-times-games-app/)

### Inferences
- The Dailies does what NYT's enforcement has not touched: it doesn't reproduce grids, tile colors, word lists or archives, and players play on nytimes.com. The likely exposure is trademark: brand names in metadata that suggest affiliation, and use of NYT/LinkedIn logos or game icons as tiles. Keep the app's game tiles generic (its own glyphs, not publisher logos). Using publisher icons in-app would be the riskiest in-app element, but that is outside metadata scope.
- NYT's posture since 2024 is aggressive, and it now sells a competing friends-leaderboard feature. Its incentive to complain is higher than it was in 2022. A complaint would most likely arrive through Apple's App Store content dispute process, which typically leads Apple to ask the developer to resolve it with the complainant or remove the material. That mechanism is an inference; I did not source it here.
- Low-risk factual mentions in the description, with a disclaimer, are the defensible position. Brand in name, subtitle, keywords or screenshots invites both a 2.3.7/4.1 rejection and an NYT complaint.

### Gaps
- I couldn't confirm USPTO records for STRANDS, SPELLING BEE or THE MINI held by NYT. None turned up in aggregator searches. I couldn't confirm "NYT GAMES" as a mark either (likely but unverified).
- I found no NYT action against score trackers, stats apps, solvers or "Wordle helper" apps on the App Store, so I can't say whether NYT tolerates them or simply hasn't been reported acting. Hint and answer sites using "Wordle" in their titles (Beebom, NME and others) visibly persist, which suggests nominative editorial use is tolerated. That is an inference from their existence, not a documented policy.
- I found no 2025–2026 enforcement news beyond the items above.

## What is LinkedIn's trademark posture on Queens, Tango and Zip?

### Takeaway
LinkedIn has filed USPTO applications for ZIP and TANGO covering puzzle games and software. I found no QUEENS filing and no public LinkedIn enforcement against third parties over its game names.

### Cited Findings
- **ZIP:** Serial 99060408, filed Feb 27 2025 by LinkedIn Corporation, in Classes 9, 41 and 42 ("recreational logic and puzzle game" goods), pending. — [Markinton 99060408](https://markinton.com/trademark/zip-99060408)
- **TANGO:** Serial 98778548, filed about Sep 30 2024, with LinkedIn Corporation as applicant, in Classes 9 and 41. — [Markinton 98778548](https://markinton.com/trademark/tango-98778548); [trademarkregistration.app](https://trademarkregistration.app/Trademark/Details/98778548)

### Inferences
- "Zip", "Tango" and "Queens" are common words with many existing third-party uses. In metadata, the risk is less about a LinkedIn complaint and more that, as keywords, they're irrelevant or ambiguous and imply the LinkedIn brand. Pairing them with "LinkedIn" ("LinkedIn's Queens") makes the reference clear but puts the LinkedIn mark in metadata. Use that only in the description, with the disclaimer.

### Gaps
- I didn't check whether CROSSCLIMB or PINPOINT were filed. I found no enforcement reports, and LinkedIn's games terms of use weren't reviewed.
- I didn't research Worldle (Teuteuf), GeoGuessr AB or Immaculate Grid (Sports Reference) trademark holdings or enforcement. Aggregator results show WORLDLE filings (serials 97455658 and 98097561) but not their owners. The owners are unconfirmed.

## What risk does the in-app browser carry (4.2, 5.2.2, 4.7)?

### Takeaway
Apple can invoke 5.2.2 and ask for proof that you're "specifically permitted" to display a third-party service. Reported cases exist of rejections for showing third-party web content in a web view, but enforcement is sporadic. The Dailies' design helps it: an unmodified site, no script injection, no framing of sites that refuse it, and native functionality beyond the web view.

### Cited Findings
- One reported 5.2.2 rejection notice reads: "Guideline 5.2.2 - Legal. Once Legal has reviewed your documentation and confirms its validity, we will proceed with the review of your app. Alternatively, please remove the third-party content from your app and its metadata." — [search summary of Apple forums / provision records](https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-019091/third-party-service-access-requires-authorization/)
- A Hacker News client ("8chen") was reportedly rejected for showing third-party articles in SFSafariViewController, while Reddit's app wasn't. The outcome is unknown. — [Apple Developer Forums 101396](https://developer.apple.com/forums/thread/101396) (summarized via search; not fetched directly)
- An April 2026 forum question asks whether showing third-party web content needs each site's authorization under 5.2.2. It got no answer, which suggests Apple hasn't clarified this publicly. — [Apple Developer Forums 821308](https://developer.apple.com/forums/thread/821308)
- 4.7 makes the developer "responsible for all such software offered in your app" for HTML5 mini games. — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Inferences
- **Mitigations to describe in the App Review notes:**
  - Games load on the publisher's own site, unmodified, with no injected scripts.
  - The user signs in to the publisher directly, if at all.
  - The app reads only text the user copies through the publisher's own Share button, via the system PasteButton.
  - No puzzle content is stored or redistributed.
  - The app works fully without the browser: paste from Safari, or the share extension.
- If a reviewer pushes on 5.2.2, the fallbacks are to open games in SFSafariViewController or in Safari instead of a custom WKWebView. That weakens any claim that the app "displays content". The other fallback is to drop the browser for specific publishers, NYT or LinkedIn, if challenged.
- 4.2 risk is low. The app has native leaderboards, feed, friends and push, so it isn't a repackaged website. The iPhone tabs that still show the site (Friends and You) are a minor 4.2 exposure. That's outside this topic.
- Because 4.7 covers "mini games" offered in an app, a reviewer could read the in-app game browser as offering third-party HTML5 games. Describe it as "opens the publisher's website" (like a link), not as games inside the app. Don't market it as "play 30 games in one app".

### Gaps
- I found no documented case of a score-tracker or companion app being rejected specifically for opening a game's website in-app.
- Whether NYT's or LinkedIn's terms of use prohibit framing or in-app-browser access wasn't checked, and that is the substance a 5.2.2 request would turn on.

## Practical placement summary (by field) and how likely each is to cause trouble

### Takeaway
Use brand names only in the long description (factual list plus disclaimer) and, optionally, as plain-text row labels inside screenshots of The Dailies' own UI. Keep them out of name, subtitle, keywords, icon, in-app event names and promotional text.

### Cited Findings
- The field-level rules come from 2.3.7, 4.1(c) and 5.2.1 and from Apple's keyword "Do not use" list, quoted above. — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/); [Apple: Creating your product page](https://developer.apple.com/app-store/product-page/)

### Inferences (risk ratings are judgment, not sourced probabilities)

| Field | Brand use | Rejection risk | Takedown risk | Rationale |
|---|---|---|---|---|
| App name | No | Very high | High | 4.1(c) needs the owner's approval; 2.3.7 |
| Subtitle | No | High | Medium | 2.3.7 says subtitles "should not ... reference other apps"; July 2025 rejection precedent |
| Keyword field | No | Medium to high (may be silently modified) | Medium | Apple's product-page guidance explicitly says "Do not use" trademarked terms or competing app names; the field is invisible to users but visible to Apple and rivals' ASO tools |
| Icon | No | Very high | High | 4.1(c) |
| Description | Yes, factual list + disclaimer, below the fold | Low | Low | Nominative use; Scordle and Wurdle precedents; avoid making the brand the product |
| Screenshots | Plain-text game names in The Dailies' own UI only; no publisher logos or game UI | Low to medium | Low to medium | 2.3.7 covers screenshots; logos or grids are 4.1/5.2.1 problems |
| Promotional text | Avoid (no ranking value anyway) | Low to medium | Low | Same metadata rules; Apple says it doesn't affect search |
| In-app event names | No | Medium to high | Medium | Shown in search like a subtitle; brand-led event names would look like trading on the brand |
| What's New | Fine factually ("Added support for X") | Low | Low | Descriptive |
| App Review notes | Yes, explicitly | None | None | Explain the share-text flow and the unmodified publisher sites up front; this is where 5.2.2 questions get answered |

- **Safe phrasings:** "works with share results from…", "paste your result from…", "supports…".
- **Phrasings to avoid:** "Wordle leaderboard", "NYT Games tracker", "the Wordle app", "play Wordle, Connections…", "official".
- Spell trademarks correctly, as Scordle does, rather than misspelling them as Wurdle does. Misspelling evades nothing legally and looks evasive.
- Use no ®/™ symbols as decoration, and no publisher colors (for example Wordle green/yellow tiles) in screenshots.

### Gaps
- No quantified rejection rates exist. The ratings above are qualitative judgments from the guideline text and a few precedents.
