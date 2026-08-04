#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
gateway_root="$(cd -- "$script_dir/../.." && pwd)"
production_compose_file="$gateway_root/deploy/compose.production.yaml"

[[ -f "$production_compose_file" ]] || {
  echo "FAIL: Production Compose overlay is missing: $production_compose_file" >&2
  exit 1
}

production_environment_count="$({
  grep -Ec '^[[:space:]]+LINE_PAY_GATEWAY_ENV:[[:space:]]+production$' \
    "$production_compose_file" || true
})"
[[ "$production_environment_count" == "1" ]] || {
  echo "FAIL: Production Compose overlay must pin exactly one production environment." >&2
  exit 1
}

if grep -Eq 'LINE_PAY_GATEWAY_ENV:[[:space:]]+sandbox' "$production_compose_file"; then
  echo "FAIL: Production Compose overlay must not select Sandbox." >&2
  exit 1
fi

export EXPECTED_GATEWAY_ENVIRONMENT=production
exec "$script_dir/preflight.sh" "$@"
