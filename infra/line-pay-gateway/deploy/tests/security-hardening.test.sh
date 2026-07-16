#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd -- "$test_dir/.." && pwd)"
validators="$deploy_dir/scripts/validators.sh"
compose_wrapper="$deploy_dir/scripts/compose.sh"
secure_log_directory="$deploy_dir/scripts/secure-log-directory.sh"
valid_sha="02304928f5963b3e3479c66df59d3f85627da2c3"
pass_count=0
fail_count=0

record_pass() {
  pass_count=$((pass_count + 1))
  printf 'ok %d - %s\n' "$((pass_count + fail_count))" "$1"
}

record_fail() {
  fail_count=$((fail_count + 1))
  printf 'not ok %d - %s\n' "$((pass_count + fail_count))" "$1" >&2
}

expect_success() {
  local description="$1"
  shift

  if "$@" >/dev/null 2>&1; then
    record_pass "$description"
  else
    record_fail "$description"
  fi
}

expect_failure() {
  local description="$1"
  shift

  if "$@" >/dev/null 2>&1; then
    record_fail "$description"
  else
    record_pass "$description"
  fi
}

temp_root="$(mktemp -d "${TMPDIR:-/tmp}/line-pay-gateway-security.XXXXXX")"
symlink_path="$temp_root/log-symlink"
symlink_parent="$temp_root/parent-symlink"
file_path="$temp_root/log-file"
wrong_owner_dir="$temp_root/log-wrong-owner"
wide_mode_dir="$temp_root/log-wide-mode"
unsafe_parent="$temp_root/not-a-directory"

cleanup() {
  [[ ! -L "$symlink_path" ]] || unlink "$symlink_path"
  [[ ! -L "$symlink_parent" ]] || unlink "$symlink_parent"
  [[ ! -f "$file_path" ]] || unlink "$file_path"
  [[ ! -f "$unsafe_parent" ]] || unlink "$unsafe_parent"
  [[ ! -d "$wrong_owner_dir" ]] || rmdir "$wrong_owner_dir"
  [[ ! -d "$wide_mode_dir" ]] || rmdir "$wide_mode_dir"
  rmdir "$temp_root" 2>/dev/null || true
}
trap cleanup EXIT

ln -s "$temp_root/missing-target" "$symlink_path"
ln -s "$temp_root" "$symlink_parent"
: >"$file_path"
mkdir "$wrong_owner_dir"
chmod 0750 "$wrong_owner_dir"
mkdir "$wide_mode_dir"
chmod 0777 "$wide_mode_dir"
: >"$unsafe_parent"

expect_success "accepts a full lowercase 40-character commit SHA" \
  "$validators" release line-pay-fixed-ip-gateway "$valid_sha"

for rejected_tag in \
  abc1234 \
  latest \
  release-candidate \
  02304928F5963B3E3479C66DF59D3F85627DA2C3 \
  02304928f5963b3e3479c66df59d3f85627da2c \
  02304928f5963b3e3479c66df59d3f85627da2c3-extra \
  " $valid_sha" \
  "$valid_sha "
do
  expect_failure "rejects unsafe image tag: $rejected_tag" \
    "$validators" release line-pay-fixed-ip-gateway "$rejected_tag"
done

expect_failure "rejects an image name containing a tag separator" \
  "$validators" release 'line-pay-fixed-ip-gateway:latest' "$valid_sha"
expect_failure "rejects an image name containing option-like text" \
  "$validators" release 'line-pay-fixed-ip-gateway --pull' "$valid_sha"
expect_failure "Compose wrapper rejects a short SHA before Docker runs" \
  env GATEWAY_IMAGE_TAG=abc1234 "$compose_wrapper" config --quiet
expect_failure "Compose wrapper rejects an injected image name before Docker runs" \
  env \
    GATEWAY_IMAGE_NAME='line-pay-fixed-ip-gateway:latest' \
    GATEWAY_IMAGE_TAG="$valid_sha" \
    "$compose_wrapper" config --quiet

expect_success "accepts the IPv4 localhost health URL" \
  "$validators" health-url http://127.0.0.1:3000/health
expect_success "accepts the localhost hostname health URL" \
  "$validators" health-url http://localhost:65535/health

for rejected_url in \
  http://127.0.0.1:3000@example.invalid/health \
  http://localhost:3000@example.invalid/health \
  'http://127.0.0.1:3000/health?x=1' \
  'http://127.0.0.1:3000/health#x' \
  https://127.0.0.1:3000/health \
  http://example.com:3000/health \
  http://127.0.0.1:0/health \
  http://127.0.0.1:65536/health \
  http://127.0.0.1:3000/health/extra \
  http://127.0.0.1:3000/health/../x \
  http://127.0.0.1:3000/%68ealth \
  http://127%2e0%2e0%2e1:3000/health \
  'http://user:password@127.0.0.1:3000/health' \
  'http://user%40example.com@127.0.0.1:3000/health' \
  http://\[::1\]:3000/health
do
  expect_failure "rejects unsafe health URL: $rejected_url" \
    "$validators" health-url "$rejected_url"
done

expect_failure "rejects a symlink log directory" \
  "$secure_log_directory" check "$symlink_path"
expect_failure "rejects a log directory path that traverses a symlink" \
  "$secure_log_directory" prepare "$symlink_parent/child"
expect_failure "rejects a regular file as the log directory" \
  "$secure_log_directory" check "$file_path"
expect_failure "rejects a log directory not owned by root" \
  "$secure_log_directory" check "$wrong_owner_dir"
expect_failure "rejects a log directory with overly broad permissions" \
  "$secure_log_directory" check "$wide_mode_dir"
expect_failure "rejects a log directory that cannot be safely created" \
  "$secure_log_directory" prepare "$unsafe_parent/child"

printf '1..%d\n' "$((pass_count + fail_count))"
printf 'Security hardening tests: %d passed, %d failed.\n' "$pass_count" "$fail_count"
((fail_count == 0))
