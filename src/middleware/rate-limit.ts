import { createMiddleware } from 'hono/factory'
import type { GatewayEnv } from '../types.js'

/** Must match `period` of the RATE_LIMITER binding in wrangler.jsonc. */
const RATE_LIMIT_PERIOD_SECONDS = 60

/** One limit per Caller across all routes. Runs after callerAuth, so open paths never reach it. */
export const rateLimit = createMiddleware<GatewayEnv>(async (c, next) => {
  const caller = c.get('caller')
  if (!caller) return next()
  const { success } = await c.env.RATE_LIMITER.limit({ key: caller.name })
  if (!success) {
    return c.json({ error: 'rate limit exceeded' }, 429, {
      'Retry-After': String(RATE_LIMIT_PERIOD_SECONDS),
    })
  }
  await next()
})
