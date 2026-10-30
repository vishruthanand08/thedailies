// App Store screenshots for the Mac (2880 × 1800): the same look as the iPhone set, a caption
// with the key word on the yellow highlighter above the real window in the site's outline.
import { writeFileSync, mkdirSync } from 'node:fs'

// scratch folder holding shots-raw/ (iPhone captures) and mac-raw/ (Mac captures), plus games.json
const dir = process.argv[2] || process.cwd()
const raw = `file://${dir}/mac-raw`
const out = `${dir}/screens/mac`
mkdirSync(out, { recursive: true })

const W = 2880, H = 1800
const winW = 2080, winScale = (winW - 20) / W, winH = Math.round(H * winScale) + 20
const base = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=block');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: #e9e4f7; font-family: Poppins, system-ui, sans-serif; color: #16162e; position: relative; }
  .caption { position: absolute; left: 0; right: 0; top: 96px; text-align: center; }
  h1 { font-weight: 800; font-size: 112px; line-height: 1.05; letter-spacing: -2px; }
  mark { background: linear-gradient(transparent 58%, #f8d34c 58%, #f8d34c 90%, transparent 90%); color: inherit; padding: 0 6px; margin: 0 -6px; }
  .sub { margin-top: 26px; font-size: 46px; font-weight: 600; color: #6f6f8a; }
  .window { position: absolute; left: 50%; top: 372px; width: ${winW}px; height: ${winH}px; transform: translateX(-50%);
            border: 10px solid #16162e; border-radius: 40px; overflow: hidden; background: #e9e4f7; box-shadow: 24px 24px 0 #16162e; }
  .screen { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform: scale(${winScale}); transform-origin: 0 0; }
  .screen img { width: ${W}px; height: ${H}px; display: block; }
`
const win = (shot, extra = '') => `<div class="window"><div class="screen"><img src="${raw}/${shot}.png">${extra}</div></div>`
const page = (body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${body}</body></html>`
const caption = (h1, sub) => `<div class="caption"><h1>${h1}</h1><div class="sub">${sub}</div></div>`

const slides = [
  ['01-today', caption('Every daily game, <mark>one window</mark>', 'Your friends’ scores land as they play.'), win('today')],
  ['02-play', caption('Play right <mark>in the app</mark>', 'Every game opens in a panel. Paste when you’re done.'), win('game')],
  ['03-feed', caption('Cheer on your <mark>friends</mark>', 'Kudos, streaks and personal bests in one feed.'), win('feed')],
  ['04-friends', caption('Add friends with <mark>one link</mark>', 'And meet their friends in People you may know.'),
    // the capture came from the local server; show the real address
    win('friends', '<div class="url">https://thedailies.lol/?add=alex</div>'),
    `.url { position: absolute; left: 456px; top: 850px; width: 900px; height: 84px; background: #fff;
            display: flex; align-items: center; padding-left: 14px; font-size: 33px; font-weight: 400; white-space: nowrap; }`],
]
for (const [name, cap, body, css] of slides) writeFileSync(`${out}/${name}.html`, page(cap + body, css ?? ''))
console.log('wrote', slides.length, 'slides to', out)
