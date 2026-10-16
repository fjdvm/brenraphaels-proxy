/** One MCP tool and how a call to it becomes a gateway request. */
export interface Tool {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[] }
  readOnly: boolean
  request: {
    method: string
    /** Gateway path, with `{param}` placeholders. */
    path: string
    pathParams: string[]
    queryParams: string[]
    headerParams: string[]
    /** Argument names sent in the JSON body; `null` when the call has no body. */
    bodyKeys: string[] | null
  }
}

type Json = Record<string, any>

const SKIPPED_OPERATIONS = new Set(['live', 'conversationLive', 'openapi', 'docs', 'mcp', 'health', 'cleanup'])

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

function resolve(spec: Json, node: any, depth = 0): any {
  if (!node || typeof node !== 'object' || depth > 8) return node
  if (typeof node.$ref === 'string') {
    const target = node.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((acc: any, part: string) => acc?.[part], spec)
    return resolve(spec, target, depth + 1)
  }
  if (Array.isArray(node)) return node.map((n) => resolve(spec, n, depth + 1))
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolve(spec, v, depth + 1)]))
}

/** Builds one tool per operation of a service's OpenAPI document. */
export function toolsFromSpec(service: string, prefix: string, spec: Json, keepOwnPrefix = false): Tool[] {
  const tools: Tool[] = []
  for (const [path, item] of Object.entries<Json>(spec.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = item[method]
      if (!op?.operationId || SKIPPED_OPERATIONS.has(op.operationId)) continue
      const properties: Record<string, unknown> = {}
      const required: string[] = []
      const request = {
        method: method.toUpperCase(),
        path: (keepOwnPrefix && path.startsWith(prefix) ? '' : prefix) + path,
        pathParams: [] as string[],
        queryParams: [] as string[],
        headerParams: [] as string[],
        bodyKeys: null as string[] | null,
      }
      for (const raw of [...(item.parameters ?? []), ...(op.parameters ?? [])]) {
        const p = resolve(spec, raw)
        if (!p?.name) continue
        properties[p.name] = { ...resolve(spec, p.schema), ...(p.description ? { description: p.description } : {}) }
        if (p.required || p.in === 'path') required.push(p.name)
        if (p.in === 'path') request.pathParams.push(p.name)
        else if (p.in === 'query') request.queryParams.push(p.name)
        else if (p.in === 'header') request.headerParams.push(p.name)
      }
      const bodySchema = resolve(spec, op.requestBody?.content?.['application/json']?.schema)
      if (bodySchema) {
        request.bodyKeys = []
        for (const [k, v] of Object.entries<any>(bodySchema.properties ?? {})) {
          if (k in properties) continue
          properties[k] = v
          request.bodyKeys.push(k)
        }
        for (const k of bodySchema.required ?? []) if (!required.includes(k)) required.push(k)
      }
      tools.push({
        name: `${service}_${snake(op.operationId)}`,
        description: [op.summary, op.description].filter(Boolean).join('. '),
        inputSchema: { type: 'object', properties, required },
        readOnly: method === 'get',
        request,
      })
    }
  }
  return tools
}

const str = (description: string, extra: Json = {}) => ({ type: 'string', description, ...extra })
const actor = { type: 'object', properties: { type: { type: 'string' }, id: { type: 'string' }, display_name: { type: 'string' } }, required: ['type', 'id', 'display_name'] }

const EVENT_PROPERTIES = {
  source: str('CRMS, HRMS, POS, IMS, Authentication, File storage, Notifications or Ecommerce. Must match the Caller\'s audit key.'),
  action: str('An action that belongs to the Source, such as record.viewed (see audit_valid_values).'),
  outcome: str('success or failure', { enum: ['success', 'failure'] }),
  actor,
  target: actor,
  subject: { ...actor, description: 'Whose history the event appears in (optional).' },
  description: str('Plain-language sentence for Administrators.'),
  customer_description: str('Sentence for the Subject Customer; without it the event is Administrator-only.'),
  occurred_at: str('ISO 8601 timestamp with a timezone.'),
  module: str('Only for CRMS, HRMS, POS and IMS.'),
  metadata: { type: 'object', description: 'JSON object up to 4096 bytes; keys such as password, token or secret are rejected.' },
  ip_address: str('IPv4 or IPv6.'),
  user_agent: str('User agent.'),
  request_id: str('Request id.'),
  idempotency_key: str('Retries with the same Source and key return the original id.'),
}
const EVENT_REQUIRED = ['source', 'action', 'outcome', 'actor', 'target', 'description', 'occurred_at']
const FILTERS = ['source', 'module', 'action', 'outcome', 'actor_type', 'actor_id', 'subject_type', 'subject_id', 'q', 'from', 'to']
const filterProps = Object.fromEntries(FILTERS.map((f) => [f, str(f === 'from' || f === 'to' ? 'ISO 8601 bound on occurred_at.' : `Filter by ${f}.`)]))

