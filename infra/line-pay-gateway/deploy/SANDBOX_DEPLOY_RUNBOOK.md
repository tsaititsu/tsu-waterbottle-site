# LINE Pay Gateway Sandbox 部署 Runbook

## 0. 範圍與停止條件

本文件只供日後由有權限的人員，將已審核 commit 部署到既有 Sandbox Droplet。Phase 2A 不執行本文命令。

已知主機識別：

- Droplet：`linepay-gateway-sgp1`
- 原始 Public IPv4：`168.144.142.127`
- Reserved／固定出口 IPv4：`165.245.144.110`
- Sandbox Gateway domain：`linepay-gateway.tsu-waterbottle.com`
- 入站 URL：`https://linepay-gateway.tsu-waterbottle.com`
- DNS A record：`linepay-gateway.tsu-waterbottle.com → 165.245.144.110`
- Cloudflare DNS mode：只允許 `DNS only`／灰雲
- LINE Pay Sandbox 白名單來源：`165.245.144.110/32`
- Ubuntu：預期 `24.04`
- Gateway container port：`3000`
- Host bind：只允許 `127.0.0.1:3000`

入站用途與出站用途必須分開理解：

- 入站用途：Vercel／瀏覽器透過 `https://linepay-gateway.tsu-waterbottle.com` 連入 Gateway；DNS A record 讓外部找到 Reserved IP。
- 出站用途：Gateway 呼叫 LINE Pay Sandbox API 時，LINE Pay 看到的來源 IPv4 是 `165.245.144.110`；LINE Pay 白名單使用 `165.245.144.110/32`。

兩者目前使用同一個 Reserved IP，但 DNS 不等於 LINE Pay 白名單。原始 Droplet IP `168.144.142.127` 不得填入 LINE Pay 白名單。網域與公開 IP 不是秘密，可以記錄在 Git；本 runbook 不會建立 DNS 或修改 LINE Pay 後台。

立即停止的情況：

- 主機、Ubuntu 版本或固定出口 IP 不符。
- 取得的 commit 不是已人工審核的 40 字元小寫完整 SHA。
- `gateway.env` 或 `proxy.env` 是 symlink、owner 不是 root、mode 不是 600、缺欄位，或兩者其實是同一檔案。
- Caddyfile 不是已核准的 `linepay-gateway.tsu-waterbottle.com`。
- Cloudflare record 準備啟用 Proxy／橘雲，或無法確認仍為 DNS only／灰雲。
- 需要把秘密貼到聊天室、Git、command line、log 或 Docker image。
- Compose 顯示 Gateway port 綁到 `0.0.0.0`、host network、privileged、Docker socket 或 Production。
- 任一 health、TLS、egress、CI 或 log 檢查失敗。

不得把本文件包成無停頓的一鍵腳本。每一階段完成後都要人工核對再繼續。

## 1. 使用者先決定並記錄

部署前必須由使用者提供或確認：

- 已審核的完整 commit SHA。
- Sandbox Gateway domain 已決定為 `linepay-gateway.tsu-waterbottle.com`；不得替換為 Production hostname。
- DNS record 何時由誰建立。
- Cloudflare DNS record 明確設定為 DNS only／灰雲；本架構不支援直接開啟 Proxy／橘雲。
- 有權限分別保管 Gateway HMAC secret 與獨立 Proxy Token 的人。
- 維護時段、負責人、rollback 前一個 image tag。
- DigitalOcean 免費監控、告警接收者與預計退場日期。

不要記錄任何 secret 真值。

## 2. 唯讀確認主機名稱與 Ubuntu

執行：

```bash
hostnamectl
uname -a
cat /etc/os-release
```

成功標準：

- 主機可辨識為預定 Droplet。
- `/etc/os-release` 顯示 Ubuntu `24.04`。

失敗時：

- 停止，不安裝任何套件。
- 回到 DigitalOcean Console 人工確認 Droplet 身分。

回復方式：此步驟唯讀，不需回復。

## 3. 唯讀確認固定出口 IP

