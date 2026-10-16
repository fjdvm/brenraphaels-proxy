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

`CALLERS` (Worker secret, never committed): JSON array of `{ "name": "...", "keyHash": "<sha256 hex of the Caller's key>" }`. Add a Caller by adding an entry; revoke by removing it and redeploying.

```
wrangler secret put CALLERS
```

## Deploy

```
npm run deploy
```

## CI/CD

`.github/workflows/ci.yml` typechecks and tests every push and pull request, and deploys on pushes to `main`. It needs the repository secrets `CLOUDFLARE_API_TOKEN` (Workers edit permission) and `CLOUDFLARE_ACCOUNT_ID`. The `CALLERS` Worker secret lives in Cloudflare, not in GitHub.
