import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hashKey } from '../src/auth/callers.js'

const KEY = 'key-for-crms'

const NOTIFY_SPEC = {
  paths: {
    '/notifications': {
      post: {
        operationId: 'sendNotification',
        summary: 'Send a Notification',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { title: { type: 'string' }, userIds: { type: 'array', items: { type: 'string' } } },
                required: ['title', 'userIds'],
              },
            },
          },
        },
      },
      get: {
        operationId: 'listNotifications',
        summary: 'List Notifications',
        parameters: [
          { name: 'userId', in: 'query', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/Limit' },
        ],
      },
    },
    '/notifications/{id}/read': {
      post: { operationId: 'markRead', summary: 'Mark read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/live': { get: { operationId: 'live', summary: 'WebSocket' } },
    '/mcp': { post: { operationId: 'mcp', summary: 'MCP' } },
  },
  components: { parameters: { Limit: { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } } } },
}
const FILES_SPEC = {
  paths: {
    '/files': {
      post: {
        operationId: 'requestUpload',
        summary: 'Request an upload',
        parameters: [{ name: 'X-Actor-Id', in: 'header', required: false, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] } } } },
      },
    },
    '/cron/cleanup': { get: { operationId: 'cleanup', summary: 'cron' } },
    '/health': { get: { operationId: 'health', summary: 'health' } },
  },
}

async function setup(respond: (req: Request) => Response | Promise<Response> = () => new Response('{"ok":true}', { status: 201 })) {
  const sent: Request[] = []
  const app = createApp({
    fetch: async (input, init) => {
      const req = new Request(input, { ...init, duplex: 'half' } as object)
      sent.push(req)
      const url = new URL(req.url)
      if (url.pathname === '/openapi.json') {
        return Response.json(url.host === 'notify.test' ? NOTIFY_SPEC : FILES_SPEC)
      }
      return respond(req)
    },
  })
  const env = {
    CALLERS: JSON.stringify([
      { name: 'crms', keyHash: await hashKey(KEY), systemCode: 'CRMS', auditKey: 'audit-key-crms', auditScope: 'writer' },
    ]),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    NOTIFICATIONS_URL: 'https://notify.test',
    FILE_STORAGE_URL: 'https://files.test',
    AUDIT_LOGS_URL: 'https://audit.test',
    NOTIFICATIONS_TOKEN: 'notify-token',
    NOTIFICATIONS_GATEWAY_SECRET: 'notify-gw',
    FILE_STORAGE_TOKEN: 'files-token',
    LIVE_TICKET_SECRET: 'ticket-secret',
  }
  async function rpc(body: unknown, headers: Record<string, string> = { Authorization: `Bearer ${KEY}` }) {
    const res = await app.fetch(
      new Request('https://gw.test/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify(body),
      }),
      env,
    )
    return { res, json: (res.headers.get('content-type')?.includes('json') ? await res.json() : null) as any }
  }
  const call = (name: string, args: Record<string, unknown> = {}) =>
    rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  return { rpc, call, sent, app, env }
}