執行：

```bash
curl -4 --fail --silent --show-error https://icanhazip.com/
```

成功結果必須完全是：

```text
165.245.144.110
```

也可以在取得 repository 後使用：

```bash
infra/line-pay-gateway/deploy/scripts/verify-egress.sh 165.245.144.110
```

失敗時：

- 立即停止。
- 不修改 Netplan、不重新綁定 Reserved IP、不改防火牆。
- 先由另一個明確授權的網路任務檢查既有固定出口設定。

回復方式：此步驟唯讀，不需回復。

## 4. 更新系統套件

執行前檢查：

```bash
apt list --upgradable
systemctl --failed
```

確認沒有進行中的付款測試、沒有其他維護作業，並已安排可接受的重開機時段後，才逐步執行：

```bash
sudo apt-get update
sudo apt-get upgrade
```

不要使用未審核的安裝腳本，不要使用 `curl ... | sh`。

成功標準：

- apt 沒有錯誤。
- `systemctl --failed` 沒有新增失敗服務。
- 若套件要求 reboot，先停止本 runbook，取得人工確認後另行重開並重新執行第 2、3 步。

失敗時：

- 不繼續安裝 Docker 或 Caddy。
- 保留 apt 輸出，人工判斷套件狀態。

回復方式：

- 不自行 downgrade 或移除系統套件。
- 由主機維護人員依 apt 紀錄處理。

## 5. 安裝 Docker Engine 與 Compose plugin

先確認沒有衝突套件：

```bash
dpkg -l | grep -E 'docker|containerd|runc|podman'
```

依 Docker 官方 Ubuntu apt repository 流程逐步安裝；不要使用 convenience script。以下命令要逐段執行並核對每段退出碼：

```bash
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

再建立官方 apt source：

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin
```

安裝套件必須包含：

```text
docker-ce
docker-ce-cli
containerd.io
docker-buildx-plugin
docker-compose-plugin
```

安裝後唯讀驗證：

```bash
sudo systemctl status docker --no-pager
sudo docker version
sudo docker compose version
```

安全提醒：

- Docker 公開 container port 可能繞過部分 host firewall 規則；本專案 Compose 只允許 `127.0.0.1:3000`。
- 不把一般帳號加入 `docker` group；Docker group 等同高權限。
- 不掛載 `/var/run/docker.sock` 給任何 container。

成功標準：

- Docker daemon 正常。
- `docker compose version` 成功。

失敗時：

- 停止，不建立 container。
- 不移除 `/var/lib/docker`，不做 destructive cleanup。

回復方式：依 Docker 官方套件文件人工修復；不得刪除既有 image／volume 來排錯。

## 6. 建立非 root 執行帳號

建立不可互動登入的 system account：

```bash
sudo useradd \
  --system \
  --home-dir /opt/line-pay-gateway \
  --shell /usr/sbin/nologin \
  linepaygw
```

成功標準：

```bash
getent passwd linepaygw
```

- 帳號存在。
- shell 是 `/usr/sbin/nologin`。
- 帳號沒有加入 `docker` group。

失敗時：停止，不用 root 長期執行 application process。

回復方式：若帳號參數錯誤，先人工確認沒有任何檔案或程序使用該帳號，再另開核准任務處理；本 runbook 不刪帳號。

Compose 內 Gateway container 仍固定使用 Dockerfile 的非 root `node` user；host account 與 container user 是兩層不同的防護。

## 7. 建立 host 目錄

執行前確認路徑不存在或內容已盤點：

```bash
sudo ls -la /opt/line-pay-gateway /etc/line-pay-gateway 2>/dev/null || true
```

建立：

```bash
sudo install -d -o linepaygw -g linepaygw -m 0750 /opt/line-pay-gateway
sudo install -d -o root -g root -m 0700 /etc/line-pay-gateway
sudo install -d -o root -g root -m 0750 /var/log/line-pay-gateway
```

成功標準：

