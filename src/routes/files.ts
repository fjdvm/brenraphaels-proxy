import { Hono } from 'hono'
import type { GatewayEnv } from '../types.js'
import { forward } from './proxy.js'

export const files = new Hono<GatewayEnv>()
  // The daily cleanup belongs to Vercel Cron; the prefix would otherwise expose it as /files/cron/*.
  .all('/files/cron/*', (c) => c.json({ error: 'not found' }, 404))
  .all('/files/*', async (c) => {
    const caller = c.get('caller')
    // Open routes (docs, openapi.json) carry no Caller; every other Caller must map to a Client System.
    if (caller && !caller.systemCode) return c.json({ error: 'no file-storage access' }, 403)
    // file-storage's own routes live under /files, so only its root-level pages lose the prefix.
    const rootLevel = /^\/files\/(docs|openapi\.json|mcp)$/.test(c.req.path)
    return forward(c, {
      prefix: rootLevel ? '/files' : '',
      baseUrl: c.env.FILE_STORAGE_URL,
      // The identity comes from the Caller map; forward() drops whatever the Caller sent.
      headers: caller?.systemCode
        ? {
            Authorization: `Bearer ${c.env.FILE_STORAGE_TOKEN}`,
            'X-System-Code': caller.systemCode,
          }
        : {},
    })
  })
