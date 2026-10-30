// App Store screenshots for iPhone (1320 × 2868): a caption in the site's type with the key
// word on the yellow highlighter, then the real app in a phone frame with the site's outline and
// hard shadow. Writes one HTML page per slide; render-slides.sh turns them into images.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

// scratch folder holding shots-raw/ (iPhone captures) and mac-raw/ (Mac captures), plus games.json
const dir = process.argv[2] || process.cwd()
const raw = `file://${dir}/shots-raw`
const out = `${dir}/screens/iphone`
mkdirSync(out, { recursive: true })
const games = JSON.parse(readFileSync(`${dir}/games.json`, 'utf8').split('\n')[1])

const W = 1320, H = 2868
const base = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=block');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: #e9e4f7; font-family: Poppins, system-ui, sans-serif; color: #16162e; position: relative; }
  .caption { position: absolute; left: 96px; right: 96px; top: 200px; }
  .logo { display: inline-flex; align-items: center; gap: 18px; font-weight: 800; font-size: 54px; margin-bottom: 56px; }
  .logo .pill { background: #16162e; color: #fff; padding: 6px 26px; border-radius: 22px; }
  h1 { font-weight: 800; font-size: 124px; line-height: 1.06; letter-spacing: -2.5px; }
  mark { background: linear-gradient(transparent 58%, #f8d34c 58%, #f8d34c 90%, transparent 90%); color: inherit; padding: 0 6px; margin: 0 -6px; }
  .sub { margin-top: 40px; font-size: 52px; font-weight: 600; color: #6f6f8a; line-height: 1.3; }
  .phone { position: absolute; left: 50%; width: 1060px; height: ${Math.round(1060 * H / W)}px; transform: translateX(-50%);
           border: 16px solid #16162e; border-radius: 116px; overflow: hidden; background: #e9e4f7;
           box-shadow: 30px 30px 0 #16162e; }
  .screen { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
  .screen img { width: ${W}px; height: ${H}px; display: block; }
`
// width 1060 bleeds off the bottom (the top of the screen is what matters); a smaller phone
// shows the whole screen, for the paste slide whose point is the bar at the bottom
function phone(shot, top, extra = '', width = 1060) {
  const scale = (width - 32) / W
  return `<div class="phone" style="top:${top}px;width:${width}px;height:${Math.round(width * H / W)}px;border-radius:${Math.round(width * 0.11)}px">
    <div class="screen" style="transform:scale(${scale})"><img src="${raw}/${shot}.png">${extra}</div></div>`
}

function page(body, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${body}</body></html>`
}

const slides = [
  {
    name: '01-today',
    html: page(`<div class="caption">
        <div class="logo"><span class="pill">The</span>Dailies</div>
        <h1>Beat your friends at <mark>every</mark> daily game</h1>
      </div>${phone('today', 1010)}`),
  },
  {
    name: '02-paste',
    html: page(`<div class="caption">
        <h1>Play, then <mark>paste</mark>. That's it.</h1>
        <div class="sub">Tap Share in any game and your score lands on the board.</div>
      </div>${phone('game', 820, '', 880)}`),
  },
  {
    name: '03-leaderboard',
    html: page(`<div class="caption">
        <h1>See who won <mark>every</mark> game</h1>
        <div class="sub">A leaderboard for each game, every day.</div>
      </div>${phone('board', 830)}`),
  },
  {
    name: '04-feed',
    html: page(`<div class="caption">
        <h1>Cheer on your <mark>friends</mark></h1>
        <div class="sub">Kudos, streaks and personal bests in one feed.</div>
      </div>${phone('feed', 830)}`),
  },
  {
    name: '05-games',
    html: page(`<div class="caption">
        <h1><mark>30+</mark> daily games in one place</h1>
        <div class="sub">Wordle to Queens to the Immaculate Grid.</div>
      </div>
      <div class="grid">${games.filter((g) => g.id !== 'ethnoguessr').map((g) => `<div class="tile"><span class="icon" style="background:${g.color}">${g.emoji}</span><span class="name">${g.name}</span></div>`).join('')}</div>`,
      `.grid { position: absolute; left: 72px; right: 72px; top: 820px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
       .tile { display: flex; align-items: center; gap: 16px; background: #fff; border: 6px solid #16162e; border-radius: 30px;
               box-shadow: 9px 9px 0 #16162e; padding: 22px 16px; min-width: 0; }
       .icon { flex: none; width: 74px; height: 74px; border-radius: 20px; border: 4px solid #16162e; display: flex;
               align-items: center; justify-content: center; font-size: 40px; }
       .name { font-weight: 700; font-size: 29px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`),
  },
  {
    name: '06-friends',
    html: page(`<div class="caption">
        <h1>Add friends with <mark>one link</mark></h1>
        <div class="sub">And meet their friends in People you may know.</div>
      </div>${phone('friends', 830,
        // the capture came from the local server; show the real address
        `<div class="url">https://thedailies.lol/?add=alex</div>`)}`,
      `.url { position: absolute; left: 130px; top: 1174px; width: 758px; height: 124px; background: #fff; border-radius: 26px;
              display: flex; align-items: center; padding-left: 34px; font-size: 44px; font-weight: 500; white-space: nowrap; overflow: hidden; }`),
  },
]

for (const s of slides) writeFileSync(`${out}/${s.name}.html`, s.html)
console.log('wrote', slides.length, 'slides to', out)