```bash
sudo stat -c '%U:%G %a %n' \
  /opt/line-pay-gateway \
  /etc/line-pay-gateway \
  /var/log/line-pay-gateway
```

失敗時：停止，不放寬成 world-writable。

回復方式：修正 owner／mode，不刪除未知內容。

## 8. 建立兩個相互隔離的 root-only Sandbox env file

從 repository 的 `deploy/gateway.env.example` 人工建立：

```text
/etc/line-pay-gateway/gateway.env
```

先建立空檔：

```bash
sudo install -o root -g root -m 0600 /dev/null /etc/line-pay-gateway/gateway.env
sudoedit /etc/line-pay-gateway/gateway.env
```

必須包含：

- `PORT=3000`
- `LINE_PAY_GATEWAY_ENV=sandbox`
- `LINE_PAY_GATEWAY_KEY_ID`
- `LINE_PAY_GATEWAY_SECRET`
- `LINE_PAY_UPSTREAM_TIMEOUT_MS`
- `GATEWAY_TIMESTAMP_TOLERANCE_SECONDS`
- `GATEWAY_REPLAY_TTL_SECONDS`
- `GATEWAY_RATE_LIMIT_WINDOW_MS`
- `GATEWAY_RATE_LIMIT_MAX`

Gateway HMAC Secret 規則：

- 由有權限的人在主機的私人終端產生，例如 `openssl rand -base64 48`。
- 不把輸出貼到聊天室、ticket、Git、PR 或一般 shell script。
- Gateway secret 不得與 LINE Pay Channel Secret 共用。
- 不使用 DigitalOcean metadata 儲存秘密。

再從 `deploy/proxy.env.example` 人工建立只供 Caddy 與 Gateway 共用的獨立檔案：

```text
/etc/line-pay-gateway/proxy.env
```

```bash
sudo install -o root -g root -m 0600 /dev/null /etc/line-pay-gateway/proxy.env
sudoedit /etc/line-pay-gateway/proxy.env
```

正式檔案只能有一行：

```text
LINE_PAY_GATEWAY_PROXY_TOKEN=<64 個小寫十六進位字元>
```

由有權限的人在主機私人終端產生，例如 `openssl rand -hex 32`；本文件不記錄輸出。Proxy Token 必須與 `LINE_PAY_GATEWAY_SECRET`、LINE Pay Channel Secret 完全不同，不得合併回 `gateway.env`。

成功標準：

```bash
sudo stat -c '%U:%G %a %n' \
  /etc/line-pay-gateway/gateway.env \
  /etc/line-pay-gateway/proxy.env
```

兩個檔案都必須是不同的 regular file、不是 symlink、owner／group 為 `root:root`、mode `600`。`proxy.env` 只能包含 Proxy Token；不要用 `cat`、`grep` 或 log 顯示真值。

失敗時：停止，不啟動 Compose。

回復方式：撤銷暴露的 secret、重新產生，再用 `sudoedit` 修正；不可只刪 terminal history 當作輪替。

## 9. 取得已審核 commit

建議使用 repository deploy key 或已核准的唯讀取得方式；不要把 token 放在 clone URL。

```bash
sudo -u linepaygw git clone <REPOSITORY_URL> /opt/line-pay-gateway/repository
cd /opt/line-pay-gateway/repository
sudo -u linepaygw git fetch --tags origin
sudo -u linepaygw git checkout --detach <APPROVED_COMMIT_SHA>
export DEPLOY_SHA="$(sudo -u linepaygw git rev-parse HEAD)"
infra/line-pay-gateway/deploy/scripts/validators.sh \
  release \
  line-pay-fixed-ip-gateway \
  "$DEPLOY_SHA"
sudo -u linepaygw git status --short
```

成功標準：

- HEAD 完全等於使用者核准的完整 SHA。
- `DEPLOY_SHA` 符合 `^[0-9a-f]{40}$`，image name 精確等於 `line-pay-fixed-ip-gateway`。
- `git status --short` 為空。
- commit 已通過 Draft PR 人工審核與必要 checks。

