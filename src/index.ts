import { startGateway } from './server.js'
import { createRateLimiter } from './middleware/rate-limit.js'
import type { Env } from './types.js'

const required = [
  'CALLERS', 'AUDIT_LOGS_URL', 'FILE_STORAGE_URL', 'NOTIFICATIONS_URL',
  'FILE_STORAGE_TOKEN', 'NOTIFICATIONS_TOKEN', 'NOTIFICATIONS_GATEWAY_SECRET', 'LIVE_TICKET_SECRET',
] as const
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)
}
for (const key of ['AUDIT_LOGS_URL', 'FILE_STORAGE_URL', 'NOTIFICATIONS_URL'] as const) {
  if (!['http:', 'https:'].includes(new URL(process.env[key]!).protocol))
    throw new Error(`${key} must be an HTTP(S) address`)
}
const port = Number(process.env.PORT ?? 8080)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
const env = {
  ...Object.fromEntries(required.map(key => [key, process.env[key]])),
  CREOMS_URL: process.env.CREOMS_URL,
  CREOMS_SIGNAL_SECRET: process.env.CREOMS_SIGNAL_SECRET,
  RATE_LIMITER: createRateLimiter(),
} as Env
const server = startGateway(env, port)
console.log(JSON.stringify({ event: 'listening', port }))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 10_000).unref()
  })
}
