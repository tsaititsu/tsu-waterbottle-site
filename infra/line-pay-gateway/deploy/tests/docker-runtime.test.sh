#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd -- "$test_dir/.." && pwd)"
compose_wrapper="$deploy_dir/scripts/compose.sh"
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/line-pay-gateway-runtime.XXXXXX")"
gateway_env_file="$runtime_dir/gateway.env"
proxy_env_file="$runtime_dir/proxy.env"
gateway_bind_port="${GATEWAY_RUNTIME_PORT:-3000}"
gateway_image_tag="${GATEWAY_IMAGE_TAG:?GATEWAY_IMAGE_TAG must be a full commit SHA}"
gateway_hmac_secret="runtime-test-hmac-secret-never-production"
proxy_token="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

cleanup() {
  set +e
  GATEWAY_IMAGE_TAG="$gateway_image_tag" \
  LINE_PAY_GATEWAY_ENV_FILE="$gateway_env_file" \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE="$proxy_env_file" \
  GATEWAY_BIND_PORT="$gateway_bind_port" \
    "$compose_wrapper" down --remove-orphans >/dev/null 2>&1
  [[ ! -f "$gateway_env_file" ]] || unlink "$gateway_env_file"
  [[ ! -f "$proxy_env_file" ]] || unlink "$proxy_env_file"
  rmdir "$runtime_dir" 2>/dev/null || true
}
trap cleanup EXIT

umask 077
printf '%s\n' \
  'PORT=3000' \
  'LINE_PAY_GATEWAY_ENV=sandbox' \
  'LINE_PAY_GATEWAY_KEY_ID=runtime-test-key' \
  "LINE_PAY_GATEWAY_SECRET=$gateway_hmac_secret" \
  'LINE_PAY_UPSTREAM_TIMEOUT_MS=100' \
  'GATEWAY_TIMESTAMP_TOLERANCE_SECONDS=60' \
  'GATEWAY_REPLAY_TTL_SECONDS=120' \
  'GATEWAY_RATE_LIMIT_WINDOW_MS=60000' \
  'GATEWAY_RATE_LIMIT_MAX=1' \
  >"$gateway_env_file"
printf 'LINE_PAY_GATEWAY_PROXY_TOKEN=%s\n' "$proxy_token" >"$proxy_env_file"

docker image inspect "line-pay-fixed-ip-gateway:$gateway_image_tag" >/dev/null

GATEWAY_IMAGE_TAG="$gateway_image_tag" \
LINE_PAY_GATEWAY_ENV_FILE="$gateway_env_file" \
LINE_PAY_GATEWAY_PROXY_ENV_FILE="$proxy_env_file" \
GATEWAY_BIND_PORT="$gateway_bind_port" \
  "$compose_wrapper" up -d --no-build gateway

container_id="$(
  GATEWAY_IMAGE_TAG="$gateway_image_tag" \
  LINE_PAY_GATEWAY_ENV_FILE="$gateway_env_file" \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE="$proxy_env_file" \
  GATEWAY_BIND_PORT="$gateway_bind_port" \
    "$compose_wrapper" ps -q gateway
)"
[[ -n "$container_id" ]] || {
  echo "Gateway container did not start." >&2
  exit 1
}

network_mode="$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_id")"
[[ "$network_mode" != "host" ]] || {
  echo "Gateway container unexpectedly uses host network." >&2
  exit 1
}
published_host_ip="$(
  docker inspect \
    --format '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostIp}}' \
    "$container_id"
)"
[[ "$published_host_ip" == "127.0.0.1" ]] || {
  echo "Gateway application port is not bound to host localhost." >&2
  exit 1
}

for _attempt in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${gateway_bind_port}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl --fail --silent --show-error "http://127.0.0.1:${gateway_bind_port}/health" >/dev/null

GATEWAY_RUNTIME_ORIGIN="http://127.0.0.1:${gateway_bind_port}" \
GATEWAY_RUNTIME_HMAC_SECRET="$gateway_hmac_secret" \
GATEWAY_RUNTIME_PROXY_TOKEN="$proxy_token" \
  node "$test_dir/docker-runtime.test.mjs"
