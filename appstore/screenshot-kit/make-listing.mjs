// The App Store listing for 1.7: iPhone screenshots (1320 × 2868), the product page header
// (3840 × 1646, 21:9) and the search results asset (3840 × 2560, 3:2). Writes one HTML page per
// image; render.sh turns each into a PNG at its exact size with headless Chrome.
//
//   node appstore/screenshot-kit/make-listing.mjs <scratch dir>
//
// The scratch dir holds raw/ (Simulator captures: today, saved, board, feed), games.json (from
// /api/submissions/games), share.json (alex's /api/share/game/wordle) and old-friends.png (the
// previous Friends slide, reused as is).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const dir = process.argv[2] || process.cwd()
const raw = (name) => `file://${dir}/raw/${name}.png`
const icon = `file://${new URL('../../apple/Dailies/Assets.xcassets/AppIcon.appiconset/icon-ios-1024.png', import.meta.url).pathname}`
const out = `${dir}/pages`
mkdirSync(out, { recursive: true })
const games = JSON.parse(readFileSync(`${dir}/games.json`, 'utf8')).games.filter((g) => g.id !== 'ethnoguessr')
const share = JSON.parse(readFileSync(`${dir}/share.json`, 'utf8')).text

const INK = '#16162e', LILAC = '#e9e4f7', YELLOW = '#f8d34c', MUTED = '#6f6f8a'
const SW = 1320, SH = 2868 // a screen capture

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function page(w, h, body, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=block');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body { background: ${LILAC}; font-family: Poppins, system-ui, sans-serif; color: ${INK}; position: relative; }
  h1 { font-weight: 800; letter-spacing: -0.02em; line-height: 1.06; }
  mark { background: linear-gradient(transparent 58%, ${YELLOW} 58%, ${YELLOW} 90%, transparent 90%); color: inherit; padding: 0 0.05em; margin: 0 -0.05em; }
  .logo { display: inline-flex; align-items: center; gap: 0.33em; font-weight: 800; }
  .logo .pill { background: ${INK}; color: #fff; padding: 0.11em 0.48em; border-radius: 0.4em; }
  .phone { position: absolute; border: solid ${INK}; overflow: hidden; background: ${LILAC}; }
  .phone img { display: block; transform-origin: 0 0; }
  .card { background: #fff; border: solid ${INK}; }
  ${css}</style></head><body>${body}</body></html>`
}

// The app in a phone frame `width` wide (the site's outline and hard shadow). `crop` keeps the
// top of the screen only, as a fraction of its height.
function phone({ shot, left, top, width, crop = 1, rotate = 0, z = 1 }) {
  const border = Math.round(width * 0.015)
  const inner = width - border * 2
  const scale = inner / SW
  const height = Math.round(SH * scale * crop) + border * 2
  const radius = Math.round(width * 0.11)
  const shadow = Math.round(width * 0.028)
  return `<div class="phone" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;border-width:${border}px;
    border-radius:${radius}px;box-shadow:${shadow}px ${shadow}px 0 ${INK};transform:rotate(${rotate}deg);z-index:${z}">
    <img src="${raw(shot)}" style="width:${SW}px;height:${SH}px;transform:scale(${scale})"></div>`
}

// A piece of a capture (in screen pixels), shown at `scale`, as a card with the hard shadow.
function piece({ shot, x, y, w, h, left, top, scale, rotate = 0, radius = 40, z = 2 }) {
  const shadow = Math.round(18 * scale)
  return `<div style="position:absolute;left:${left}px;top:${top}px;width:${w * scale}px;height:${h * scale}px;overflow:hidden;
    border-radius:${radius * scale}px;box-shadow:${shadow}px ${shadow}px 0 ${INK};transform:rotate(${rotate}deg);z-index:${z}">
    <img src="${raw(shot)}" style="position:absolute;left:${-x * scale}px;top:${-y * scale}px;width:${SW * scale}px;height:${SH * scale}px"></div>`
}

const tile = (g, size) => `<span class="gtile" style="width:${size}px;height:${size}px;background:${g.color};font-size:${Math.round(size * 0.52)}px;border-radius:${Math.round(size * 0.27)}px;border-width:${Math.max(4, Math.round(size * 0.055))}px">${g.emoji}</span>`
const tileCss = `.gtile { display: inline-flex; align-items: center; justify-content: center; border: solid ${INK}; box-shadow: 0.09em 0.09em 0 ${INK}; flex: none; }`

// ---------- iPhone screenshots ----------

const caption = (title, sub, top = 200, logo = false) => `<div style="position:absolute;left:96px;right:96px;top:${top}px">
  ${logo ? `<div class="logo" style="font-size:54px;margin-bottom:56px"><span class="pill">The</span>Dailies</div>` : ''}
  <h1 style="font-size:124px">${title}</h1>
  ${sub ? `<div style="margin-top:40px;font-size:52px;font-weight:600;color:${MUTED};line-height:1.3">${sub}</div>` : ''}</div>`

const shots = {
  '01-today': page(SW, SH, caption('Beat your friends at <mark>every</mark> daily game', '', 200, true) +
    phone({ shot: 'today', left: 130, top: 1010, width: 1060 })),

  // the banner (at the top of the capture, y ≈ 70–260) blown up over the phone
  '02-saved': page(SW, SH, caption('Just play. Your score <mark>saves itself</mark>.', 'Finish a game and you’re on the board. No copying, no pasting.') +
    phone({ shot: 'saved', left: 220, top: 1060, width: 880 }) +
    piece({ shot: 'saved', x: 36, y: 196, w: 1248, h: 150, left: 64, top: 1150, scale: 0.955, radius: 44, z: 3 })),

  '03-leaderboard': page(SW, SH, caption('See who won <mark>every</mark> game', 'A leaderboard for each game, every day.') +
    phone({ shot: 'board', left: 130, top: 830, width: 1060 })),

  '04-brag': page(SW, SH, caption('<mark>Brag</mark> with one tap', 'Share your score with a link that brings friends to the board.') + `
    <div class="bubble me">${esc(share).replace(/\n/g, '<br>').replace(/(https:\/\/\S+)/, '<span class="link">$1</span>')}</div>
    <div class="preview card"><img src="${icon}"><div><div class="pt">@alex got 3/6 on Wordle. Can you beat it?</div><div class="pu">thedailies.lol</div></div></div>
    <div class="bubble them">ok that’s it. rematch tomorrow 😤</div>
    <div class="bubble them two">downloading it now</div>`,
  `.bubble { position: absolute; font-size: 54px; line-height: 1.35; font-weight: 500; padding: 44px 52px; border: 6px solid ${INK}; border-radius: 56px; box-shadow: 14px 14px 0 ${INK}; }
   .me { right: 96px; left: 230px; top: 960px; background: ${YELLOW}; border-bottom-right-radius: 14px; }
   .me .link { font-size: 40px; word-break: break-all; color: ${INK}; text-decoration: underline; font-weight: 600; }
   .preview { position: absolute; right: 96px; left: 230px; top: 1860px; border-width: 6px; border-radius: 40px; box-shadow: 14px 14px 0 ${INK};
              display: flex; align-items: center; gap: 36px; padding: 32px 40px; }
   .preview img { width: 130px; height: 130px; border-radius: 30px; flex: none; }
   .preview .pt { font-size: 44px; font-weight: 700; line-height: 1.25; }
   .preview .pu { font-size: 36px; color: ${MUTED}; font-weight: 500; margin-top: 6px; }
   .them { left: 96px; background: #fff; border-bottom-left-radius: 14px; top: 2240px; }
   .them.two { top: 2470px; }`),

  '05-feed': page(SW, SH, caption('Cheer on your <mark>friends</mark>', 'Kudos, streaks and personal bests in one feed.') +
    phone({ shot: 'feed', left: 130, top: 830, width: 1060 })),

  '06-reminders': page(SW, SH, caption('Never break your <mark>streak</mark>', 'A nudge when your friends have played and you haven’t.') + [
      ['Your friends are playing', 'maya and jules already played today. Your turn 👀', 'now'],
      ['🔥 Your 6-day streak ends at midnight', 'One game keeps it going. Play now.', '8:00 PM'],
      ['👏 Kudos', 'maya, jules and sam gave you kudos for today', '9:12 PM'],
    ].map(([t, b, when], i) => `<div class="note card" style="top:${1000 + i * 420}px">
      <img src="${icon}"><div class="txt"><div class="t">${t}</div><div class="b">${b}</div></div><div class="when">${when}</div></div>`).join(''),
  `.note { position: absolute; left: 96px; right: 96px; height: 340px; border-width: 6px; border-radius: 64px; box-shadow: 14px 14px 0 ${INK};
           display: flex; align-items: center; gap: 40px; padding: 0 48px; }
   .note img { width: 150px; height: 150px; border-radius: 36px; flex: none; }
   .note .txt { flex: 1; min-width: 0; }
   .note .t { font-weight: 700; font-size: 46px; line-height: 1.2; }
   .note .b { font-size: 44px; color: ${MUTED}; font-weight: 500; line-height: 1.3; margin-top: 8px; }
   .note .when { align-self: flex-start; margin-top: 70px; font-size: 38px; color: ${MUTED}; font-weight: 500; }`),

  '07-games': page(SW, SH, caption(`<mark>${games.length}+</mark> daily games in one place`, 'Word games, logic puzzles, geography and trivia.') +
    `<div class="grid">${games.slice(0, 27).map((g) => `<div class="g card">${tile(g, 74)}<span class="name">${esc(g.name)}</span></div>`).join('')}</div>`,
  `${tileCss}
   .grid { position: absolute; left: 72px; right: 72px; top: 860px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
   .g { display: flex; align-items: center; gap: 16px; border-width: 6px; border-radius: 30px; box-shadow: 9px 9px 0 ${INK}; padding: 22px 16px; min-width: 0; }
   .name { font-weight: 700; font-size: 29px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`),
}

// ---------- the product page header: 3840 × 1646 ----------
// Apple crops it differently by device, so everything that matters sits in the middle third:
// the name and the promise. The phones and game tiles toward the edges are decoration.

const HW = 3840, HH = 1646
const ring = games.filter((g) => ['wordle', 'connections', 'queens', 'worldle', 'mini', 'zip', 'strands', 'globle', 'tango', 'chainle', 'pinpoint', 'travle'].includes(g.id))
const spots = [ // [left, top, size, rotate]
  [1040, 170, 190, -10], [730, 720, 150, 8], [1110, 1180, 170, -6], [760, 1300, 120, 12],
  [2640, 180, 170, 9], [2980, 760, 150, -8], [2720, 1190, 190, 6], [2990, 1340, 120, -12],
  [1280, 1380, 110, 14], [2480, 1430, 110, -10], [700, 300, 110, 10], [3020, 330, 120, -6],
]
const header = page(HW, HH, `
  <div class="center">
    <div class="logo" style="font-size:96px"><span class="pill">The</span>Dailies</div>
    <h1 style="font-size:210px;margin-top:60px">Every daily game.<br><mark>One</mark> leaderboard.</h1>
    <div class="sub">Play, beat your friends, take the crown.</div>
  </div>
  ${ring.map((g, i) => { const [l, t, s, r] = spots[i]; return `<div style="position:absolute;left:${l}px;top:${t}px;transform:rotate(${r}deg)">${tile(g, s)}</div>` }).join('')}
  ${phone({ shot: 'today', left: 80, top: 160, width: 600, crop: 0.62, rotate: -6 })}
  ${phone({ shot: 'board', left: 3160, top: 160, width: 600, crop: 0.62, rotate: 6 })}`,
`${tileCss}
 .center { position: absolute; left: 0; right: 0; top: 300px; text-align: center; }
 .sub { margin-top: 56px; font-size: 76px; font-weight: 600; color: ${MUTED}; }`)

// ---------- the search results asset: 3840 × 2560 ----------
// Search is where people decide whether to look at all, so it says what the app is at a glance
// and shows the real app: the crown, a score saving itself, a game's board.

const RW = 3840, RH = 2560
const search = page(RW, RH, `
  <div class="top">
    <div class="logo" style="font-size:88px"><span class="pill">The</span>Dailies</div>
    <h1 style="font-size:172px;margin-top:44px">Beat your friends at your <mark>daily puzzles</mark></h1>
  </div>
  ${phone({ shot: 'today', left: 300, top: 900, width: 1000, rotate: -3 })}
  ${phone({ shot: 'saved', left: 1420, top: 820, width: 1000, z: 2 })}
  ${phone({ shot: 'board', left: 2540, top: 900, width: 1000, rotate: 3 })}
`,
`.top { position: absolute; left: 200px; right: 200px; top: 150px; text-align: center; }`)

const all = { ...Object.fromEntries(Object.entries(shots).map(([k, v]) => [`iphone/${k}`, v])), header, search }
for (const [name, html] of Object.entries(all)) {
  mkdirSync(`${out}/${name.split('/').slice(0, -1).join('/') || '.'}`, { recursive: true })
  writeFileSync(`${out}/${name}.html`, html)
}
console.log(`wrote ${Object.keys(all).length} pages to ${out}`)