describe('gateway MCP server', () => {
  it('needs a Caller key', async () => {
    const { res } = await (await setup()).rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, {})
    expect(res.status).toBe(401)
  })

  it('answers initialize with the tools capability', async () => {
    const { json } = await (await setup()).rpc({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
    })
    expect(json.result.protocolVersion).toBe('2025-06-18')
    expect(json.result.capabilities.tools).toBeDefined()
    expect(json.result.serverInfo.name).toBe('api-gateway')
  })

  it('accepts notifications with 202 and answers ping', async () => {
    const t = await setup()
    expect((await t.rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).res.status).toBe(202)
    expect((await t.rpc({ jsonrpc: '2.0', id: 2, method: 'ping' })).json.result).toEqual({})
  })

  it('lists tools generated from the services and the gateway', async () => {
    const { rpc } = await setup()
    const { json } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    const names = json.result.tools.map((t: { name: string }) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'notifications_send_notification', 'notifications_list_notifications', 'notifications_mark_read',
        'files_request_upload', 'audit_write_event', 'audit_list_events', 'issue_live_ticket', 'gateway_request',
      ]),
    )
    for (const skipped of ['notifications_live', 'notifications_mcp', 'files_cleanup', 'files_health'])
      expect(names).not.toContain(skipped)
    const send = json.result.tools.find((t: { name: string }) => t.name === 'notifications_send_notification')
    expect(send.inputSchema.required).toEqual(['title', 'userIds'])
    expect(send.inputSchema.properties.userIds.type).toBe('array')
    const list = json.result.tools.find((t: { name: string }) => t.name === 'notifications_list_notifications')
    expect(Object.keys(list.inputSchema.properties)).toEqual(['userId', 'limit'])
    expect(list.annotations.readOnlyHint).toBe(true)
  })

  it('calls a tool through the gateway with the Caller key and downstream credentials', async () => {
    const { call, sent } = await setup()
    const { json } = await call('notifications_send_notification', { title: 'Hi', userIds: ['u1'] })
    const req = sent.find((r) => r.method === 'POST' && new URL(r.url).pathname === '/notifications')!
    expect(req.headers.get('authorization')).toBe('Bearer notify-token')
    expect(await req.json()).toEqual({ title: 'Hi', userIds: ['u1'] })
    expect(json.result.isError).toBeFalsy()
    expect(json.result.content[0].text).toContain('201')
    expect(json.result.content[0].text).toContain('"ok": true')
  })

  it('puts path and query arguments in the URL and headers in headers', async () => {
    const t = await setup()
    await t.call('notifications_mark_read', { id: 'a/b' })
    expect(t.sent.some((r) => new URL(r.url).pathname === '/notifications/a%2Fb/read')).toBe(true)
    await t.call('notifications_list_notifications', { userId: 'u1', limit: 5 })
    expect(t.sent.some((r) => r.url === 'https://notify.test/notifications?userId=u1&limit=5')).toBe(true)
    await t.call('files_request_upload', { filename: 'a.txt', 'X-Actor-Id': 'me' })
    const up = t.sent.find((r) => r.url === 'https://files.test/files')!
    expect(up.headers.get('x-actor-id')).toBe('me')
    expect(up.headers.get('x-system-code')).toBe('CRMS')
    expect(await up.json()).toEqual({ filename: 'a.txt' })
  })

  it('flags downstream errors as tool errors', async () => {
    const { call } = await setup(() => new Response('{"error":"bad"}', { status: 400 }))
    const { json } = await call('notifications_send_notification', { title: 'x', userIds: ['u'] })
    expect(json.result.isError).toBe(true)
    expect(json.result.content[0].text).toContain('400')
  })

  it('uses the Caller\'s own audit key for audit tools', async () => {
    const t = await setup()
    await t.call('audit_list_events', { source: 'CRMS', limit: 3 })
    const req = t.sent.find((r) => new URL(r.url).host === 'audit.test')!
    expect(req.headers.get('authorization')).toBe('Bearer audit-key-crms')
    expect(req.url).toBe('https://audit.test/events?source=CRMS&limit=3')
  })

  it('issues a Live ticket', async () => {
    const { call } = await setup()
    const { json } = await call('issue_live_ticket', { userId: 'u1' })
    expect(JSON.parse(json.result.content[0].text.split('\n').slice(1).join('\n')).ticket).toBeTruthy()
  })

  it('rejects unknown tools and unsafe gateway_request paths', async () => {
    const t = await setup()
    expect((await t.call('nope')).json.error.code).toBe(-32602)
    for (const path of ['/mcp', '/notifications/../mcp', 'https://evil.test/x', '/health', '//evil.test/x']) {
      const { json } = await t.call('gateway_request', { method: 'GET', path })
      expect(json.result.isError, path).toBe(true)
    }
    const ok = await t.call('gateway_request', { method: 'GET', path: '/audit/events/valid-values' })
    expect(ok.json.result.isError).toBeFalsy()
  })

  it('rejects invalid JSON and non-POST methods', async () => {
    const t = await setup()
    const bad = await t.app.fetch(
      new Request('https://gw.test/mcp', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: '{nope' }),
      t.env,
    )
    expect(bad.status).toBe(400)
    const get = await t.app.fetch(new Request('https://gw.test/mcp', { headers: { Authorization: `Bearer ${KEY}` } }), t.env)
    expect(get.status).toBe(405)
  })
})
