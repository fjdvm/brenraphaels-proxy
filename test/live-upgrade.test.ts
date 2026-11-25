import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { hashKey } from '../src/auth/callers.js'
import { issueLiveTicket } from '../src/auth/live-tickets.js'
import { startGateway } from '../src/server.js'
import type { Env } from '../src/types.js'

// Drives the Node upgrade listener in server.ts, not just the Hono routes: a live route
// missing from its path check is refused with 404 before the ticket is even looked at.
let upstream: WebSocketServer
let gateway: ReturnType<typeof startGateway>
let base: string

beforeAll(async () => {
  upstream = new WebSocketServer({ port: 0 })
  upstream.on('connection', (socket, request) => socket.send(JSON.stringify({ path: request.url })))
  await once(upstream, 'listening')
  const env = {
    CALLERS: JSON.stringify([{ name: 'crms', keyHash: await hashKey('crms-key'), app: 'crms', systemCode: 'CRMS' }]),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    NOTIFICATIONS_URL: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    NOTIFICATIONS_TOKEN: 'service-token',
    NOTIFICATIONS_GATEWAY_SECRET: 'gateway-secret',
    LIVE_TICKET_SECRET: 'live-secret',
  } as unknown as Env
  gateway = startGateway(env, 0)
  await once(gateway, 'listening')
  base = `ws://127.0.0.1:${(gateway.address() as AddressInfo).port}`
})

afterAll(async () => {
  gateway.close()
  upstream.close()
})

function connect(path: string): Promise<{ path: string } | number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base + path)
    ws.on('message', (data) => { resolve(JSON.parse(data.toString())); ws.close() })
    ws.on('unexpected-response', (_req, res) => { res.resume(); resolve(res.statusCode ?? 0); ws.terminate() })
    ws.on('error', reject)
  })
}

describe('WebSocket upgrades through the Node gateway', () => {
  for (const [channel, path] of [
    ['staff-orders', '/notifications/orders/staff/live'],
    ['staff-stock', '/notifications/stock/staff/live'],
  ] as const) {
    it(`relays ${path} with a valid ${channel} ticket and refuses a forged one`, async () => {
      const { ticket } = await issueLiveTicket('live-secret', { userId: 'staff-1', app: 'crms', channel })
      expect(await connect(`${path}?ticket=${ticket}`)).toEqual({ path: `${path.replace('/notifications', '')}?userId=staff-1` })
      expect(await connect(`${path}?ticket=forged`)).toBe(401)
    })
  }

  it('refuses an unknown live path', async () => {
    expect(await connect('/notifications/unknown/live?ticket=x')).toBe(404)
  })
})
