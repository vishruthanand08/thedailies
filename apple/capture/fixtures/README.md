# Share text fixtures

One file per game, named `<gameId>.txt`, holding the **exact** text that game's Share button
produced (copied from the share sheet, the Shortcut or the share extension, unedited).
`npm test` checks that `detect()` in `server/parsers.js` recognizes every fixture as its game.

Only add text captured from a real share. Don't type one from memory or adapt another day's.

## Recorded

| Game | Source |
| --- | --- |
| wend, minisudoku, patches | LinkedIn web shares, 2026-10-26 |
| minutecryptic | minutecryptic.com share, 2026-10-26 |
| krillion | krillion.io share, 2026-10-26 (from the parser's verified comment) |
| mini | NYT Mini share link (shared/v2/mini-xwd.html), 2026-10-27 |
| strands, timeguessr, worldguessr | web shares, 2026-10-27 |
| chainle | chainle.io share, 2026-10-28 |
| perceptle, poeltl, gridmlb, dailytens | web shares, 2026-10-28 |
| poople | web share, 2026-10-30 |
| sizeitup | web share, 2026-10-30 |

## Still needed

Capture these from the share extension or the Shortcut (Stage 3 acceptance), especially from
the NYT Games and LinkedIn **apps**, whose text may differ from the web version:

wordle, connections, queens, tango, zip, pinpoint, crossclimb, worldle, globle,
travle, costcodle, fermi, maptap, ethnoguessr, gridnfl, gridnba