失敗時：停止，不 checkout 其他未核准 commit。

回復方式：保留 checkout 供盤點，不執行 build；由使用者重新指定 SHA。

## 10. 準備已核准 Sandbox domain 的 Caddyfile，但不改 DNS

把 repository 內已核准 domain 的版本放在 application 目錄；此時尚未安裝或啟動 Caddy：

```bash
sudo install -o root -g root -m 0644 \
  infra/line-pay-gateway/deploy/Caddyfile.example \
  /opt/line-pay-gateway/Caddyfile.sandbox
```

不得替換成其他 Sandbox 或 Production hostname。不要放 Gateway secret、完整簽章、LINE Pay authorization header 或 access log。

此步驟不建立 DNS、不啟動 Caddy、不申請憑證。

成功標準：

- `/opt/line-pay-gateway/Caddyfile.sandbox` 使用且只使用 `linepay-gateway.tsu-waterbottle.com`。
- upstream 仍是 `127.0.0.1:3000`。
- 只允許 `GET /health` 與 `POST /v1/line-pay/proxy`。
- proxy route 以 `header_up X-Gateway-Client-IP {remote_host}` 強制覆寫呼叫端可能送來的同名 header。
- proxy route 以 `header_up X-Gateway-Proxy-Token {$LINE_PAY_GATEWAY_PROXY_TOKEN}` 強制覆寫同名 header，不得硬編碼 token 或從 client request header 複製。

失敗時：停止，不猜測正式網域。

回復方式：保留 example，等待使用者決定網域。

## 11. 執行只讀 preflight

在任何 build 或 service start 前執行：

```bash
cd /opt/line-pay-gateway/repository
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$DEPLOY_SHA" \
  GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  CADDYFILE=/opt/line-pay-gateway/Caddyfile.sandbox \
  CLOUDFLARE_DNS_MODE=dns-only \
  EXPECTED_EGRESS_IP=165.245.144.110 \
  GATEWAY_BIND_PORT=3000 \
  infra/line-pay-gateway/deploy/scripts/preflight.sh
```

preflight 只做檢查，不安裝套件、不改檔案、不啟停服務。

成功標準：最後顯示 `Preflight checks passed. No system changes were made.`

失敗時：依第一個 `FAIL` 停止。不可用改 script、放寬權限或改成 Production 來繞過。

回復方式：修正明確前置條件後重新執行全部 preflight。

## 12. Build Gateway image

使用完整核准 commit SHA 作 image tag。所有 Compose 命令必須透過 `deploy/scripts/compose.sh`；直接執行 `docker compose` 會因缺少 wrapper 產生的已驗證變數而 fail closed：

```bash
cd /opt/line-pay-gateway/repository/infra/line-pay-gateway
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$DEPLOY_SHA" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  deploy/scripts/compose.sh build --pull gateway
sudo docker image inspect "line-pay-fixed-ip-gateway:$DEPLOY_SHA"
```

成功標準：

- build 成功。
- image tag 完全等於核准 SHA。
- build log 沒有 env 真值或 secret。

失敗時：停止，不用 `latest` 或其他未審核 image 代替。

回復方式：保留 build log；修正程式要回 Git PR，不直接改主機 checkout。

## 13. 啟動 Compose 並驗證 localhost health

啟動前再次確認 rendered config：

```bash
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$DEPLOY_SHA" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh config --quiet
```

`config --quiet` 只驗證，不輸出可能解析到的 env 值。再直接審查 repository 內不含秘密的 `deploy/compose.yaml`，確認：

- `LINE_PAY_GATEWAY_ENV: sandbox`
- `env_file` 分別引用 `gateway.env` 與 `proxy.env`。
- port 是 `127.0.0.1:3000:3000`
- `read_only: true`
- `cap_drop: ALL`
- `no-new-privileges:true`
- 沒有 privileged、host network 或 Docker socket。

再執行：

```bash
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$DEPLOY_SHA" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh up -d --no-build gateway
deploy/scripts/verify-health.sh http://127.0.0.1:3000/health
```

