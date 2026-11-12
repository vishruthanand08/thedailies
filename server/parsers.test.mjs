// Real share texts recorded in apple/capture/fixtures/<gameId>.txt must each be recognized as
// that game. Run with: npm test (node --test server/parsers.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { detect, expectedDate, GAMES } from './parsers.js'

const dir = new URL('../apple/capture/fixtures/', import.meta.url)
const fixtures = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))

test('fixtures exist', () => {
  assert.ok(fixtures.length > 0)
})

for (const file of fixtures) {
  // <gameId>.txt, or <gameId>.<anything>.txt for another format of the same game
  const gameId = file.replace(/(\.[^.]+)?\.txt$/, '')
  test(`${file} is detected as ${gameId}`, () => {
    assert.ok(GAMES.some((g) => g.id === gameId), `no game with id "${gameId}"`)
    const text = fs.readFileSync(new URL(file, dir), 'utf8')
    const hit = detect(text)
    assert.ok(hit, 'not recognized by any parser')
    assert.equal(hit.game.id, gameId)
    assert.ok(Number.isFinite(hit.parsed.metric), 'metric is not a number')
  })
}

// Share formats built from each game's own share code (2026-11-11 audit), not real shares: the
// game, metric and puzzle date each must parse to. `null` means the text must not be recognized.
const SAMPLES = [
  ['Costcodle Classic #1149 3/6\n⬆️🟥\n⬇️🟨\n✅\n\nPlay now at https://www.costcodle.com', 'costcodle', 3, '2026-11-11'],
  ['Costcodle #1149 X/6\n⬆️🟥', 'costcodle', 7, '2026-11-11'],
  ["Went full Bulk Buyer on today's Costcodle and walked out $21.40 off the mark!\n\nCostcodle Checkout #2\n1. Kirkland Olive Oil — off $3.10\n\nPlay now at https://www.costcodle.com", null],
  ['Krillion #119 🦐 365  🏮🦑🫧🐟🦑🦑🦑', 'krillion', 365, '2026-11-11'],
  ['Krillion #119 🦐 1,365  🏮🦑  https://krillion.io', 'krillion', 1365, '2026-11-11'],
  ['Krillion ∞ #12 🦐 365  🏮', null],
  ['#travle #1428 (hard mode) +2\n🟩🟩🟧\nhttps://travle.earth', 'travle', 2, '2026-11-11'],
  ['#travle #1428 (3 away)\n🟥', 'travle', 23, '2026-11-11'],
  ['#travle #1428 +0 (Perfect)', 'travle', 0, '2026-11-11'],
  ['#travle_usa #400 +1', 'travle', 1, null],
  ['Noillirk: The Daily Climb | No. 46 - 12 km\n\n🟩', 'noillirk', 12000, '2026-11-11'],
  ['Noillirk: The Daily Climb | No. 46 - 6 763m', 'noillirk', 6763, '2026-11-11'],
  ['Plain #25 — ✈️ 6.120 m\n🟢', 'plain', 6120, '2026-11-11'],
  ['Plain #25 — ✈️ 6 120 m', 'plain', 6120, '2026-11-11'],
  ['Wordle 1.971 4/6\n\n🟩', 'wordle', 4, '2026-11-11'],
  ['Wordle 1 971 X/6*', 'wordle', 7, '2026-11-11'],
  ["Wordle 1'971 3/6", 'wordle', 3, '2026-11-11'],
  ['Wordle 1,971 2/6', 'wordle', 2, '2026-11-11'],
  ['#Worldle #1755 (11.11.2026) 😛/6 (93%)', 'worldle', 7, '2026-11-11'],
  ['#Worldle #1755 (11.11.2026) 2/6 (100%)', 'worldle', 2, '2026-11-11'],
  ['Pinpoint #925\n🤔 🤔 📌 ⬜ ⬜ (3/5)\nlnkd.in/pinpoint.', 'pinpoint', 3],
  ['Pinpoint #925\n🤔 🤔 🤔 🤔 🤔 (X/5)\nlnkd.in/pinpoint.', 'pinpoint', 6],
  ['Pinpoint #925 | 3 guesses\n1️⃣ | 13% match\nlnkd.in/pinpoint.', 'pinpoint', 3],
  ['www.maptap.gg November 11\n75🤗 69😁 80🥳 91🤩 88🤩\nFinal score: 812', 'maptap', 812],
  ['MapTap November 11\n🇺🇸83 🇫🇷70\nFinal score: 640\n🔥 4 day streak', 'maptap', 640],
  ['Capitals by someone\n75🤗 69😁\nFinal score: 812\nwww.maptap.gg/m/abc123', null],
  ['Fermi · No. 108\n01 ↑ 1.56×\n─────────\n1,234.5× score\n<https://fermi.gg/s/daily>', 'fermi', 1234.5, '2026-11-11'],
  ['Fermi · No. 108\n01 ↑ 1.56×\n─────────\n1.19× score · top 3%', 'fermi', 1.19, '2026-11-11'],
  ['GeoGuessr Daily · 11/11/2026 · 18,234 🥈\n🟪🟪🟪🟪🟪🟪🟪⬛⬛⬛\n3,612 pts · 1,204 km\n──────────\nNow it\'s your turn! 👇\nwww.geoguessr.com/dc/AbCd1234', 'geoguessr', 18234],
  ['GeoGuessr Daily · 2026/11/11 · 🌟 25,000 🌟\n🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨 🎯', 'geoguessr', 25000, '2026-11-11'],
  ['⚾️ Immaculate Grid 1319 7/9:\nRarity: 412\n🟩🟩🟩\n🟩⬜️🟩\n🟩⬜️⬜️\nPlay at:\nhttps://www.sports-reference.com/immaculate-grid/play', 'gridmlb', 6 * 1000 + 488, '2026-11-11'],
  ['My WorldGuessr Daily Score · 11 Nov 6280 / 15000  ·  Beat 43% players worldwide 🔴🟡🟢 https://www.worldguessr.com/daily', 'worldguessr', 6280],
  ['My WorldGuessr Daily Score · Nov 11 6280 / 15000 🔴🟡🟢 https://www.worldguessr.com/daily', 'worldguessr', 6280],
  ['Daily Holes — Round #315 · ON FIRE\nBriarwood Links · E (36)\n🟩🟩\nLongest 280 yds', 'dailyholes', 0, '2026-11-11'],
  ['Poeltl #1721 | 4/8 | 00:01:23 \n\n🟩🟨⬛', 'poeltl', 4, '2026-11-11'],
  ['Poople #454 8/6\n⬜⬜⬜⬜\n\nhttps://poople.io/', 'poople', 2, '2026-11-11'],
  ['Connections\nPuzzle #1249\n🟨🟨🟨🟨\n🟩🟦🟩🟩\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪', 'connections', 1, '2026-11-11'],
  ['Strands #983\n“Hello”\n💡🔵🔵🔵\n🟡🔵🔵🔵', 'strands', 1, '2026-11-11'],
  ['Eraly #27 · I travelled to 1582 AD\n▰▰▰▰▱▱▱▱▱▱ 395/700\n🟦🟨🟥\nhttps://eraly.io', 'eraly', 395, '2026-11-11'],
  ['Chainle #84 · 4,120 🔗\n🟩🟥🟨🟧🟩\nhttps://chainle.io', 'chainle', 4120, '2026-11-11'],
  ['Perceptle #117 - B (72)\n🔢 80\nhttps://perceptle.com', 'perceptle', 72, '2026-11-11'],
  ['TimeGuessr #1260 28,325/50,000\n🌎🟩🟩⬛', 'timeguessr', 28325, '2026-11-11'],
  ["I scored an average of 2417 over 10 rounds in today's EthnoGuessr! Can you beat my score of 4876 points on round 7? Play now at https://hbd.gg/play/", 'ethnoguessr', 2417],
  ['EthnoGuessr 4876 points', null],
]

for (const [text, gameId, metric, date] of SAMPLES) {
  test(`sample: ${text.split('\n')[0].slice(0, 50)}`, () => {
    const hit = detect(text)
    if (gameId === null) return assert.equal(hit, null)
    assert.ok(hit, 'not recognized')
    assert.equal(hit.game.id, gameId)
    assert.equal(hit.parsed.metric, metric)
    if (date !== undefined) assert.equal(expectedDate(hit.game, hit.parsed), date)
  })
}
