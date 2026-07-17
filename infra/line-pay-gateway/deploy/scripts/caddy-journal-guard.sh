#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
journalctl_command="${JOURNALCTL_COMMAND:-journalctl}"
systemctl_command="${SYSTEMCTL_COMMAND:-systemctl}"
if [[ "$EUID" -eq 0 ]]; then
  readonly journal_guard_temp_parent="/tmp"
else
  readonly journal_guard_temp_parent="${TMPDIR:-/tmp}"
fi
declare -a journal_guard_temp_dirs=()

# shellcheck source=validate-proxy-env.sh
source "$script_dir/validate-proxy-env.sh"

journal_guard_error() {
  echo "Caddy journal guard failed: $*" >&2
  return 1
}

validate_journal_guard_temp_dir() {
  local temp_dir="$1"

  [[ "$temp_dir" == "$journal_guard_temp_parent"/line-pay-caddy-journal.* ]] \
    || journal_guard_error "temporary directory path is outside the guarded namespace"
  [[ -d "$temp_dir" && ! -L "$temp_dir" ]] \
    || journal_guard_error "temporary directory is not a non-symlink directory"
}

register_journal_guard_temp_dir() {
  local temp_dir="$1"

  validate_journal_guard_temp_dir "$temp_dir" || return
  journal_guard_temp_dirs+=("$temp_dir")
}

unregister_journal_guard_temp_dir() {
  local temp_dir="$1"
  local -a remaining=()
  local registered_dir

  for registered_dir in "${journal_guard_temp_dirs[@]}"; do
    [[ "$registered_dir" == "$temp_dir" ]] || remaining+=("$registered_dir")
  done
  if [[ "${#remaining[@]}" -eq 0 ]]; then
    journal_guard_temp_dirs=()
  else
    journal_guard_temp_dirs=("${remaining[@]}")
  fi
}

cleanup_journal_guard_temp_dir() {
  local temp_dir="$1"
  local file_path cleanup_status=0

  validate_journal_guard_temp_dir "$temp_dir" || return
  for file_path in "$temp_dir/proxy-token.pattern" "$temp_dir/caddy.journal"; do
    if [[ -e "$file_path" || -L "$file_path" ]]; then
      if [[ -L "$file_path" || ! -f "$file_path" ]] || ! unlink -- "$file_path"; then
        journal_guard_error "unable to remove a guarded temporary file"
        cleanup_status=1
      fi
    fi
  done
  if [[ "$cleanup_status" -eq 0 ]]; then
    if rmdir -- "$temp_dir"; then
      unregister_journal_guard_temp_dir "$temp_dir"
    else
      journal_guard_error "unable to remove a guarded temporary directory"
      cleanup_status=1
    fi
  fi
  return "$cleanup_status"
}

