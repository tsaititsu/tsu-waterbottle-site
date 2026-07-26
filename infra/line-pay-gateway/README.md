# LINE Pay Fixed IP Gateway

這是 LINE Pay 官方直串固定出口的第一階段 Gateway。網站仍建立 LINE Pay 官方簽章；Gateway 僅驗證網站的內部 HMAC，然後從固定出口轉送到預先定義的 LINE Pay API。它不是一般用途 proxy，也不接受 URL、hostname、protocol、port、path 或 HTTP method。

## 架構

```text
使用者瀏覽器
    │
    ▼
Vercel / Next.js server
  1. 建立 LINE Pay payload 與官方簽章
  2. 建立 Gateway canonical string 與 HMAC-SHA256
    │ HTTPS + x-gateway-* headers
    ▼
Host Caddy
  1. 以獨立 Proxy Token 證明請求經受控 Caddy
  2. 以實際 TCP remote_host 強制覆寫 X-Gateway-Client-IP
  3. 只轉送到 localhost-published Gateway port
    │ HTTP through Docker port publishing
    ▼
Fixed IP Gateway (DigitalOcean Droplet)
  1. timing-safe 驗證獨立 Proxy Token
  2. 嚴格解析直接連入 Caddy 的網路來源 IP，執行 per-source rate limit
  3. timestamp／網站 HMAC／replay 驗證
  4. operation 白名單推導固定 host + path
    │ HTTPS，redirect=error，無重試
    ▼
LINE Pay Sandbox 或 Production API
```

第一階段的 LINE Pay Channel ID、Channel Secret 與官方簽章責任仍在網站 server。Gateway 收到的只有已簽章 LINE Pay headers 與必要 payload；程式邊界已把內部 Gateway HMAC 與 LINE Pay 官方簽章分開，後續可另行設計把 Channel Secret 移至 Gateway，但本階段沒有這樣做。

## HTTP endpoints

- `GET /health`：回傳 `{"ok":true,"status":"healthy"}`。
- `POST /v1/line-pay/proxy`：只接受 `application/json` 與受 HMAC 保護的固定 operation。

成功轉送時回傳：

```json
{
  "ok": true,
  "upstreamStatus": 200,
  "body": { "returnCode": "0000" }
}
```

`upstreamStatus` 保留 LINE Pay HTTP status，`body` 保留 LINE Pay JSON。無效 JSON、timeout 或 Gateway 內部錯誤只回傳固定錯誤碼，不回傳上游 HTML 或內部例外內容。

## Operation 白名單與 timeout 契約

| operation | method | 固定 v3 path | 必要欄位 | LINE Pay 官方最低 read timeout | direct／Gateway upstream | 網站到 Gateway |
| --- | --- | --- | --- | ---: | ---: | ---: |
| `request` | POST | `/v3/payments/request` | `bodyText` | 10 秒 | 15 秒 | 35 秒 |
| `confirm` | POST | `/v3/payments/{transactionId}/confirm` | `transactionId`, `bodyText` | 40 秒 | 45 秒 | 50 秒 |
| `status` | GET | `/v3/payments/requests/{transactionId}/check` | `transactionId` | 20 秒 | 25 秒 | 35 秒 |
| `paymentDetails` | GET | `/v3/payments?transactionId=...&orderId=...` | 至少一個查詢鍵 | 20 秒 | 25 秒 | 35 秒 |

`refund` 與 `void` 不在白名單；目前網站沒有完整正式基礎，本階段只列為後續評估項目。Payload 若出現 `url` 等任何未定義欄位會被拒絕。

P1 保留完整 Online API v3 operation set，不把部分路徑靜默換成 v4。官方目前把 v4 的主要差異定位在台灣 EPI 的 `paymentProvider` 與預先授權付款；本專案尚未使用這兩項能力。若商務需求確認要使用 v4，必須另以原子化工作包同步修改四個 path、HMAC 測試向量、Gateway target 與 response schema。官方版本與 timeout 研究記錄見 [`docs/line-pay-online-api-version-timeout-research.md`](../../docs/line-pay-online-api-version-timeout-research.md)。

