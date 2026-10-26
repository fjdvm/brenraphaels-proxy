# CREOMS Staff sync signal (fjdvm/epic-crms#244)

`POST /creoms/notifications/signal` accepts only a Caller whose trusted map entry
has `systemCode: ECOM`. Missing/invalid keys return 401; other Callers return
403 even if they spoof identity headers. The normal per-Caller rate limit
applies. This is a backend endpoint; browsers do not receive Caller keys.

Set Worker variable `CREOMS_URL` to CREOMS's HTTPS origin and Worker secret
`CREOMS_SIGNAL_SECRET` to the same dedicated random value (at least 32 characters)
as CREOMS. It is not the storefront Caller key or scheduler credential. Missing
configuration fails closed with 503.

The gateway POSTs `{}` to `/api/notifications/signal`, with only its dedicated
bearer credential, JSON content type and request id. Request body, query,
identity headers and storefront key are not forwarded. A signal cannot claim an
Order id, Customer name, event or recipient: CREOMS runs its own SQL sync and
uses its ledger. The response status is preserved; network/timeout/redirect
faults return 502. Callers should treat failure as best effort and never fail a
committed Order change because of it; CREOMS's five-second poll is the backstop.

The companion CREOMS PR adds the signal endpoint, schema upgrade, coalescing,
post-commit content-free nudge and Staff-only Live-ticket action. Merge/apply its
SQL and configure both ends before enabling the storefront sender (#246).
Staff bell consumption is #247. No notifications-service schema or new WebSocket
protocol is needed: CREOMS sends `creoms.staff.changed` for app `crms` and shared
user `creoms-staff`, and Staff connect through the existing `/notifications/live`
with a short-lived generic inbox Live ticket issued only after CREOMS's session
check. No event or Customer data appears in the nudge.

Tests drive the Hono app with hashed Caller keys and fake downstream fetch.
Live verification needs deployment access: signal as the storefront, observe one
new Orders alert, retry without duplication, and verify other Callers/missing
keys are refused. No Worker deployment or secrets are changed by this PR.
