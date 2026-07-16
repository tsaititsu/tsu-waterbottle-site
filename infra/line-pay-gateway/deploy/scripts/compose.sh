#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
gateway_root="$(cd -- "$script_dir/../.." && pwd)"
compose_file="${COMPOSE_FILE:-$gateway_root/deploy/compose.yaml}"
gateway_image_name="${GATEWAY_IMAGE_NAME:-line-pay-fixed-ip-gateway}"
gateway_image_tag="${GATEWAY_IMAGE_TAG:-}"

# shellcheck source=validators.sh
source "$script_dir/validators.sh"

[[ $# -gt 0 ]] || {
  echo "Usage: GATEWAY_IMAGE_TAG=<full-commit-sha> compose.sh <docker-compose-arguments...>" >&2
  exit 2
}

validate_release_inputs "$gateway_image_name" "$gateway_image_tag"
[[ -f "$compose_file" ]] || {
  echo "Compose file is missing: $compose_file" >&2
  exit 1
}

export GATEWAY_IMAGE_TAG_VALIDATED="$gateway_image_tag"
exec docker compose -f "$compose_file" "$@"
