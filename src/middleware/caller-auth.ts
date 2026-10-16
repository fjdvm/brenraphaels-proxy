import { createMiddleware } from 'hono/factory'
import { identifyCaller, parseCallers } from '../auth/callers.js'
import type { GatewayEnv } from '../types.js'

const OPEN_PATHS = new Set([
  '/health',
  '/notifications/docs',
  '/notifications/openapi.json',
  '/files/docs',
  '/files/openapi.json',
  '/audit/docs',
  '/audit/openapi.json',
])

const DOC_PATHS = new Set(['/', '/ui', '/docs'])

/** Live routes are opened by browsers, which hold a Live ticket instead of a Caller key. */
const LIVE_PATH = /^\/notifications\/(live|conversations\/[^/]+\/live)$/

/** Requires a valid Caller key as a bearer credential, except on open paths. */
export const callerAuth = createMiddleware<GatewayEnv>(async (c, next) => {
  if (OPEN_PATHS.has(c.req.path)) return next()
  // The docs site is static and holds no data; it asks for the Caller key in the browser.
  if (c.req.method === 'GET' && DOC_PATHS.has(c.req.path)) return next()
  if (c.req.method === 'GET' && LIVE_PATH.test(c.req.path)) return next()
  const match = /^bearer (\S+)$/i.exec(c.req.header('Authorization') ?? '')
  const caller = match && (await identifyCaller(parseCallers(c.env.CALLERS), match[1]))
  if (!caller) return c.json({ error: 'unauthorized' }, 401)
  c.set('caller', caller)
  await next()
})
