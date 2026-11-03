// The game panel's frame. The app lays the game's own view over #hole, so this page tells it
// where #hole is whenever the layout changes.
const params = new URLSearchParams(location.search)
const mode = params.get('mode') === 'window' ? 'window' : 'overlay'
const name = params.get('name') || 'Game'
const $ = (id) => document.getElementById(id)

document.body.classList.add('panel', mode)
document.title = name
$('name').textContent = name
$('icon').textContent = params.get('emoji') || '🎮'
$('icon').style.background = params.get('color') || 'var(--lilac)'
$('close').setAttribute('aria-label', `Close ${name}`)
document.querySelector('.gamepanel').setAttribute('aria-label', `Play ${name}`)

const hole = $('hole')
const reportHole = () => {
  const r = hole.getBoundingClientRect()
  window.dailiesPanel.hole({ x: r.left, y: r.top, width: r.width, height: r.height })
}
new ResizeObserver(reportHole).observe(hole)
window.addEventListener('resize', reportHole)
document.fonts?.ready.then(reportHole) // the header's height settles once Poppins loads

$('close').addEventListener('click', () => window.dailiesPanel.close())
$('popout').addEventListener('click', () => window.dailiesPanel.popOut())
$('backdrop').addEventListener('click', (e) => {
  if (mode === 'overlay' && e.target === e.currentTarget) window.dailiesPanel.close()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mode === 'overlay') window.dailiesPanel.close()
})

let current = null // the message on screen
let busy = false
const showFlash = (f) => {
  current = f
  const el = $('flash')
  el.hidden = !f
  if (!f) return
  el.className = `flash ${f.ok ? 'ok' : 'err'}`
  el.textContent = f.msg
}

async function paste() {
  if (busy) return
  busy = true
  $('paste').disabled = true
  $('pastelabel').textContent = 'Saving…'
  showFlash(null)
  let result
  try {
    result = await window.dailiesPanel.paste()
  } catch {
    result = { ok: false, msg: 'Couldn’t reach The Dailies. Check your connection.' }
  }
  busy = false
  $('paste').disabled = false
  $('pastelabel').textContent = 'Paste result'
  showFlash(result)
  // saved: back to the board after a moment to read it (as the website's panel does)
  if (result.ok && mode === 'overlay') {
    setTimeout(() => current === result && window.dailiesPanel.close(), 1500)
  }
}
$('paste').addEventListener('click', paste)
window.dailiesPanel.onPasteNow(paste)
