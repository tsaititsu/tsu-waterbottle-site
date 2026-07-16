#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
env_file="${GATEWAY_ENV_FILE:-/etc/line-pay-gateway/gateway.env}"
caddyfile="${CADDYFILE:-/etc/caddy/Caddyfile}"
expected_egress_ip="${EXPECTED_EGRESS_IP:-}"
gateway_bind_port="${GATEWAY_BIND_PORT:-3000}"
gateway_image_name="${GATEWAY_IMAGE_NAME:-line-pay-fixed-ip-gateway}"
gateway_image_tag="${GATEWAY_IMAGE_TAG:-}"
gateway_domain="linepay-gateway.tsu-waterbottle.com"
minimum_memory_kib="${MINIMUM_MEMORY_KIB:-524288}"
minimum_disk_kib="${MINIMUM_DISK_KIB:-2097152}"

# shellcheck source=validators.sh
source "$script_dir/validators.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is missing: $1"
  pass "command is available: $1"
}

read_env_value() {
  local key="$1"
  awk -v expected_key="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      separator = index($0, "=")
      if (separator == 0) next
      key = substr($0, 1, separator - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      if (key == expected_key) {
        count += 1
        value = substr($0, separator + 1)
      }
    }
    END {
      if (count != 1) exit 2
      print value
    }
  ' "$env_file"
}

check_port_free() {
  local port="$1"
  if ss -H -ltn | awk -v port="$port" '$4 ~ (":" port "$") { found = 1 } END { exit found ? 0 : 1 }'; then
    fail "TCP port $port is already listening; identify the owner before continuing"
  fi
  pass "TCP port $port is available"
}

[[ "$(uname -s)" == "Linux" ]] || fail "host is not Linux"
pass "host kernel is Linux"

[[ -r /etc/os-release ]] || fail "/etc/os-release is unavailable"
os_id="$(awk -F= '$1 == "ID" { gsub(/"/, "", $2); print $2 }' /etc/os-release)"
os_version="$(awk -F= '$1 == "VERSION_ID" { gsub(/"/, "", $2); print $2 }' /etc/os-release)"
[[ "$os_id" == "ubuntu" ]] || fail "host distribution is not Ubuntu"
[[ "$os_version" == "24.04" ]] || fail "host Ubuntu version is not 24.04"
pass "Ubuntu 24.04 verified"

cpu_count="$(getconf _NPROCESSORS_ONLN)"
((cpu_count >= 1)) || fail "no online CPU detected"
pass "CPU count: $cpu_count"

memory_kib="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
[[ "$memory_kib" =~ ^[0-9]+$ ]] || fail "unable to read total memory"
((memory_kib >= minimum_memory_kib)) || fail "memory is below the minimum ${minimum_memory_kib} KiB"
pass "memory is at least ${minimum_memory_kib} KiB"

disk_kib="$(df -Pk / | awk 'NR == 2 { print $4 }')"
[[ "$disk_kib" =~ ^[0-9]+$ ]] || fail "unable to read root filesystem capacity"
((disk_kib >= minimum_disk_kib)) || fail "free disk is below the minimum ${minimum_disk_kib} KiB"
pass "free disk is at least ${minimum_disk_kib} KiB"

for command_name in awk curl docker openssl ss stat; do
  require_command "$command_name"
done
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is unavailable"
pass "Docker Compose plugin is available"
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable or the operator lacks permission"
pass "Docker daemon is reachable"

validate_release_inputs "$gateway_image_name" "$gateway_image_tag"
pass "Gateway image name and full commit SHA are valid"

[[ -f "$env_file" ]] || fail "Gateway env file is missing: $env_file"
[[ ! -L "$env_file" ]] || fail "Gateway env file must not be a symbolic link"
[[ "$(stat -c '%a' "$env_file")" == "600" ]] || fail "Gateway env file mode must be 600"
[[ "$(stat -c '%U' "$env_file")" == "root" ]] || fail "Gateway env file owner must be root"
pass "Gateway env file owner and mode are correct"

required_env_names=(
  PORT
  LINE_PAY_GATEWAY_ENV
  LINE_PAY_GATEWAY_KEY_ID
  LINE_PAY_GATEWAY_SECRET
  LINE_PAY_UPSTREAM_TIMEOUT_MS
  GATEWAY_TIMESTAMP_TOLERANCE_SECONDS
  GATEWAY_REPLAY_TTL_SECONDS
  GATEWAY_RATE_LIMIT_WINDOW_MS
  GATEWAY_RATE_LIMIT_MAX
)

for env_name in "${required_env_names[@]}"; do
  if ! env_value="$(read_env_value "$env_name")"; then
    fail "env file must contain exactly one $env_name assignment"
  fi
  [[ -n "$env_value" ]] || fail "$env_name is empty"
  if [[ "$env_value" == replace-with-* ]]; then
    fail "$env_name still contains an example placeholder"
  fi
done
pass "all required Gateway environment variables exist without displaying their values"

gateway_environment="$(read_env_value LINE_PAY_GATEWAY_ENV)"
[[ "$gateway_environment" == "sandbox" ]] || fail "Gateway environment must be sandbox and must never be production in Phase 2A"
pass "Gateway environment is sandbox"

gateway_port="$(read_env_value PORT)"
[[ "$gateway_port" == "3000" ]] || fail "Gateway container PORT must be 3000 for the reviewed Compose and Caddy configuration"
[[ "$gateway_bind_port" =~ ^[0-9]+$ ]] || fail "GATEWAY_BIND_PORT is invalid"
((gateway_bind_port >= 1024 && gateway_bind_port <= 65535)) || fail "GATEWAY_BIND_PORT is outside the allowed range"

[[ -f "$caddyfile" ]] || fail "Caddyfile is missing: $caddyfile"
grep -Eq "^${gateway_domain//./\\.}[[:space:]]*\\{" "$caddyfile" \
  || fail "Caddyfile must use the approved Sandbox domain: $gateway_domain"
if grep -Eqi 'LINE_PAY_GATEWAY_SECRET|X-Gateway-Signature|X-LINE-Authorization' "$caddyfile"; then
  fail "Caddyfile must not contain secrets or sensitive authorization headers"
fi
pass "Caddyfile uses the approved Sandbox domain and contains no sensitive header names"

check_port_free 80
check_port_free 443
check_port_free "$gateway_bind_port"

[[ -n "$expected_egress_ip" ]] || fail "EXPECTED_EGRESS_IP must be provided explicitly"
"$script_dir/verify-egress.sh" "$expected_egress_ip"

echo "Preflight checks passed. No system changes were made."
