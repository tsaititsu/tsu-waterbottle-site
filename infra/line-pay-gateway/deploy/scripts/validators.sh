#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_GATEWAY_IMAGE_NAME="line-pay-fixed-ip-gateway"

validation_error() {
  echo "Validation failed: $*" >&2
  return 2
}

validate_gateway_image_name() {
  local image_name="${1:-}"

  [[ "$image_name" == "$EXPECTED_GATEWAY_IMAGE_NAME" ]] \
    || validation_error "Gateway image name must be exactly $EXPECTED_GATEWAY_IMAGE_NAME"
}

validate_full_commit_sha() {
  local commit_sha="${1:-}"

  [[ "$commit_sha" =~ ^[0-9a-f]{40}$ ]] \
    || validation_error "Gateway image tag must be a full 40-character lowercase hexadecimal commit SHA"
}

validate_release_inputs() {
  local image_name="${1:-}"
  local commit_sha="${2:-}"

  validate_gateway_image_name "$image_name"
  validate_full_commit_sha "$commit_sha"
}

validate_local_health_url() {
  local health_url="${1:-}"
  local port

  if [[ "$health_url" =~ ^http://(127\.0\.0\.1|localhost):([0-9]{1,5})/health$ ]]; then
    port="${BASH_REMATCH[2]}"
  else
    validation_error "health URL must be exactly http://127.0.0.1:<port>/health or http://localhost:<port>/health"
    return
  fi

  ((10#$port >= 1 && 10#$port <= 65535)) \
    || validation_error "health URL port must be between 1 and 65535"
}

usage() {
  printf '%s\n' \
    'Usage:' \
    '  validators.sh release <image-name> <full-commit-sha>' \
    '  validators.sh health-url <localhost-health-url>'
}

main() {
  local command_name="${1:-}"

  case "$command_name" in
    release)
      [[ $# -eq 3 ]] || {
        usage >&2
        exit 2
      }
      validate_release_inputs "$2" "$3"
      ;;
    health-url)
      [[ $# -eq 2 ]] || {
        usage >&2
        exit 2
      }
      validate_local_health_url "$2"
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
