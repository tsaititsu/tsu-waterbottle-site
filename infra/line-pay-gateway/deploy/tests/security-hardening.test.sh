#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd -- "$test_dir/.." && pwd)"
validators="$deploy_dir/scripts/validators.sh"
compose_wrapper="$deploy_dir/scripts/compose.sh"
secure_log_directory="$deploy_dir/scripts/secure-log-directory.sh"
validate_proxy_env="$deploy_dir/scripts/validate-proxy-env.sh"
caddyfile="$deploy_dir/Caddyfile.example"
compose_file="$deploy_dir/compose.yaml"
proxy_env_example="$deploy_dir/proxy.env.example"
runbook="$deploy_dir/SANDBOX_DEPLOY_RUNBOOK.md"
valid_sha="02304928f5963b3e3479c66df59d3f85627da2c3"
valid_proxy_token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
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
proxy_env_symlink="$temp_root/proxy-symlink"
proxy_env_broad="$temp_root/proxy-broad.env"
proxy_env_extra="$temp_root/proxy-extra.env"
proxy_env_malformed="$temp_root/proxy-malformed.env"
proxy_env_non_root="$temp_root/proxy-non-root.env"

cleanup() {
  [[ ! -L "$symlink_path" ]] || unlink "$symlink_path"
  [[ ! -L "$symlink_parent" ]] || unlink "$symlink_parent"
  [[ ! -L "$proxy_env_symlink" ]] || unlink "$proxy_env_symlink"
  [[ ! -f "$file_path" ]] || unlink "$file_path"
  [[ ! -f "$unsafe_parent" ]] || unlink "$unsafe_parent"
  [[ ! -f "$proxy_env_broad" ]] || unlink "$proxy_env_broad"
  [[ ! -f "$proxy_env_extra" ]] || unlink "$proxy_env_extra"
  [[ ! -f "$proxy_env_malformed" ]] || unlink "$proxy_env_malformed"
  [[ ! -f "$proxy_env_non_root" ]] || unlink "$proxy_env_non_root"
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
ln -s "$temp_root/missing-proxy-env" "$proxy_env_symlink"
printf 'LINE_PAY_GATEWAY_PROXY_TOKEN=%s\n' "$valid_proxy_token" >"$proxy_env_broad"
chmod 0644 "$proxy_env_broad"
printf 'LINE_PAY_GATEWAY_PROXY_TOKEN=%s\nLINE_PAY_GATEWAY_SECRET=blocked\n' \
  "$valid_proxy_token" >"$proxy_env_extra"
chmod 0600 "$proxy_env_extra"
printf 'LINE_PAY_GATEWAY_PROXY_TOKEN=not-lowercase-hex\n' >"$proxy_env_malformed"
chmod 0600 "$proxy_env_malformed"
printf 'LINE_PAY_GATEWAY_PROXY_TOKEN=%s\n' "$valid_proxy_token" >"$proxy_env_non_root"
chmod 0600 "$proxy_env_non_root"

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
expect_success "accepts an exact 64-character lowercase hexadecimal Proxy Token" \
  "$validators" proxy-token "$valid_proxy_token"
expect_failure "rejects a short Proxy Token" \
  "$validators" proxy-token "${valid_proxy_token%a}"
expect_failure "rejects an uppercase Proxy Token" \
  "$validators" proxy-token "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
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

expect_failure "rejects a symlink Proxy env file" \
  "$validate_proxy_env" "$proxy_env_symlink"
expect_failure "rejects a Proxy env file with mode broader than 0600" \
  "$validate_proxy_env" "$proxy_env_broad"
expect_failure "rejects additional secrets in the Proxy env file" \
  "$validate_proxy_env" "$proxy_env_extra"
expect_failure "rejects malformed Proxy Token content" \
  "$validate_proxy_env" "$proxy_env_malformed"
expect_failure "rejects a Proxy env file not owned by root" \
  "$validate_proxy_env" "$proxy_env_non_root"

expect_success "Proxy env example has only the dedicated Proxy Token assignment" \
  test "$(grep -Ec '^[A-Z0-9_]+=' "$proxy_env_example")" -eq 1
expect_success "Proxy env example contains no Gateway HMAC or LINE Pay secret variable" \
  sh -c "! grep -Eq 'LINE_PAY_GATEWAY_SECRET|LINE_PAY_CHANNEL_SECRET' \"\$1\"" sh "$proxy_env_example"
expect_success "Compose provides the separate Proxy env file to Gateway" \
  grep -Fq '${LINE_PAY_GATEWAY_PROXY_ENV_FILE:-/etc/line-pay-gateway/proxy.env}' "$compose_file"
expect_success "Compose keeps the Gateway application port on host localhost" \
  grep -Fq '"127.0.0.1:${GATEWAY_BIND_PORT:-3000}:3000"' "$compose_file"
expect_failure "Compose does not use host network or privileged mode" \
  grep -Eq '^[[:space:]]*(network_mode:[[:space:]]*host|privileged:[[:space:]]*true)' "$compose_file"

expect_success "Caddy proxy route overwrites the dedicated Proxy Token from its environment" \
  grep -Fxq $'\t\t\theader_up X-Gateway-Proxy-Token {$LINE_PAY_GATEWAY_PROXY_TOKEN}' "$caddyfile"
expect_success "Caddy config assigns the dedicated Proxy Token header exactly once" \
  test "$(grep -Eic '^[[:space:]]*header_up[[:space:]]+X-Gateway-Proxy-Token([[:space:]]|$)' "$caddyfile")" -eq 1
expect_failure "Caddy Proxy Token override does not use a client request header" \
  grep -Eq 'header_up X-Gateway-Proxy-Token \{http\.request\.header\.' "$caddyfile"
expect_success "Caddy proxy route overwrites the dedicated client IP header with remote_host" \
  grep -Fxq $'\t\t\theader_up X-Gateway-Client-IP {remote_host}' "$caddyfile"
expect_success "Caddy config assigns the dedicated client IP header exactly once" \
  test "$(grep -Eic '^[[:space:]]*header_up[[:space:]]+X-Gateway-Client-IP([[:space:]]|$)' "$caddyfile")" -eq 1
expect_failure "Caddy client IP override does not use a request header value" \
  grep -Eq 'header_up X-Gateway-Client-IP \{http\.request\.header\.' "$caddyfile"
expect_success "Sandbox runbook requires Cloudflare DNS only and forbids orange-cloud proxy mode" \
  grep -Fq 'Sandbox 初期禁止開啟 Cloudflare Proxy／橘雲' "$runbook"

printf '1..%d\n' "$((pass_count + fail_count))"
printf 'Security hardening tests: %d passed, %d failed.\n' "$pass_count" "$fail_count"
((fail_count == 0))
