import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hashKey } from '../src/auth/callers.js'

const KEY_A = 'key-for-crms'
const KEY_B = 'key-for-pos'

/** Stub of the Cloudflare rate limiting binding: allows everything except keys in `blocked`. */
function limiter(blocked: string[] = []) {
  const seen: string[] = []
  return {
    seen,
    limit: async ({ key }: { key: string }) => {
      seen.push(key)
      return { success: !blocked.includes(key) }
    },
  }
}

async function env(
  keys: Record<string, string> = { crms: KEY_A, pos: KEY_B },
  rateLimiter: Pick<RateLimit, 'limit'> = limiter(),
) {
  const callers = await Promise.all(
    Object.entries(keys).map(async ([name, key]) => ({
      name,
      keyHash: await hashKey(key),
    })),
  )
  return { CALLERS: JSON.stringify(callers), RATE_LIMITER: rateLimiter }
}

async function call(path: string, init: RequestInit = {}, e?: Awaited<ReturnType<typeof env>>) {
  const app = createApp({ fetch: async () => new Response('downstream') })
  return app.fetch(new Request(`https://gw.test${path}`, init), e ?? (await env()))
}

const bearer = (key: string) => ({ Authorization: `Bearer ${key}` })

describe('/health', () => {
  it('answers ok without a key', async () => {
    const res = await call('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('Caller key check', () => {
  it('rejects a missing key with 401', async () => {
    expect((await call('/files/x')).status).toBe(401)
  })

  it('rejects a wrong key with 401', async () => {
    expect((await call('/files/x', { headers: bearer('nope') })).status).toBe(401)
  })

  it('rejects a revoked Caller once removed from the map', async () => {
    const revoked = await env({ pos: KEY_B })
    const res = await call('/files/x', { headers: bearer(KEY_A) }, revoked)
    expect(res.status).toBe(401)
  })

  it('accepts the bearer scheme case-insensitively', async () => {
    const res = await call('/nowhere', {
      headers: { Authorization: `bearer ${KEY_A}` },
    })
    expect(res.status).toBe(404)
  })

  it('rejects non-bearer schemes', async () => {
    const res = await call('/files/x', {
      headers: { Authorization: `Basic ${KEY_A}` },
    })
    expect(res.status).toBe(401)
  })

  it('lets a valid key past the door (unknown path is 404, not 401)', async () => {
    expect((await call('/nowhere', { headers: bearer(KEY_A) })).status).toBe(404)
  })

  it('fails closed when the Caller map is missing or malformed', async () => {
    const bad = { ...(await env()), CALLERS: 'not json' }
    expect((await call('/files/x', { headers: bearer(KEY_A) }, bad)).status).toBe(401)
    expect((await call('/health', {}, bad)).status).toBe(200)
  })
})

describe('X-Request-Id', () => {
  it('is generated when absent', async () => {
    const res = await call('/health')
    expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('is kept when supplied', async () => {
    const res = await call('/health', {
      headers: { 'X-Request-Id': 'abc-123' },
    })
    expect(res.headers.get('X-Request-Id')).toBe('abc-123')
  })

  it('is replaced when the supplied value is unsafe', async () => {
    const res = await call('/health', {
      headers: { 'X-Request-Id': 'x'.repeat(500) },
    })
    expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('is present on 401 and 404 responses', async () => {
    const unauthorised = await call('/files/x', {
      headers: { 'X-Request-Id': 'r1' },
    })
    expect(unauthorised.status).toBe(401)
    expect(unauthorised.headers.get('X-Request-Id')).toBe('r1')
    const missing = await call('/nowhere', { headers: bearer(KEY_A) })
    expect(missing.headers.get('X-Request-Id')).toBeTruthy()
  })

  it('is present when a handler throws', async () => {
    const app = createApp({ fetch: async () => new Response('downstream') })
    app.get('/boom', () => {
      throw new Error('boom')
    })
    const res = await app.fetch(
      new Request('https://gw.test/boom', { headers: bearer(KEY_A) }),
      await env(),
    )
    expect(res.status).toBe(500)
    expect(res.headers.get('X-Request-Id')).toBeTruthy()
  })
})

describe('Per-Caller rate limit', () => {
  it('returns 429 with a retry hint when the Caller is over its limit', async () => {
    const e = await env(undefined, limiter(['crms']))
    const res = await call('/files/x', { headers: bearer(KEY_A) }, e)
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(res.headers.get('X-Request-Id')).toBeTruthy()
  })

  it('does not affect another Caller', async () => {
    const rl = limiter(['crms'])
    const e = await env(undefined, rl)
    expect((await call('/nowhere', { headers: bearer(KEY_A) }, e)).status).toBe(429)
    expect((await call('/nowhere', { headers: bearer(KEY_B) }, e)).status).toBe(404)
    expect(rl.seen).toEqual(['crms', 'pos'])
  })

  it('counts every route against the same Caller key', async () => {
    const rl = limiter()
    const e = await env(undefined, rl)
    for (const path of ['/notifications/x', '/files/x', '/audit/x']) {
      await call(path, { headers: bearer(KEY_A) }, e)
    }
    expect(rl.seen).toEqual(['crms', 'crms', 'crms'])
  })

  it('does not rate limit unauthenticated requests or /health', async () => {
    const rl = limiter()
    const e = await env(undefined, rl)
    await call('/files/x', {}, e)
    await call('/health', {}, e)
    expect(rl.seen).toEqual([])
  })
})

describe('/notifications', () => {
  const NOTIFY_ENV = {
    NOTIFICATIONS_URL: 'https://notify.test',
    NOTIFICATIONS_TOKEN: 'gw-notify-token',
  }

  /** Calls the gateway with a recording stand-in for the notifications service. */
  async function notify(
    path: string,
    init: RequestInit = {},
    downstream: (req: Request) => Response | Promise<Response> = () => new Response('ok'),
  ) {
    const sent: Request[] = []
    const app = createApp({
      fetch: async (input, init) => {
        const req = new Request(input, { ...init, duplex: 'half' } as object)
        sent.push(req)
        return downstream(req)
      },
    })
    const res = await app.fetch(new Request(`https://gw.test${path}`, init), {
      ...(await env()),
      ...NOTIFY_ENV,
    })
    return { res, sent }
  }

  it('forwards an email send with the prefix stripped, the body intact and the gateway token', async () => {
    const { res, sent } = await notify('/notifications/emails?x=1', {
      method: 'POST',
      headers: {
        ...bearer(KEY_A),
        'Content-Type': 'application/json',
        'X-System-Code': 'forged',
      },
      body: JSON.stringify({ to: 'a@b.c' }),
    })
    expect(res.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0].method).toBe('POST')
    expect(sent[0].url).toBe('https://notify.test/emails?x=1')
    expect(sent[0].headers.get('Authorization')).toBe('Bearer gw-notify-token')
    expect(sent[0].headers.has('X-System-Code')).toBe(false)
    expect(sent[0].headers.get('Content-Type')).toBe('application/json')
    expect(sent[0].headers.get('X-Request-Id')).toBe(res.headers.get('X-Request-Id'))
    expect(await sent[0].json()).toEqual({ to: 'a@b.c' })
  })

  it('forwards an in-app notification', async () => {
    const { sent } = await notify('/notifications/notifications', {
      method: 'POST',
      headers: { ...bearer(KEY_A), 'Content-Type': 'application/json' },
      body: '{"userId":"u1"}',
    })
    expect(sent[0].url).toBe('https://notify.test/notifications')
  })

  it('returns the downstream status and body unchanged', async () => {
    const { res } = await notify('/notifications/emails', { headers: bearer(KEY_A) }, () =>
      Response.json({ error: 'bad' }, { status: 422, headers: { 'X-Thing': 'y' } }),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'bad' })
    expect(res.headers.get('X-Thing')).toBe('y')
    expect(res.headers.get('X-Request-Id')).toBeTruthy()
  })

  it('serves docs and openapi.json without a key', async () => {
    for (const path of ['/notifications/docs', '/notifications/openapi.json']) {
      const { res, sent } = await notify(path)
      expect(res.status).toBe(200)
      expect(sent[0].url).toBe(`https://notify.test${path.replace('/notifications', '')}`)
      expect(sent[0].headers.get('Authorization')).toBe('Bearer gw-notify-token')
    }
  })

  it('requires a Caller key for /mcp', async () => {
    const { res, sent } = await notify('/notifications/mcp', {
      method: 'POST',
    })
    expect(res.status).toBe(401)
    expect(sent).toHaveLength(0)
    const ok = await notify('/notifications/mcp', {
      method: 'POST',
      headers: bearer(KEY_A),
    })
    expect(ok.sent[0].url).toBe('https://notify.test/mcp')
  })

  it('returns 502 with the request id when the service is unreachable', async () => {
    const { res } = await notify(
      '/notifications/emails',
      { headers: { ...bearer(KEY_A), 'X-Request-Id': 'r9' } },
      () => {
        throw new TypeError('network down')
      },
    )
    expect(res.status).toBe(502)
    expect(res.headers.get('X-Request-Id')).toBe('r9')
    expect(await res.json()).toMatchObject({ requestId: 'r9' })
  })

  it('returns 504 with the request id when the service times out', async () => {
    const { res } = await notify(
      '/notifications/emails',
      { headers: { ...bearer(KEY_A), 'X-Request-Id': 'r8' } },
      () => {
        throw new DOMException('timed out', 'TimeoutError')
      },
    )
    expect(res.status).toBe(504)
    expect(await res.json()).toMatchObject({ requestId: 'r8' })
  })
})