成功標準：

- container health 是 healthy。
- localhost health 回固定安全 JSON。
- `ss -ltn` 只看到 `127.0.0.1:3000`，沒有 `0.0.0.0:3000` 或 `[::]:3000`。

失敗時：停止，不設定 DNS 或 Caddy。保留 logs：

```bash
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$DEPLOY_SHA" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh logs --no-color gateway
```

回復方式：依 `SANDBOX_ROLLBACK_RUNBOOK.md` 回到已存在的上一個 image；不要執行 `docker compose down -v`。

## 14. 安裝並設定 Caddy

先確認沒有其他服務占用 80／443。若有任何 listener，停止並確認用途；不得為了 Caddy 任意停止未知服務：

```bash
sudo ss -ltnp | grep -E ':(80|443)[[:space:]]' || true
```

使用 Caddy 官方 stable Debian／Ubuntu package repository，不使用不明 binary 或 `curl | sh`。逐段執行：

```bash
sudo apt-get install -y \
  debian-keyring \
  debian-archive-keyring \
  apt-transport-https \
  curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install caddy
```

官方 package 可能自動啟動 systemd service。尚未放入已審核 config 與確認 DNS 前，先停止：

```bash
sudo systemctl stop caddy
```

再把已審核的 candidate 放到正式位置，並建立只讀取 Proxy Token 的 systemd override。Caddy 不得讀取 `gateway.env`：

```bash
caddy version
sudo install -o root -g root -m 0644 \
  /opt/line-pay-gateway/Caddyfile.sandbox \
  /etc/caddy/Caddyfile
sudo systemctl edit caddy
```

在 editor 中只加入：

```ini
[Service]
EnvironmentFile=/etc/line-pay-gateway/proxy.env
```

儲存後：

```bash
sudo systemctl daemon-reload
sudo sh -c '
  set -a
  . /etc/line-pay-gateway/proxy.env
  set +a
  exec caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
'
```

上述驗證只在 `validate-proxy-env.sh` 與完整 preflight 已成功後執行，不輸出 token，也不把 token 放在 command line。systemd manager 只從 root-owned `proxy.env` 注入 Caddy 所需變數。

在啟用 Caddy 前，必須先由有權限人員確認 Reserved IP `165.245.144.110` 仍綁定 `linepay-gateway-sgp1`，再人工建立：

```text
Type: A
Name: linepay-gateway.tsu-waterbottle.com
Value: 165.245.144.110
TTL: 300
Proxy status: DNS only（灰雲）
```

本 runbook 不執行上述 DNS 修改。Sandbox 初期禁止開啟 Cloudflare Proxy／橘雲；DNS only 時 Caddy 的 `{remote_host}` 才是直接 TCP 來源。若日後需要橘雲，必須先另行設計與測試 Cloudflare trusted proxy 邊界，不得直接沿用現有 client IP 信任規則。DNS 生效前不得啟動 Caddy 自動申請正式憑證。從 Droplet 與另一個外部 resolver 查詢，結果都必須只包含 `165.245.144.110`；若仍指向原始 Droplet IP `168.144.142.127` 或其他 IP，立即停止。

只有 config validation 成功、80／443 沒有未知服務占用，且 DNS 已由使用者確認生效後，才啟用：

```bash
sudo systemctl enable --now caddy
sudo systemctl status caddy --no-pager
```

架構必須保持：

```text
Vercel / browser
→ https://linepay-gateway.tsu-waterbottle.com :80/:443
→ host Caddy
→ 127.0.0.1:3000
→ Gateway container
→ LINE Pay Sandbox（來源 IPv4：165.245.144.110）
```

Caddy 預設保留 request method、URI、headers 與 body；本設定不重寫 HMAC request body。`request_body max_size 64KB` 在 reverse proxy 前再次限制 body。

