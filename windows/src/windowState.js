// Remembers the main window's size, position and maximized state between launches.
const { app, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const file = () => path.join(app.getPath('userData'), 'window-state.json')

// a saved position on a monitor that's since been unplugged would open off screen
function onScreen(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y)
}

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(file(), 'utf8'))
    if (saved.bounds && Number.isFinite(saved.bounds.x) && onScreen(saved.bounds)) return saved
  } catch {}
  const area = screen.getPrimaryDisplay().workAreaSize
  return { bounds: { width: Math.min(1180, area.width - 40), height: Math.min(880, area.height - 40) }, maximized: false }
}

function track(win) {
  win.on('close', () => {
    try {
      fs.writeFileSync(file(), JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }))
    } catch {}
  })
}

module.exports = { load, track }
