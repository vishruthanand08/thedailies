// Real share texts recorded in apple/capture/fixtures/<gameId>.txt must each be recognized as
// that game. Run with: npm test (node --test server/parsers.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { detect, GAMES } from './parsers.js'

const dir = new URL('../apple/capture/fixtures/', import.meta.url)
const fixtures = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))

test('fixtures exist', () => {
  assert.ok(fixtures.length > 0)
})

for (const file of fixtures) {
  const gameId = file.replace(/\.txt$/, '')
  test(`${gameId} fixture is detected as ${gameId}`, () => {
    assert.ok(GAMES.some((g) => g.id === gameId), `no game with id "${gameId}"`)
    const text = fs.readFileSync(new URL(file, dir), 'utf8')
    const hit = detect(text)
    assert.ok(hit, 'not recognized by any parser')
    assert.equal(hit.game.id, gameId)
    assert.ok(Number.isFinite(hit.parsed.metric), 'metric is not a number')
  })
}