上表的 direct／Gateway upstream deadline 已包含 5 秒服務緩衝。`LINE_PAY_UPSTREAM_TIMEOUT_MS` 仍可把特定 operation 的 Gateway deadline拉長，但不能壓低表列值；其允許上限為 30 秒，因此各 operation 的最大 upstream deadline 分別是 30／45／30／30 秒。網站到 Gateway 的固定下限再多保留 5 秒，確保 Gateway 有時間解析上游回應並傳回受控結果。兩層 timeout 都只會中止本次 request，不會自動 retry，也不會從 Gateway fallback 到 direct。

## HMAC canonical string

網站送出以下 headers：

- `x-gateway-key-id`
- `x-gateway-timestamp`：Unix epoch seconds
- `x-gateway-nonce`
- `x-gateway-request-id`
- `x-gateway-signature`：小寫 hex HMAC-SHA256

canonical string 必須逐行且完全一致，結尾不加換行：

```text
POST
/v1/line-pay/proxy
TIMESTAMP
NONCE
SHA256_BODY
```

`SHA256_BODY` 是 HTTP adapter 收到、尚未 parse JSON 的原始 UTF-8 request body bytes 的小寫 hex SHA-256，不會先 parse 再重新 stringify。簽章是 `HMAC-SHA256(LINE_PAY_GATEWAY_SECRET, canonicalString)`。`requestId` 同時存在 header 與 JSON body，Gateway 驗證兩者一致；因 body hash 被簽署，requestId 也受到完整性保護。

`X-Gateway-Proxy-Token` 不屬於網站 HMAC canonical string，也不屬於 LINE Pay 官方簽章。它是 Caddy 與 Gateway 之間獨立的 64 字元小寫 hex token，只證明請求經過受控 reverse proxy。

預設 timestamp 容許誤差為 60 秒。nonce 與 requestId 使用單機 TTL cache 防重播；多 instance 部署前必須改成共享且具原子 claim 的儲存。

## 環境變數

Gateway：

| 名稱 | 必要 | 預設 | 說明 |
| --- | --- | --- | --- |
| `PORT` | 否 | `3000` | HTTP listen port |
| `LINE_PAY_GATEWAY_ENV` | 是 | 無 | 僅 `sandbox` 或 `production` |
| `LINE_PAY_GATEWAY_KEY_ID` | 是 | 無 | 內部金鑰識別，不是秘密 |
| `LINE_PAY_GATEWAY_SECRET` | 是 | 無 | Vercel 與 Gateway 的獨立共享秘密 |
| `LINE_PAY_GATEWAY_PROXY_TOKEN` | 是 | 無 | Caddy 與 Gateway 的獨立 64 字元小寫 hex token，不得與 Gateway secret 共用 |
| `LINE_PAY_UPSTREAM_TIMEOUT_MS` | 否 | `5000` | Gateway upstream timeout 的設定下限，100–30000 ms；實際值不得低於 operation 固定 deadline |
| `GATEWAY_TIMESTAMP_TOLERANCE_SECONDS` | 否 | `60` | HMAC timestamp 容許誤差，1–300 秒 |
| `GATEWAY_REPLAY_TTL_SECONDS` | 否 | `120` | nonce/requestId 單機 TTL，60–600 秒 |
| `GATEWAY_RATE_LIMIT_WINDOW_MS` | 否 | `60000` | 單機來源 IP rate limit 視窗 |
| `GATEWAY_RATE_LIMIT_MAX` | 否 | `120` | 每個視窗最多請求數 |

網站：

