# Move the Portal and shared services to Azure Container Apps

Status: accepted; supersedes [ADR-0001](0001-gateway-runs-on-cloudflare-workers.md). Implementation is tracked in [Spec#138](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/138); recorded by [Ticket#140](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/140).

The Portal's Vercel Hobby team is paused until 2026-12-06. The owner has about $80 of Azure credit, subject to subscription verification, and a monthly budget below $20. Move the Portal, audit-logs, file-storage, api-gateway and notifications from Vercel and Cloudflare Workers to Azure Container Apps, together in one resource group and Container Apps Environment in Indonesia Central (Jakarta). Container Apps supports the persistent WebSockets that originally drove the gateway to Workers, so Callers can still use one gateway address for HTTP and live routes.

## Alternatives considered

Keep the current split across Vercel, Cloudflare and Azure: this avoids rewriting the Workers integrations but retains three hosts to operate and does not consolidate the shared services within the Azure credit. Waiting for the Vercel pause to end leaves the Portal unavailable in the meantime. Moving everything shared to Vercel still requires another solution for persistent WebSockets. Keeping the shared runtime entirely on Cloudflare preserves Durable Objects, Queues and the Workers rate limiter, but does not use the Azure credit or satisfy the chosen consolidation.

## Consequences

The gateway will run its Hono application as a Node service. Its Workers rate limiter becomes an in-memory per-instance, per-Caller limiter with the existing limit and period; it is not a globally coordinated limit across instances. The notifications service binding becomes an ordinary HTTPS call, while the gateway continues proxying WebSocket upgrades. Caller keys, hashes and existing secret names remain unchanged, so Callers change an address rather than credentials.

The move also requires replacing notifications' Durable Objects and Queues with in-memory WebSocket rooms and timer-based Email retries in a single Node service. This rewrite is the accepted cost of consolidation. Notifications' ADR-0005 records the resulting inability to scale out without Azure Web PubSub or Redis and its restart behavior.

Each repository will own its container image and deployment workflow. Neon Postgres and Neon Auth stay unchanged; ecommerce, hrms and creoms remain on Vercel. Cutover is staged, retaining old deployments for rollback until a quiet week has passed, and accepts one forced sign-out when the Portal moves. Stable service subdomains decouple callers from the host.

Azure credit is finite, and the below-$20 budget is a constraint rather than a verified cost guarantee. Subscription credit and pricing must be verified, with budget alerts and cost monitoring. Replica counts and sizing remain tuning settings in Spec#138, not a separate ADR.
