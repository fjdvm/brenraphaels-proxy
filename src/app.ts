import { Hono } from 'hono'
import { identifyCaller, parseCallers, type Caller } from './callers.js'

export interface Env {
  /** JSON array of { name, keyHash, ... }; a Worker secret. */
  CALLERS: string
}

export interface AppDeps {
  /** Outbound fetch used to reach downstream services; injected so tests can stand in for them. */
  fetch: typeof fetch
}

export type GatewayEnv = {
  Bindings: Env
  Variables: { requestId: string; caller: Caller; fetch: typeof fetch }
}

const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/
const OPEN_PATHS = new Set(['/health'])

export function createApp(deps: AppDeps) {
  const app = new Hono<GatewayEnv>()

  app.use(async (c, next) => {
    const supplied = c.req.header('X-Request-Id')
    const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID()
    c.set('requestId', requestId)
    c.set('fetch', deps.fetch)
    await next()
    c.res.headers.set('X-Request-Id', requestId)
  })

  app.use(async (c, next) => {
    if (OPEN_PATHS.has(c.req.path)) return next()
    const match = /^bearer (\S+)$/i.exec(c.req.header('Authorization') ?? '')
    const caller = match && (await identifyCaller(parseCallers(c.env.CALLERS), match[1]))
    if (!caller) return c.json({ error: 'unauthorized' }, 401)
    c.set('caller', caller)
    await next()
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.notFound((c) => c.json({ error: 'not found' }, 404))
  app.onError((_err, c) => c.json({ error: 'internal error' }, 500))

  return app
}
