import type { Caller } from './auth/callers.js'

export interface Env {
  /** JSON array of { name, keyHash }; a runtime secret. */
  CALLERS: string
  /** CREOMS origin and dedicated signal credential; never the storefront Caller key. */
  CREOMS_URL?: string
  CREOMS_SIGNAL_SECRET?: string
  /** Per-instance limiter keyed by Caller name; the Workers rollback uses its binding. */
  RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> }
  /** Base address of the notifications service; a runtime variable. */
  NOTIFICATIONS_URL: string
  /** Service binding to the notifications Worker; used instead of the public address when set. */
  NOTIFICATIONS?: Fetcher
  /** Base address of the audit-logs service; a runtime variable. */
  AUDIT_LOGS_URL: string
  /** Base address of the file-storage service; a runtime variable. */
  FILE_STORAGE_URL: string
  /** Gateway secret file-storage requires on every API request (its GATEWAY_SECRET); a runtime secret. */
  FILE_STORAGE_TOKEN: string
  /** Bearer token the notifications service expects from the gateway; a runtime secret. */
  NOTIFICATIONS_TOKEN: string
  /** Secret the notifications live routes require in X-Gateway-Secret (its GATEWAY_SECRET); a runtime secret. */
  NOTIFICATIONS_GATEWAY_SECRET: string
  /** Key that signs and verifies Live tickets; a runtime secret. */
  LIVE_TICKET_SECRET: string
}

export type GatewayEnv = {
  Bindings: Env
  Variables: { requestId: string; caller: Caller; fetch: typeof fetch }
}
