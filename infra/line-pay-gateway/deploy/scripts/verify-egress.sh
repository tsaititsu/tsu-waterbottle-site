#!/usr/bin/env bash
set -euo pipefail

expected_ip="${1:-${EXPECTED_EGRESS_IP:-}}"

if [[ -z "$expected_ip" ]]; then
  echo "Usage: $0 <expected-ipv4> or set EXPECTED_EGRESS_IP" >&2
  exit 2
fi

is_ipv4() {
  local value="$1"
  local part
  local -a parts

  IFS='.' read -r -a parts <<<"$value"
  [[ "${#parts[@]}" -eq 4 ]] || return 1

  for part in "${parts[@]}"; do
    [[ "$part" =~ ^[0-9]{1,3}$ ]] || return 1
    ((10#$part >= 0 && 10#$part <= 255)) || return 1
  done
}

if ! is_ipv4 "$expected_ip"; then
  echo "Expected value is not a valid IPv4 address." >&2
  exit 2
fi

actual_ip="$(curl --fail --silent --show-error --max-time 10 -4 https://icanhazip.com/ | tr -d '[:space:]')"

if ! is_ipv4 "$actual_ip"; then
  echo "Egress check returned an invalid IPv4 response." >&2
  exit 1
fi

if [[ "$actual_ip" != "$expected_ip" ]]; then
  echo "Egress IPv4 mismatch: expected $expected_ip, received $actual_ip." >&2
  exit 1
fi

echo "Egress IPv4 verified: $actual_ip"
