import { Hono } from 'hono'
import { safeGatewayPath, STATIC_TOOLS, toolsFromSpec, type Tool } from '../mcp/tools.js'
import type { Env, GatewayEnv } from '../types.js'

const VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']
const SPEC_TTL_MS = 5 * 60_000
const MAX_RESULT_CHARS = 60_000

type Dispatch = (req: Request, env: Env) => Promise<Response>
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any }

const reply = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result })
const fail = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], isError })

/**
 * One MCP server for all three services. Tools run as ordinary gateway requests carrying the
 * Caller's own key, so authentication, the rate limit and downstream credentials all still apply.
 */
export function createMcp(dispatch: Dispatch) {
  let cache: { at: number; tools: Tool[] } | undefined

  async function loadTools(origin: string, env: Env): Promise<Tool[]> {
    if (cache && Date.now() - cache.at < SPEC_TTL_MS) return cache.tools
    const specs = await Promise.all(
      [
        ['notifications', '/notifications'],
        ['files', '/files'],
      ].map(async ([service, prefix]) => {
        try {
          const res = await dispatch(new Request(`${origin}${prefix}/openapi.json`), env)
          return res.ok ? toolsFromSpec(service, prefix, await res.json(), service === 'files') : []
        } catch {
          return []
        }
      }),
    )
    const tools = [...specs.flat(), ...STATIC_TOOLS]
    // Keep a partial list out of the cache so a service that was briefly down is retried.
    if (specs.every((s) => s.length > 0)) cache = { at: Date.now(), tools }
    return tools
  }

  function toRequest(tool: Tool, args: Record<string, any>, origin: string, auth: string): Request | string {
    let { method, path } = tool.request
    const headers = new Headers({ Authorization: auth })
    let body: unknown
    const query = new URLSearchParams()
    if (tool.name === 'gateway_request') {
      method = String(args.method ?? '').toUpperCase()
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return 'method must be GET, POST, PUT, PATCH or DELETE'
      if (!safeGatewayPath(args.path)) return 'path must be under /notifications, /files or /audit (or /live-tickets), and must not be /mcp'
      path = args.path
      for (const [k, v] of Object.entries(args.query ?? {})) query.append(k, String(v))
      body = args.body
    } else {
      for (const name of tool.inputSchema.required) {
        if (args[name] === undefined) return `missing required argument: ${name}`
      }
      for (const name of tool.request.pathParams) path = path.replace(`{${name}}`, encodeURIComponent(String(args[name])))
      for (const name of tool.request.queryParams) {
        if (args[name] === undefined) continue
        for (const v of [].concat(args[name])) query.append(name, String(v))
      }
      for (const name of tool.request.headerParams) if (args[name] !== undefined) headers.set(name, String(args[name]))
      if (tool.request.bodyKeys) {
        body = Object.fromEntries(tool.request.bodyKeys.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]))
      }
    }
    const qs = query.toString()
    const init: RequestInit = { method, headers }
    if (body !== undefined && method !== 'GET') {
      headers.set('Content-Type', 'application/json')
      init.body = JSON.stringify(body)
    }
    return new Request(`${origin}${path}${qs ? `?${qs}` : ''}`, init)
  }

  async function callTool(tool: Tool, args: Record<string, any>, origin: string, env: Env, auth: string) {
    const req = toRequest(tool, args ?? {}, origin, auth)
    if (typeof req === 'string') return text(req, true)
    const res = await dispatch(req, env)
    const raw = await res.text()
    let shown = raw
    try {
      shown = JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      // not JSON: show as is
    }
    if (shown.length > MAX_RESULT_CHARS) shown = `${shown.slice(0, MAX_RESULT_CHARS)}\n... truncated`
    return text(`HTTP ${res.status}\n${shown}`, res.status >= 400)
  }

  async function handle(msg: Rpc, origin: string, env: Env, auth: string) {
    if (msg.id === undefined) return undefined // a notification: nothing to answer
    switch (msg.method) {
      case 'initialize': {
        const wanted = msg.params?.protocolVersion
        return reply(msg.id, {
          protocolVersion: VERSIONS.includes(wanted) ? wanted : VERSIONS[2],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'api-gateway', version: '1.0.0' },
          instructions:
            'One door to notifications, file storage and audit-logs. Every tool runs with your Caller key. Audit tools also need the Caller to hold an audit-logs key of the right scope.',
        })
      }
      case 'ping':
        return reply(msg.id, {})
      case 'tools/list': {
        const tools = await loadTools(origin, env)
        return reply(msg.id, {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { readOnlyHint: t.readOnly },
          })),
        })
      }
      case 'tools/call': {
        const tool = (await loadTools(origin, env)).find((t) => t.name === msg.params?.name)
        if (!tool) return fail(msg.id, -32602, `Unknown tool: ${msg.params?.name}`)
        return reply(msg.id, await callTool(tool, msg.params?.arguments ?? {}, origin, env, auth))
      }
      default:
        return fail(msg.id, -32601, `Method not found: ${msg.method}`)
    }
  }

  return new Hono<GatewayEnv>()
    .post('/mcp', async (c) => {
      const payload = await c.req.json().catch(() => undefined)
      if (payload === undefined) return c.json(fail(null, -32700, 'Parse error'), 400)
      const origin = new URL(c.req.url).origin
      const auth = c.req.header('Authorization') ?? ''
      const messages: Rpc[] = Array.isArray(payload) ? payload : [payload]
      const answers = (await Promise.all(messages.map((m) => handle(m ?? {}, origin, c.env, auth)))).filter(Boolean)
      if (answers.length === 0) return c.body(null, 202)
      return c.json(Array.isArray(payload) ? answers : answers[0])
    })
    .all('/mcp', (c) => c.json({ error: 'method not allowed; POST JSON-RPC to /mcp' }, 405, { Allow: 'POST' }))
}
