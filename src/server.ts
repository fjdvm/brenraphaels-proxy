import { createAdaptorServer } from '@hono/node-server'
import httpProxy from 'http-proxy'
import { createApp, type Env } from './app.js'

/** Node fetch requires duplex when forwarding a streamed request body. */
const outboundFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, ...(init?.body ? { duplex: 'half' } : {}) } as RequestInit)

export function startGateway(env: Env, port: number) {
  const app = createApp({ fetch: outboundFetch })
  const server = createAdaptorServer({
    fetch: async request => {
      const response = await app.fetch(request, env)
      console.log(JSON.stringify({ requestId: response.headers.get('x-request-id'), method: request.method, path: new URL(request.url).pathname, status: response.status }))
      return response
    },
  })
  const proxy = httpProxy.createProxyServer({ changeOrigin: true, ignorePath: true })
  server.on('upgrade', async (request, socket, head) => {
    socket.on('error', () => socket.destroy())
    try {
      // Reuse the HTTP application's ticket checks and identity rewriting before touching upstream.
      let target: { url: string; headers: Headers } | undefined
      const upgradeApp = createApp({
        fetch: async (input, init) => {
          target = { url: String(input), headers: new Headers(init?.headers) }
          return new Response(null, { status: 204 })
        },
      })
      const path = new URL(request.url ?? '/', 'http://gateway').pathname
      if (!/^\/notifications\/(live|orders\/live|conversations\/[^/]+\/live)$/.test(path)) {
        socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
        return
      }
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(key, value)
        else if (Array.isArray(value)) headers.set(key, value.join(', '))
      }
      const response = await upgradeApp.fetch(new Request(`http://gateway${request.url}`, { headers }), env)
      console.log(JSON.stringify({ requestId: response.headers.get('x-request-id'), method: 'GET', path, status: response.status === 204 ? 101 : response.status }))
      if (!target || response.status !== 204) {
        socket.end(`HTTP/1.1 ${response.status} Rejected\r\nConnection: close\r\nX-Request-Id: ${response.headers.get('x-request-id')}\r\n\r\n`)
        return
      }
      request.headers = Object.fromEntries(target.headers)
      proxy.ws(request, socket, head, { target: target.url }, () => {
        socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
      })
    } catch {
      socket.destroy()
    }
  })
  server.listen(port, '0.0.0.0')
  return server
}
