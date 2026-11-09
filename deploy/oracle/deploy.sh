#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
DOMAIN=${1:?Usage: bash deploy/oracle/deploy.sh your-domain}
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$ ]]; then echo 'Provide hostname without protocol or path'; exit 1; fi
umask 077
if [ ! -f .env.production ]; then
  printf 'DOMAIN=%s\nDB_PASSWORD=%s\n' "$DOMAIN" "$(openssl rand -hex 32)" > .env.production
else
  configured=$(sed -n 's/^DOMAIN=//p' .env.production)
  if [ "$configured" != "$DOMAIN" ]; then echo 'Existing DOMAIN differs. Review .env.production before deploying.'; exit 1; fi
fi
docker compose --env-file .env.production -f compose.prod.yaml config --quiet
docker compose --env-file .env.production -f compose.prod.yaml up --build -d
for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error "https://$DOMAIN/api/csrf" >/dev/null 2>&1; then
    printf 'Ready: https://%s\n' "$DOMAIN"
    exit 0
  fi
  sleep 5
done
echo 'HTTPS not ready; inspect DNS, OCI ingress rules, host firewall and gateway/backend logs.'
docker compose --env-file .env.production -f compose.prod.yaml ps
exit 1
