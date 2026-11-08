## Problem Statement

The company's applications (CRMS, POS, IMS, HRMS, ECOM, the Portal) and its services (Authentication, file storage, notifications, audit-logs) each have to know three separate addresses, three different credential schemes and three sets of conventions to use the notifications, file-storage and audit-logs services. Services call each other the same way. Each service is also directly reachable on its own public address, so nothing enforces who may call it: file-storage trusts a plain `X-System-Code` header that anyone can forge, and the notifications live connections accept a declared, unverified user id.

## Solution

A single gateway with one URL. A Caller presents one gateway key and reaches all three services under `/notifications/*`, `/files/*` and `/audit/*`. The gateway identifies the Caller, applies one rate limit per Caller, tags each request with a request id, and forwards it to the right service using the credentials and identity that service expects. The services accept only gateway traffic. Browsers open live connections with a short-lived Live ticket that a Caller's backend obtains from the gateway. The gateway does not authenticate people; that stays in the authentication portal.

## User Stories

1. As a Caller, I want to reach notifications, file storage and audit-logs through one URL, so that I only configure and monitor one address.
2. As a Caller, I want to use a single gateway key for all three services, so that I do not hold three different credentials.
3. As a Caller, I want requests under `/notifications/*` to reach the notifications service, so that I can send emails and in-app notifications.
4. As a Caller, I want requests under `/files/*` to reach the file-storage service, so that I can request uploads, view, edit, link and delete files.
5. As a Caller, I want requests under `/audit/*` to reach the audit-logs service, so that I can record and read Audit Events.
6. As a Caller, I want the prefix removed before the request is forwarded, so that the services' own documented paths keep working unchanged.
7. As a Caller, I want a request to an unknown path to return a clear 404, so that I can tell a wrong path from a service error.
8. As a Caller, I want the downstream status code and body returned unchanged, so that I can rely on each service's own documentation.
9. As an operator, I want a `/health` route on the gateway, so that I can check the gateway is up without a key.
10. As a developer, I want each service's `/docs` and `/openapi.json` readable through the gateway without a key, so that I can read the API reference from the one address.
11. As a developer, I want `/mcp` on each service to need a Caller key, so that tool access is not open to the public.
12. As an operator, I want a request with a missing or wrong gateway key rejected with 401, so that unknown parties cannot use the services.
13. As an operator, I want a revoked Caller to be rejected on its next request, so that a leaked key stops working quickly.
14. As an operator, I want only a hash of each gateway key stored in the gateway, so that reading the configuration does not reveal a usable key.
15. As an operator, I want to add a new Caller by adding an entry to the Caller map, so that onboarding a new application needs no code change.
16. As an operator, I want each Caller mapped to the identity each service expects (Source, Client System code, App, audit key scope), so that a Caller cannot act as another Caller.
17. As the file-storage service, I want the gateway to set `X-System-Code` from the Caller map, so that a Caller cannot forge another Client System's identity.
18. As the file-storage service, I want to require the gateway secret on every API request, so that a direct call that skips the gateway is rejected.
19. As the notifications service, I want to receive the gateway's bearer token on every request, so that only the gateway can call it.
20. As the audit-logs service, I want the gateway to use the right API key and scope for each Caller, so that Administrator-only routes stay restricted to Callers that hold the Administrator scope.
21. As a Caller, I want any `Authorization` or `X-System-Code` header I send to be ignored and replaced, so that I cannot smuggle in a different identity.
22. As a service, I want to call another service through the gateway with my own Caller key, so that service-to-service traffic is checked and limited like all other traffic.
23. As the Authentication service, I want to upload files through the gateway, so that I use the same door as every other Caller.
24. As file-storage or notifications, I want to write Audit Events through the gateway, so that audit writes use the same door.
25. As an operator, I want one rate limit per Caller across all routes, so that a misbehaving Caller cannot flood the services.
26. As a Caller, I want a 429 response with a retry hint when I exceed my limit, so that I know to back off.
27. As an operator, I want audit-logs' own per-key limiter to remain, so that there is a second layer of protection.
28. As an operator, I want each request tagged with an `X-Request-Id`, so that I can trace one call from the gateway into a service's own log.
29. As a Caller, I want to supply my own request id and have it kept, so that I can correlate my logs with the gateway's.
30. As a Caller's backend, I want to ask the gateway for a Live ticket for one user, so that the user's browser can open a live connection without holding a gateway key.
31. As a Caller's backend, I want the Live ticket for a Ticket conversation to carry the Ticket id and the user's role, so that the browser can only join that conversation in that role.
32. As an end user's browser, I want to connect to `/notifications/live` with a ticket, so that I receive my notifications in real time.
33. As an end user's browser, I want to connect to `/notifications/conversations/:ticketId/live` with a ticket, so that I can take part in a Ticket conversation.
34. As the gateway, I want to reject a live connection with a missing, expired, tampered or wrong-user ticket before upgrading, so that no one can listen to another user's notifications.
35. As the gateway, I want a Live ticket to expire within about a minute, so that a leaked ticket is of little use.
36. As a Caller, I want a Live ticket to be requestable only with a valid Caller key, so that browsers cannot mint their own.
37. As a user, I want live connections to pass through the gateway as WebSockets, so that I only need the one address.
38. As an operator, I want file-storage's `/cron/cleanup` left off the gateway, so that the gateway never needs the cron secret.
39. As an operator, I want the three service addresses to be Worker variables, so that moving a service changes only configuration.
40. As a Caller, I want file uploads to go straight to storage through the presigned address, so that file bytes never pass through the gateway.
41. As a developer, I want the gateway to add no CORS handling, so that it stays a backend-to-backend door.
42. As a maintainer, I want the gateway to write no Audit Events of its own, so that audit traffic does not double and calls do not loop.
43. As an operator, I want a failure to reach a service to return a clear 502 or 504 with the request id, so that I can tell a gateway problem from a service problem.
44. As a maintainer, I want the gateway to hold no state beyond configuration and the rate limiter, so that it is easy to deploy and reason about.

