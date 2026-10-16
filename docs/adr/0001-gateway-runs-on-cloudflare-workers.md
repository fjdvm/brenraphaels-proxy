# The gateway runs on Cloudflare Workers, not Vercel

Callers must reach notifications, file-storage and audit-logs through a single URL. Notifications serves real-time WebSocket routes (`/live`, `/conversations/:ticketId/live`) from Cloudflare Workers, and a Vercel function cannot proxy a WebSocket upgrade. Hosting the gateway on Vercel would have forced a second hostname for live connections, or replacing WebSockets with polling or SSE.

We host the gateway on Cloudflare Workers so one URL covers every route, WebSockets included. This departs from the original intent to deploy it on Vercel. The other services stay where they are; the gateway reaches them over the network.
