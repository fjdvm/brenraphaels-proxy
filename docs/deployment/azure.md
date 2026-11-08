# Gateway on Azure

This is the parallel deployment for Portal Ticket#159 in Spec#138. The Cloudflare
Worker keeps serving real traffic. No database migration or Caller key rotation is
needed. Repointing Callers and retiring Workers are separate cutover steps.

## Delivery

On every push to main, CI typechecks, runs the existing suite, builds the image and
smoke-tests its HTTP/WebSocket interface against disposable upstreams. Only then
it publishes `ghcr.io/fjdvm/brenraphaels-proxy:<commit>` and `:latest`, signs into
Azure with OIDC, and runs `scripts/azure-deploy.sh`.

The script creates or updates `api-gateway` in `rg-brenraphaels`, environment
`cae-brenraphaels` (Indonesia Central). It uses 0.25 vCPU / 0.5 GiB, min 1 / max 2
replicas, external HTTPS ingress to port 8080, and startup, readiness and liveness
HTTP probes on `/health`. It points to `https://audit.buildwrite.me`,
`https://files.buildwrite.me` and `https://notifications.buildwrite.me`.

GitHub secrets required before merging:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`: the existing
  deployment identity, scoped to this resource group, federated for this repo's main.
- `GHCR_PULL_TOKEN`: existing classic token with only `read:packages`.
- `CALLERS`: exact existing JSON including all hashes, audit keys and mappings.
- `FILE_STORAGE_TOKEN`, `NOTIFICATIONS_TOKEN`, `NOTIFICATIONS_GATEWAY_SECRET`,
  `LIVE_TICKET_SECRET`: exact existing values.
- Optional `CREOMS_SIGNAL_SECRET`, paired with repository variable `CREOMS_URL`,
  for the Staff signal route. Leave both unset if the route is disabled.

Repository variable `GHCR_USERNAME` names the package owner. Secrets become
Container Apps secret references, never image layers. The runtime variable list
is `.env.production.example`. CI checks deployed health and replica settings.
No workflow deploys or changes Cloudflare.

OIDC provisioning and GHCR token setup are shared with Portal Ticket#141. Azure's
[GitHub Actions guide](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
describes the delivery model. If credentials expire, renew the existing pull token
in GitHub secrets and redeploy; do not rotate Caller keys as part of hosting changes.

## Verify before cutover

Obtain the app's HTTPS address:

```sh
az containerapp show -n api-gateway -g rg-brenraphaels \
  --query properties.configuration.ingress.fqdn -o tsv
```

With an operator-only env file containing the **existing** `CALLER_KEY_PORTAL` and
`CALLER_KEY_PORTAL_AUDIT_READER` (write:Authentication and read:admin mappings):

```sh
SMOKE_URL=https://<fqdn> node --env-file=/secure/path/gateway.env scripts/smoke-deployed.mjs
```

This verifies health, audit write/readback, a private temporary Pending File upload
request, a Notification to a synthetic recipient, and Live ticket conversation
message relay between two WebSockets. It writes a labelled synthetic audit event
and Notification; no real person receives a message or Email. No object is uploaded;
the nightly cleanup expires the Pending File. It prints no credentials or signed
storage URLs. Run it explicitly after a deployment rather than writing synthetic
production records on every CI push.

Inspect revision health and replica count:

```sh
az containerapp revision list -n api-gateway -g rg-brenraphaels \
  --query '[].{revision:name,health:properties.healthState,active:properties.active}' -o table
az containerapp replica list -n api-gateway -g rg-brenraphaels -o table
```

## Cutover and rollback

Keep the current Cloudflare address configured in production Callers throughout
this ticket. Before the later cutover, add the `api.buildwrite.me` CNAME at Namecheap
to the Azure FQDN, then bind the hostname with an Azure-managed certificate (use
Azure's displayed domain verification record). Change only Caller base URLs after
verification in the Spec#138 order; preserve all keys. The domain is an ingress
binding, never a hard-coded service origin.

If Azure verification fails, keep traffic on Cloudflare and fix the revision. After
cutover, rollback is restoring the old Caller base URL. Redeploying a prior main
commit restores its immutable GHCR image; retain images and revisions through the
quiet week. Observe the shared $15/$20 budget alerts set up in Ticket#139; this
warm replica adds to the shared resource group's usage.
