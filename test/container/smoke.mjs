import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import WebSocket, { WebSocketServer } from 'ws'

// Only downstream services are stubbed; every assertion crosses the container's public interface.
const stub = createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ path: req.url, method: req.method, headers: req.headers, body }))
})
const wss = new WebSocketServer({ server: stub })
wss.on('connection', (ws, req) => {
  ws.send(JSON.stringify({ path: req.url, headers: req.headers }))
  ws.on('message', (data, binary) => ws.send(data, { binary }))
})
await new Promise(resolve => stub.listen(0, '0.0.0.0', resolve))
const upstream = `http://127.0.0.1:${stub.address().port}`
const name = `gateway-smoke-${randomUUID()}`
const port = Number(process.env.SMOKE_PORT ?? 18080)
const base = `http://127.0.0.1:${port}`
const hash = key => createHash('sha256').update(key).digest('hex')
const callers = [
  { name: 'portal', keyHash: hash('smoke-key'), auditKey: 'audit-secret', systemCode: 'POS' },
  { name: 'limited', keyHash: hash('rate-key') },
]
const env = { PORT: String(port), CALLERS: JSON.stringify(callers), AUDIT_LOGS_URL: upstream, FILE_STORAGE_URL: upstream, NOTIFICATIONS_URL: upstream, FILE_STORAGE_TOKEN: 'file-secret', NOTIFICATIONS_TOKEN: 'notify-secret', NOTIFICATIONS_GATEWAY_SECRET: 'gateway-secret', LIVE_TICKET_SECRET: 'ticket-secret' }
const container = spawn('docker', ['run', '--rm', '--name', name, '--network', 'host', ...Object.entries(env).flatMap(([k,v]) => ['-e', `${k}=${v}`]), process.env.GATEWAY_IMAGE ?? 'gateway:test'], { stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
for (const stream of [container.stdout, container.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-12000) })
const call = (path, init = {}, key = 'smoke-key') => fetch(base + path, { ...init, headers: { Authorization: `Bearer ${key}`, ...init.headers } })
const sockets = new Set()
try {
  let ready = false
  const started = Date.now()
  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(base + '/health')
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { status: 'ok' })
      ready = true
      break
    } catch { await delay(100) }
    if (container.exitCode !== null) break
  }
  assert.ok(ready, 'container exposes a healthy HTTP interface')
  console.log('PASS health')
  for (const key of ['unknown-key', 'revoked-key']) {
    assert.equal((await call('/audit/events', {}, key)).status, 401)
  }
  console.log('PASS unknown and revoked Caller refusal')
  for (const [path, upstreamPath, token] of [
    ['/audit/events?limit=1', '/events?limit=1', 'audit-secret'],
    ['/files', '/files', 'file-secret'],
    ['/notifications/notifications', '/notifications', 'notify-secret'],
  ]) {
    const response = await call(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'container-smoke', 'X-System-Code': 'forged' }, body: '{"hello":"world"}' })
    assert.equal(response.status, 200, await response.clone().text())
    const forwarded = await response.json()
    assert.equal(forwarded.path, upstreamPath)
    assert.equal(forwarded.method, 'POST')
    assert.equal(forwarded.body, '{"hello":"world"}')
    assert.equal(forwarded.headers.authorization, `Bearer ${token}`)
    assert.equal(forwarded.headers['x-request-id'], 'container-smoke')
    assert.equal(response.headers.get('x-request-id'), 'container-smoke')
    if (path === '/files') assert.equal(forwarded.headers['x-system-code'], 'POS')
    else assert.equal(forwarded.headers['x-system-code'], undefined)
  }
  console.log('PASS audit, file and notification HTTP forwarding')
  const issue = await call('/live-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"userId":"u1"}' })
  assert.equal(issue.status, 200)
  const { ticket, expiresIn } = await issue.json()
  assert.equal(typeof ticket, 'string')
  assert.ok(expiresIn > 0 && expiresIn <= 60)
  const ws = new WebSocket(base.replace('http:', 'ws:') + `/notifications/live?ticket=${ticket}&app=forged`)
  sockets.add(ws)
  const [identity] = await once(ws, 'message', { signal: AbortSignal.timeout(5000) })
  const forwarded = JSON.parse(identity.toString())
  assert.equal(forwarded.path, '/live?userId=u1&app=portal')
  assert.equal(forwarded.headers['x-gateway-secret'], 'gateway-secret')
  assert.equal(forwarded.headers.authorization, undefined)
  for (const payload of ['hello over WebSocket', Buffer.from([0, 1, 255])]) {
    const reply = once(ws, 'message', { signal: AbortSignal.timeout(5000) })
    ws.send(payload)
    const [data, binary] = await reply
    assert.deepEqual(data, Buffer.from(payload))
    assert.equal(binary, Buffer.isBuffer(payload))
  }
  ws.close()
  const bad = new WebSocket(base.replace('http:', 'ws:') + '/notifications/live?ticket=forged')
  sockets.add(bad)
  const refused = new Promise((resolve, reject) => {
    bad.on('unexpected-response', (_req, res) => { res.resume(); resolve(res.statusCode) })
    bad.on('error', reject)
    bad.on('open', () => reject(new Error('forged ticket upgraded')))
  })
  assert.equal(await refused, 401)
  bad.terminate()
  console.log('PASS Live ticket issue, authenticated WebSocket relay and forged-ticket refusal')
  for (let i = 0; i < 600; i++) {
    const res = await call(i % 2 ? '/missing' : '/other', {}, 'rate-key')
    assert.equal(res.status, 404, `allowed request ${i + 1}`)
    await res.arrayBuffer()
  }
  const limited = await call('/missing', {}, 'rate-key')
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
  assert.ok(limited.headers.get('x-request-id'))
  assert.equal((await call('/missing')).status, 404)
  assert.equal((await fetch(base + '/health')).status, 200)
  console.log('PASS 600 requests per Caller across routes, 429, Caller isolation and health bypass')
  // Observe the real 60-second period through HTTP; no clock or limiter internals are mocked.
  await delay(Math.max(0, 61_000 - (Date.now() - started)))
  assert.equal((await call('/missing', {}, 'rate-key')).status, 404)
  console.log('PASS rate limit resets after 60 seconds')
} catch (error) {
  console.error(logs)
  throw error
} finally {
  for (const ws of sockets) ws.terminate()
  for (const ws of wss.clients) ws.terminate()
  try { execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' }) } catch {}
  wss.close()
  stub.closeAllConnections()
  await new Promise(resolve => stub.close(resolve))
}
