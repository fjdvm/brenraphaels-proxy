import type { Context } from 'hono'
import type { GatewayEnv } from '../types.js'

const DOWNSTREAM_TIMEOUT_MS = 25_000

/** Headers that belong to the Caller's connection or identity, not to the downstream request. */
const DROPPED_HEADERS = ['authorization', 'x-system-code', 'host', 'x-request-id']

interface Target {
  /** Gateway path prefix, e.g. `/notifications`; removed before forwarding. */
  prefix: string
  baseUrl: string
  /** Headers the gateway sets itself, replacing anything the Caller sent. */
  headers: Record<string, string>
}

/** Forwards the request to a service with the prefix stripped and returns its response unchanged. */
export async function forward(c: Context<GatewayEnv>, target: Target): Promise<Response> {
  const requestId = c.get('requestId')
  const incoming = new URL(c.req.url)
  const path = incoming.pathname.slice(target.prefix.length) || '/'
  const headers = new Headers(c.req.raw.headers)
  for (const name of DROPPED_HEADERS) headers.delete(name)
  for (const [name, value] of Object.entries(target.headers)) headers.set(name, value)
  headers.set('X-Request-Id', requestId)

  const hasBody = c.req.method !== 'GET' && c.req.method !== 'HEAD'
  // The timeout covers waiting for the response headers only, so long-lived bodies are not cut off.
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException('timed out', 'TimeoutError')),
    DOWNSTREAM_TIMEOUT_MS,
  )
  try {
    const url = new URL(path + incoming.search, target.baseUrl)
    const res = await c.get('fetch')(url, {
      method: c.req.method,
      headers,
      body: hasBody ? c.req.raw.body : undefined,
      redirect: 'manual',
      signal: controller.signal,
    })
    // Copy so the response headers are mutable (the request id is added on the way out).
    return new Response(res.body, res)
  } catch (err) {
    const timedOut = (err as { name?: string })?.name === 'TimeoutError'
    return c.json(
      {
        error: timedOut ? 'service timed out' : 'service unreachable',
        requestId,
      },
      timedOut ? 504 : 502,
    )
  } finally {
    clearTimeout(timer)
  }
}