| 名稱 | 說明 |
| --- | --- |
| `LINE_PAY_TRANSPORT` | `direct` 或 `gateway`；Vercel Preview 必須明確設為 `gateway`，缺少、`direct` 或未知值都 fail closed；其他環境未設定才維持既有 `direct` |
| `LINE_PAY_GATEWAY_URL` | 未經 percent encoding 的 canonical 公開 HTTPS Gateway origin；authority／hostname 內任何 `%` 都拒絕，且不得有 hostname 尾點、任何顯式 port（含 `:443`）、尾端 `/`、path、query、fragment 或帳密，也拒絕 IP 與 localhost |
| `LINE_PAY_GATEWAY_KEY_ID` | 必須與 Gateway 相同 |
| `LINE_PAY_GATEWAY_SECRET` | 必須與 Gateway 相同，不得與 LINE Pay Channel Secret 共用 |
| `LINE_PAY_GATEWAY_TIMEOUT_MS` | 網站到 Gateway timeout 的設定下限，預設 5000 ms；實際值不得低於 operation 固定 deadline |
| `LINE_PAY_GATEWAY_SMOKE_ENABLED` | 僅 Preview 的 authenticated smoke 開關，預設停用；Production 不需要也不會自動啟用 |

gateway 模式少任何必要設定都 fail closed，不會 fallback 到 direct。Gateway URL 在 Sandbox、Preview、Development 與 Production runtime 一律必須是 canonical 公開 HTTPS origin。Validator 會先檢查未經 URL parser normalization 的原始字串，再檢查解析後的 URL；authority／hostname 內任何 `%` 都會在 parser 前被拒絕，因此 percent decoding、顯式預設 port、literal／encoded dot-segment、backslash、控制字元與任何 path 都不能被 parser 折疊後接受。Scheme 與 hostname 大小寫可正規化；原始 Unicode 公開 hostname 仍依 IDNA 正規化為 Punycode，公開 Punycode hostname 也維持允許，Unicode 等價尾點仍會被拒絕。固定 hostname allowlist 尚未實作。所有範例值只是假值；不要提交真實秘密或把秘密寫入映像檔。

`LINE_PAY_GATEWAY_PROXY_TOKEN` 明確禁止放入 Vercel，也不得由網站程式讀取或送出。Proxy Token 只存在 Droplet 的 `/etc/line-pay-gateway/proxy.env`，由 Caddy 覆寫注入 Gateway request；它不屬於網站 HMAC contract。

### Preview authenticated non-payment smoke

`POST /api/internal/line-pay/gateway-smoke` 是預設停用的 Preview-only 診斷路徑，必須同時符合：

- `VERCEL_ENV=preview`
- `LINE_PAY_TRANSPORT=gateway`
- `LINE_PAY_GATEWAY_SMOKE_ENABLED=true`
- 通過網站既有 `requireAdminUser` bearer 管理員授權

任一環境條件不符、未登入或非管理員都回相同 404。此路徑不接受 client 自訂 operation、URL、Gateway headers 或 signed body，只由 server 送出固定 `gatewayAuthenticationSmoke` synthetic payload。現行 Gateway 會依既有順序先驗證 Caddy Proxy Token、Gateway HMAC、timestamp 與 replay key，再以 `400 invalid_operation` 拒絕固定非白名單 operation；網站只在 status 與 error code 都精確符合時回：

```json
{"ok":true,"authenticated":true,"upstreamCalled":false}
```

因此 smoke 不會呼叫 Request、Confirm、Status、Payment Details 或任何 LINE Pay upstream，也不建立訂單、不寫入 Supabase 或其他業務資料；管理員身份只沿用既有 Supabase Auth 驗證。回應不會包含 key ID、簽章、nonce、timestamp、secret、Gateway headers、URL 或 stack。Production、Development 與未設定 `VERCEL_ENV` 時路徑均不可用。Sandbox 付款、Production 設定與 Production 付款仍各自需要獨立人工授權。

## Sandbox／Production 切換

Gateway 每次啟動只允許一個環境：

- `sandbox` 固定連線 `https://sandbox-api-pay.line.me`
- `production` 固定連線 `https://api-pay.line.me`

