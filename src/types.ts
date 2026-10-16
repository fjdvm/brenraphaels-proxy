import type { Caller } from './auth/callers.js'

export interface Env {
  /** JSON array of { name, keyHash }; a Worker secret. */
  CALLERS: string
}

export type GatewayEnv = {
  Bindings: Env
  Variables: { requestId: string; caller: Caller; fetch: typeof fetch }
}
