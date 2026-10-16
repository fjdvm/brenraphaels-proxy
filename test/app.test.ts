import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hashKey } from '../src/auth/callers.js'

const KEY_A = 'key-for-crms'
const KEY_B = 'key-for-pos'

async function env(keys: Record<string, string> = { crms: KEY_A, pos: KEY_B }) {
  const callers = await Promise.all(
    Object.entries(keys).map(async ([name, key]) => ({ name, keyHash: await hashKey(key) })),
  )
  return { CALLERS: JSON.stringify(callers) }
}

async function call(path: string, init: RequestInit = {}, e?: { CALLERS: string }) {
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
    const res = await call('/nowhere', { headers: { Authorization: `bearer ${KEY_A}` } })
    expect(res.status).toBe(404)
  })

  it('rejects non-bearer schemes', async () => {
    const res = await call('/files/x', { headers: { Authorization: `Basic ${KEY_A}` } })
    expect(res.status).toBe(401)
  })

  it('lets a valid key past the door (unknown path is 404, not 401)', async () => {
    expect((await call('/nowhere', { headers: bearer(KEY_A) })).status).toBe(404)
  })

  it('fails closed when the Caller map is missing or malformed', async () => {
    const bad = { CALLERS: 'not json' }
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
    const res = await call('/health', { headers: { 'X-Request-Id': 'abc-123' } })
    expect(res.headers.get('X-Request-Id')).toBe('abc-123')
  })

  it('is replaced when the supplied value is unsafe', async () => {
    const res = await call('/health', { headers: { 'X-Request-Id': 'x'.repeat(500) } })
    expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('is present on 401 and 404 responses', async () => {
    const unauthorised = await call('/files/x', { headers: { 'X-Request-Id': 'r1' } })
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
