# api-gateway

One URL for notifications, file-storage and audit-logs, running as a Node service in a Docker image. See [ADR-0002](docs/adr/0002-move-portal-and-shared-services-to-azure-container-apps.md).

## Develop

Use Node 22 or later. Run `npm ci`, `npm test` and `npm run typecheck`. Copy `.env.production.example` to `.env.production` and supply the existing secrets. Start with `node --env-file=.env.production --import tsx src/index.ts`; `npm run dev` watches with environment variables already exported. For a compiled build, run `npm run build` and `node --env-file=.env.production dist/index.js`.

## Container

```sh
docker build -t gateway:test .
docker run --rm -p 8080:8080 --env-file .env.production gateway:test
curl http://localhost:8080/health
```

The image runs as the unprivileged `node` user and listens on `0.0.0.0:$PORT` (default 8080). `/health` is public and returns `{"status":"ok"}`. SIGTERM drains HTTP requests with a ten-second shutdown limit; live clients reconnect after shutdown. Logs include `x-request-id`, method, path and response status without ticket query strings or credentials.

## Configuration

`.env.production.example` lists runtime variables. Copy the **existing** `CALLERS` JSON, including its hashes and optional mappings (`app`, `systemCode`, `auditKey`, `auditScope`), and all existing secrets. Callers change only the gateway address. Add a Caller by adding an entry; revoke by removing it and restarting the service. A Caller without `auditKey` receives 403 on `/audit/*`; one without `systemCode` receives 403 on `/files`.

Notifications is reached using ordinary HTTP(S) at `NOTIFICATIONS_URL`; production uses HTTPS. Its ordinary routes use `NOTIFICATIONS_TOKEN`, and live routes use `NOTIFICATIONS_GATEWAY_SECRET`. `FILE_STORAGE_TOKEN` and `LIVE_TICKET_SECRET` keep their names and values too. There is no Workers service binding in the Node runtime. `CREOMS_URL` and `CREOMS_SIGNAL_SECRET` remain optional for the storefront Staff signal route.

The limiter allows 600 authenticated requests per Caller per 60-second fixed window shared across routes **in each instance**. Excess requests return 429 with `Retry-After: 60`. Public health/docs and ticket-authenticated live connections do not consume Caller limits. Counts reset on restart; replicas have independent limits. No database or credential migration is required.

## Docs and MCP

`GET /` (also `/ui`, `/docs`) is the gateway's documentation site: guides, an API reference built from the notifications and file-storage OpenAPI documents, and a Try it panel on every endpoint. It is open and holds no data; paste a Caller key into it and the key stays in the browser tab (session storage) and is sent only to this gateway.

`POST /mcp` is an MCP server (Streamable HTTP, stateless) for AI agents, authenticated with a Caller key. Its tools are generated from the same OpenAPI documents plus audit-logs, Live ticket and `gateway_request` tools, and each call runs as an ordinary gateway request with the Caller's own key.

```
claude mcp add --transport http gateway https://api-gateway.jude-nitram08.workers.dev/mcp \
  --header "Authorization: Bearer $CALLER_KEY"
```

## CI and rollout

`.github/workflows/ci.yml` typechecks, runs existing tests, builds the Docker image and runs `npm run test:container`. The smoke test requires Docker on Linux (host networking); it starts its own container and stubbed upstreams. It checks health, HTTP forwarding, Live ticket issue and WebSocket relay, credential rejection, 600 requests per Caller across routes, Caller isolation, 429/Retry-After, and recovery after the real 60-second window. It takes about one minute. Set `GATEWAY_IMAGE` or `SMOKE_PORT` to override the image or gateway port.

CI publishes to GHCR and deploys the gateway to Azure with min 1 / max 2 replicas after smoke tests pass. See the [Azure deployment guide](docs/deployment/azure.md) for secrets, probes, real-service verification and rollback. Production Callers keep their existing Cloudflare address until the separate cutover.

The old Cloudflare deployment stays available for rollback. Its entrypoint is retained in `src/worker.ts`, with `wrangler.jsonc` pointing there; manual redeployment uses `npm run deploy:worker` and the existing Cloudflare credentials/secrets. CI no longer automatically redeploys that Worker. Keep it serving until the staged cutover is verified and the quiet week in Spec#138 has passed.

### Staff stock (CREOMS #670)

CREOMS and the IMS ask `POST /live-tickets` for `{ "userId": "<signed-in User>", "channel": "staff-stock" }`
with their Caller key (only `systemCode: CRMS` or `IMS`; each checks the signed-in User first), so a
stock change reaches both apps' screens at once.
The browser connects to `/notifications/stock/staff/live?ticket=PASS`; other channels' tickets
cannot join. The IMS publishes `{ "sizeId" }` to `POST /notifications/stock/changed`; only
`systemCode: IMS` may, and everything else under `/notifications/stock/` is refused. Nothing is
stored or replayed.

### Staff Orders (Portal #174)

CREOMS checks the signed-in User is Staff and asks `POST /live-tickets` for
`{ "userId": "<signed-in User>", "channel": "staff-orders" }`, using its CRMS Caller key.
Only `systemCode: CRMS` can issue that channel. The browser connects to
`/notifications/orders/staff/live?ticket=PASS`. Tickets for Customer Orders,
inboxes or Conversations cannot join, and a mismatched declared userId is refused.
The gateway forwards only the verified User and the gateway secret to notifications.

Ecommerce publishes JSON `{}` to `POST /notifications/orders/changed` after commit.
Only `systemCode: ECOM` can publish; notifications rejects payload data. Each connected
Staff Orders socket receives `{ "type": "orders.changed" }`. Offline signals are
not stored or replayed. Refetch current Orders on connect and on the signal; log
publish failures without failing an already committed change. Notifications sends
protocol pings every 30 seconds and drops silent dead sockets within two intervals.
Browsers answer automatically, without heartbeat timers or periodic data requests.
