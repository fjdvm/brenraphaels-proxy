import { Hono } from 'hono'
import type { GatewayEnv } from '../types.js'
import { forward } from './proxy.js'

export const notifications = new Hono<GatewayEnv>().all('/notifications/*', (c) =>
  forward(c, {
    prefix: '/notifications',
    baseUrl: c.env.NOTIFICATIONS_URL,
    headers: { Authorization: `Bearer ${c.env.NOTIFICATIONS_TOKEN}` },
  }),
)
