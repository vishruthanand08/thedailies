// A small log file for problems on someone else's PC: %APPDATA%\The Dailies\dailies.log
// (Help › Open Log File). Kept short: it starts over past 256 KB.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const file = () => path.join(app.getPath('userData'), 'dailies.log')

function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.map((p) => (p instanceof Error ? p.stack || p.message : String(p))).join(' ')}\n`
  console.log(line.trimEnd())
  try {
    if (fs.statSync(file(), { throwIfNoEntry: false })?.size > 256 * 1024) fs.writeFileSync(file(), '')
    fs.appendFileSync(file(), line)
  } catch {}
}

module.exports = { log, logFile: file }