付款 proxy route 同時以 `header_up X-Gateway-Proxy-Token {$LINE_PAY_GATEWAY_PROXY_TOKEN}` 與 `header_up X-Gateway-Client-IP {remote_host}` 強制覆寫任何呼叫端提供的同名 headers。Gateway 先 timing-safe 驗證 Proxy Token，再信任 Client IP 作 per-client rate limit；不依賴 Docker NAT 後的 socket peer、Docker bridge IP、`X-Forwarded-For` 或任意 proxy CIDR。

Proxy Token 不參與網站 HMAC canonical string、LINE Pay 官方簽章或付款授權；Proxy Token 與 Client IP 都不轉送到 LINE Pay，也不進入一般付款 log。

為避免記錄 `x-gateway-signature` 與 LINE Pay authorization headers，example 預設不啟用 Caddy access log。若未來需要 access log，必須先另行設計 header redaction。

成功標準：

- Caddy config validation 通過。
- Caddy service 正常。
- systemd override 只引用 `/etc/line-pay-gateway/proxy.env`，沒有引用 `gateway.env`。
- 只有 80／443 對外，Gateway 3000 仍只在 localhost。

失敗時：停止，不反覆申請憑證、不改成固定 IP 純 HTTP URL。

回復方式：恢復上一份已驗證 Caddyfile 並 reload；Gateway localhost service 可保持，網站流量仍不可切入。

## 15. DNS A record 生效後驗證 TLS

本 runbook 不修改 DNS。由使用者確認 `linepay-gateway.tsu-waterbottle.com` 的 A record 已指向入站 IP `165.245.144.110` 後，執行：

```bash
deploy/scripts/verify-tls.sh linepay-gateway.tsu-waterbottle.com
```

成功標準：

- 憑證有效且 hostname 符合。
- `https://linepay-gateway.tsu-waterbottle.com/health` 回 HTTP 200。
- `http://linepay-gateway.tsu-waterbottle.com/health` 自動轉到 HTTPS。

失敗時：停止，不把網站 Gateway URL 指向該 domain。

回復方式：修正 DNS／Caddy 後重驗；不可改用 `http://165.245.144.110`。

## 16. 從外部驗證 health

從不在 Droplet 上的受控終端執行：

```bash
curl --fail --silent --show-error "https://linepay-gateway.tsu-waterbottle.com/health"
```

成功標準：只回 `{"ok":true,"status":"healthy"}`，不暴露版本、env、IP 或 secret。

失敗時：停止，不進入 Vercel Preview HMAC 測試。

回復方式：檢查 DNS、TLS、Caddy 與 localhost health，逐層排除。

## 17. 從 Vercel Preview 測 Gateway HMAC

此步驟需另一個明確授權任務，由使用者自行在 Vercel Preview 設定 Sandbox 專用變數；不要貼真值給 Codex：

- `LINE_PAY_TRANSPORT=gateway`
- `LINE_PAY_ENV=sandbox`
- `LINE_PAY_GATEWAY_URL=https://linepay-gateway.tsu-waterbottle.com`
- `LINE_PAY_GATEWAY_KEY_ID`
- `LINE_PAY_GATEWAY_SECRET`
- `LINE_PAY_GATEWAY_TIMEOUT_MS`

只測 HMAC 與受控 Gateway request；網站購物車 LINE Pay 入口仍保持關閉，不執行付款。

成功標準：

- 正確 HMAC 可到 Gateway。
- 錯誤／過期／重播請求被拒絕。
- 不會 fallback 到 direct。

失敗時：停止，不修改 Production 環境變數。

回復方式：移除 Preview-only 變數或停用 Preview 測試；輪替曾暴露的 Gateway secret。

## 18. 只允許 Sandbox

部署期間持續確認：

```bash
sudo docker inspect line-pay-gateway-sandbox-gateway-1 \
  --format '{{range .Config.Env}}{{if eq . "LINE_PAY_GATEWAY_ENV=sandbox"}}{{println .}}{{end}}{{end}}'
```

這個 template 只輸出符合的 Sandbox 環境名稱，不得改成輸出完整 env 清單。

成功標準：只有 `LINE_PAY_GATEWAY_ENV=sandbox`。

