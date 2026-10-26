import fs from 'node:fs'

// Postgres on Railway (DATABASE_URL set), embedded PGlite locally (zero setup).
let backend

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  backend = {
    query: (text, params = []) => pool.query(text, params),
    exec: (text) => pool.query(text),
  }
} else {
  const { PGlite } = await import('@electric-sql/pglite')
  const dir = new URL('../data/pg', import.meta.url).pathname
  fs.mkdirSync(dir, { recursive: true })
  const lite = new PGlite(dir)
  backend = {
    query: (text, params = []) => lite.query(text, params),
    exec: (text) => lite.exec(text),
  }
}

export const q = (text, params = []) => backend.query(text, params)

export async function initDb() {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  await backend.exec(schema)
}
