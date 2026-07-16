#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=validators.sh
source "$script_dir/validators.sh"
# shellcheck source=secure-log-directory.sh
source "$script_dir/secure-log-directory.sh"

proxy_env_error() {
  echo "Proxy env check failed: $*" >&2
  return 1
}

read_proxy_token() {
  local proxy_env_file="$1"

  awk '
    NR == 1 && /^LINE_PAY_GATEWAY_PROXY_TOKEN=/ {
      print substr($0, length("LINE_PAY_GATEWAY_PROXY_TOKEN=") + 1)
      next
    }
    { invalid = 1 }
    END {
      if (NR != 1 || invalid) exit 2
    }
  ' "$proxy_env_file"
}

check_proxy_env_file() {
  local proxy_env_file="${1:-}"
  local proxy_token

  if [[ -z "$proxy_env_file" ]]; then
    proxy_env_error "path is empty"
    return
  fi
  if [[ ! -e "$proxy_env_file" ]]; then
    proxy_env_error "file does not exist: $proxy_env_file"
    return
  fi
  if [[ -L "$proxy_env_file" ]]; then
    proxy_env_error "file must not be a symbolic link: $proxy_env_file"
    return
  fi
  if [[ ! -f "$proxy_env_file" ]]; then
    proxy_env_error "path must be a regular file: $proxy_env_file"
    return
  fi
  if [[ "$(path_mode "$proxy_env_file")" != "600" ]]; then
    proxy_env_error "file mode must be 0600: $proxy_env_file"
    return
  fi

  if ! proxy_token="$(read_proxy_token "$proxy_env_file")"; then
    proxy_env_error "file must contain only one LINE_PAY_GATEWAY_PROXY_TOKEN assignment"
    return
  fi
  if ! validate_proxy_token "$proxy_token" >/dev/null; then
    proxy_env_error "Proxy Token format is invalid"
    return
  fi

  if [[ "$(path_uid "$proxy_env_file")" != "0" ]]; then
    proxy_env_error "file owner must be root: $proxy_env_file"
    return
  fi
  if [[ "$(path_gid "$proxy_env_file")" != "0" ]]; then
    proxy_env_error "file group must be root: $proxy_env_file"
    return
  fi
}

usage() {
  echo "Usage: validate-proxy-env.sh <proxy-env-file>"
}

main() {
  [[ $# -eq 1 ]] || {
    usage >&2
    exit 2
  }
  check_proxy_env_file "$1"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
