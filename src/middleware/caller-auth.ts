import { createMiddleware } from 'hono/factory'
import { identifyCaller, parseCallers } from '../auth/callers.js'
import type { GatewayEnv } from '../types.js'

const OPEN_PATHS = new Set(['/health'])

/** Requires a valid Caller key as a bearer credential, except on open paths. */
export const callerAuth = createMiddleware<GatewayEnv>(async (c, next) => {
  if (OPEN_PATHS.has(c.req.path)) return next()
  const match = /^bearer (\S+)$/i.exec(c.req.header('Authorization') ?? '')
  const caller = match && (await identifyCaller(parseCallers(c.env.CALLERS), match[1]))
  if (!caller) return c.json({ error: 'unauthorized' }, 401)
  c.set('caller', caller)
  await next()
})
