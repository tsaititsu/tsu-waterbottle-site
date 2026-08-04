#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd -- "$test_dir/.." && pwd)"
base_compose="$deploy_dir/compose.yaml"
production_compose="$deploy_dir/compose.production.yaml"
production_wrapper="$deploy_dir/scripts/compose-production.sh"
production_preflight="$deploy_dir/scripts/preflight-production.sh"
production_runbook="$deploy_dir/PRODUCTION_DEPLOY_RUNBOOK.md"
valid_sha="0a5c70f0b06aa0f0503102f4c5a59d7f1ad7b250"
confirmation="CONFIRM_LINE_PAY_GATEWAY_PRODUCTION_MODE"
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

expect_success "Sandbox base remains explicitly pinned to sandbox" \
  test "$(grep -Ec '^[[:space:]]+LINE_PAY_GATEWAY_ENV:[[:space:]]+sandbox$' "$base_compose")" -eq 1
expect_success "Production Compose overlay exists" test -f "$production_compose"
expect_success "Production Compose wrapper exists and is executable" test -x "$production_wrapper"
expect_success "Production preflight wrapper exists and is executable" test -x "$production_preflight"
expect_success "Production runbook exists" test -f "$production_runbook"

if [[ -f "$production_compose" ]]; then
  expect_failure "Production overlay cannot create a parallel Docker project" \
    grep -Eq '^[[:space:]]*name:' "$production_compose"
  expect_success "Production overlay pins exactly one production environment" \
    test "$(grep -Ec '^[[:space:]]+LINE_PAY_GATEWAY_ENV:[[:space:]]+production$' "$production_compose")" -eq 1
  expect_failure "Production overlay cannot select Sandbox" \
    grep -Eq 'LINE_PAY_GATEWAY_ENV:[[:space:]]+sandbox' "$production_compose"
  expect_failure "Production overlay cannot weaken network or privilege boundaries" \
    grep -Eq '^[[:space:]]*(ports:|network_mode:|privileged:|user:|read_only:|cap_drop:|security_opt:)' \
      "$production_compose"
fi

if [[ -x "$production_wrapper" ]]; then
  expect_failure "Production Compose rejects a missing confirmation" \
    env GATEWAY_IMAGE_TAG="$valid_sha" "$production_wrapper" config --quiet
  expect_failure "Production Compose rejects an invalid confirmation" \
    env \
      GATEWAY_IMAGE_TAG="$valid_sha" \
      LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION=wrong \
      "$production_wrapper" config --quiet
  expect_failure "Production Compose rejects a short image SHA before Docker runs" \
    env \
      GATEWAY_IMAGE_TAG=abc1234 \
      LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION="$confirmation" \
      "$production_wrapper" config --quiet
  expect_failure "Production Compose blocks config output that could reveal env values" \
    env \
      GATEWAY_IMAGE_TAG="$valid_sha" \
      LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION="$confirmation" \
      "$production_wrapper" config
  expect_failure "Production Compose cannot bypass the config-output block with global options" \
    env \
      GATEWAY_IMAGE_TAG="$valid_sha" \
      LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION="$confirmation" \
      "$production_wrapper" --ansi never config
  expect_failure "Production Compose rejects config output modes even when quiet is also present" \
    env \
      GATEWAY_IMAGE_TAG="$valid_sha" \
      LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION="$confirmation" \
      "$production_wrapper" config --quiet --environment
  expect_success "Production Compose always combines the reviewed base and production overlay" \
    grep -Fq 'docker compose -f "$base_compose_file" -f "$production_compose_file"' "$production_wrapper"
  expect_success "Production Compose retains the existing project identity for in-place replacement" \
    grep -Fxq 'name: line-pay-gateway-sandbox' "$base_compose"
fi

if [[ -x "$production_preflight" ]]; then
  expect_success "Production preflight pins the expected environment" \
    grep -Fq 'EXPECTED_GATEWAY_ENVIRONMENT=production' "$production_preflight"
  expect_success "Production preflight validates the reviewed overlay" \
    grep -Fq 'compose.production.yaml' "$production_preflight"
fi

if [[ -f "$production_runbook" ]]; then
  expect_success "Runbook keeps the website runtime disabled before cutover" \
    grep -Fq 'NEXT_PUBLIC_ENABLE_LINE_PAY=false' "$production_runbook"
  expect_success "Runbook requires the exact production confirmation" \
    grep -Fq "$confirmation" "$production_runbook"
  expect_success "Runbook requires the Reserved IP egress" \
    grep -Fq '165.245.144.110' "$production_runbook"
  expect_success "Runbook forbids bulk or fallback deployment" \
    grep -Fq '禁止 retry、fallback' "$production_runbook"
  expect_success "Runbook separates Gateway cutover from website runtime enablement" \
    grep -Fq 'Gateway 切換不等於網站 Runtime 啟用' "$production_runbook"
  expect_success "Runbook forbids a parallel Sandbox and Production container" \
    grep -Fq '不得建立第二個平行 Compose project' "$production_runbook"
  expect_failure "Runbook never prints resolved Production Compose env values" \
    sh -c "grep -F 'compose-production.sh config' \"\$1\" | grep -Fv 'compose-production.sh config --quiet'" \
      sh "$production_runbook"
fi

printf '1..%d\n' "$((pass_count + fail_count))"
printf 'Production deployment contract tests: %d passed, %d failed.\n' "$pass_count" "$fail_count"
((fail_count == 0))
