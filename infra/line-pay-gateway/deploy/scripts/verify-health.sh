#!/usr/bin/env bash
set -euo pipefail

health_url="${1:-http://127.0.0.1:3000/health}"

case "$health_url" in
  http://127.0.0.1:*/* | http://localhost:*/*)
    ;;
  *)
    echo "Health verification is restricted to an explicit localhost HTTP URL." >&2
    exit 2
    ;;
esac

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
