#!/usr/bin/env bash
set -euo pipefail

ss_command="${SS_COMMAND:-ss}"
docker_command="${DOCKER_COMMAND:-docker}"
curl_command="${CURL_COMMAND:-curl}"
gateway_bind_port="${GATEWAY_BIND_PORT:-3000}"
gateway_container_name="${GATEWAY_CONTAINER_NAME:-line-pay-gateway-sandbox-gateway-1}"
gateway_health_url="${GATEWAY_HEALTH_URL:-http://127.0.0.1:${gateway_bind_port}/health}"

fail() {
  echo "Network preflight failed: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

usage() {
  printf '%s\n' \
    'Usage:' \
    '  preflight-network.sh prepare' \
    '  preflight-network.sh gateway-running' \
    '  preflight-network.sh public-caddy pre-start' \
    '  preflight-network.sh public-caddy post-start'
}

listeners_for_port() {
  local listeners="$1"
  local port="$2"

  awk -v expected_port="$port" '$4 ~ (":" expected_port "$")' <<<"$listeners"
}

require_port_free() {
  local listeners="$1"
  local port="$2"

  if [[ -n "$(listeners_for_port "$listeners" "$port")" ]]; then
    fail "TCP port $port must be free in this preflight phase"
  fi
  pass "TCP port $port is free"
}

require_gateway_localhost_listener() {
  local listeners="$1"
  local port_lines

  port_lines="$(listeners_for_port "$listeners" "$gateway_bind_port")"
  [[ -n "$port_lines" ]] || fail "Gateway is not listening on 127.0.0.1:${gateway_bind_port}"
  if awk -v expected="127.0.0.1:${gateway_bind_port}" '$4 != expected { invalid = 1 } END { exit invalid ? 0 : 1 }' \
    <<<"$port_lines"
  then
    fail "Gateway port ${gateway_bind_port} must listen only on IPv4 localhost"
  fi
  pass "Gateway port ${gateway_bind_port} listens only on IPv4 localhost"
}

require_gateway_healthy() {
  local health_status health_body

  health_status="$("$docker_command" inspect --format '{{.State.Health.Status}}' "$gateway_container_name")" \
    || fail "unable to inspect Gateway container health"
  [[ "$health_status" == "healthy" ]] || fail "Gateway container health is not healthy"

  health_body="$("$curl_command" --fail --silent --show-error --max-time 5 "$gateway_health_url")" \
    || fail "Gateway localhost health endpoint failed"
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"healthy"' <<<"$health_body" \
    || fail "Gateway localhost health response is invalid"
  pass "Gateway container and localhost health are healthy"
}

require_caddy_listener() {
  local listeners="$1"
  local port="$2"
  local port_lines

  port_lines="$(listeners_for_port "$listeners" "$port")"
  [[ -n "$port_lines" ]] || fail "Caddy is not listening on TCP port $port"
  if grep -Fvq '"caddy"' <<<"$port_lines"; then
    fail "TCP port $port is not exclusively identified as Caddy"
  fi
  pass "Caddy is listening on TCP port $port"
}

require_admin_loopback_only() {
  local listeners="$1"
  local port_lines address

  port_lines="$(listeners_for_port "$listeners" 2019)"
  [[ -z "$port_lines" ]] && {
    pass "Caddy admin port 2019 is not listening"
    return
  }

  while IFS= read -r address; do
    case "$address" in
      127.0.0.1:2019|\[::1\]:2019)
        ;;
      *)
        fail "Caddy admin port 2019 must be absent or loopback-only"
        ;;
    esac
  done < <(awk '{ print $4 }' <<<"$port_lines")
  pass "Caddy admin port 2019 is loopback-only"
}

main() {
  local mode="${1:-}"
  local phase="${2:-}"
  local listeners

  case "$mode" in
    prepare|gateway-running)
      [[ $# -eq 1 ]] || {
        usage >&2
        exit 2
      }
      ;;
    public-caddy)
      [[ $# -eq 2 && ("$phase" == "pre-start" || "$phase" == "post-start") ]] || {
        usage >&2
        exit 2
      }
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac

  [[ "$gateway_bind_port" =~ ^[0-9]+$ ]] || fail "GATEWAY_BIND_PORT must be numeric"
  ((gateway_bind_port >= 1024 && gateway_bind_port <= 65535)) \
    || fail "GATEWAY_BIND_PORT is outside the allowed range"

  listeners="$("$ss_command" -H -ltnp)" || fail "unable to inspect TCP listeners"

  case "$mode" in
    prepare)
      require_port_free "$listeners" 80
      require_port_free "$listeners" 443
      require_port_free "$listeners" "$gateway_bind_port"
      ;;
    gateway-running)
      require_port_free "$listeners" 80
      require_port_free "$listeners" 443
      require_gateway_localhost_listener "$listeners"
      require_gateway_healthy
      ;;
    public-caddy)
      require_gateway_localhost_listener "$listeners"
      require_gateway_healthy
      require_admin_loopback_only "$listeners"
      if [[ "$phase" == "pre-start" ]]; then
        require_port_free "$listeners" 80
        require_port_free "$listeners" 443
      else
        require_caddy_listener "$listeners" 80
        require_caddy_listener "$listeners" 443
      fi
      ;;
  esac
}

main "$@"
