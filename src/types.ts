import type { Caller } from './auth/callers.js'

export interface Env {
  /** JSON array of { name, keyHash }; a Worker secret. */
  CALLERS: string
  /** Cloudflare rate limiting binding; keyed by Caller name. */
  RATE_LIMITER: RateLimit
  /** Base address of the notifications service; a Worker variable. */
  NOTIFICATIONS_URL: string
  /** Service binding to the notifications Worker; used instead of the public address when set. */
  NOTIFICATIONS?: Fetcher
  /** Base address of the audit-logs service; a Worker variable. */
  AUDIT_LOGS_URL: string
  /** Base address of the file-storage service; a Worker variable. */
  FILE_STORAGE_URL: string
  /** Gateway secret file-storage requires on every API request (its GATEWAY_SECRET); a Worker secret. */
  FILE_STORAGE_TOKEN: string
  /** Bearer token the notifications service expects from the gateway; a Worker secret. */
  NOTIFICATIONS_TOKEN: string
  /** Secret the notifications live routes require in X-Gateway-Secret (its GATEWAY_SECRET); a Worker secret. */
  NOTIFICATIONS_GATEWAY_SECRET: string
  /** Key that signs and verifies Live tickets; a Worker secret. */
  LIVE_TICKET_SECRET: string
}

export type GatewayEnv = {
  Bindings: Env
  Variables: { requestId: string; caller: Caller; fetch: typeof fetch }
}