function tool(name: string, description: string, request: Tool['request'], properties: Record<string, unknown>, required: string[]): Tool {
  return { name, description, readOnly: request.method === 'GET', inputSchema: { type: 'object', properties, required }, request }
}
const get = (path: string, pathParams: string[], queryParams: string[]) => ({ method: 'GET', path, pathParams, queryParams, headerParams: [], bodyKeys: null })

/** Gateway and audit-logs tools; audit-logs publishes no OpenAPI document, so these are written out. */
export const STATIC_TOOLS: Tool[] = [
  tool(
    'issue_live_ticket',
    'Issue a short-lived Live ticket for one user so their browser can open a live WebSocket (/notifications/live?ticket=...) without a Caller key. Add ticketId and role for a Ticket conversation.',
    { method: 'POST', path: '/live-tickets', pathParams: [], queryParams: [], headerParams: [], bodyKeys: ['userId', 'ticketId', 'role'] },
    { userId: str('The user the ticket is for.'), ticketId: str('Ticket id, for a conversation.'), role: str('Customer or Staff, for a conversation.', { enum: ['Customer', 'Staff'] }) },
    ['userId'],
  ),
  tool(
    'audit_write_event',
    'Write one Audit Event. Needs a write key for the same Source. Audit Events cannot be changed or deleted.',
    { method: 'POST', path: '/audit/events', pathParams: [], queryParams: [], headerParams: [], bodyKeys: Object.keys(EVENT_PROPERTIES) },
    EVENT_PROPERTIES,
    EVENT_REQUIRED,
  ),
  tool(
    'audit_write_events_batch',
    'Write 1 to 100 Audit Events in one transaction. Every event must match the key\'s Source.',
    { method: 'POST', path: '/audit/events/batch', pathParams: [], queryParams: [], headerParams: [], bodyKeys: ['events'] },
    { events: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', properties: EVENT_PROPERTIES, required: EVENT_REQUIRED } } },
    ['events'],
  ),
  tool('audit_list_events', 'List and search Audit Events, newest first. Needs the Administrator (read:admin) key.',
    get('/audit/events', [], [...FILTERS, 'limit', 'cursor']),
    { ...filterProps, limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: str('The previous next_cursor.') }, []),
  tool('audit_get_event', 'Get one Audit Event by id. Needs the Administrator key.', get('/audit/events/{id}', ['id'], []), { id: str('Event id.') }, ['id']),
  tool('audit_event_stats', 'Counts of Audit Events for charts, grouped by day, source, action or outcome. Needs the Administrator key.',
    get('/audit/events/stats', [], ['group_by', ...FILTERS, 'limit']),
    { group_by: str('How to group.', { enum: ['day', 'source', 'action', 'outcome'] }), ...filterProps, limit: { type: 'integer' } }, ['group_by']),
  tool('audit_valid_values', 'The Sources, Modules and Actions that Audit Events may use. Needs the Administrator key.', get('/audit/events/valid-values', [], []), {}, []),
  tool('audit_export_events', 'Export matching Audit Events as csv or json. Records its own Audit Event. Needs the Administrator key.',
    get('/audit/events/export', [], ['format', 'from', 'to', 'requested_by_id', 'requested_by_name', ...FILTERS.filter((f) => f !== 'from' && f !== 'to')]),
    { format: str('csv or json', { enum: ['csv', 'json'] }), ...filterProps, requested_by_id: str('The Administrator asking.'), requested_by_name: str('Their name.') },
    ['format', 'from', 'to', 'requested_by_id', 'requested_by_name']),
  tool('audit_customer_activity', 'A Customer\'s own activity, with Administrator-only fields removed. Needs the Customer read (read:customer) key.',
    get('/audit/events/customer-activity', [], ['subject_type', 'subject_id', 'limit', 'cursor']),
    { subject_type: str('Usually customer.'), subject_id: str('The Customer id.'), limit: { type: 'integer' }, cursor: str('The previous next_cursor.') }, ['subject_type', 'subject_id']),
  {
    name: 'gateway_request',
    description: 'Escape hatch: call any gateway route under /notifications, /files or /audit (or /live-tickets) with your Caller key. Prefer the specific tools.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        path: str('Gateway path such as /notifications/notifications or /files/{id}.'),
        query: { type: 'object', description: 'Query string parameters.', additionalProperties: true },
        body: { description: 'JSON body.' },
      },
      required: ['method', 'path'],
    },
    request: { method: '', path: '', pathParams: [], queryParams: [], headerParams: [], bodyKeys: null },
  },
]

/** gateway_request may only reach the three services and the ticket route, never /mcp itself. */
export function safeGatewayPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return false
  }
  if (!/^\/(notifications|files|audit)\/[^?#\\]*$|^\/live-tickets$/.test(path)) return false
  if (decoded.split('/').some((s) => s === '..' || s === '.')) return false
  if (/\/mcp\/?$/.test(decoded)) return false
  return !decoded.includes('//')
}
