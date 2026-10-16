import { Hono } from 'hono'
import { callerAuth } from './middleware/caller-auth.js'
import { rateLimit } from './middleware/rate-limit.js'
import { requestId } from './middleware/request-id.js'
import { notifications } from './routes/notifications.js'
import { live } from './routes/live.js'
import { audit } from './routes/audit.js'
import { health } from './routes/health.js'
import type { GatewayEnv } from './types.js'

export type { Env, GatewayEnv } from './types.js'

export interface AppDeps {
  /** Outbound fetch used to reach downstream services; injected so tests can stand in for them. */
  fetch: typeof fetch
}

export function createApp(deps: AppDeps) {
  const app = new Hono<GatewayEnv>()

  app.use(async (c, next) => {
    c.set('fetch', deps.fetch)
    await next()
  })
  app.use(requestId)
  app.use(callerAuth)
  app.use(rateLimit)

  app.route('/', health)
  app.route('/', live)
  app.route('/', notifications)
  app.route('/', audit)

  app.notFound((c) => c.json({ error: 'not found' }, 404))
  app.onError((_err, c) => c.json({ error: 'internal error' }, 500))

  return app
}
