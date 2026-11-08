import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hashKey } from '../src/auth/callers.js'
import { verifyLiveTicket } from '../src/auth/live-tickets.js'

async function harness() {
  const sent: Request[] = []
  const app = createApp({
    fetch: async (input, init) => {
      sent.push(new Request(input, { ...init, duplex: 'half' } as object))
      return Response.json({ connected: 1 })
    },
  })
  const env = {
    CALLERS: JSON.stringify([
      { name: 'shop', keyHash: await hashKey('shop-key'), app: 'ecommerce', systemCode: 'ECOM' },
      { name: 'crms', keyHash: await hashKey('crms-key'), app: 'crms', systemCode: 'CRMS' },
    ]),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    NOTIFICATIONS_URL: 'https://notify.test',
    NOTIFICATIONS_TOKEN: 'service-token',
    NOTIFICATIONS_GATEWAY_SECRET: 'gateway-secret',
    LIVE_TICKET_SECRET: 'live-secret',
  }
  const request = (path: string, init: RequestInit = {}) =>
    app.fetch(new Request(`https://gateway.test${path}`, init), env)
  const post = (path: string, body: unknown, key = 'shop-key') =>
    request(path, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  return { request, post, sent }
}

describe('Order live passes', () => {
  it('lets only the storefront Caller issue a pass scoped to one Customer and the Orders channel', async () => {
    const h = await harness()
    const body = { userId: 'customer-1', channel: 'orders' }
    expect((await h.post('/live-tickets', body, 'crms-key')).status).toBe(403)
    const res = await h.post('/live-tickets', body)
    expect(res.status).toBe(200)
    const issued = (await res.json()) as { ticket: string; expiresIn: number }
    expect(issued.expiresIn).toBe(60)
    expect(await verifyLiveTicket('live-secret', issued.ticket)).toMatchObject({
      userId: 'customer-1',
      channel: 'orders',
    })
    expect(
      await verifyLiveTicket('live-secret', issued.ticket, Date.now() + 61_000),
    ).toBeUndefined()
    const live = await h.request(`/notifications/orders/live?ticket=${issued.ticket}`, {
      headers: { upgrade: 'websocket' },
    })
    expect(live.status).toBe(200)
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].url).toBe('https://notify.test/orders/live?userId=customer-1')
    expect(h.sent[0].headers.get('x-gateway-secret')).toBe('gateway-secret')
  })
})

it('refuses missing, expired, forged, wrong-Customer and wrong-channel passes before forwarding', async () => {
  const { issueLiveTicket } = await import('../src/auth/live-tickets.js')
  const h = await harness()
  const issue = async (body: object) =>
    ((await (await h.post('/live-tickets', body)).json()) as { ticket: string }).ticket
  const orders = await issue({ userId: 'customer-1', channel: 'orders' })
  const inbox = await issue({ userId: 'customer-1' })
  const conversation = await issue({ userId: 'customer-1', ticketId: 't1', role: 'Customer' })
  const claims = { userId: 'customer-1', app: 'ecommerce', channel: 'orders' as const }
  const expired = await issueLiveTicket('live-secret', claims, Date.now() - 120_000)
  const forged = await issueLiveTicket('wrong-secret', claims)
  for (const path of [
    '/notifications/orders/live',
    '/notifications/orders/live?ticket=garbage',
    `/notifications/orders/live?ticket=${orders}&userId=customer-2`,
    `/notifications/orders/live?ticket=${inbox}`,
    `/notifications/orders/live?ticket=${conversation}`,
    `/notifications/orders/live?ticket=${expired.ticket}`,
    `/notifications/orders/live?ticket=${forged.ticket}`,
    `/notifications/live?ticket=${orders}`,
    `/notifications/conversations/t1/live?ticket=${orders}`,
  ])
    expect((await h.request(path)).status, path).toBe(401)
  expect(h.sent).toEqual([])
})

it('rejects ambiguous or unknown pass channels and unauthenticated issuance', async () => {
  const h = await harness()
  for (const extra of [
    { channel: 'unknown' },
    { channel: 'orders', ticketId: 't1', role: 'Customer' },
    { channel: 'orders', role: 'Customer' },
  ])
    expect((await h.post('/live-tickets', { userId: 'c1', ...extra })).status).toBe(400)
  expect((await h.post('/live-tickets', { channel: 'orders' })).status).toBe(400)
  expect(
    (await h.post('/live-tickets', { userId: 'c1', channel: 'orders' }, 'unknown')).status,
  ).toBe(401)
})

it('lets only the storefront publish events through the gateway', async () => {
  const h = await harness()
  const body = { customerId: 'customer-1', event: { type: 'order.updated', orderId: 'o1' } }
  expect((await h.post('/notifications/orders/events', body, 'crms-key')).status).toBe(403)
  expect((await h.post('/notifications/orders/events', body, 'unknown')).status).toBe(401)
  expect(h.sent).toHaveLength(0)
  const res = await h.post('/notifications/orders/events', body)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ connected: 1 })
  expect(h.sent[0].url).toBe('https://notify.test/orders/events')
  expect(h.sent[0].headers.get('authorization')).toBe('Bearer service-token')
  expect(await h.sent[0].json()).toEqual(body)
})

it('still requires a Caller key for other methods on the Order live path', async () => {
  const h = await harness()
  expect((await h.request('/notifications/orders/live', { method: 'POST' })).status).toBe(401)
  expect(h.sent).toEqual([])
})