網站 payload 宣告的環境必須與 Gateway 設定一致，否則回 400。切換環境必須明確改設定並重新啟動，不能由單一 request 指定其他 host。

## 本機啟動

需要 Node.js 24。先複製 `.env.example` 為未追蹤的本機設定，填入測試用假 secret，再執行：

```bash
npm ci
npm run typecheck
npm test
npm run build
npm start
curl --fail http://127.0.0.1:3000/health
```

不要把 `.env` 加入 Git。health endpoint 不檢查 LINE Pay 或洩漏設定，只代表程序可服務。

## Docker

```bash
docker build -t line-pay-fixed-ip-gateway:phase1 .
docker run --rm --env-file .env -p 127.0.0.1:3000:3000 line-pay-fixed-ip-gateway:phase1
curl --fail http://127.0.0.1:3000/health
```

映像使用 Node 24、多階段 build、非 root `node` 使用者，且有 Docker health check。TLS 應在受控 reverse proxy 終止；Production 不應直接公開純 HTTP endpoint。

## Sandbox 部署準備

Phase 2A 的可審核部署資料位於 `deploy/`：

- `compose.yaml`：只啟動 Sandbox Gateway，application port 只綁 host localhost；必須經 `scripts/compose.sh` 驗證完整 commit SHA 後執行。
- `Caddyfile.example`：固定使用已核准的 Sandbox domain `linepay-gateway.tsu-waterbottle.com`。
- `caddy.service.d/line-pay-gateway.conf.example`：清除官方 package 含 `--environ` 的 ExecStart，再以不輸出環境的直接 Caddy command 啟動。
- `gateway.env.example`：只含假值與欄位格式。
- `proxy.env.example`：只含獨立 Proxy Token 假值；正式檔案是 `/etc/line-pay-gateway/proxy.env`。
- `SANDBOX_DEPLOY_RUNBOOK.md`：分階段主機部署、檢查與停止條件。
- `SANDBOX_ROLLBACK_RUNBOOK.md`：只回復既有 image tag，不刪除資料或雲端資源。
- `scripts/`：完整 SHA／image name validator、受保護 Compose wrapper、顯式階段 preflight、Caddy systemd 有效設定驗證、journal 洩漏 guard、egress、嚴格 localhost health、TLS、secure log directory 與 guarded rollback。

部署架構固定為：

```text
Vercel / Next.js server（付款 proxy）或受控 health check client
→ https://linepay-gateway.tsu-waterbottle.com :80/:443
→ host Caddy
→ 127.0.0.1:3000
→ Gateway container
→ LINE Pay Sandbox（來源 IPv4：165.245.144.110）
```

Compose 不包含 Caddy container；Caddy 以 host systemd service 執行，reverse proxy 到只綁 host localhost 的 Gateway published port。Docker 轉送後的 Node socket peer 不作為信任依據；信任邊界只由獨立 Proxy Token 建立。

正式部署分離兩個 root-owned `0600` secret file：Gateway container 同時讀取 `gateway.env` 與 `proxy.env`，host Caddy systemd service 只能透過 `EnvironmentFile=/etc/line-pay-gateway/proxy.env` 取得 Proxy Token，不能取得網站至 Gateway 的 HMAC secret。

官方 Caddy package unit 的 ExecStart 可能含 `--environ`，會在啟動時把 process environment 寫入 journal。部署時必須從已核准 release 原子安裝 committed drop-in，先以空的 `ExecStart=` 清除 vendor command，再把唯一有效命令固定為：

```text
/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
```

drop-in 不覆寫 `User=caddy`、`Group=caddy`、ExecReload 或其他 vendor hardening，也不使用 shell wrapper、env-file command flag 或 `gateway.env`。`validate-caddy-systemd.sh` 會同時驗證 committed drop-in 與 `systemctl cat caddy` 的有效設定。

完整 preflight 的模式是必要參數：

