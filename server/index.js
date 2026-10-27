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

const __dirname = path.dirname(fileURLToPath(import.meta.url))

await initDb()

const app = express()
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/friends', friendsRouter)
app.use('/api/submissions', submissionsRouter)
app.use('/api/prefs', prefsRouter)
app.use('/api/suggestions', suggestionsRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something broke on our end' })
})

// Production: serve the built frontend from the same service.
const dist = path.join(__dirname, '../web/dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`thedailies api on :${port}`))
