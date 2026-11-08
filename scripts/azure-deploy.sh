#!/usr/bin/env bash
# Deploy the Node gateway without changing the retained Cloudflare Worker.
set -euo pipefail

RG="${AZURE_RESOURCE_GROUP:-rg-brenraphaels}"
ENV_NAME="${AZURE_CONTAINERAPPS_ENV:-cae-brenraphaels}"
APP="${AZURE_APP_NAME:-api-gateway}"

for v in IMAGE GHCR_USERNAME GHCR_PULL_TOKEN CALLERS FILE_STORAGE_TOKEN NOTIFICATIONS_TOKEN NOTIFICATIONS_GATEWAY_SECRET LIVE_TICKET_SECRET; do
  [ -n "${!v:-}" ] || { echo "Missing required value: $v" >&2; exit 1; }
done
SECRETS=("callers=$CALLERS" "file-storage-token=$FILE_STORAGE_TOKEN"
  "notifications-token=$NOTIFICATIONS_TOKEN" "notifications-gateway-secret=$NOTIFICATIONS_GATEWAY_SECRET"
  "live-ticket-secret=$LIVE_TICKET_SECRET" "ghcr-pull-token=$GHCR_PULL_TOKEN")
if [ -n "${CREOMS_SIGNAL_SECRET:-}" ]; then SECRETS+=("creoms-signal-secret=$CREOMS_SIGNAL_SECRET"); fi

if az containerapp show -n "$APP" -g "$RG" >/dev/null 2>&1; then
  az containerapp secret set -n "$APP" -g "$RG" --secrets "${SECRETS[@]}" >/dev/null
  az containerapp registry set -n "$APP" -g "$RG" --server ghcr.io \
    --username "$GHCR_USERNAME" --password "$GHCR_PULL_TOKEN" >/dev/null
  az containerapp update -n "$APP" -g "$RG" --image "$IMAGE" \
    --min-replicas 1 --max-replicas 2 --cpu 0.25 --memory 0.5Gi \
    >/dev/null
else
  az containerapp create -n "$APP" -g "$RG" --environment "$ENV_NAME" --image "$IMAGE" \
    --registry-server ghcr.io --registry-username "$GHCR_USERNAME" \
    --registry-password "$GHCR_PULL_TOKEN" \
    --ingress external --target-port 8080 --transport auto \
    --min-replicas 1 --max-replicas 2 --cpu 0.25 --memory 0.5Gi \
    --secrets "${SECRETS[@]}" \
    --env-vars PORT=8080 AUDIT_LOGS_URL=https://audit.buildwrite.me \
      FILE_STORAGE_URL=https://files.buildwrite.me NOTIFICATIONS_URL=https://notifications.buildwrite.me \
      CALLERS=secretref:callers FILE_STORAGE_TOKEN=secretref:file-storage-token \
      NOTIFICATIONS_TOKEN=secretref:notifications-token \
      NOTIFICATIONS_GATEWAY_SECRET=secretref:notifications-gateway-secret \
      LIVE_TICKET_SECRET=secretref:live-ticket-secret >/dev/null
fi

# Env vars and health probes (startup, liveness, readiness) on /health. They need YAML; the
# exported app template holds no secret values (only secretref names).
YAML=$(mktemp)
trap 'rm -f "$YAML"' EXIT
az containerapp show -n "$APP" -g "$RG" -o json > "$YAML"
python3 - "$YAML" <<'PY'
import json, sys
path = sys.argv[1]
import os
app = json.load(open(path))
env = os.environ
plain = {"PORT": "8080", "AUDIT_LOGS_URL": "https://audit.buildwrite.me",
         "FILE_STORAGE_URL": "https://files.buildwrite.me",
         "NOTIFICATIONS_URL": "https://notifications.buildwrite.me"}
if env.get("CREOMS_URL"): plain["CREOMS_URL"] = env["CREOMS_URL"]
refs = {"CALLERS": "callers", "FILE_STORAGE_TOKEN": "file-storage-token",
        "NOTIFICATIONS_TOKEN": "notifications-token",
        "NOTIFICATIONS_GATEWAY_SECRET": "notifications-gateway-secret",
        "LIVE_TICKET_SECRET": "live-ticket-secret"}
if env.get("CREOMS_SIGNAL_SECRET"): refs["CREOMS_SIGNAL_SECRET"] = "creoms-signal-secret"
app["properties"]["template"]["containers"][0]["env"] = (
    [{"name": k, "value": v} for k, v in plain.items()]
    + [{"name": k, "secretRef": v} for k, v in refs.items()])
def probe(kind, **kw):
    return {"type": kind, "httpGet": {"path": "/health", "port": 8080, "scheme": "HTTP"},
            "timeoutSeconds": 5, **kw}
app["properties"]["template"]["containers"][0]["probes"] = [
    probe("Startup", periodSeconds=5, failureThreshold=30, initialDelaySeconds=2),
    probe("Liveness", periodSeconds=30, failureThreshold=3, initialDelaySeconds=10),
    probe("Readiness", periodSeconds=10, failureThreshold=3, initialDelaySeconds=2),
]
json.dump(app, open(path, "w"))
PY
az containerapp update -n "$APP" -g "$RG" --yaml "$YAML" >/dev/null

FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
echo "Deployed https://$FQDN"
echo "fqdn=$FQDN" >> "${GITHUB_OUTPUT:-/dev/null}"
