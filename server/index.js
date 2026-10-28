import express from 'express'
import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './db.js'
import { authRouter } from './auth.js'
import { friendsRouter } from './friends.js'
import { submissionsRouter } from './submissions.js'
import { prefsRouter } from './prefs.js'
import { suggestionsRouter } from './suggestions.js'
import { adminRouter } from './admin.js'
import { feedRouter } from './feed.js'
import { pushRouter, startReminders } from './push.js'
import { releaseRouter, macDownload } from './release.js'
import { pageWithMeta, metaFor } from './meta.js'
import { loadRules, backfillPoints } from './points.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

await initDb()
await loadRules()
await backfillPoints()
startReminders() // the evening push, once APNs is configured

const app = express()
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/friends', friendsRouter)
app.use('/api/submissions', submissionsRouter)
app.use('/api/prefs', prefsRouter)
app.use('/api/suggestions', suggestionsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/feed', feedRouter)
app.use('/api/push', pushRouter)
app.use('/api/app', releaseRouter)
app.get('/download/mac', macDownload)
// development only: the Vite dev server asks for a page's link-preview tags here (web/vite.config.js),
// so an invite link from localhost previews like the live site's
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/dev/meta', async (req, res) => res.json(await metaFor(String(req.query.origin || ''), req.query.add)))
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something broke on our end' })
})

// Production: serve the built frontend from the same service.
const dist = path.join(__dirname, '../web/dist')
if (fs.existsSync(dist)) {
  // index: false, so / comes to the handler below and gets its link-preview tags (meta.js)
  app.use(express.static(dist, { extensions: ['html'], index: false })) // /privacy -> privacy.html
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.type('html').set('Cache-Control', 'no-cache').send(await pageWithMeta(indexHtml, req))
  })
}

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`thedailies api on :${port}`))
