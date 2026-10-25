# Customer Order live channel

For fjdvm/epic-crms#229. Merge and deploy the notifications companion before this gateway change.

The storefront's Caller entry in `CALLERS` must have `systemCode: "ECOM"`. The gateway uses that trusted identity, never a body field, to authorize issuing Order Live tickets and publishing events.

1. The storefront backend checks the Customer's session and requests `POST /live-tickets` with its Caller key and `{ "userId": "customer-1", "channel": "orders" }`. The response is `{ ticket, expiresIn: 60 }`.
2. Hand the pass to that Customer's browser. Open `wss://<gateway>/notifications/orders/live?ticket=<pass>` within 60 seconds. The pass is scoped to Orders and cannot open the bell or a Conversation; the gateway replaces the query with the verified Customer. An optional declared `userId` must match.
3. After committing an Order change or Return decision, publish with the storefront Caller key to `POST /notifications/orders/events`:

```json
{ "customerId": "customer-1", "event": { "type": "order.updated", "orderId": "order-1" } }
```

For a Return use `{ "type": "return.updated", "orderId": "order-1", "returnId": "return-1" }` in `event`. These are invalidation signals; no Order details travel over the socket. The response `{ connected }` counts reached sockets, including multiple tabs. Offline events are dropped, so refetch Orders on connect/reconnect. Log publish failures without failing a committed change. The next storefront ticket owns publishing and browser handling.

## Verification

`test/orders.test.ts` exercises issuance, Caller restrictions, Customer and channel mismatch, expiration, forgery, and publishing through HTTP. Notifications tests exercise the real relay with the existing fake Durable Object socket boundary.

After both PRs deploy, manually request a pass through the deployed gateway with the storefront Caller key, open sockets for two Customers, publish the example, and confirm only customer-1 receives it. Confirm a mismatched userId is refused and an event published before connecting is never replayed. This deployed check remains a post-merge acceptance step.
