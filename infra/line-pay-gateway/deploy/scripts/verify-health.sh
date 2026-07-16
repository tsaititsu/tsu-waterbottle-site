#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
health_url="${1:-http://127.0.0.1:3000/health}"

# shellcheck source=validators.sh
source "$script_dir/validators.sh"

validate_local_health_url "$health_url"

response="$(
  curl \
    --fail \
    --silent \
    --show-error \
    --max-time 5 \
    "$health_url"
)"
compact_response="$(printf '%s' "$response" | tr -d '[:space:]')"

if [[ "$compact_response" != '{"ok":true,"status":"healthy"}' ]]; then
  echo "Gateway health response did not match the expected safe payload." >&2
  exit 1
fi

echo "Gateway localhost health verified."
