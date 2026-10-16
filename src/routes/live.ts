import { Hono } from 'hono'
import { issueLiveTicket, verifyLiveTicket } from '../auth/live-tickets.js'
import type { GatewayEnv } from '../types.js'
import { forward } from './proxy.js'

const ROLES = ['Customer', 'Staff']
const bad = (c: { json: (b: object, s: 400) => Response }, error: string) => c.json({ error }, 400)

export const live = new Hono<GatewayEnv>()

/** A Caller's backend asks for a ticket naming one user (and, for a conversation, Ticket and role). */
live.post('/live-tickets', async (c) => {
  const body = await c.req.json().catch(() => null)
  const str = (v: unknown) =>
    typeof v === 'string' && v.length > 0 && v.length <= 128 ? v : undefined
  const userId = str(body?.userId)
  if (!userId) return bad(c, 'userId is required')
  const caller = c.get('caller')
  const app = caller.app ?? caller.name
  const isConversation = body.ticketId !== undefined || body.role !== undefined
  const ticketId = str(body.ticketId)
  if (isConversation && (!ticketId || !ROLES.includes(body.role)))
    return bad(c, 'ticketId and a valid role are required')
  const claims = isConversation ? { userId, app, ticketId, role: body.role } : { userId, app }
  return c.json(await issueLiveTicket(c.env.LIVE_TICKET_SECRET, claims))
})

/** Browsers hold no Caller key, so the ticket is the credential; checked before any upgrade. */
async function forwardLive(c: Parameters<typeof forward>[0], ticketId: string | undefined) {
  const claims = await verifyLiveTicket(c.env.LIVE_TICKET_SECRET, c.req.query('ticket'))
  const declaredUser = c.req.query('userId')
  if (
    !claims ||
    claims.ticketId !== ticketId ||
    (declaredUser !== undefined && declaredUser !== claims.userId)
  ) {
    return c.json({ error: 'invalid ticket' }, 401)
  }
  // The verified values replace anything the browser declared.
  const query = new URLSearchParams({ userId: claims.userId })
  if (claims.role) query.set('role', claims.role)
  else query.set('app', claims.app)
  return forward(c, {
    prefix: '/notifications',
    baseUrl: c.env.NOTIFICATIONS_URL,
    query,
    // The live routes take the gateway secret in place of the bearer token.
    headers: { 'X-Gateway-Secret': c.env.NOTIFICATIONS_GATEWAY_SECRET },
  })
}

live.get('/notifications/live', (c) => forwardLive(c, undefined))
live.get('/notifications/conversations/:ticketId/live', (c) =>
  forwardLive(c, c.req.param('ticketId')),
)
