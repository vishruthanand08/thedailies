async function call(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (p) => call(p),
  post: (p, body) => call(p, { method: 'POST', body }),
  put: (p, body) => call(p, { method: 'PUT', body }),
  del: (p) => call(p, { method: 'DELETE' }),
}

export function timeAgo(iso) {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
