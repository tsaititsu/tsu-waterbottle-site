#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
journalctl_command="${JOURNALCTL_COMMAND:-journalctl}"
systemctl_command="${SYSTEMCTL_COMMAND:-systemctl}"

# shellcheck source=validate-proxy-env.sh
source "$script_dir/validate-proxy-env.sh"

journal_guard_error() {
  echo "Caddy journal guard failed: $*" >&2
  return 1
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
    unlink "$temp_file"
    journal_guard_error "unable to restrict the temporary timestamp file"
    return
  fi
  if ! timestamp="$(date -u '+%Y-%m-%d %H:%M:%S UTC')" \
    || ! printf '%s\n' "$timestamp" >"$temp_file" \
    || ! chown root:root "$temp_file"
  then
    unlink "$temp_file"
    journal_guard_error "unable to prepare the root-only timestamp file"
    return
  fi
  if ! mv -n -- "$temp_file" "$timestamp_file"; then
    unlink "$temp_file"
    journal_guard_error "unable to install timestamp file atomically"
    return
  fi
}

disable_caddy_after_leak() {
  local command_status=0

  "$systemctl_command" stop caddy || command_status=1
  "$systemctl_command" disable caddy || command_status=1
  return "$command_status"
}

scan_journal_file_for_proxy_token() {
  local proxy_token="$1"
  local journal_file="$2"
  local secure_temp_dir pattern_file grep_status

  secure_temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/line-pay-caddy-journal.XXXXXX")"
  chmod 0700 "$secure_temp_dir"
  pattern_file="$secure_temp_dir/proxy-token.pattern"
  (
    umask 077
    printf '%s\n' "$proxy_token" >"$pattern_file"
  )

  if grep -F -q -f "$pattern_file" "$journal_file"; then
    grep_status=0
  else
    grep_status="$?"
  fi

  unlink "$pattern_file"
  rmdir "$secure_temp_dir"

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
  local proxy_token proxy_token_fingerprint timestamp secure_temp_dir journal_file scan_status

  check_proxy_env_file "$proxy_env_file" || journal_guard_error "Proxy env validation failed"
  check_root_only_regular_file "$timestamp_file" || return
  proxy_token="$(read_proxy_token "$proxy_env_file")" \
    || journal_guard_error "unable to read the validated Proxy Token"
  proxy_token_fingerprint="$(printf '%s' "$proxy_token" | sha256_string)" \
    || journal_guard_error "unable to calculate the internal Proxy Token fingerprint"
  [[ "$proxy_token_fingerprint" =~ ^[0-9a-f]{64}$ ]] \
    || journal_guard_error "internal Proxy Token fingerprint is invalid"
  timestamp="$(sed -n '1p' "$timestamp_file")"
  [[ -n "$timestamp" && "$(wc -l <"$timestamp_file" | tr -d '[:space:]')" == "1" ]] \
    || journal_guard_error "timestamp file must contain exactly one non-empty line"

  secure_temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/line-pay-caddy-journal.XXXXXX")"
  chmod 0700 "$secure_temp_dir"
  journal_file="$secure_temp_dir/caddy.journal"
  (
    umask 077
    "$journalctl_command" --unit caddy --since "$timestamp" --no-pager --output cat >"$journal_file"
  ) || {
    unlink "$journal_file" 2>/dev/null || true
    rmdir "$secure_temp_dir" 2>/dev/null || true
    journal_guard_error "unable to read the new Caddy journal range"
    return
  }

  if scan_journal_file_for_proxy_token "$proxy_token" "$journal_file"; then
    scan_status=0
  else
    scan_status="$?"
  fi
  if [[ "$scan_status" -ne 0 ]]; then
    unlink "$journal_file"
    rmdir "$secure_temp_dir"
    disable_caddy_after_leak || true
    if [[ "$scan_status" -eq 1 ]]; then
      journal_guard_error "Proxy Token leakage detected; Caddy was stopped and disabled"
    else
      journal_guard_error "journal scan failed closed; Caddy was stopped and disabled"
    fi
    return
  fi

  unlink "$journal_file"
  rmdir "$secure_temp_dir"
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
  main "$@"
fi
