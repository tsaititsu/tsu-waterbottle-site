#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly expected_environment_file="/etc/line-pay-gateway/proxy.env"
readonly expected_exec_start="/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"

# shellcheck source=secure-log-directory.sh
source "$script_dir/secure-log-directory.sh"

validation_error() {
  echo "Caddy systemd validation failed: $*" >&2
  return 1
}

validate_regular_file() {
  local file_path="$1"

  [[ -e "$file_path" ]] || validation_error "file does not exist: $file_path"
  [[ ! -L "$file_path" ]] || validation_error "file must not be a symbolic link: $file_path"
  [[ -f "$file_path" ]] || validation_error "path must be a regular file: $file_path"
}

validate_drop_in() {
  local drop_in_file="$1"
  local expected_content actual_content

  validate_regular_file "$drop_in_file" || return

  expected_content="$(
    printf '%s\n' \
      '[Service]' \
      "EnvironmentFile=$expected_environment_file" \
      'ExecStart=' \
      "ExecStart=$expected_exec_start"
  )"
  actual_content="$(sed 's/\r$//' "$drop_in_file")"

  [[ "$actual_content" == "$expected_content" ]] \
    || validation_error "drop-in must exactly match the committed safe service override"
}

validate_installed_drop_in() {
  local drop_in_file="$1"

  validate_drop_in "$drop_in_file" || return
  [[ "$(path_mode "$drop_in_file")" == "644" ]] \
    || validation_error "installed drop-in mode must be 0644"
  [[ "$(path_uid "$drop_in_file")" == "0" ]] \
    || validation_error "installed drop-in owner must be root"
  [[ "$(path_gid "$drop_in_file")" == "0" ]] \
    || validation_error "installed drop-in group must be root"
}

validate_effective_unit() {
  local unit_source="$1"
  local current_section=""
  local raw_line line value
  local user_name=""
  local group_name=""
  local -a exec_starts=()
  local -a environment_files=()

  if [[ "$unit_source" != "-" ]]; then
    validate_regular_file "$unit_source" || return
  fi

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"

    if [[ "$line" =~ ^\[[^]]+\]$ ]]; then
      current_section="$line"
      continue
    fi
    [[ "$current_section" == "[Service]" ]] || continue
    [[ -n "$line" && ! "$line" =~ ^[[:space:]]*[#\;] ]] || continue

    case "$line" in
      ExecStart=*)
        value="${line#ExecStart=}"
        if [[ -z "$value" ]]; then
          exec_starts=()
        else
          exec_starts+=("$value")
        fi
        ;;
      ExecReload=*)
        value="${line#ExecReload=}"
        if [[ "$value" == *"--environ"* || "$value" =~ (^|[[:space:]])environ($|[[:space:]]) ]]; then
          validation_error "effective ExecReload must not display the environment"
          return
        fi
        ;;
      EnvironmentFile=*)
        value="${line#EnvironmentFile=}"
        environment_files+=("$value")
        ;;
      Environment=*)
        value="${line#Environment=}"
        if [[ "$value" == *"LINE_PAY_GATEWAY_"* || "$value" == *"LINE_PAY_CHANNEL_"* ]]; then
          validation_error "Gateway or LINE Pay values must not be embedded in the systemd unit"
          return
        fi
        ;;
      User=*)
        user_name="${line#User=}"
        ;;
      Group=*)
        group_name="${line#Group=}"
        ;;
    esac
  done < <(
    if [[ "$unit_source" == "-" ]]; then
      cat
    else
      cat -- "$unit_source"
    fi
  )

  [[ "${#exec_starts[@]}" -eq 1 ]] \
    || validation_error "effective unit must contain exactly one ExecStart"
  [[ "${exec_starts[0]}" == "$expected_exec_start" ]] \
    || validation_error "effective ExecStart must be exactly: $expected_exec_start"
  [[ "${#environment_files[@]}" -eq 1 ]] \
    || validation_error "effective unit must contain exactly one EnvironmentFile"
  [[ "${environment_files[0]}" == "$expected_environment_file" ]] \
    || validation_error "EnvironmentFile must be exactly $expected_environment_file"
  [[ "$user_name" == "caddy" ]] || validation_error "effective service User must remain caddy"
  [[ "$group_name" == "caddy" ]] || validation_error "effective service Group must remain caddy"
}

usage() {
  printf '%s\n' \
    'Usage:' \
    '  validate-caddy-systemd.sh drop-in <drop-in-file>' \
    '  validate-caddy-systemd.sh installed <installed-drop-in-file>' \
    '  validate-caddy-systemd.sh effective <systemctl-cat-file|->'
}

main() {
  local mode="${1:-}"

  case "$mode" in
    drop-in)
      [[ $# -eq 2 ]] || {
        usage >&2
        exit 2
      }
      validate_drop_in "$2"
      ;;
    installed)
      [[ $# -eq 2 ]] || {
        usage >&2
        exit 2
      }
      validate_installed_drop_in "$2"
      ;;
    effective)
      [[ $# -eq 2 ]] || {
        usage >&2
        exit 2
      }
      validate_effective_unit "$2"
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
