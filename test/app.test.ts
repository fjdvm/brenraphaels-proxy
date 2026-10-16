import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hashKey } from '../src/auth/callers.js'
import { issueLiveTicket, verifyLiveTicket } from '../src/auth/live-tickets.js'

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
      ...AUDIT_KEYS[name],
      ...SYSTEM_CODES[name],
    })),
  )
  return { CALLERS: JSON.stringify(callers), RATE_LIMITER: rateLimiter }
}

async function call(path: string, init: RequestInit = {}, e?: Awaited<ReturnType<typeof env>>) {
  const app = createApp({ fetch: async () => new Response('downstream') })
  return app.fetch(new Request(`https://gw.test${path}`, init), e ?? (await env()))
}

/** Audit-logs API keys held in the Caller map; crms holds the Administrator scope, pos does not. */
const AUDIT_KEYS: Record<string, { auditKey: string; auditScope: string }> = {
  crms: { auditKey: 'audit-key-crms', auditScope: 'administrator' },
  pos: { auditKey: 'audit-key-pos', auditScope: 'writer' },
}

/** Client System codes held in the Caller map; ims has none. */
const SYSTEM_CODES: Record<string, { systemCode: string }> = {
  crms: { systemCode: 'CRMS' },
  pos: { systemCode: 'POS' },
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

describe('/files', () => {
  const FILES_ENV = { FILE_STORAGE_URL: 'https://files.test', FILE_STORAGE_TOKEN: 'gateway-secret' }

  /** Calls the gateway with a recording stand-in for file-storage. */
  async function files(
    path: string,
    init: RequestInit = {},
    callers?: Awaited<ReturnType<typeof env>>,
  ) {
    const sent: Request[] = []
    const app = createApp({
      fetch: async (input, init) => {
        sent.push(new Request(input, { ...init, duplex: 'half' } as object))
        return new Response('ok')
      },
    })
    const res = await app.fetch(new Request(`https://gw.test${path}`, init), {
      ...(callers ?? (await env())),
      ...FILES_ENV,
    })
    return { res, sent }
  }

  it('forwards the path unchanged, with the mapped Client System code and the gateway secret', async () => {
    const { res, sent } = await files('/files/abc/confirm?x=1', {
      method: 'POST',
      headers: { ...bearer(KEY_A), 'X-Actor-Id': 'user-1' },
    })
    expect(res.status).toBe(200)
    expect(sent[0].url).toBe('https://files.test/files/abc/confirm?x=1')
    expect(sent[0].method).toBe('POST')
    expect(sent[0].headers.get('X-System-Code')).toBe('CRMS')
    expect(sent[0].headers.get('Authorization')).toBe('Bearer gateway-secret')
    expect(sent[0].headers.get('X-Actor-Id')).toBe('user-1')
  })

  it('ignores an X-System-Code the Caller sends', async () => {
    const { sent } = await files('/files/abc', {
      headers: { ...bearer(KEY_B), 'X-System-Code': 'CRMS' },
    })
    expect(sent[0].headers.get('X-System-Code')).toBe('POS')
    expect(sent[0].headers.get('Authorization')).toBe('Bearer gateway-secret')
  })

  it('refuses a Caller with no Client System code without reaching file-storage', async () => {
    const { res, sent } = await files('/files/abc', { headers: bearer('key-for-ims') }, await env({ ims: 'key-for-ims' }))
    expect(res.status).toBe(403)
    expect(sent).toHaveLength(0)
  })

  it('serves docs and openapi.json without a key and without credentials', async () => {
    for (const path of ['/files/docs', '/files/openapi.json']) {
      const { res, sent } = await files(path)
      expect(res.status).toBe(200)
      expect(sent[0].url).toBe(`https://files.test${path.replace('/files', '')}`)
      expect(sent[0].headers.has('Authorization')).toBe(false)
      expect(sent[0].headers.has('X-System-Code')).toBe(false)
    }
  })

  it('reaches file-storage’s own /files routes', async () => {
    const created = await files('/files', { method: 'POST', headers: bearer(KEY_A) })
    expect(created.sent[0].url).toBe('https://files.test/files')
  })

  it('does not expose the cleanup cron route', async () => {
    for (const headers of [{}, bearer(KEY_A)]) {
      const { res, sent } = await files('/files/cron/cleanup', { headers })
      expect(res.status === 401 || res.status === 404).toBe(true)
      expect(sent).toHaveLength(0)
    }
  })

  it('requires a Caller key for /mcp', async () => {
    const refused = await files('/files/mcp', { method: 'POST' })
    expect(refused.res.status).toBe(401)
    const ok = await files('/files/mcp', { method: 'POST', headers: bearer(KEY_A) })
    expect(ok.sent[0].url).toBe('https://files.test/mcp')
  })
})

describe('/audit', () => {
  const AUDIT_ENV = { AUDIT_LOGS_URL: 'https://audit.test' }

  /** Calls the gateway with a recording stand-in for audit-logs. */
  async function audit(
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
      ...AUDIT_ENV,
    })
    return { res, sent }
  }

  it('records a single Audit Event with the prefix stripped and the Caller’s own audit key', async () => {
    const { res, sent } = await audit('/audit/events', {
      method: 'POST',
      headers: { ...bearer(KEY_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login' }),
    })
    expect(res.status).toBe(200)
    expect(sent[0].url).toBe('https://audit.test/events')
    expect(sent[0].headers.get('Authorization')).toBe('Bearer audit-key-crms')
    expect(await sent[0].json()).toEqual({ action: 'login' })
  })

  it('records a batch of Audit Events', async () => {
    const { sent } = await audit('/audit/events/batch', {
      method: 'POST',
      headers: { ...bearer(KEY_B), 'Content-Type': 'application/json' },
      body: '[{"action":"a"},{"action":"b"}]',
    })
    expect(sent[0].url).toBe('https://audit.test/events/batch')
    expect(sent[0].headers.get('Authorization')).toBe('Bearer audit-key-pos')
    expect(await sent[0].json()).toHaveLength(2)
  })

  it('drops the Caller’s own Authorization and X-System-Code', async () => {
    const { sent } = await audit('/audit/events', {
      headers: { ...bearer(KEY_B), 'X-System-Code': 'forged' },
    })
    expect(sent[0].headers.get('Authorization')).toBe('Bearer audit-key-pos')
    expect(sent[0].headers.has('X-System-Code')).toBe(false)
  })

  it('leaves Administrator-only routes to the scope of each Caller’s key', async () => {
    const adminOnly = (req: Request) =>
      req.headers.get('Authorization') === 'Bearer audit-key-crms'
        ? Response.json({ ok: true })
        : Response.json({ error: 'forbidden' }, { status: 403 })
    const allowed = await audit('/audit/admin/purge', { headers: bearer(KEY_A) }, adminOnly)
    expect(allowed.res.status).toBe(200)
    const refused = await audit('/audit/admin/purge', { headers: bearer(KEY_B) }, adminOnly)
    expect(refused.res.status).toBe(403)
    expect(await refused.res.json()).toEqual({ error: 'forbidden' })
  })

  it('refuses a Caller with no audit key without reaching audit-logs', async () => {
    const e = await env({ ims: 'key-for-ims' })
    const sent: Request[] = []
    const app = createApp({
      fetch: async (input, init) => {
        sent.push(new Request(input, init))
        return new Response('ok')
      },
    })
    const res = await app.fetch(
      new Request('https://gw.test/audit/events', {
        headers: bearer('key-for-ims'),
      }),
      { ...e, ...AUDIT_ENV },
    )
    expect(res.status).toBe(403)
    expect(sent).toHaveLength(0)
  })

  it('serves docs and openapi.json without a key', async () => {
    for (const path of ['/audit/docs', '/audit/openapi.json']) {
      const { res, sent } = await audit(path)
      expect(res.status).toBe(200)
      expect(sent[0].url).toBe(`https://audit.test${path.replace('/audit', '')}`)
      expect(sent[0].headers.has('Authorization')).toBe(false)
    }
  })

  it('requires a Caller key for /mcp', async () => {
    const { res, sent } = await audit('/audit/mcp', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(sent).toHaveLength(0)
    const ok = await audit('/audit/mcp', {
      method: 'POST',
      headers: bearer(KEY_A),
    })
    expect(ok.sent[0].url).toBe('https://audit.test/mcp')
  })

  it('returns 502 and 504 with the request id when audit-logs cannot be reached', async () => {
    const down = await audit(
      '/audit/events',
      { headers: { ...bearer(KEY_A), 'X-Request-Id': 'r7' } },
      () => {
        throw new TypeError('network down')
      },
    )
    expect(down.res.status).toBe(502)
    expect(await down.res.json()).toMatchObject({ requestId: 'r7' })
    const slow = await audit('/audit/events', { headers: bearer(KEY_A) }, () => {
      throw new DOMException('timed out', 'TimeoutError')
    })
    expect(slow.res.status).toBe(504)
  })

  it('returns the downstream status and body unchanged', async () => {
    const { res } = await audit('/audit/events', { headers: bearer(KEY_A) }, () =>
      Response.json({ error: 'bad' }, { status: 422 }),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'bad' })
  })
})

describe('Live tickets', () => {
  const LIVE_ENV = {
    NOTIFICATIONS_URL: 'https://notify.test',
    NOTIFICATIONS_TOKEN: 'gw-notify-token',
    LIVE_TICKET_SECRET: 'ticket-secret',
  }

  async function gateway(
    path: string,
    init: RequestInit = {},
    overrides: Record<string, unknown> = {},
  ) {
    const sent: Request[] = []
    const app = createApp({
      fetch: async (input, init) => {
        const req = new Request(input, { ...init, duplex: 'half' } as object)
        sent.push(req)
        return new Response('live')
      },
    })
    const res = await app.fetch(new Request(`https://gw.test${path}`, init), {
      ...(await env()),
      ...LIVE_ENV,
      ...overrides,
    })
    return { res, sent }
  }

  async function issue(body: object, headers: HeadersInit = bearer(KEY_A)) {
    const { res } = await gateway('/live-tickets', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res
  }

  const ticketFor = async (body: object) =>
    ((await (await issue(body)).json()) as { ticket: string }).ticket

  it('requires a valid Caller key to issue a ticket', async () => {
    expect((await issue({ userId: 'u1' }, {})).status).toBe(401)
    expect((await issue({ userId: 'u1' }, bearer('nope'))).status).toBe(401)
    expect((await issue({ userId: 'u1' })).status).toBe(200)
  })

  it('rejects a request without a user, or a conversation ticket without Ticket and role', async () => {
    expect((await issue({})).status).toBe(400)
    expect((await issue({ userId: 'u1', ticketId: 't1' })).status).toBe(400)
    expect((await issue({ userId: 'u1', ticketId: 't1', role: 'Admin' })).status).toBe(400)
  })

  it('opens /notifications/live with a valid ticket and forwards the verified user', async () => {
    const ticket = await ticketFor({ userId: 'u1' })
    const { res, sent } = await gateway(`/notifications/live?ticket=${ticket}`)
    expect(res.status).toBe(200)
    const url = new URL(sent[0].url)
    expect(url.origin + url.pathname).toBe('https://notify.test/live')
    expect(url.searchParams.get('userId')).toBe('u1')
    expect(url.searchParams.get('app')).toBe('crms')
    expect(url.searchParams.has('ticket')).toBe(false)
  })

  it('opens the conversation route and forwards the verified user and role', async () => {
    const ticket = await ticketFor({
      userId: 'u1',
      ticketId: 't1',
      role: 'Staff',
    })
    const { res, sent } = await gateway(
      `/notifications/conversations/t1/live?ticket=${ticket}&role=Customer`,
    )
    expect(res.status).toBe(200)
    const url = new URL(sent[0].url)
    expect(url.pathname).toBe('/conversations/t1/live')
    expect(url.searchParams.get('userId')).toBe('u1')
    expect(url.searchParams.get('role')).toBe('Staff')
  })

  it('does not let a browser declare a different user', async () => {
    const ticket = await ticketFor({ userId: 'u1' })
    const { res, sent } = await gateway(`/notifications/live?ticket=${ticket}&userId=victim`)
    expect(res.status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('rejects a missing, tampered, forged or expired ticket before forwarding', async () => {
    const ticket = await ticketFor({ userId: 'u1' })
    const [payload, sig] = ticket.split('.')
    const other = (await ticketFor({ userId: 'u2' })).split('.')[0]
    const forged = await issueLiveTicket('other-secret', {
      userId: 'u1',
      app: 'crms',
    })
    const expired = await issueLiveTicket(
      'ticket-secret',
      { userId: 'u1', app: 'crms' },
      Date.now() - 120_000,
    )
    for (const bad of [
      '',
      'garbage',
      `${other}.${sig}`,
      `${payload}.${sig.slice(1)}x`,
      forged.ticket,
      expired.ticket,
    ]) {
      const { res, sent } = await gateway(`/notifications/live?ticket=${bad}`)
      expect(res.status, bad).toBe(401)
      expect(sent).toHaveLength(0)
    }
    expect((await gateway('/notifications/live')).res.status).toBe(401)
  })

  it('expires within about a minute', async () => {
    const issued = await issueLiveTicket('ticket-secret', {
      userId: 'u1',
      app: 'crms',
    })
    expect(issued.expiresIn).toBeLessThanOrEqual(60)
    expect(
      await verifyLiveTicket('ticket-secret', issued.ticket, Date.now() + 61_000),
    ).toBeUndefined()
  })

  it('does not let a ticket join another Ticket, role, or the inbox route', async () => {
    const convo = await ticketFor({
      userId: 'u1',
      ticketId: 't1',
      role: 'Staff',
    })
    const inbox = await ticketFor({ userId: 'u1' })
    for (const path of [
      `/notifications/conversations/t2/live?ticket=${convo}`,
      `/notifications/live?ticket=${convo}`,
      `/notifications/conversations/t1/live?ticket=${inbox}`,
    ]) {
      const { res, sent } = await gateway(path)
      expect(res.status, path).toBe(401)
      expect(sent).toHaveLength(0)
    }
  })

  it('still requires a Caller key for other methods on the live paths', async () => {
    const { res, sent } = await gateway('/notifications/live', {
      method: 'POST',
    })
    expect(res.status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('fails closed when no ticket secret is configured', async () => {
    const ticket = await ticketFor({ userId: 'u1' })
    const { res } = await gateway(
      `/notifications/live?ticket=${ticket}`,
      {},
      { LIVE_TICKET_SECRET: '' },
    )
    expect(res.status).toBe(401)
  })
})
