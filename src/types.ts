import type { Caller } from './auth/callers.js'

export interface Env {
  /** JSON array of { name, keyHash }; a Worker secret. */
  CALLERS: string
  /** Cloudflare rate limiting binding; keyed by Caller name. */
  RATE_LIMITER: RateLimit
  /** Base address of the notifications service; a Worker variable. */
  NOTIFICATIONS_URL: string
  /** Bearer token the notifications service expects from the gateway; a Worker secret. */
  NOTIFICATIONS_TOKEN: string
}

export type GatewayEnv = {
  Bindings: Env
  Variables: { requestId: string; caller: Caller; fetch: typeof fetch }
}