## Implementation Decisions

- The gateway is a Hono app deployed as a Cloudflare Worker, recorded in ADR-0001 because Vercel cannot proxy WebSockets and one URL was required. The existing Vercel scaffold is replaced by Worker configuration.
- Routing: three prefixes (`/notifications`, `/files`, `/audit`) stripped before forwarding, plus the gateway's own `/health`. No version segment.
- Open routes: `/health`, and each service's `/docs` and `/openapi.json`. Everything else, including `/mcp`, needs a Caller key.
- Door check: a Caller sends its gateway key as a bearer credential. The gateway compares a hash of it, in constant time, against the Caller map held in Worker secrets. Revocation is by editing the map and redeploying.
- The Caller map holds, per Caller: the key hash, the Source name for audit-logs, the audit-logs API key to use and its scope, the Client System code for file-storage, and the App name for notifications.
- Outbound: the gateway removes the Caller's `Authorization` and `X-System-Code` headers and sets the downstream ones itself. notifications gets its shared bearer token. audit-logs gets the Caller's mapped API key. file-storage gets `X-System-Code` and the gateway secret.
- Service-to-service calls (Authentication, file storage, notifications as Callers) use the same door with their own Caller keys. No bypass.
- Rate limit: one limit per Caller across all routes, using Cloudflare's rate limiting binding. A rejected request gets 429 with a retry hint.
- Request id: the gateway adds `X-Request-Id` if absent, keeps a supplied one, forwards it, and returns it on every response, including gateway-generated errors.
- Live ticket: a Caller's backend calls an issuing route on the gateway, authenticated with its Caller key, naming the user (and, for conversations, the Ticket id and role). The gateway returns a signed ticket that expires in about 60 seconds. The two live routes verify the ticket before upgrading and replace the declared user parameters with the verified values when forwarding to notifications. notifications itself does not change.
- The live routes are the only gateway routes reachable by a browser. All other Callers are backends, so no CORS.
- file-storage change: require the gateway secret as a bearer credential on all API routes. `/cron/cleanup` keeps its own cron authentication and `/health`, `/docs` and `/openapi.json` stay open.
- Service addresses are Worker variables: notifications at its workers.dev address, file-storage and audit-logs at their Vercel addresses.
- `file-storage`'s `/cron/cleanup` is not routed. File bytes do not pass through the gateway because uploads use presigned storage addresses.
- The gateway writes no Audit Events. Failure to reach a service returns 502 or 504 with the request id.
- Authentication of people stays in `brenraphaels-authentication`. The gateway checks only which Caller is calling.
- Vocabulary follows `CONTEXT.md`: Caller and Live ticket. The services' own terms (Source, Client System, App) are used only for what the gateway sends to each.

## Testing Decisions

- A good test sends a request to the gateway and checks the response and what was sent downstream. It does not test internal functions.
- One seam: the gateway's HTTP interface, driven through the Hono app's `fetch`. Downstream services are replaced by stand-ins injected through the gateway's outbound `fetch`, and the rate limiter binding is stubbed.
- Covered through that seam: routing and prefix stripping, 404s, `/health`, the open and protected route split, 401 for missing, wrong and revoked keys, header replacement per Caller, the right downstream credential for each service, 429 handling, request id creation and forwarding, 502 and 504 on downstream failure, Live ticket issuing, and acceptance or rejection of valid, expired, tampered and wrong-user tickets on both live routes.
- The file-storage change is tested through file-storage's own existing HTTP tests: a request without the gateway secret is rejected, a request with it passes, and the cron and open routes are unaffected.
- Prior art: notifications tests its Hono app with Vitest, and file-storage and audit-logs have Vitest HTTP tests.

## Out of Scope

- Authenticating or authorising people. That stays in the authentication portal.
- Merging or reshaping responses across services (no BFF behaviour).
- CORS and browser access to anything except the two live routes.
- Gateway-written Audit Events.
- Per-service rate limits.
- Adding or revoking Callers without a redeploy.
- Routing file-storage's cron route.
- Replacing the WebSockets with polling or SSE.
- Making notifications private through a service binding. This is optional and can come later.

## Further Notes

- Corrections to earlier assumptions: the notifications live routes currently have no verification at all (the user id is declared, not verified), and file-storage's `X-System-Code` can be forged by anyone who can reach it. Both are closed by this work.
- The Caller map and the gateway secret are credentials and must be created by the operator and set as Worker secrets, not committed.
- ADR-0001 records the Cloudflare decision. The glossary is in `CONTEXT.md`.
