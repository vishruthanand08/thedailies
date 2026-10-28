import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The live server writes link-preview tags into each page (server/meta.js); in development the
// API does the same through /api/dev/meta, so an invite link from localhost previews the same.
const previewTags = {
  name: 'dailies-preview-tags',
  async transformIndexHtml(html, ctx) {
    if (!ctx.server) return html
    const origin = `http://localhost:${ctx.server.config.server.port || 5173}`
    const url = new URL(ctx.originalUrl || '/', origin)
    try {
      const q = new URLSearchParams({ origin, add: url.searchParams.get('add') || '' })
      const meta = await (await fetch(`http://localhost:3001/api/dev/meta?${q}`)).json()
      return html.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`).replace('<!-- server meta -->', meta.tags)
    } catch {
      return html // API not up yet: no preview tags
    }
  },
}

export default defineConfig({
  plugins: [react(), previewTags],
  server: {
    proxy: { '/api': 'http://localhost:3001', '/download': 'http://localhost:3001' },
  },
})
