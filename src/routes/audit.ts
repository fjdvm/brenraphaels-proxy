import { Hono } from 'hono'
import type { GatewayEnv } from '../types.js'
import { forward } from './proxy.js'

export const audit = new Hono<GatewayEnv>().all('/audit/*', async (c) => {
  const anonymous = c.get('caller') === undefined
  const auditKey = c.get('caller')?.auditKey
  // Open routes (docs, openapi.json) carry no Caller; every other Caller must hold an audit key.
  if (!anonymous && !auditKey) return c.json({ error: 'no audit-logs access' }, 403)
  return forward(c, {
    prefix: '/audit',
    baseUrl: c.env.AUDIT_LOGS_URL,
    headers: auditKey ? { Authorization: `Bearer ${auditKey}` } : {},
  })
})