失敗時：立即停止網站測試並回復已審核 Sandbox image/config；不可切 Production。

## 19. 再次確認固定出口與 logs

執行：

```bash
deploy/scripts/verify-egress.sh 165.245.144.110
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$DEPLOY_SHA" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh logs --no-color gateway
sudo docker inspect line-pay-gateway-sandbox-gateway-1 \
  --format '{{json .HostConfig.LogConfig}}'
df -h
sudo journalctl --disk-usage
```

人工檢查 logs 只能有：

- requestId
- operation
- orderId
- transactionId
- statusCode
- elapsedMs

logs 不得有 secret、完整簽章、LINE Pay authorization header、payload、客戶資料或原始 HTML。

成功標準：

- egress 仍是 `165.245.144.110`。
- Docker log rotation 是 10 MB × 5。
- 磁碟容量正常。
- 無敏感資訊。

失敗時：停止測試；若 log 有秘密，先隔離存取、輪替 secret，再由安全事件流程處理。

## 20. 記錄部署 commit

只有所有檢查成功後，才記錄非秘密 SHA：

```bash
printf '%s\n' "$DEPLOY_SHA" | sudo tee /opt/line-pay-gateway/DEPLOYED_IMAGE_TAG >/dev/null
sudo chmod 0644 /opt/line-pay-gateway/DEPLOYED_IMAGE_TAG
```

同時記錄：

- 部署日期與操作者。
- 完整 commit SHA。
- image digest。
- Gateway domain。
- 固定出口驗證結果。
- CI／TLS／health 結果。
- 上一個可回復 image tag。

不要記錄 secret、完整交易 ID 或個資。

## 主機安全檢查表

- [ ] SSH 只用 Key。
- [ ] 密碼登入已由有權限人員確認為停用；Phase 2A 不修改 sshd。
- [ ] 不直接以 root 長期執行 application。
- [ ] Gateway container 使用非 root `node` user。
- [ ] 對外只需要 22、80、443；Phase 2A 不修改 UFW 或 DigitalOcean Firewall。
- [ ] Gateway port 3000 只綁 `127.0.0.1`。
- [ ] `gateway.env` 與 `proxy.env` 是不同的 root-owned `0600` 非 symlink 檔案；Caddy systemd override 只讀取 `proxy.env`。
- [ ] Firewall／網路規則調整另行審核，且不得誤封鎖既有 SSH 22 連線。
- [ ] DNS A record 是 `linepay-gateway.tsu-waterbottle.com → 165.245.144.110`，部署初期 TTL 為 `300`。
- [ ] Cloudflare DNS record 是 DNS only／灰雲；不得開啟 Cloudflare Proxy／橘雲，除非已另行完成 trusted proxy 安全設計與測試。
- [ ] LINE Pay 白名單是出站來源 `165.245.144.110/32`，不是原始 Droplet IP `168.144.142.127`。
- [ ] 已啟用 DigitalOcean 免費監控與告警。
- [ ] Docker logs 有 rotation。
- [ ] 定期執行 `df -h` 與 `journalctl --disk-usage`。
- [ ] 不記錄 payload、秘密或完整簽章。
- [ ] 不使用 DigitalOcean metadata 儲存秘密。
- [ ] 不掛載 Docker socket。
- [ ] 已記錄 Sandbox 預計退場日期與負責人。

## 永久停機／退場提醒

永久關閉網站或不再使用 LINE Pay 時，必須由有權限的人員逐項人工執行：

1. 關閉網站 LINE Pay 入口。
2. 停止背景對帳與補單。
3. 撤銷網站與 Gateway secrets。
4. 停用 LINE Pay Channel 或 IP 白名單。
5. 停止 Gateway container。
6. 刪除 Droplet。
7. 刪除 Reserved IP，不可只解除綁定。
8. 移除 DNS。
9. 移除 TLS、監控與告警。
10. 確認 DigitalOcean 不再持續計費。

本 repository 的任何 script 都不得自動執行上述雲端退場操作。
