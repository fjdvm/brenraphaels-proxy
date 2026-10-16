export interface Caller {
  name: string
  keyHash: string
  /** App name notifications knows this Caller by; defaults to the Caller name. */
  app?: string
  /** The Caller's own audit-logs API key; its scope decides which audit-logs routes it may use. */
  auditKey?: string
  /** Scope the audit key carries (informational; audit-logs enforces it). */
  auditScope?: string
}

const encoder = new TextEncoder()

export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(key))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Parses the Caller map from the CALLERS secret; a missing or malformed map yields no Callers. */
export function parseCallers(raw: string | undefined): Caller[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is Caller => typeof c?.name === 'string' && typeof c?.keyHash === 'string',
    )
  } catch {
    return []
  }
}

/** Finds the Caller whose key hash matches. Compares every entry, in constant time per entry. */
export async function identifyCaller(callers: Caller[], key: string): Promise<Caller | undefined> {
  const hash = await hashKey(key)
  let found: Caller | undefined
  for (const caller of callers) {
    if (timingSafeEqual(caller.keyHash.toLowerCase(), hash)) found = caller
  }
  return found
}
