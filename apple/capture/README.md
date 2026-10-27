# In-app game browser capture

`capture.js` is injected at document start into every frame of the in-app game browser
(`apple/Dailies/GameBrowser.swift`). It wraps `navigator.share`, `Clipboard.prototype.writeText`,
`Clipboard.prototype.write` and `document.execCommand('copy')`, and posts the text the game
shares to native, which submits it like a paste. Share sheets are suppressed (`SUPPRESS_SHARE_SHEET`);
clipboard writes still go through so the game's "Copied!" UI works.

The browser is Debug-only and off by default: gear button > "Play games in the app". NYT and
LinkedIn need the separate "Experimental" toggle. GeoGuessr is never allowlisted.

## Harness

`harness.html` has one button per primitive plus a share-then-copy dedupe check.

- In a browser: `python3 -m http.server 8765 --directory apple/capture`, open
  `http://127.0.0.1:8765/harness.html`; captures log on the page (stub handler).
- In the app: Debug menu > "Open capture harness"; captures show as banners.

## Results (2026-10-26, iOS 27 Simulator and macOS)

Harness: all four primitives capture, and share + copy back to back captures once, in Chrome
and in the app's WKWebView.

`capture.js` installed and a share reached native on each site (logged out):

| Game | Host | Loads in-app | Capture active | Primitive the real Share button uses |
| --- | --- | --- | --- | --- |
| Worldle | worldle.teuteuf.fr | yes | yes (full submit verified) | pending a real play |
| Minute Cryptic | www.minutecryptic.com | yes | yes | pending |
| Globle | globle-game.com | yes | yes | pending |
| Travle | travle.earth | yes | yes | pending |
| Costcodle | costcodle.com | yes | yes | pending |
| Fermi | fermi.gg | yes | yes | pending |
| MapTap | maptap.gg | yes | yes | pending |
| Krillion | krillion.io | yes | yes | pending |
| EthnoGuessr | hbd.gg | yes | yes | pending |
| Wordle (experimental) | www.nytimes.com | yes, Play / Log in shown | yes | pending |
| Connections (experimental) | www.nytimes.com | yes | yes | pending |
| Queens (experimental) | www.linkedin.com | yes, logged out, "Start game" shown, no app wall | yes | pending |

"Capture active" means the script installed and a `navigator.share` call from the page reached
native. Fill in the last column (share / writeText / write / execCommand, from the app log line
`captured via <primitive> on <host>`) after finishing each game and tapping its own Share button.
Save each game's captured text as `fixtures/<gameId>.txt` too.
