import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hashKey } from '../src/auth/callers.js'

it('forwards only storefront signals using its own CREOMS credential and no event data', async () => {
  const calls: Request[] = []
  const app = createApp({ fetch: async (url, init) => {
    calls.push(new Request(url, init)); return Response.json({ accepted: true }, { status: 202 })
  } })
  const env = {
    CALLERS: JSON.stringify(await Promise.all([
      ['shop', 'shop-key', 'ECOM'], ['crms', 'crms-key', 'CRMS'], ['pos', 'pos-key', 'POS'],
    ].map(async ([name, key, systemCode]) => ({ name, keyHash: await hashKey(key), systemCode })))),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    CREOMS_URL: 'https://creoms.test', CREOMS_SIGNAL_SECRET: 'creoms-signal-secret-at-least-32-characters',
  }
  const request = (key?: string) => app.fetch(new Request('https://gateway.test/creoms/notifications/signal?orderId=999', {
    method: 'POST', headers: key ? { Authorization: `Bearer ${key}`, 'X-System-Code': 'ECOM' } : {},
    body: JSON.stringify({ kind: 'order', orderId: 999, customerName: 'Forged' }),
  }), env)
  for (const key of [undefined, 'wrong', 'pos-key', 'crms-key']) {
    expect((await request(key)).status).toBe(key === undefined || key === 'wrong' ? 401 : 403)
  }
  expect(calls).toHaveLength(0)
  expect((await request('shop-key')).status).toBe(202)
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe('https://creoms.test/api/notifications/signal')
  expect(calls[0].headers.get('authorization')).toBe('Bearer creoms-signal-secret-at-least-32-characters')
  expect(calls[0].headers.get('x-system-code')).toBeNull()
  expect(await calls[0].text()).toBe('{}')
})

it('keeps signal configuration failures, upstream refusals and outages visible without leaking credentials', async () => {
  const base = {
    CALLERS: JSON.stringify([{ name: 'shop', systemCode: 'ECOM', keyHash: await hashKey('shop-key') }]),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    CREOMS_URL: 'https://creoms.test', CREOMS_SIGNAL_SECRET: 'creoms-signal-secret-at-least-32-characters',
  }
  let calls = 0
  const app = createApp({ fetch: async () => { calls++; return Response.json({ error: 'sync unavailable' }, { status: 503 }) } })
  const request = (env = base) => app.fetch(new Request('https://gateway.test/creoms/notifications/signal', {
    method: 'POST', headers: { Authorization: 'Bearer shop-key' },
  }), env)
  expect((await request({ ...base, CREOMS_SIGNAL_SECRET: '' })).status).toBe(503)
  expect((await request({ ...base, CREOMS_URL: 'http://creoms.test' })).status).toBe(503)
  expect(calls).toBe(0)
  expect((await request()).status).toBe(503)
  expect(calls).toBe(1)
  const offline = createApp({ fetch: async () => { throw new Error('offline') } })
  const response = await offline.fetch(new Request('https://gateway.test/creoms/notifications/signal', {
    method: 'POST', headers: { Authorization: 'Bearer shop-key' },
  }), base)
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain(base.CREOMS_SIGNAL_SECRET)
  expect((await request({ ...base, RATE_LIMITER: { limit: async () => ({ success: false }) } })).status).toBe(429)
  expect(calls).toBe(1)
})
