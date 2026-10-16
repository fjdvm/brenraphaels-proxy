import { Hono } from 'hono'
import type { GatewayEnv } from '../types.js'

export const health = new Hono<GatewayEnv>().get('/health', (c) => c.json({ status: 'ok' }))
