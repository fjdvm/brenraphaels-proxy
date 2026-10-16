import { createMiddleware } from 'hono/factory'
import type { GatewayEnv } from '../types.js'

const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/

/** Keeps a supplied X-Request-Id (if safe), otherwise generates one, and returns it on every response. */
export const requestId = createMiddleware<GatewayEnv>(async (c, next) => {
  const supplied = c.req.header('X-Request-Id')
  const id = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID()
  c.set('requestId', id)
  await next()
  c.res.headers.set('X-Request-Id', id)
})