- `prepare`：Gateway 尚未啟動，80／443／3000 必須空閒。
- `gateway-running`：3000 必須只在 `127.0.0.1`，Gateway container 與 localhost health 必須 healthy，80／443仍空閒。
- `public-caddy pre-start`：Gateway healthy、80／443 空閒、2019 不得對外。
- `public-caddy post-start`：Caddy systemd service 必須是 active，80／443 必須由 Caddy 監聽，3000 仍只在 localhost，2019 缺席或只在 loopback。

缺少或未知模式會 fail closed，不會依目前 listener 自動猜測部署階段。

Sandbox 的入站與出站目前共用 Reserved IPv4 `165.245.144.110`，但用途不同：

- 入站：DNS A record `linepay-gateway.tsu-waterbottle.com → 165.245.144.110`，讓網站透過 `https://linepay-gateway.tsu-waterbottle.com` 找到 Gateway。
- 出站：Gateway 呼叫 LINE Pay Sandbox 時，LINE Pay 看到的來源 IP 是 `165.245.144.110`；LINE Pay 白名單必須使用 `165.245.144.110/32`，不得使用原始 Droplet IP `168.144.142.127`。

建立 A record 前必須先確認 Reserved IP 仍綁定正確 Droplet；部署初期建議 TTL `300` 秒。DNS 尚未生效前不得啟動 Caddy 自動申請正式憑證。本 repository 只記錄已決定的公開網域與 IP，不會修改 DNS、申請憑證或變更 LINE Pay 白名單。

Sandbox 初期的 Cloudflare DNS record 必須使用 **DNS only／灰雲**，不得開啟 **Cloudflare Proxy／橘雲**。只有 DNS only 時，Caddy 的 `{remote_host}` 才是直接連線來源，才能安全覆寫 `X-Gateway-Client-IP`。若日後要啟用橘雲，必須先另行設計並測試 Cloudflare trusted proxy 邊界；現有設定不支援直接切換。

`X-Gateway-Client-IP` 代表直接連入 Caddy 的網路來源 IP。網站正常付款流程由 Vercel server 呼叫 Gateway，因此它通常是 Vercel 出口 IP，不是最終消費者的瀏覽器或裝置 IP。

本階段不部署、不產生 secret、不修改 DigitalOcean、防火牆、LINE Pay 後台或 Vercel 環境變數。詳細步驟請從 `deploy/SANDBOX_DEPLOY_RUNBOOK.md` 開始，不要把 runbook 合併成無停頓的一鍵腳本。

## 安全限制與日誌

- HTTP body 上限 64 KB，只接受 JSON。
- HMAC 使用 timing-safe comparison；錯誤簽章與過期 timestamp 回 401，重播回 409。
- `POST /v1/line-pay/proxy` 先 timing-safe 驗證 `X-Gateway-Proxy-Token`，成功後才信任 Caddy 覆寫的單一合法 `X-Gateway-Client-IP`。缺少／錯誤 token 回同一個 401；Client IP 缺失或不合法回固定 400，兩者都不 fallback 到 socket peer 或共同 bucket。
- 單機來源 IP fixed-window rate limit 只使用已通過 Proxy Token 邊界後解析的直接網路來源 IP；不信任 `X-Forwarded-For`、Docker bridge IP、任意 proxy CIDR 或 `request.socket.remoteAddress`。
- `X-Gateway-Client-IP` 只作 rate-limit key，不參與 Gateway HMAC、LINE Pay 官方簽章或付款授權，不會轉送至 LINE Pay，也不加入一般付款 metadata log。
- Proxy Token 不寫入 Caddy access log、Gateway log、錯誤回應或 LINE Pay upstream headers。
- Caddy systemd 的唯一有效 ExecStart 不含 `--environ`；pre-start 通過後記錄 journal 時間點，啟動並完成 post-start、TLS、redirect、health 與 security header 驗證後，只掃描該起點以後的新 journal 範圍。掃描用 root-only 暫存 pattern file，不把 Proxy Token 放入 grep command line；訊號或錯誤退出也會清理暫存檔，若命中或掃描失敗會立即 stop、disable Caddy 並停止部署。
- 只轉送四個 LINE Pay headers；額外 headers 與 `Host`、`Connection`、`Content-Length`、`Transfer-Encoding`、`Keep-Alive`、`Upgrade` 等 hop-by-hop headers 都會被拒絕。
- 上游只用 HTTPS，送出前再次檢查固定 hostname 且禁止自訂 port。
- `redirect: error`、AbortController timeout、所有 operation 都不自動重試，尤其 Request API 不可重送。
- request log 只含 `requestId`、`operation`、`orderId`、`transactionId`、狀態碼與耗時。
- 不記錄 shared secret、Channel Secret、payload、完整簽章、LINE Pay authorization header 或上游原始 HTML。
- replay cache 與 rate limit 都是單機記憶體實作；擴成多 instance 前不可把它視為跨機防護。

