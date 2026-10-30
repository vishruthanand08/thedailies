# Apple App Store search mechanics and metadata (as of Oct 2026, US storefront)

Research date: 2026-10-29. Apple pages fetched today (current versions, (c) 2026). Vendor sources carry dates where shown. Apple does not publish its ranking algorithm, so anything about weights or behavioral signals comes from third parties.

## 1. Which fields are indexed for search

### Takeaway
Apple confirms only these as indexed: title (name), subtitle, keyword field, the primary category and the optional secondary category, and the company/developer name (the app is "already searchable" by it). Apple says outright that promotional text does not affect ranking. Descriptions are widely believed to be unindexed on iOS. Screenshot-caption OCR (June 2025) is disputed and not confirmed by Apple. LLM-generated App Store Tags (WWDC25) are real, US-only and built from en-US metadata, and they show in search, but Apple does not say they are a ranking input.

### Cited Findings
- Apple: "Search results are based on a number of factors, including text relevance (matches for your app's title, subtitle, keywords, and primary category)" and "user behavior (downloads, ratings and reviews, and more)." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Apple: "Your primary category and optional secondary category are indexed by our search algorithm." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Apple: "Promotional text doesn't affect your app's search ranking so it should not be used to display keywords." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Apple keyword-field help: "Don't repeat the app or company name, since the app is already searchable by those." This implies the developer/company name is indexed. — [ASC Help, Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- Limits: name 2–30 characters, subtitle up to 30, keywords up to 100 **bytes** (each keyword longer than two characters), promotional text 170, description 4,000 (plain text). — [ASC Help, App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information); [ASC Help, Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- In-app events and promoted IAPs: Apple says both *appear in* search results ("next to your app or game"). The search page does not say their text is indexed. — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- AppTweak (updated Jan 28, 2026): "Apple indexes [in-app events] and considers their relevance to user queries." The description "is not a ranking factor"; screenshot captions "may be a factor" but are not officially confirmed. — [AppTweak, ranking factors](https://www.apptweak.com/en/aso-blog/which-factors-influence-rankings-on-the-app-store)
- Third-party guides say the event name (30 characters) and short description (50 characters) are indexed and the long description (120) is not. This is observed behavior, not in Apple docs. — [Sonar, In-App Events for ASO](https://trysonar.app/blog/in-app-events-aso-what-indie-devs-miss); [MobileAction 2026 ASO report, in-app events](https://www.mobileaction.co/report/2026-aso-report/in-app-events-and-their-aso-impact/)
- **Screenshot OCR, for:** Appfigures (June 2025, shortly after a ~June 6, 2025 algorithm shift): "Apple is now extracting text from your app's screenshot captions and treating that text as part of your keyword metadata." This rests on its own keyword analysis, cites no Apple announcement, and labels caption placement "speculation." It also says: "I haven't found any indication that app descriptions are being indexed." — [Appfigures, algorithm update 2025](https://appfigures.com/resources/guides/app-store-algorithm-update-2025)
- **Screenshot OCR, against:** ConsultMyApp/APPlyzer (June 16, 2025) tested 64 screenshot-derived phrases from 8 top apps. 36 didn't rank, 27 were explained by other metadata, and 1 (Audible) was inconclusive. Their verdict: "no strong evidence that Apple broadly indexes screenshot text." — [ConsultMyApp](https://consultmyapp.squarespace.com/blog/-is-apple-now-indexing-screenshot-titles-on-the-app-store)
- **App Store Tags (Apple):** "Tags are based on the App Store metadata you provide in App Store Connect, artificial intelligence, and human curation," "applied to your app by default, based on the metadata you provide in App Store Connect (en_US only)," and "Currently, tags are only supported and displayed to users across the App Store in the United States." They "appear as glanceable terms in search results and as clickable entities on Search Landing Page and Product Page." Tapping a tag lists related apps. Managed under App Information > App Store Tags > Edit (Account Holder/Admin/App Manager/Marketing). "Deselecting all tags may affect your discoverability." — [ASC Help, Manage app tags](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-tags)
- Apple's search page: "Search results may also include app tags… generated using large language models (LLMs) based on the metadata you've provided." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Tags were announced at WWDC25 (June 2025) and went live in the iOS 26 beta. — [TechCrunch, Jun 11 2025](https://techcrunch.com/2025/06/11/at-wwdc-apple-says-it-will-use-ai-to-tag-apps-to-improve-discoverability-on-the-app-store); [TechCrunch, Jun 14 2025](https://techcrunch.com/2025/06/14/the-app-stores-new-ai-generated-tags-are-live-in-the-beta)
- Developers can't write custom tags, only deselect Apple's suggestions. Tag changes need no new build. Installs from a tag search count as Search, and from tag browse as Browse. — [Phiture, Oct 2 2025](https://phiture.com/blog/app-store-ios-26-updates-aso/); [Gummicube](https://www.gummicube.com/blog/new-apple-app-tags-explained/)

### Inferences
- Because tags are generated from en-US metadata (likely including the description), the description now has an indirect discovery role in the US through tags, even if it isn't ranked text. Writing a description that plainly states "word games," "puzzle," "leaderboard" and "friends" should help steer the tags.
- Repeating core keywords in screenshot captions costs nothing and may help. Don't count on it as an indexed field.
- An in-app event (e.g. a weekly friends challenge) adds 30+50 characters of probably-indexed text and a second search result card.

### Gaps
- Apple has not confirmed or denied screenshot-text indexing. No Apple source on whether IAP display names are ranked text (they matter little here; the app is free).
- No Apple statement on whether tags feed ranking, as opposed to being shown in results.

## 2. How the keyword field works

### Takeaway
Use commas with no spaces, singular forms, and no words already in the name, subtitle or category. Skip "app"/"game" and stop words. No competitor or trademarked names. Words are combined across name, subtitle and keyword field within one locale.

### Cited Findings
- Apple: "Keywords are limited to 100 characters total, with terms separated by commas and no spaces. You can use spaces to separate words within keyword phrases." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Apple: "Don't repeat any words included in your app name, subtitle, or category." Avoid "Plurals of words you've already included, such as 'climbs' and 'climb,' as these are considered duplicates," "Generic terms… such as 'app' or 'game'," "Filler words like 'the' and 'to'," and special characters such as # or @. — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Apple rejection triggers: "Unauthorized use of trademarked terms, celebrity names, or other protected words," irrelevant terms, "Competing app names," and offensive terms. — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- Guideline 2.3.7: "don't try to pack any of your metadata with trademarked terms, popular app names… Apple may modify inappropriate keywords at any time." Subtitles must not "reference other apps." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Guideline 4.1(c): "You cannot use another developer's icon, brand, or product name in your app's icon or name, without approval." Guideline 5.2.1 bars protected third-party trademarks in metadata without permission. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- The ASC field takes "Names of other apps or companies aren't allowed." — [ASC Help, Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- Gummicube: Apple treats each field as a keyword bank and combines individual words into the phrases you rank for, so repeats add nothing. AppTweak (Jan 2026): split long-tail phrases into single terms and don't repeat title/subtitle words. — [Gummicube, How ASO works on Apple](https://gummicube.com/how-aso-works-apple); [AppTweak](https://www.apptweak.com/en/aso-blog/which-factors-influence-rankings-on-the-app-store)
- Apple on term choice: popular terms ("jobs," "social," seasonal) are "highly competitive – especially if you are a newer or smaller app. Less common terms drive lower traffic, but are less competitive." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)

### Inferences
- For The Dailies, "Wordle," "Connections," "NYT," "LinkedIn," "GeoGuessr" and "Worldle" in the name, subtitle or keywords carry real rejection or keyword-strip risk under 2.3.7, 4.1(c) and 5.2.1. Generic terms ("word," "puzzle," "daily," "leaderboard," "streak," "score," "tracker") are safe. A factual mention in the description is lower risk than in indexed fields but still needs review-safe wording (see Gaps).
- The 100 limit is in bytes, so ASCII-only keywords get the full 100.
- "Games" is the category name if Games is chosen, so "game" is redundant there (Apple already lists it as too generic).

### Gaps
- The guidelines excerpt didn't settle whether naming specific third-party games in the *description* is allowed for a companion or tracker app. Treat it as a review risk.

## 3. Relative weight of name, subtitle and keywords, and behavioral signals

### Takeaway
The industry consensus, not confirmed by Apple, is name > subtitle > keyword field. Apple confirms that downloads and ratings/reviews affect ranking. Vendors add conversion rate, download velocity and retention.

### Cited Findings
- Apple confirms "downloads, ratings and reviews, and more" as user-behavior factors, and that ratings "can influence how your app ranks." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- AppTweak (updated Jan 28, 2026): title and subtitle are "the most heavily weighted text fields." "Total downloads and velocity (downloads over time) are strong ranking signals." Search conversion rate "most likely" improves rankings. Ratings under 3.5 cut visibility, and over 4.0 correlate with better rankings. Retention and engagement (session length, churn, DAU, uninstalls) count. Most of this is not Apple-confirmed. — [AppTweak](https://www.apptweak.com/en/aso-blog/which-factors-influence-rankings-on-the-app-store)
- Vendor guides commonly state the order name > subtitle > keyword field. — [AppLaunchFlow, metadata limits 2026](https://www.applaunchflow.com/blog/app-store-metadata-character-limits-2026); [Gummicube](https://gummicube.com/how-aso-works-apple)
- One source claims the subtitle is "ignored for ranking," which conflicts with AppTweak and Apple (Apple lists the subtitle as matched text). Treat it as an outlier. — [AppTweak](https://www.apptweak.com/en/aso-blog/which-factors-influence-rankings-on-the-app-store); [Apple](https://developer.apple.com/app-store/search/)

### Inferences
- The highest-intent generic phrase ("word game leaderboard," "daily puzzle tracker") belongs in the name after the brand. Secondary concepts go in the subtitle and the rest in keywords.
- A new app with little download volume should target low-competition, long-tail phrases, which Apple itself recommends for "newer or smaller" apps.

### Gaps
- No quantified public weights exist. Apple doesn't publish them.

## 4. Duplicate and near-duplicate names, and name reservation

### Takeaway
Names must be unique across the store. A name is held as soon as any account creates an app record with it. A suffixed or punctuated variant such as "The Dailies: Puzzle Scores" is generally accepted when it isn't an exact match, but only App Store Connect can confirm it, by trying. The old "180 days to upload or lose the name" rule is not confirmed as current.

### Cited Findings
- Guideline 2.3.7: "Choose a unique app name… App names must be limited to 30 characters." 4.1(a) warns against "minor changes to another app's name… [to] pass it off as your own." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Forum reports, including Apple support as quoted by developers: a name counts as in use once an app record exists in ASC, even if no app is live (it may be in another region or unreleased). — [Apple Dev Forums 809402](https://developer.apple.com/forums/thread/809402); [Apple Dev Forums 91335](https://developer.apple.com/forums/thread/91335)
- The error text offers a trademark route: "If you have trademark rights to this name and would like it released for your use, submit a claim." — [Apple Dev Forums 91335](https://developer.apple.com/forums/thread/91335)
- Past rules: a 120-day window (2010) to upload a binary after creating a record, later reported as 180 days. A recent thread asks whether the cap still exists, with no official answer. Released names can take days to free up. — [AppleInsider 2010](https://appleinsider.com/articles/10/09/11/apple_removing_app_store_name_squatters); [Apple Dev Forums 711244](https://developer.apple.com/forums/thread/711244); [Apple Dev Forums 844943](https://developer.apple.com/forums/thread/844943)
- A forum post says names differing only by a space or punctuation were once allowed ("YMMV"). — [Apple Dev Forums 685777](https://developer.apple.com/forums/thread/685777)
- The store name is set in ASC, separately from the on-device name (CFBundleDisplayName). — [ASC Help, App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)

### Inferences
- "The Dailies: <descriptor>" or "The Dailies – <descriptor>" is the standard brand-plus-keyword pattern and is very likely accepted because it isn't an exact match. It does sit next to an existing "The Dailies" listing, so the descriptor should make the difference obvious (4.1 confusion risk is low when the category and icon differ). The home-screen name can stay "Dailies."
- Creating the ASC record as early as possible reserves the chosen name.

### Gaps
- No current Apple documentation on how long a reserved, unused name is held, or on the matching rule (exact versus normalized).

## 5. Mac App Store specifics under universal purchase

### Takeaway
One app record means the **name, subtitle, primary and secondary category, and age rating are shared** by iOS and macOS. **Keywords, description, promotional text, screenshots, What's New and URLs are per platform version**, so the Mac listing gets its own 100-byte keyword field. Custom product pages and Product Page Optimization are iPhone/iPad only.

### Cited Findings
- "App information refers to the properties that are shared across the platforms added to an app." It lists Name, Subtitle, Primary Category, Secondary Category and Age Rating. — [ASC Help, App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information); [ASC Help, Required/localizable/editable properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties)
- Platform version information is "the set of properties of an app version specific to each platform the app supports," covering Promotional Text, Description and Keywords. — [ASC Help, Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- Universal purchase: the platforms share a bundle ID with "platform-specific information" added separately. Once two platform versions are approved the app is a universal purchase, and a platform can't be removed afterward. — [Apple, Universal purchase](https://developer.apple.com/support/universal-purchase/)
- "For macOS apps, you also set the app category in Xcode. The primary category you set in App Store Connect should match the category you set in Xcode." (LSApplicationCategoryType) — [ASC Help, App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- On macOS, the primary category "determines where your app appears when people browse or filter search results in the Mac App Store" and places it in the Categories tab. — [Apple, Categories](https://developer.apple.com/app-store/categories/)
- Custom product pages: "up to 70 additional versions of your product page for iPhone and iPad," with no mention of macOS. — [Apple, Custom product pages](https://developer.apple.com/app-store/custom-product-pages/)
- PPO treatments are shown on "iOS and iPadOS 15 or later" only. — [Apple, Product page optimization](https://developer.apple.com/app-store/product-page-optimization/)
- ASO tools often don't track Mac keyword ranks or popularity (one supports macOS but shows positions only for iOS). — [aso.dev metadata editor](https://aso.dev/metadata/editor/)

### Inferences
- The Mac keyword field can be tuned separately (e.g. "desktop," "menu bar") while the name and subtitle must work for both.
- There's little keyword-popularity data for Mac search, so optimize for iOS and treat the Mac as secondary.

### Gaps
- No source quantifies Mac App Store search volume or ranking differences from iOS. Not confirmed whether tags apply to Mac listings.

## 6. Localization trick: extra indexed locales in the US storefront

### Takeaway
Vendor testing (not Apple docs) says the US store indexes English (US) plus several other locales, most famously Spanish (Mexico). Each adds roughly another name, subtitle and keyword set. Words don't combine across locales.

### Cited Findings
- AppTweak (updated Nov 21, 2025; data from 2022 tests): the US indexes English (US) plus Spanish (Mexico), Russian, Chinese (Simplified), Arabic, French, Portuguese (Brazil), Chinese (Traditional), Vietnamese and Korean. English (UK) is **not** listed for the US. "Keyword combinations are restricted to singular locales," so "bus" in en-US plus "metro" in es-MX likely won't rank for "metro bus." — [AppTweak, cross-localization](https://www.apptweak.com/en/aso-blog/how-to-benefit-from-cross-localization-on-the-app-store)
- Other vendors name Spanish (Mexico) as the US secondary language ("200 characters to work with instead of the 100"). Removing es-MX keywords that rank in the US can drop rankings. — [MobileAction, cross-localization](https://www.mobileaction.co/blog/app-store-cross-localization/); [AppFollow](https://appfollow.io/blog/how-to-expand-on-iOS-localization-for-usa); [Sonar](https://trysonar.app/blog/app-localization-keep-home-rankings-intact.md)
- The name, subtitle and description are localizable, and keywords are localizable per locale. — [ASC Help, Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)

### Inferences
- The low-risk extra keyword pool for the US is Spanish (Mexico), filled with English terms that don't fit in en-US. Those listings are seen by es-MX users (and Mexico), so the name and subtitle there should still read sensibly. Repeating the most important word inside each locale keeps combinations working.
- Tags use en-US metadata only, so the en-US description and fields matter most for tags.

### Gaps
- Apple has never documented this. No 2025–2026 retest confirming the full list. Possible reviewer pushback on English text in a Spanish locale is anecdotal and wasn't found.

## 7. Primary and secondary category, Games versus non-Games

### Takeaway
The primary category drives browse placement, the Apps-versus-Games tab, category charts and search filtering. Both primary and secondary are indexed. Games is defined as "interactive activities for entertainment," and a leaderboard companion that hosts no games doesn't clearly fit. Choosing an inappropriate category breaks guideline 2.3. Entertainment or Social Networking (with Games as secondary, or the reverse) are the realistic options.

### Cited Findings
- "The primary category… determines placement on the Apps tab or Games tab," and is the category used "when people browse the App Store or filter search results." — [Apple, Categories](https://developer.apple.com/app-store/categories/)
- Games: "Apps that provide single or multiplayer interactive activities for entertainment purposes." Up to two Games subcategories (e.g. board, card, family, puzzle, trivia, word…), which feed subcategory browse and **subcategory charts**. — [Apple, Categories](https://developer.apple.com/app-store/categories/)
- "If you select Games or Stickers as the Primary or Secondary Category, you can also select one or two subcategories." So Games as *secondary* also allows subcategories. — [ASC Help, App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- "Choosing categories that are not appropriate for your app is against the App Review Guidelines" (2.3). Pick by "Your app's purpose," "Where users naturally look" and "Which categories contain the same type of apps." — [Apple, Categories](https://developer.apple.com/app-store/categories/)
- The Sports category explicitly includes "score trackers" and "fantasy sports companions," so Apple puts companion and tracker apps in the category of their subject, not in Games. — [Apple, Categories](https://developer.apple.com/app-store/categories/)
- Time Allowance: Entertainment or Games, as primary or secondary, puts the app in that Screen Time category. Social Media time allowance depends on social features regardless of category. — [Apple, Categories](https://developer.apple.com/app-store/categories/)
- Apple says category words are already indexed ("Don't repeat… words in your… category"). — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- iOS 26 has a separate Apple Games app with its own ad-free search, where games with events can get two results. — [Phiture, Oct 2 2025](https://phiture.com/blog/app-store-ios-26-updates-aso/)

### Inferences
- A Games primary would put The Dailies in the Games tab against real games in Puzzle/Word subcategory charts (very competitive), with review risk because it isn't itself a game. Entertainment or Social Networking primary is more defensible. Social Networking charts are dominated by giant apps but the category fits "friends leaderboard." Entertainment is broad and mid-competition. Games as *secondary* (Word/Puzzle subcategories) still indexes "games" and the subcategory terms and is lower risk, though how a secondary category is reviewed isn't documented.
- Sports could make sense only for the Immaculate Grid games and isn't the core purpose.

### Gaps
- No Apple statement on whether the secondary category affects charts. No public data on Entertainment versus Social Networking chart thresholds for a new app.

## 8. Product Page Optimization, custom product pages, keyword-linked CPPs and in-app events

### Takeaway
PPO A/B-tests the icon, screenshots and previews (3 treatments, up to 90 days, iOS/iPadOS). Since mid-2025, custom product pages can be tied to keywords from your keyword field and replace the default page in organic search for those terms. Apple now allows up to 70 CPPs. In-app events appear in search and are probably indexed.

### Cited Findings
- PPO: "Up to three alternate versions," up to 90 days, one test at a time; icon, screenshots and previews can be tested; shown on iOS/iPadOS 15+; needs App Review (no new binary unless testing icons, which must ship in the binary); alternate assets "may appear in search results." — [Apple, Product page optimization](https://developer.apple.com/app-store/product-page-optimization/)
- CPP keywords (Apple): "Enable your custom product pages to appear in search results for those selected keywords, rather than your default product page… each keyword combination is unique to a single product page." — [Apple, App Store Search](https://developer.apple.com/app-store/search/)
- CPP limits (Apple, current): up to 70 per app (iPhone/iPad). Metadata is reviewed independently of app updates. Deep links on iOS 18+. Apple cites an average +2.5 pp conversion versus a 1.6% default baseline for linked CPPs. — [Apple, Custom product pages](https://developer.apple.com/app-store/custom-product-pages/)
- Timeline conflict: Phiture (Aug 4, 2025) reported the feature launched quietly around WWDC25 with up to **35** CPPs, keywords chosen only from Apple suggestions drawn from each locale's keyword field. Apple's current page says **70**, so the limit was raised later. — [Phiture](https://phiture.com/blog/keyword-based-custom-product-pages-cpps-arrive-in-app-store-connect/); [Apple](https://developer.apple.com/app-store/custom-product-pages/)
- Keywords for CPPs come from the keyword field (not the title or subtitle) and are per localization. ASC reports search impressions per CPP. — [Adapty, CPP 2026](https://adapty.io/blog/custom-product-pages-app-store/); [MobileAction help, organic CPP results](https://helpcenter.mobileaction.co/en/organic-cpp-results)
- In-app events appear in search next to the app on iOS/iPadOS. The event name and short description are reported as indexed (vendor). — [Apple, App Store Search](https://developer.apple.com/app-store/search/); [Sonar](https://trysonar.app/blog/in-app-events-aso-what-indie-devs-miss)

### Inferences
- For The Dailies, CPPs per game family (a "word games" page with Wordle-style visuals, a "geography games" page, a "LinkedIn games" page) linked to generic keywords in the keyword field would match search intent without putting trademarks in indexed text. The screenshots themselves would still need care with third-party logos (5.2.1).
- PPO and CPPs need iPhone/iPad traffic. They don't apply to the Mac listing.

### Gaps
- Not verified whether CPP keyword assignment still limits you to Apple-suggested terms in late 2026, or whether there's a per-page keyword cap. One vendor's claim (Adapty) of a product-page preview tool for fall 2026 is unverified.