cleanup_all_journal_guard_temp_dirs() {
  local cleanup_status=0
  local index

  for ((index = ${#journal_guard_temp_dirs[@]} - 1; index >= 0; index--)); do
    cleanup_journal_guard_temp_dir "${journal_guard_temp_dirs[index]}" || cleanup_status=1
  done
  return "$cleanup_status"
}

journal_guard_exit_cleanup() {
  local exit_status="$?"

  trap - EXIT INT TERM
  if ! cleanup_all_journal_guard_temp_dirs && [[ "$exit_status" -eq 0 ]]; then
    exit_status=1
  fi
  exit "$exit_status"
}

journal_guard_signal_cleanup() {
  local signal_exit_status="$1"

  trap - EXIT INT TERM
  cleanup_all_journal_guard_temp_dirs || true
  exit "$signal_exit_status"
}

install_journal_guard_cleanup_traps() {
  trap journal_guard_exit_cleanup EXIT
  trap 'journal_guard_signal_cleanup 130' INT
  trap 'journal_guard_signal_cleanup 143' TERM
}

create_journal_guard_temp_dir() {
  local output_variable="$1"
  local temp_dir

  [[ -d "$journal_guard_temp_parent" && ! -L "$journal_guard_temp_parent" ]] \
    || journal_guard_error "guarded temporary parent must be a non-symlink directory"
  temp_dir="$(mktemp -d "$journal_guard_temp_parent/line-pay-caddy-journal.XXXXXX")" \
    || journal_guard_error "unable to create a guarded temporary directory"
  register_journal_guard_temp_dir "$temp_dir" || return
  chmod 0700 "$temp_dir" \
    || journal_guard_error "unable to restrict a guarded temporary directory"
  [[ "$(path_mode "$temp_dir")" == "700" ]] \
    || journal_guard_error "guarded temporary directory mode must be 0700"
  [[ "$(path_uid "$temp_dir")" == "$EUID" ]] \
    || journal_guard_error "guarded temporary directory owner is invalid"
  printf -v "$output_variable" '%s' "$temp_dir"
}

sha256_string() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
  else
    shasum -a 256 | awk '{ print $1 }'
  fi
}

check_root_only_regular_file() {
  local file_path="$1"

  [[ -e "$file_path" ]] || journal_guard_error "file does not exist: $file_path"
  [[ ! -L "$file_path" ]] || journal_guard_error "file must not be a symbolic link: $file_path"
  [[ -f "$file_path" ]] || journal_guard_error "path must be a regular file: $file_path"
  [[ "$(path_mode "$file_path")" == "600" ]] || journal_guard_error "file mode must be 0600: $file_path"
  [[ "$(path_uid "$file_path")" == "0" ]] || journal_guard_error "file owner must be root: $file_path"
  [[ "$(path_gid "$file_path")" == "0" ]] || journal_guard_error "file group must be root: $file_path"
}

cleanup_journal_timestamp_temp_file() {
  local temp_file="$1"

  if [[ -e "$temp_file" || -L "$temp_file" ]]; then
    if ! unlink -- "$temp_file"; then
      journal_guard_error "unable to remove the temporary journal timestamp file"
      return
    fi
  fi
}

record_journal_start_time() {
  local timestamp_file="$1"
  local parent_dir temp_file timestamp

  [[ "$timestamp_file" == /* ]] || journal_guard_error "timestamp file path must be absolute"
  [[ ! -e "$timestamp_file" && ! -L "$timestamp_file" ]] \
    || journal_guard_error "timestamp file already exists: $timestamp_file"

  parent_dir="$(dirname -- "$timestamp_file")"
  [[ -d "$parent_dir" && ! -L "$parent_dir" ]] \
    || journal_guard_error "timestamp parent must be an existing non-symlink directory"

  temp_file="$(mktemp "$parent_dir/.caddy-journal-start.XXXXXX")"
  if ! chmod 0600 "$temp_file"; then
    cleanup_journal_timestamp_temp_file "$temp_file" || return
    journal_guard_error "unable to restrict the temporary timestamp file"
    return
  fi
  if ! timestamp="$(date -u '+%Y-%m-%d %H:%M:%S UTC')" \
    || ! printf '%s\n' "$timestamp" >"$temp_file" \
    || ! chown root:root "$temp_file"
  then
    cleanup_journal_timestamp_temp_file "$temp_file" || return
    journal_guard_error "unable to prepare the root-only timestamp file"
    return
  fi
  if ! ln -- "$temp_file" "$timestamp_file"; then
    cleanup_journal_timestamp_temp_file "$temp_file" || return
    journal_guard_error "unable to install timestamp file atomically"
    return
  fi
  cleanup_journal_timestamp_temp_file "$temp_file" || return
}

disable_caddy_after_leak() {
  local command_status=0

  "$systemctl_command" stop caddy || command_status=1
  "$systemctl_command" disable caddy || command_status=1
  return "$command_status"
}

fail_closed_caddy_scan() {
  local failure_message="$1"

  disable_caddy_after_leak || true
  journal_guard_error "$failure_message; Caddy was stopped and disabled"
}

scan_journal_file_for_proxy_token() {
  local proxy_token="$1"
  local journal_file="$2"
  local secure_temp_dir pattern_file grep_status

  create_journal_guard_temp_dir secure_temp_dir || return 2
  pattern_file="$secure_temp_dir/proxy-token.pattern"
  if ! (
    umask 077
    printf '%s\n' "$proxy_token" >"$pattern_file"
  ) || [[ ! -f "$pattern_file" || -L "$pattern_file" ]] \
    || [[ "$(path_mode "$pattern_file")" != "600" ]] \
    || [[ "$(path_uid "$pattern_file")" != "$EUID" ]]; then
    journal_guard_error "unable to create a root-only Proxy Token pattern file"
    return 2
  fi

  if grep -F -q -f "$pattern_file" "$journal_file"; then
    grep_status=0
  else
    grep_status="$?"
  fi

  cleanup_journal_guard_temp_dir "$secure_temp_dir" || return 2

  case "$grep_status" in
    0)
      return 1
      ;;
    1)
      return 0
      ;;
    *)
      return 2
      ;;
  esac
}

scan_new_caddy_journal() {
  local proxy_env_file="$1"
  local timestamp_file="$2"
  local proxy_token proxy_token_fingerprint timestamp timestamp_line_count
  local secure_temp_dir journal_file scan_status

  if ! check_proxy_env_file "$proxy_env_file"; then
    fail_closed_caddy_scan "Proxy env validation failed"
    return
  fi
  if ! check_root_only_regular_file "$timestamp_file"; then
    fail_closed_caddy_scan "journal timestamp file validation failed"
    return
  fi
  if ! proxy_token="$(read_proxy_token "$proxy_env_file")"; then
    fail_closed_caddy_scan "unable to read the validated Proxy Token"
    return
  fi
  if ! proxy_token_fingerprint="$(printf '%s' "$proxy_token" | sha256_string)"; then
    fail_closed_caddy_scan "unable to calculate the internal Proxy Token fingerprint"
    return
  fi
  if [[ ! "$proxy_token_fingerprint" =~ ^[0-9a-f]{64}$ ]]; then
    fail_closed_caddy_scan "internal Proxy Token fingerprint is invalid"
    return
  fi
  if ! timestamp="$(sed -n '1p' "$timestamp_file")" \
    || ! timestamp_line_count="$(wc -l <"$timestamp_file" | tr -d '[:space:]')"
  then
    fail_closed_caddy_scan "unable to read the journal timestamp file"
    return
  fi
  if [[ -z "$timestamp" || "$timestamp_line_count" != "1" ]]; then
    fail_closed_caddy_scan "timestamp file must contain exactly one non-empty line"
    return
  fi

  if ! create_journal_guard_temp_dir secure_temp_dir; then
    fail_closed_caddy_scan "unable to prepare journal scan temporary storage"
    return
  fi
  journal_file="$secure_temp_dir/caddy.journal"
  (
    umask 077
    "$journalctl_command" --unit caddy --since "$timestamp" --no-pager --output cat >"$journal_file"
  ) || {
    cleanup_journal_guard_temp_dir "$secure_temp_dir" || true
    fail_closed_caddy_scan "unable to read the new Caddy journal range"
    return
  }
  [[ -f "$journal_file" && ! -L "$journal_file" \
    && "$(path_mode "$journal_file")" == "600" \
    && "$(path_uid "$journal_file")" == "$EUID" ]] || {
    cleanup_journal_guard_temp_dir "$secure_temp_dir" || true
    fail_closed_caddy_scan "Caddy journal temporary file mode must be 0600"
    return
  }

  if scan_journal_file_for_proxy_token "$proxy_token" "$journal_file"; then
    scan_status=0
  else
    scan_status="$?"
  fi
  if [[ "$scan_status" -ne 0 ]]; then
    cleanup_journal_guard_temp_dir "$secure_temp_dir" || true
    disable_caddy_after_leak || true
    if [[ "$scan_status" -eq 1 ]]; then
      journal_guard_error "Proxy Token leakage detected; Caddy was stopped and disabled"
    else
      journal_guard_error "journal scan failed closed; Caddy was stopped and disabled"
    fi
    return
  fi

  cleanup_journal_guard_temp_dir "$secure_temp_dir" || {
    fail_closed_caddy_scan "unable to clean the Caddy journal temporary files"
    return
  }
  echo "Caddy journal guard passed without displaying secret material."
}

usage() {
  printf '%s\n' \
    'Usage:' \
    '  caddy-journal-guard.sh record <absolute-root-only-timestamp-file>' \
    '  caddy-journal-guard.sh scan <proxy-env-file> <timestamp-file>'
}

main() {
  local mode="${1:-}"

  case "$mode" in
    record)
      [[ $# -eq 2 ]] || {
        usage >&2
        exit 2
      }
      record_journal_start_time "$2"
      ;;
    scan)
      [[ $# -eq 3 ]] || {
        usage >&2
        exit 2
      }
      scan_new_caddy_journal "$2" "$3"
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_journal_guard_cleanup_traps
  main "$@"
fi
