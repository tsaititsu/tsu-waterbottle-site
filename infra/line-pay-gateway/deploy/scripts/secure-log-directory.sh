#!/usr/bin/env bash
set -euo pipefail

secure_log_error() {
  echo "Secure log directory check failed: $*" >&2
  return 1
}

reject_unsafe_log_path() {
  local target="${1:-}"
  local component
  local current_path=""
  local -a components

  [[ "$target" == /* ]] || secure_log_error "log directory must use an absolute path"

  IFS='/' read -r -a components <<<"$target"
  for component in "${components[@]}"; do
    [[ -n "$component" ]] || continue
    [[ "$component" != "." && "$component" != ".." ]] \
      || secure_log_error "log directory must not contain dot path components: $target"
    current_path="${current_path}/${component}"
    [[ ! -L "$current_path" ]] \
      || secure_log_error "log directory path must not traverse a symbolic link: $current_path"
  done
}

path_mode() {
  local target="$1"

  if stat -c '%a' -- "$target" >/dev/null 2>&1; then
    stat -c '%a' -- "$target"
  else
    stat -f '%Lp' -- "$target"
  fi
}

path_uid() {
  local target="$1"

  if stat -c '%u' -- "$target" >/dev/null 2>&1; then
    stat -c '%u' -- "$target"
  else
    stat -f '%u' -- "$target"
  fi
}

path_gid() {
  local target="$1"

  if stat -c '%g' -- "$target" >/dev/null 2>&1; then
    stat -c '%g' -- "$target"
  else
    stat -f '%g' -- "$target"
  fi
}

check_secure_log_directory() {
  local log_dir="${1:-}"
  local mode

  [[ -n "$log_dir" ]] || secure_log_error "log directory path is empty"
  reject_unsafe_log_path "$log_dir"
  [[ -e "$log_dir" ]] || secure_log_error "log directory does not exist: $log_dir"
  [[ -d "$log_dir" ]] || secure_log_error "log path is not a directory: $log_dir"

  mode="$(path_mode "$log_dir")"
  [[ "$mode" == "700" || "$mode" == "750" ]] \
    || secure_log_error "log directory mode must be 0700 or 0750: $log_dir"
  [[ "$(path_uid "$log_dir")" == "0" ]] \
    || secure_log_error "log directory owner must be root: $log_dir"
  [[ "$(path_gid "$log_dir")" == "0" ]] \
    || secure_log_error "log directory group must be root: $log_dir"
}

prepare_secure_log_directory() {
  local log_dir="${1:-}"
  local parent_dir

  [[ -n "$log_dir" ]] || secure_log_error "log directory path is empty"
  reject_unsafe_log_path "$log_dir"

  if [[ -e "$log_dir" ]]; then
    check_secure_log_directory "$log_dir"
    return
  fi

  parent_dir="$(dirname -- "$log_dir")"
  [[ -d "$parent_dir" ]] || secure_log_error "log directory parent must already be a directory: $parent_dir"
  [[ "${EUID:-$(id -u)}" -eq 0 ]] \
    || secure_log_error "root privileges are required to create the log directory safely"

  install -d -o root -g root -m 0750 -- "$log_dir"
  check_secure_log_directory "$log_dir"
}

usage() {
  printf '%s\n' \
    'Usage:' \
    '  secure-log-directory.sh check <log-directory>' \
    '  secure-log-directory.sh prepare <log-directory>'
}

main() {
  [[ $# -eq 2 ]] || {
    usage >&2
    exit 2
  }

  case "$1" in
    check)
      check_secure_log_directory "$2"
      ;;
    prepare)
      prepare_secure_log_directory "$2"
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
