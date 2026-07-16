#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
gateway_root="$(cd -- "$script_dir/../.." && pwd)"
compose_file="${COMPOSE_FILE:-$gateway_root/deploy/compose.yaml}"
compose_wrapper="$script_dir/compose.sh"
gateway_env_file="${GATEWAY_ENV_FILE:-/etc/line-pay-gateway/gateway.env}"
log_dir="${ROLLBACK_LOG_DIR:-/var/log/line-pay-gateway}"
deployment_record="${DEPLOYMENT_RECORD_FILE:-/opt/line-pay-gateway/DEPLOYED_IMAGE_TAG}"
gateway_bind_port="${GATEWAY_BIND_PORT:-3000}"
gateway_image_name="${GATEWAY_IMAGE_NAME:-line-pay-fixed-ip-gateway}"
previous_tag=""
execute=false

# shellcheck source=validators.sh
source "$script_dir/validators.sh"
# shellcheck source=secure-log-directory.sh
source "$script_dir/secure-log-directory.sh"

usage() {
  printf '%s\n' \
    'Usage:' \
    '  rollback.sh --previous-tag <audited-full-commit-sha> [--execute]' \
    '' \
    'Without --execute, the script performs a dry-run and makes no changes.' \
    'Execution preserves current container logs, stops only the Gateway service,' \
    'and starts an already-existing previous image without rebuilding or deleting data.'
}

while (($# > 0)); do
  case "$1" in
    --previous-tag)
      [[ $# -ge 2 ]] || {
        usage >&2
        exit 2
      }
      previous_tag="$2"
      shift 2
      ;;
    --execute)
      execute=true
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

validate_release_inputs "$gateway_image_name" "$previous_tag"
[[ -f "$compose_file" ]] || {
  echo "Compose file is missing: $compose_file" >&2
  exit 1
}
[[ -f "$gateway_env_file" ]] || {
  echo "Gateway env file is missing: $gateway_env_file" >&2
  exit 1
}

if [[ -L "$log_dir" ]]; then
  echo "Rollback log directory must not be a symbolic link: $log_dir" >&2
  exit 1
fi
if [[ -e "$log_dir" ]]; then
  check_secure_log_directory "$log_dir"
else
  log_parent="$(dirname -- "$log_dir")"
  [[ ! -L "$log_parent" && -d "$log_parent" ]] || {
    echo "Rollback log directory parent must be an existing non-symlink directory: $log_parent" >&2
    exit 1
  }
fi

image_name="${gateway_image_name}:${previous_tag}"
docker image inspect "$image_name" >/dev/null 2>&1 || {
  echo "Previous image does not exist locally: $image_name" >&2
  exit 1
}

echo "Rollback target image: $image_name"
echo "Compose file: $compose_file"
echo "The script will preserve logs, stop the current Gateway container, and start the existing target image."
echo "It will not delete containers, images, logs, the Droplet, the Reserved IP, secrets, or any external configuration."

if [[ "$execute" != true ]]; then
  echo "Dry-run complete. Re-run with --execute only after reviewing the target image and rollback runbook."
  exit 0
fi

if [[ ! -t 0 ]]; then
  echo "Interactive confirmation is required for rollback execution." >&2
  exit 2
fi

read -r -p "Type the previous full commit SHA exactly to continue: " confirmation
[[ "$confirmation" == "$previous_tag" ]] || {
  echo "Confirmation did not match; no changes were made." >&2
  exit 2
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Rollback execution must run as root so logs remain root-owned." >&2
  exit 2
}

prepare_secure_log_directory "$log_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
log_file="$log_dir/pre-rollback-$timestamp.log"
[[ ! -e "$log_file" && ! -L "$log_file" ]] || {
  echo "Rollback log file already exists or is a symbolic link: $log_file" >&2
  exit 1
}
install -o root -g root -m 0600 /dev/null -- "$log_file"

GATEWAY_IMAGE_TAG="$previous_tag" \
GATEWAY_IMAGE_NAME="$gateway_image_name" \
LINE_PAY_GATEWAY_ENV_FILE="$gateway_env_file" \
GATEWAY_BIND_PORT="$gateway_bind_port" \
COMPOSE_FILE="$compose_file" \
  "$compose_wrapper" logs --no-color gateway >"$log_file" 2>&1 || true

[[ "$(path_mode "$log_file")" == "600" ]] || {
  echo "Rollback log file mode is not 0600: $log_file" >&2
  exit 1
}
[[ "$(path_uid "$log_file")" == "0" && "$(path_gid "$log_file")" == "0" ]] || {
  echo "Rollback log file must be owned by root:root: $log_file" >&2
  exit 1
}

echo "Current Gateway logs preserved at $log_file"

GATEWAY_IMAGE_TAG="$previous_tag" \
GATEWAY_IMAGE_NAME="$gateway_image_name" \
LINE_PAY_GATEWAY_ENV_FILE="$gateway_env_file" \
GATEWAY_BIND_PORT="$gateway_bind_port" \
COMPOSE_FILE="$compose_file" \
  "$compose_wrapper" stop gateway

GATEWAY_IMAGE_TAG="$previous_tag" \
GATEWAY_IMAGE_NAME="$gateway_image_name" \
LINE_PAY_GATEWAY_ENV_FILE="$gateway_env_file" \
GATEWAY_BIND_PORT="$gateway_bind_port" \
COMPOSE_FILE="$compose_file" \
  "$compose_wrapper" up -d --no-build --no-deps gateway

if ! "$script_dir/verify-health.sh" "http://127.0.0.1:${gateway_bind_port}/health"; then
  echo "Rollback target did not pass health verification. Stop and inspect preserved logs; no destructive cleanup was performed." >&2
  exit 1
fi

printf '%s\n' "$previous_tag" >"$deployment_record"
echo "Rollback completed and deployment record updated: $deployment_record"
