# api-gateway

One URL for the notifications, file-storage and audit-logs services, running as a Cloudflare Worker (see `docs/adr/0001-gateway-runs-on-cloudflare-workers.md`).

## Develop

```
npm install
npm test
npm run typecheck
npm run dev
```

## Configuration

`CALLERS` (Worker secret, never committed): JSON array of `{ "name": "...", "keyHash": "<sha256 hex of the Caller's key>" }`. Optional per Caller: `"auditKey"` (its audit-logs API key, which carries the scope) and `"auditScope"`; a Caller without `auditKey` gets 403 on `/audit/*`. Add a Caller by adding an entry; revoke by removing it and redeploying.

```
wrangler secret put CALLERS
```

Other Worker secrets: `FILE_STORAGE_TOKEN` (file-storage's `GATEWAY_SECRET`), `NOTIFICATIONS_TOKEN` (notifications' `API_TOKEN`), `NOTIFICATIONS_GATEWAY_SECRET` (notifications' `GATEWAY_SECRET`, sent as `X-Gateway-Secret` on the live routes) and `LIVE_TICKET_SECRET`. Set each with `printf '%s' "$VALUE" | wrangler secret put NAME`; the matching value must be set on the service too.

Production: https://api-gateway.jude-nitram08.workers.dev

## Docs and MCP

`GET /` (also `/ui`, `/docs`) is the gateway's documentation site: guides, an API reference built from the notifications and file-storage OpenAPI documents, and a Try it panel on every endpoint. It is open and holds no data; paste a Caller key into it and the key stays in the browser tab (session storage) and is sent only to this gateway.

`POST /mcp` is an MCP server (Streamable HTTP, stateless) for AI agents, authenticated with a Caller key. Its tools are generated from the same OpenAPI documents plus audit-logs, Live ticket and `gateway_request` tools, and each call runs as an ordinary gateway request with the Caller's own key.

```
claude mcp add --transport http gateway https://api-gateway.jude-nitram08.workers.dev/mcp \
  --header "Authorization: Bearer $CALLER_KEY"
```

## Deploy

```
npm run deploy
```

## CI/CD

`.github/workflows/ci.yml` typechecks and tests every push and pull request, and deploys on pushes to `main`. It needs the repository secrets `CLOUDFLARE_API_TOKEN` (Workers edit permission) and `CLOUDFLARE_ACCOUNT_ID`. The `CALLERS` Worker secret lives in Cloudflare, not in GitHub.
