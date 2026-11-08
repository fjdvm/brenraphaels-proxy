// Explicit operator check against real services. Uses existing Caller keys; creates only
// a labelled audit event, a temporary Pending File, and a Notification for a synthetic user.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import WebSocket from 'ws'

const base = process.env.SMOKE_URL
const key = process.env.CALLER_KEY_PORTAL
const reader = process.env.CALLER_KEY_PORTAL_AUDIT_READER
assert.ok(base && key && reader, 'SMOKE_URL and existing Portal write/read Caller keys required')
const id = `gateway-deploy-${randomUUID()}`
async function call(path, body, credential = key, status = 200) {
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  // Never print response bodies: file responses contain signed storage credentials.
  assert.equal(response.status, status, `${path}: HTTP ${response.status}`)
  return response.json()
}
const sockets = []
try {
  assert.deepEqual(await call('/health'), { status: 'ok' })
  const written = await call('/audit/events', {
    source: 'Authentication', action: 'user.login', outcome: 'success',
    actor: { type: 'user', id, display_name: 'Gateway deployment smoke test' },
    target: { type: 'session', id, display_name: 'Synthetic deployment check' },
    description: 'Gateway Azure deployment verification (synthetic).',
    occurred_at: new Date().toISOString(),
  }, key, 201)
  const stored = await call(`/audit/events/${written.id}`, undefined, reader)
  assert.equal(stored.id, written.id)
  assert.equal(stored.actor.id, id)
  console.log('PASS health and audit write/read with existing Caller keys')

  const file = await call('/files', {
    filename: `${id}.txt`, contentType: 'text/plain', size: 5,
    visibility: 'private', retentionType: 'temporary',
  }, key, 201)
  assert.ok(file.id && file.uploadUrl)
  console.log('PASS temporary Pending File operation (nightly cleanup expires it)')

  const notice = await call('/notifications/notifications', {
    type: 'gateway.deployment', title: 'Synthetic gateway verification',
    body: id, sendingApp: 'Portal', targetApp: 'Portal', userIds: [id],
  }, key, 201)
  assert.equal(notice.stored, 1)
  const listed = await call(`/notifications/notifications?userId=${id}&app=Portal`)
  assert.ok(listed.notifications.some(n => n.body === id))
  console.log('PASS Notification creation and readback for synthetic recipient')

  async function connect(userId, role) {
    const { ticket } = await call('/live-tickets', { userId, ticketId: id, role })
    const url = new URL(`/notifications/conversations/${id}/live`, base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('ticket', ticket)
    const ws = new WebSocket(url, { handshakeTimeout: 30_000 })
    sockets.push(ws)
    await once(ws, 'open', { signal: AbortSignal.timeout(35_000) })
    return ws
  }
  const customer = await connect(`${id}-customer`, 'Customer')
  const staff = await connect(`${id}-staff`, 'Staff')
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket relay timed out')), 15_000)
    staff.on('message', data => {
      const event = JSON.parse(data.toString())
      if (event.type === 'message' && event.id === id) { clearTimeout(timer); resolve(event) }
    })
  })
  customer.send(JSON.stringify({ type: 'message', id, text: 'Synthetic Azure relay check' }))
  const event = await received
  assert.equal(event.text, 'Synthetic Azure relay check')
  assert.equal(event.from.userId, `${id}-customer`)
  console.log('PASS Live ticket WebSocket message relayed between Customer and Staff')
} finally {
  for (const socket of sockets) socket.terminate()
}