## DigitalOcean 部署前檢查表

- [ ] 本分支經人工 review，Gateway 與網站測試、typecheck、lint、build 全數通過。
- [ ] 使用獨立隨機 Gateway secret；不重用 Channel Secret，且只透過受控 secret 管理提供。
- [ ] 使用另一個獨立 Proxy Token；`gateway.env` 與 `proxy.env` 是不同 root-owned `0600` 非 symlink 檔案，Caddy 只能讀後者。
- [ ] 已審查 `systemctl cat caddy`；committed drop-in 是 root:root `0644` regular file、非 symlink，有效 ExecStart 唯一且不含 `--environ`。
- [ ] `public-caddy pre-start` 通過後才記錄 journal 起點；啟動後 `public-caddy post-start`、TLS／redirect／health／security headers 與 journal guard 依序通過。
- [ ] Droplet 使用 Node 24 container、非 root runtime、restart policy 與最小權限。
- [ ] Reserved IP 對外出口與 LINE Pay 後台白名單值由人工再次核對。
- [ ] Reserved IP `165.245.144.110` 仍綁定正確 Droplet；DNS A record 使用該入站 IP，LINE Pay 白名單使用 `165.245.144.110/32`。
- [ ] 原始 Droplet IP `168.144.142.127` 沒有被填入 LINE Pay 白名單。
- [ ] DNS、TLS 憑證與 HTTPS reverse proxy 完成；外部不能連到未加密的 application port。
- [ ] Cloudflare DNS record 是 DNS only／灰雲；未完成 trusted proxy 重新設計前不得開啟 Cloudflare Proxy／橘雲。
- [ ] 僅允許 Vercel 所需流量的網路政策、rate limit、監控與告警已另行審核。
- [ ] Gateway 與網站 clock 同步，timestamp 容許窗維持最小合理值。
- [ ] 先使用 Sandbox 做 request／confirm／status／details 完整驗收。
- [ ] Production 設定缺失時確認 fail closed，且確認沒有 direct fallback。
- [ ] 備妥關閉入口、撤銷 secret 與回復網站設定的 runbook。

本文件不授權部署、修改 DigitalOcean、防火牆、LINE Pay 後台或 Vercel Production 環境變數。

## 停機／退場 SOP

依序由有權限的人員執行並保留稽核紀錄：

1. 先關閉網站 LINE Pay 入口，阻止新交易進入。
2. 停止相關背景任務，確認沒有進行中的付款狀態同步。
3. 從 Vercel 與 Gateway secret store 移除／撤銷 Gateway secret、key ID 與 LINE Pay credentials。
4. 在 LINE Pay 後台停用對應 Channel／IP 白名單；確認未完成交易的人工處理方式。
5. 停止並刪除 Droplet。
6. 刪除 Reserved IP；不可只解除綁定，避免繼續計費或留下可重新指派資源。
7. 移除 Gateway DNS、TLS 憑證／設定、監控、告警與 log drain。
8. 驗證 endpoint 已不可達、網站沒有 fallback 到 direct，並完成秘密撤銷與資源帳單複核。
