#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
gateway_root="$(cd -- "$script_dir/../.." && pwd)"
base_compose_file="$gateway_root/deploy/compose.yaml"
production_compose_file="$gateway_root/deploy/compose.production.yaml"
gateway_image_name="${GATEWAY_IMAGE_NAME:-line-pay-fixed-ip-gateway}"
gateway_image_tag="${GATEWAY_IMAGE_TAG:-}"
production_confirmation="${LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION:-}"
expected_confirmation="CONFIRM_LINE_PAY_GATEWAY_PRODUCTION_MODE"

# shellcheck source=validators.sh
source "$script_dir/validators.sh"

[[ $# -gt 0 ]] || {
  echo "Usage: GATEWAY_IMAGE_TAG=<full-commit-sha> LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION=$expected_confirmation compose-production.sh <docker-compose-arguments...>" >&2
  exit 2
}

[[ "$production_confirmation" == "$expected_confirmation" ]] || {
  echo "Production Gateway confirmation is missing or invalid." >&2
  exit 2
}

config_requested=0
config_is_quiet=0
config_has_unsupported_argument=0
for argument in "$@"; do
  case "$argument" in
    config)
      config_requested=1
      ;;
    --quiet|-q)
      config_is_quiet=1
      ;;
    *)
      if [[ "$config_requested" == "1" ]]; then
        config_has_unsupported_argument=1
      fi
      ;;
  esac
done

if [[ "$config_requested" == "1" ]]; then
  [[ "$config_is_quiet" == "1" && "$config_has_unsupported_argument" == "0" && "$#" == "2" ]] || {
    echo "Production Compose config output is blocked because it can reveal env values; only config --quiet is allowed." >&2
    exit 2
  }
fi

validate_release_inputs "$gateway_image_name" "$gateway_image_tag"
[[ -f "$base_compose_file" ]] || {
  echo "Base Compose file is missing: $base_compose_file" >&2
  exit 1
}
[[ -f "$production_compose_file" ]] || {
  echo "Production Compose overlay is missing: $production_compose_file" >&2
  exit 1
}

export GATEWAY_IMAGE_TAG_VALIDATED="$gateway_image_tag"
exec docker compose -f "$base_compose_file" -f "$production_compose_file" "$@"
