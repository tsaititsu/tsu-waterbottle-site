#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd -- "$test_dir/.." && pwd)"
drop_in="$deploy_dir/caddy.service.d/line-pay-gateway.conf.example"
validator="$deploy_dir/scripts/validate-caddy-systemd.sh"
network_preflight="$deploy_dir/scripts/preflight-network.sh"
journal_guard="$deploy_dir/scripts/caddy-journal-guard.sh"
preflight="$deploy_dir/scripts/preflight.sh"
vendor_fixture="$test_dir/fixtures/caddy.service"
deploy_runbook="$deploy_dir/SANDBOX_DEPLOY_RUNBOOK.md"
rollback_runbook="$deploy_dir/SANDBOX_ROLLBACK_RUNBOOK.md"
readme="$deploy_dir/../README.md"
valid_proxy_token="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
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

expect_exit() {
  local description="$1"
  local expected_exit="$2"
  shift 2
  local actual_exit

  set +e
  "$@" >/dev/null 2>&1
  actual_exit="$?"
  set -e
  if [[ "$actual_exit" -eq "$expected_exit" ]]; then
    record_pass "$description"
  else
    record_fail "$description"
  fi
}

temp_root="$(mktemp -d "${TMPDIR:-/tmp}/line-pay-caddy-systemd.XXXXXX")"
effective_safe="$temp_root/effective-safe.service"
effective_without_reset="$temp_root/effective-without-reset.service"
effective_extra_exec="$temp_root/effective-extra-exec.service"
effective_wrong_env="$temp_root/effective-wrong-env.service"
effective_shell="$temp_root/effective-shell.service"
effective_wrong_user="$temp_root/effective-wrong-user.service"
effective_unsafe_reload="$temp_root/effective-unsafe-reload.service"
effective_embedded_secret="$temp_root/effective-embedded-secret.service"
effective_spaced_exec="$temp_root/effective-spaced-exec.service"
effective_continuation="$temp_root/effective-continuation.service"
fake_bin="$temp_root/bin"
fake_systemctl_log="$temp_root/systemctl.log"
timestamp_file="$temp_root/journal-start"
clean_journal="$temp_root/clean.journal"
leaked_journal="$temp_root/leaked.journal"
journal_temp_root="$temp_root/journal-temp"
interrupt_temp_root="$temp_root/interrupt-temp"
terminate_temp_root="$temp_root/terminate-temp"
journal_failure_temp_root="$temp_root/journal-failure-temp"
grep_failure_temp_root="$temp_root/grep-failure-temp"
timestamp_record_root="$temp_root/timestamp-record"
timestamp_failure_root="$temp_root/timestamp-failure"
mkdir "$fake_bin"
mkdir \
  "$journal_temp_root" \
  "$interrupt_temp_root" \
  "$terminate_temp_root" \
  "$journal_failure_temp_root" \
  "$grep_failure_temp_root" \
  "$timestamp_record_root" \
  "$timestamp_failure_root"

cleanup() {
  find "$temp_root" -depth -delete
}
trap cleanup EXIT

{
  cat "$vendor_fixture"
  printf '\n# /etc/systemd/system/caddy.service.d/line-pay-gateway.conf\n'
  cat "$drop_in"
} >"$effective_safe"
{
  cat "$vendor_fixture"
  printf '\n[Service]\nEnvironmentFile=/etc/line-pay-gateway/proxy.env\n'
  printf 'ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile\n'
} >"$effective_without_reset"
{
  cat "$effective_safe"
  printf 'ExecStart=/usr/bin/caddy run --config /etc/caddy/other\n'
} >"$effective_extra_exec"
sed 's#EnvironmentFile=/etc/line-pay-gateway/proxy.env#EnvironmentFile=/etc/line-pay-gateway/gateway.env#' \
  "$effective_safe" >"$effective_wrong_env"
sed 's#ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile#ExecStart=/bin/sh -c /usr/bin/caddy\\ run#' \
  "$effective_safe" >"$effective_shell"
{
  cat "$effective_safe"
  printf '\n[Service]\nUser=root\n'
} >"$effective_wrong_user"
sed 's#ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force#ExecReload=/usr/bin/caddy reload --environ --config /etc/caddy/Caddyfile --force#' \
  "$effective_safe" >"$effective_unsafe_reload"
{
  cat "$effective_safe"
  printf '\n[Service]\nEnvironment=LINE_PAY_GATEWAY_PROXY_TOKEN=not-a-real-token\n'
} >"$effective_embedded_secret"
{
  cat "$effective_safe"
  printf '\n[Service]\nExecStart = /usr/bin/caddy run --config /etc/caddy/other\n'
} >"$effective_spaced_exec"
{
  cat "$effective_safe"
  printf '\n[Service]\nEnvironment=SAFE=value\\\n continued\n'
} >"$effective_continuation"

printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" "${FAKE_SS_OUTPUT:-}"' \
  >"$fake_bin/ss"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "${1:-}" == "inspect" ]]; then printf "%s\n" healthy; else exit 2; fi' \
  >"$fake_bin/docker"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" "{\"ok\":true,\"status\":\"healthy\"}"' \
  >"$fake_bin/curl"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" "ordinary Caddy startup log"' \
  >"$fake_bin/journal-clean"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  "printf '%s\\n' 'startup environment contains ${valid_proxy_token}'" \
  >"$fake_bin/journal-leak"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "${1:-}" == "is-active" ]]; then' \
  '  printf "%s\n" "${FAKE_SYSTEMCTL_ACTIVE_STATE:-active}"' \
  '  [[ "${FAKE_SYSTEMCTL_ACTIVE_STATE:-active}" == "active" ]]' \
  '  exit' \
  'fi' \
  'printf "%s\n" "$*" >>"$FAKE_SYSTEMCTL_LOG"' \
  >"$fake_bin/systemctl"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'exit 1' \
  >"$fake_bin/journal-fail"
chmod 0755 "$fake_bin"/*

printf '%s\n' '2026-07-16 00:00:00 UTC' >"$timestamp_file"
printf '%s\n' 'ordinary Caddy startup log' >"$clean_journal"
printf '%s\n' "startup environment contains $valid_proxy_token" >"$leaked_journal"

expect_success "committed Caddy systemd drop-in matches the strict validator" \
  "$validator" drop-in "$drop_in"
expect_success "drop-in contains exactly one dedicated Proxy EnvironmentFile" \
  sh -c 'test "$(grep -Fxc "EnvironmentFile=/etc/line-pay-gateway/proxy.env" "$1")" -eq 1' sh "$drop_in"
expect_success "drop-in clears ExecStart before assigning the safe command" \
  awk '
    /^ExecStart=$/ { clear_line = NR }
    /^ExecStart=\/usr\/bin\/caddy run --config \/etc\/caddy\/Caddyfile --adapter caddyfile$/ { safe_line = NR }
    END { exit (clear_line > 0 && safe_line == clear_line + 1) ? 0 : 1 }
  ' "$drop_in"
expect_success "drop-in uses the exact direct Caddy ExecStart" \
  grep -Fxq 'ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile' "$drop_in"
expect_failure "drop-in does not contain the environment display flag" \
  grep -Fq -- '--environ' "$drop_in"
expect_failure "drop-in does not contain an env-file command flag" \
  grep -Fq -- '--envfile' "$drop_in"
expect_failure "drop-in does not contain a shell wrapper" \
  grep -Eq '(^|[=/[:space:]])(sh|bash)([[:space:]]|-c|$)' "$drop_in"
expect_failure "drop-in contains no value shaped like a real Proxy Token" \
  grep -Eq '[0-9a-f]{64}' "$drop_in"
expect_failure "drop-in does not override User or Group" \
  grep -Eq '^(User|Group)=' "$drop_in"
expect_failure "deployment tree does not provide a replacement vendor caddy.service" \
  test -e "$deploy_dir/caddy.service"

expect_success "effective unit simulation accepts the vendor unit plus safe drop-in" \
  "$validator" effective "$effective_safe"
expect_failure "effective unit rejects the unsafe vendor ExecStart without an override" \
  "$validator" effective "$vendor_fixture"
expect_failure "effective unit rejects an override that omits the empty ExecStart reset" \
  "$validator" effective "$effective_without_reset"
expect_failure "effective unit rejects more than one final ExecStart" \
  "$validator" effective "$effective_extra_exec"
expect_failure "effective unit rejects gateway.env as the Caddy EnvironmentFile" \
  "$validator" effective "$effective_wrong_env"
expect_failure "effective unit rejects a shell wrapper" \
  "$validator" effective "$effective_shell"
expect_failure "effective unit rejects a changed service User" \
  "$validator" effective "$effective_wrong_user"
expect_failure "effective unit rejects an ExecReload that displays environment" \
  "$validator" effective "$effective_unsafe_reload"
expect_failure "effective unit rejects embedded Gateway values" \
  "$validator" effective "$effective_embedded_secret"
expect_failure "effective unit parses whitespace around directive assignment and rejects extra ExecStart" \
  "$validator" effective "$effective_spaced_exec"
expect_failure "effective unit fails closed on a Service line continuation" \
  "$validator" effective "$effective_continuation"
expect_success "effective unit validator accepts systemctl cat content from stdin" \
  sh -c '"$1" effective - <"$2"' sh "$validator" "$effective_safe"

expect_success "deploy runbook explicitly forbids caddy environ" \
  grep -Fq '禁止執行 `caddy environ`' "$deploy_runbook"
expect_success "deploy runbook explicitly forbids systemctl environment display" \
  grep -Fq '禁止執行 `systemctl show caddy --property=Environment`' "$deploy_runbook"
expect_success "deploy runbook explicitly forbids process environment inspection" \
  sh -c 'grep -Fq "禁止執行 \`ps e\`" "$1" && grep -Fq "禁止讀取 \`/proc/<pid>/environ\`" "$1"' \
    sh "$deploy_runbook"
expect_success "rollback runbook includes Caddy drop-in restoration" \
  grep -Fq '回復 Caddyfile 與 systemd drop-in' "$rollback_runbook"
expect_success "Gateway README documents the safe systemd ExecStart boundary" \
  grep -Fq '/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile' "$readme"

expect_exit "full preflight fails closed when mode is missing" 2 "$preflight"
expect_exit "full preflight fails closed for an unknown mode" 2 "$preflight" automatic
expect_exit "network preflight fails closed when mode is missing" 2 "$network_preflight"
expect_exit "network preflight requires an explicit public-caddy phase" 2 "$network_preflight" public-caddy

free_listeners=$'LISTEN 0 4096 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1,fd=3))'
gateway_listeners=$'LISTEN 0 4096 127.0.0.1:3000 0.0.0.0:* users:(("docker-proxy",pid=2,fd=4))'
caddy_listeners="${gateway_listeners}"$'\nLISTEN 0 4096 0.0.0.0:80 0.0.0.0:* users:(("caddy",pid=3,fd=5))\nLISTEN 0 4096 [::]:443 [::]:* users:(("caddy",pid=3,fd=6))\nLISTEN 0 4096 127.0.0.1:2019 0.0.0.0:* users:(("caddy",pid=3,fd=7))'

expect_success "prepare mode accepts free 80, 443, and 3000 ports" \
  env FAKE_SS_OUTPUT="$free_listeners" SS_COMMAND="$fake_bin/ss" \
    "$network_preflight" prepare
expect_failure "prepare mode rejects an occupied Gateway port" \
  env FAKE_SS_OUTPUT="$gateway_listeners" SS_COMMAND="$fake_bin/ss" \
    "$network_preflight" prepare
expect_success "gateway-running accepts an IPv4 localhost-only Gateway" \
  env FAKE_SS_OUTPUT="$gateway_listeners" SS_COMMAND="$fake_bin/ss" \
    DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    "$network_preflight" gateway-running
expect_failure "gateway-running rejects an IPv4 wildcard Gateway listener" \
  env FAKE_SS_OUTPUT='LISTEN 0 4096 0.0.0.0:3000 0.0.0.0:* users:(("docker-proxy",pid=2,fd=4))' \
    SS_COMMAND="$fake_bin/ss" DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    "$network_preflight" gateway-running
expect_failure "gateway-running rejects an IPv6 wildcard Gateway listener" \
  env FAKE_SS_OUTPUT='LISTEN 0 4096 [::]:3000 [::]:* users:(("docker-proxy",pid=2,fd=4))' \
    SS_COMMAND="$fake_bin/ss" DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    "$network_preflight" gateway-running
expect_success "public-caddy pre-start accepts healthy Gateway with free public ports" \
  env FAKE_SS_OUTPUT="$gateway_listeners" SS_COMMAND="$fake_bin/ss" \
    DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    "$network_preflight" public-caddy pre-start
expect_failure "public-caddy pre-start rejects an occupied port 80" \
  env FAKE_SS_OUTPUT="${gateway_listeners}"$'\nLISTEN 0 4096 0.0.0.0:80 0.0.0.0:* users:(("unknown",pid=4,fd=8))' \
    SS_COMMAND="$fake_bin/ss" DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    "$network_preflight" public-caddy pre-start
expect_success "public-caddy post-start accepts Caddy on 80 and 443 with loopback admin" \
  env FAKE_SS_OUTPUT="$caddy_listeners" SS_COMMAND="$fake_bin/ss" \
    DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    "$network_preflight" public-caddy post-start
expect_failure "public-caddy post-start rejects an inactive Caddy service" \
  env FAKE_SS_OUTPUT="$caddy_listeners" SS_COMMAND="$fake_bin/ss" \
    DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    FAKE_SYSTEMCTL_ACTIVE_STATE=inactive \
    "$network_preflight" public-caddy post-start
expect_failure "public-caddy post-start rejects a public Caddy admin listener" \
  env FAKE_SS_OUTPUT="${caddy_listeners/127.0.0.1:2019/0.0.0.0:2019}" SS_COMMAND="$fake_bin/ss" \
    DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    "$network_preflight" public-caddy post-start
expect_failure "public-caddy post-start rejects a non-Caddy public listener" \
  env FAKE_SS_OUTPUT="${caddy_listeners/\"caddy\",pid=3,fd=5/\"unknown\",pid=3,fd=5}" \
    SS_COMMAND="$fake_bin/ss" DOCKER_COMMAND="$fake_bin/docker" CURL_COMMAND="$fake_bin/curl" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    "$network_preflight" public-caddy post-start

expect_success "journal scan implementation uses a protected pattern file instead of a token argument" \
  grep -Fq 'grep -F -q -f "$pattern_file" "$journal_file"' "$journal_guard"
expect_success "journal start marker is installed atomically without leaving its temporary file" \
  bash -c '
    source "$1"
    chown() { return 0; }
    record_journal_start_time "$2/start"
    test -s "$2/start"
    test -z "$(find "$2" -name ".caddy-journal-start.*" -print -quit)"
  ' bash "$journal_guard" "$timestamp_record_root"
expect_failure "journal start marker fails closed when chown fails" \
  bash -c '
    source "$1"
    chown() { return 1; }
    record_journal_start_time "$2/start"
  ' bash "$journal_guard" "$timestamp_failure_root"
expect_success "chown failure removes the journal timestamp temporary file" \
  sh -c 'test -z "$(find "$1" -mindepth 1 -print -quit)"' sh "$timestamp_failure_root"
expect_success "journal scan succeeds when the Proxy Token is absent" \
  env TMPDIR="$journal_temp_root" bash -c \
    'source "$1"; install_journal_guard_cleanup_traps; scan_journal_file_for_proxy_token "$2" "$3"' \
    bash "$journal_guard" "$valid_proxy_token" "$clean_journal"
expect_success "normal journal scan removes all guarded temporary files" \
  sh -c 'test -z "$(find "$1" -mindepth 1 -print -quit)"' sh "$journal_temp_root"
expect_failure "journal scan fails when the Proxy Token is present" \
  bash -c 'source "$1"; scan_journal_file_for_proxy_token "$2" "$3"' \
    bash "$journal_guard" "$valid_proxy_token" "$leaked_journal"
expect_exit "SIGINT cleans a guarded Proxy Token pattern file" 130 \
  env TMPDIR="$interrupt_temp_root" bash -c '
    source "$1"
    install_journal_guard_cleanup_traps
    create_journal_guard_temp_dir guarded_dir
    printf "%s\n" "$2" >"$guarded_dir/proxy-token.pattern"
    chmod 0600 "$guarded_dir/proxy-token.pattern"
    kill -INT "$$"
  ' bash "$journal_guard" "$valid_proxy_token"
expect_success "SIGINT leaves no guarded temporary files" \
  sh -c 'test -z "$(find "$1" -mindepth 1 -print -quit)"' sh "$interrupt_temp_root"
expect_exit "SIGTERM cleans a guarded Proxy Token pattern file" 143 \
  env TMPDIR="$terminate_temp_root" bash -c '
    source "$1"
    install_journal_guard_cleanup_traps
    create_journal_guard_temp_dir guarded_dir
    printf "%s\n" "$2" >"$guarded_dir/proxy-token.pattern"
    chmod 0600 "$guarded_dir/proxy-token.pattern"
    kill -TERM "$$"
  ' bash "$journal_guard" "$valid_proxy_token"
expect_success "SIGTERM leaves no guarded temporary files" \
  sh -c 'test -z "$(find "$1" -mindepth 1 -print -quit)"' sh "$terminate_temp_root"
expect_failure "journalctl failure fails closed" \
  env TMPDIR="$journal_failure_temp_root" JOURNALCTL_COMMAND="$fake_bin/journal-fail" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    bash -c '
      source "$1"
      install_journal_guard_cleanup_traps
      test_token="$2"
      check_proxy_env_file() { return 0; }
      check_root_only_regular_file() { return 0; }
      read_proxy_token() { printf "%s\n" "$test_token"; }
      scan_new_caddy_journal ignored "$3"
    ' bash "$journal_guard" "$valid_proxy_token" "$timestamp_file"
expect_success "journalctl failure removes all guarded temporary files" \
  sh -c 'test -z "$(find "$1" -mindepth 1 -print -quit)"' sh "$journal_failure_temp_root"
expect_success "journalctl failure stops and disables Caddy" \
  sh -c 'grep -Fxq "stop caddy" "$1" && grep -Fxq "disable caddy" "$1"' sh "$fake_systemctl_log"
expect_exit "grep failure returns the controlled scan error" 2 \
  env TMPDIR="$grep_failure_temp_root" bash -c '
    source "$1"
    install_journal_guard_cleanup_traps
    grep() { return 2; }
    scan_journal_file_for_proxy_token "$2" "$3"
  ' bash "$journal_guard" "$valid_proxy_token" "$clean_journal"
expect_success "grep failure removes all guarded temporary files" \
  sh -c 'test -z "$(find "$1" -mindepth 1 -print -quit)"' sh "$grep_failure_temp_root"
: >"$fake_systemctl_log"
expect_failure "simulated journal leakage stops the guarded deployment" \
  env TMPDIR="$journal_temp_root" JOURNALCTL_COMMAND="$fake_bin/journal-leak" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" \
    FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    bash -c '
      source "$1"
      test_token="$2"
      check_proxy_env_file() { return 0; }
      check_root_only_regular_file() { return 0; }
      read_proxy_token() { printf "%s\n" "$test_token"; }
      scan_new_caddy_journal ignored "$3"
    ' bash "$journal_guard" "$valid_proxy_token" "$timestamp_file"
expect_success "journal leak response issues both stop and disable for Caddy" \
  sh -c 'grep -Fxq "stop caddy" "$1" && grep -Fxq "disable caddy" "$1"' sh "$fake_systemctl_log"
systemctl_calls_before_clean="$(wc -l <"$fake_systemctl_log" | tr -d '[:space:]')"
expect_success "simulated clean journal range passes without service mutation" \
  env TMPDIR="$journal_temp_root" JOURNALCTL_COMMAND="$fake_bin/journal-clean" \
    SYSTEMCTL_COMMAND="$fake_bin/systemctl" \
    FAKE_SYSTEMCTL_LOG="$fake_systemctl_log" \
    bash -c '
      source "$1"
      test_token="$2"
      check_proxy_env_file() { return 0; }
      check_root_only_regular_file() { return 0; }
      read_proxy_token() { printf "%s\n" "$test_token"; }
      scan_new_caddy_journal ignored "$3"
    ' bash "$journal_guard" "$valid_proxy_token" "$timestamp_file"
expect_success "clean journal scan does not issue a systemctl command" \
  sh -c 'test "$(wc -l <"$1" | tr -d "[:space:]")" = "$2"' \
    sh "$fake_systemctl_log" "$systemctl_calls_before_clean"
expect_success "journal guard never passes the Proxy Token to grep on the command line" \
  sh -c '! grep -Eq "grep .*proxy_token|grep .*LINE_PAY_GATEWAY_PROXY_TOKEN" "$1"' sh "$journal_guard"
expect_success "deploy runbook orders pre-start, journal marker, start, post-start, TLS, headers, and journal scan" \
  awk '
    /^## 14[.] / { in_scope = 1 }
    /^## 16[.] / { in_scope = 0 }
    in_scope && /preflight[.]sh public-caddy pre-start/ && !pre_start { pre_start = NR }
    in_scope && /caddy-journal-guard[.]sh/ {
      guard_count += 1
      if (guard_count == 1) marker = NR
      if (guard_count == 2) scan = NR
    }
    in_scope && /systemctl enable --now caddy/ { service_start = NR }
    in_scope && /preflight[.]sh public-caddy post-start/ { post_start = NR }
    in_scope && /verify-tls[.]sh linepay-gateway[.]tsu-waterbottle[.]com/ { tls = NR }
    in_scope && /Strict-Transport-Security/ { headers = NR }
    END {
      exit (pre_start < marker && marker < service_start && service_start < post_start \
        && post_start < tls && tls < headers && headers < scan) ? 0 : 1
    }
  ' "$deploy_runbook"

printf '1..%d\n' "$((pass_count + fail_count))"
printf 'Caddy systemd security tests: %d passed, %d failed.\n' "$pass_count" "$fail_count"
((fail_count == 0))
