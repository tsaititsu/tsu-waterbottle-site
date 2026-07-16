#!/usr/bin/env bash
set -euo pipefail

domain="${1:-}"

if [[ -z "$domain" ]]; then
  echo "Usage: $0 <gateway-domain>" >&2
  exit 2
fi

if [[ "$domain" == *example.com* ]]; then
  echo "Refusing to verify a placeholder example.com domain." >&2
  exit 2
fi

if [[ ! "$domain" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$ ]]; then
  echo "Domain must be a hostname without scheme, path, query, fragment, credentials, or port." >&2
  exit 2
fi

if ! openssl s_client -connect "${domain}:443" -servername "$domain" </dev/null 2>/dev/null \
  | openssl x509 -checkend 0 -noout >/dev/null; then
  echo "TLS certificate validation failed." >&2
  exit 1
fi

https_status="$(
  curl \
    --fail \
    --silent \
    --show-error \
    --max-time 10 \
    --output /dev/null \
    --write-out '%{http_code}' \
    "https://${domain}/health"
)"

if [[ "$https_status" != "200" ]]; then
  echo "HTTPS health check returned status $https_status instead of 200." >&2
  exit 1
fi

redirect_result="$(
  curl \
    --silent \
    --show-error \
    --max-time 10 \
    --output /dev/null \
    --write-out '%{http_code}\n%{redirect_url}' \
    "http://${domain}/health"
)"
redirect_status="${redirect_result%%$'\n'*}"
redirect_url="${redirect_result#*$'\n'}"

case "$redirect_status" in
  301 | 302 | 307 | 308)
    ;;
  *)
    echo "HTTP endpoint did not return a redirect status." >&2
    exit 1
    ;;
esac

if [[ "$redirect_url" != "https://${domain}/health" ]]; then
  echo "HTTP redirect target is not the expected HTTPS health URL." >&2
  exit 1
fi

echo "TLS certificate, HTTPS health, and HTTP-to-HTTPS redirect verified for $domain."
