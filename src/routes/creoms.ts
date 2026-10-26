import { Hono } from 'hono'
import type { GatewayEnv } from '../types.js'

export const creoms = new Hono<GatewayEnv>()

/** A signal is only a wake-up: no Caller data or headers become an alert. */
creoms.post('/creoms/notifications/signal', async c => {
  if (c.get('caller').systemCode !== 'ECOM') return c.json({ error: 'storefront Caller required' }, 403)
  if (!c.env.CREOMS_URL || !c.env.CREOMS_SIGNAL_SECRET || c.env.CREOMS_SIGNAL_SECRET.length < 32) return c.json({ error: 'CREOMS signal is not configured' }, 503)
  try {
    const url = new URL('/api/notifications/signal', c.env.CREOMS_URL)
    if (url.protocol !== 'https:' || url.username || url.password) return c.json({ error: 'invalid CREOMS address' }, 503)
    const response = await c.get('fetch')(url, {
      method: 'POST', headers: {
        Authorization: `Bearer ${c.env.CREOMS_SIGNAL_SECRET}`, 'Content-Type': 'application/json',
        'X-Request-Id': c.get('requestId'),
      }, body: '{}', redirect: 'error', signal: AbortSignal.timeout(25_000),
    })
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } })
  } catch {
    return c.json({ error: 'CREOMS signal unavailable' }, 502)
  }
})
