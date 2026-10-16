const TICKET_TTL_SECONDS = 60

/** What a Live ticket vouches for. `ticketId` and `role` are present only for a Ticket conversation. */
export interface LiveTicketClaims {
  userId: string
  app: string
  ticketId?: string
  role?: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (ch) => ch.charCodeAt(0))

const hmacKey = (secret: string, usage: KeyUsage) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ])

/** Signs claims into `payload.signature`, expiring in about a minute. */
export async function issueLiveTicket(
  secret: string,
  claims: LiveTicketClaims,
  now = Date.now(),
): Promise<{ ticket: string; expiresIn: number }> {
  if (!secret) throw new Error('LIVE_TICKET_SECRET is not configured')
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        ...claims,
        exp: Math.floor(now / 1000) + TICKET_TTL_SECONDS,
      }),
    ),
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret, 'sign'),
    encoder.encode(payload),
  )
  return {
    ticket: `${payload}.${toBase64Url(new Uint8Array(sig))}`,
    expiresIn: TICKET_TTL_SECONDS,
  }
}

/** Returns the claims of a genuine, unexpired ticket; anything else yields undefined. */
export async function verifyLiveTicket(
  secret: string | undefined,
  ticket: string | undefined,
  now = Date.now(),
): Promise<LiveTicketClaims | undefined> {
  if (!secret || !ticket) return undefined
  try {
    const [payload, sig, extra] = ticket.split('.')
    if (!payload || !sig || extra !== undefined) return undefined
    const genuine = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret, 'verify'),
      fromBase64Url(sig),
      encoder.encode(payload),
    )
    if (!genuine) return undefined
    const { exp, ...claims } = JSON.parse(decoder.decode(fromBase64Url(payload)))
    if (typeof exp !== 'number' || exp * 1000 <= now) return undefined
    if (typeof claims.userId !== 'string' || typeof claims.app !== 'string') return undefined
    return claims
  } catch {
    return undefined
  }
}
