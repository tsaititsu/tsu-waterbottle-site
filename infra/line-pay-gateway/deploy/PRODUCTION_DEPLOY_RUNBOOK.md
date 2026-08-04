# LINE Pay Gateway Production Cutover Runbook

本文件只處理既有固定出口 Gateway 從 Sandbox 明確切換到 LINE Pay Production，以及網站正式 Runtime 啟用前的停損點。它不是一鍵部署腳本，不包含任何 Secret 真值，也不代表已取得主機、Vercel、LINE Pay 後台或正式付款授權。

## 不可合併的兩個動作

1. **Gateway 切換不等於網站 Runtime 啟用**：Gateway 可先完成 production mode、health、TLS 與固定出口驗證，網站仍必須維持 `NEXT_PUBLIC_ENABLE_LINE_PAY=false`。
2. 網站 Runtime 只有在 Gateway 與 Vercel Production 設定全部通過、取得另一筆明確授權後，才能改成 `NEXT_PUBLIC_ENABLE_LINE_PAY=true` 並重新部署。

禁止 retry、fallback、直接使用未驗證 image tag，或在失敗後自動改走 direct transport。不得把 Sandbox 與 Production Channel 資料混用。

## 固定安全邊界

- Gateway 網域：`linepay-gateway.tsu-waterbottle.com`
- 固定入站／出口 IPv4：`165.245.144.110`
- LINE Pay Production 白名單：`165.245.144.110/32`
- Gateway application port：只綁 `127.0.0.1:3000`
- Docker project／container：沿用既有 `line-pay-gateway-sandbox` project 身分做原地重建；名稱只是既有營運識別，不代表 container mode
- Caddy：host systemd service，只公開 80／443
- Production upstream：只能是 `https://api-pay.line.me`
- Gateway image tag：必須是本次人工核准的完整 40 字元 commit SHA
- Website transport：必須是 `gateway`，缺設定時 fail closed，不得 fallback 到 `direct`

不得修改 DNS、Firewall、Netplan、Caddy、Secret 或 LINE Pay 後台，除非使用者對該具體操作另行明確授權。

## 0. 執行前停止點

逐項確認後才可取得 Gateway 主機切換授權：

- [ ] 核准 commit 已在 `main`，Repository checks 全綠。
- [ ] Production Supabase LINE Pay application state 已為完整契約。
- [ ] Production Vercel deployment 是核准的 exact SHA 且 `READY`。
- [ ] `NEXT_PUBLIC_ENABLE_LINE_PAY=false`，一般使用者看不到 LINE Pay 入口。
- [ ] Reserved IP 仍綁定 `linepay-gateway-sgp1`。
- [ ] DNS A record 只指向 `165.245.144.110`，沒有 AAAA 或 Cloudflare Proxy。
- [ ] TLS 驗證成功，外部 3000 不可連線。
- [ ] LINE Pay Production 後台已把 `165.245.144.110/32` 加入白名單。
- [ ] 已記錄目前 image 完整 SHA 與 `gateway.env` 安全備份路徑，供人工回復。

任何一項不符都停止；不得以 Sandbox 結果替代 Production 證據。

## 1. Production Gateway 設定

實際 `/etc/line-pay-gateway/gateway.env` 必須保持 root:root、`0600`、regular file、非 symlink。只透過主機受控秘密通道維護，禁止顯示內容。

其中非秘密模式欄位必須精確為：

```text
LINE_PAY_GATEWAY_ENV=production
```

其餘既有 HMAC、Proxy Token 與 timeout 設定不得在切換過程輸出、搬移或重建。Production overlay 會再明確覆寫 container environment 為 `production`，避免 env file 與容器模式漂移。

## 2. 切換前唯讀 preflight

在 exact commit 的 repository checkout 中設定非秘密參數：

```bash
export GATEWAY_IMAGE_TAG='<核准的完整 commit SHA>'
export EXPECTED_EGRESS_IP='165.245.144.110'
export CLOUDFLARE_DNS_MODE='dns-only'
```

先用既有 Sandbox mode 與目前已部署的完整 SHA，驗證切換前健康基準：

```bash
deploy/scripts/preflight.sh public-caddy post-start
```

此步只檢查 Ubuntu、Docker、secret metadata、Sandbox mode、Compose 安全邊界、listener、Caddy 與固定出口；不安裝、不啟動、不修改系統。Production env file 尚未寫入前，不得呼叫 `preflight-production.sh`，也不得要求現行健康 container 停止以滿足 `prepare` mode。

## 3. Exact image 與 resolved Compose

每次 Production Compose 操作都必須同時提供完整 SHA 與固定確認字串：

```bash
export LINE_PAY_GATEWAY_PRODUCTION_CONFIRMATION='CONFIRM_LINE_PAY_GATEWAY_PRODUCTION_MODE'
deploy/scripts/compose-production.sh config --quiet
deploy/scripts/compose-production.sh build --pull gateway
```

Production wrapper 禁止輸出 resolved config，因為 Docker Compose 會展開 env file。詳細 Compose 解析只可在 CI 使用 committed example 假值完成。主機端只透過 `config --quiet` 驗證，並在啟動後使用不讀取完整 environment 的精確 metadata 檢查確認：

- Docker project name 仍是 `line-pay-gateway-sandbox`，確保 Compose 原地重建現有 service，而不是建立第二套 container
- image tag 等於核准完整 SHA
- `LINE_PAY_GATEWAY_ENV=production`
- host mapping 只有 `127.0.0.1:3000`
- `user=node`、`read_only=true`、`cap_drop=ALL`、`no-new-privileges=true`
- 沒有 host network、privileged 或 Docker socket mount

若任何項目不符，停止且不得啟動 container。

## 4. 受控 Gateway 切換

本節會修改 `/etc/line-pay-gateway/gateway.env` 的非秘密 mode 並原地重建 Droplet container，必須先取得使用者對 exact SHA 與 production mode 的明確授權。更新 mode 後先執行一次 `config --quiet`；不得建立第二個平行 Compose project，也不得手動同時保留兩個 Gateway container。只允許單次執行：

```bash
deploy/scripts/compose-production.sh up -d --no-build gateway
```

禁止自動 retry、fallback 或改用其他 SHA。啟動失敗時保持網站 Runtime disabled，依已記錄的上一個完整 SHA 與安全備份人工回復；不得臨時修改 Secret、Caddy、DNS、Firewall 或 Netplan。

## 5. Gateway postflight

依序驗證，任一步失敗即停止：

```bash
deploy/scripts/preflight-production.sh gateway-running
deploy/scripts/preflight-production.sh public-caddy post-start
deploy/scripts/verify-health.sh http://127.0.0.1:3000/health
deploy/scripts/verify-tls.sh linepay-gateway.tsu-waterbottle.com
deploy/scripts/verify-egress.sh 165.245.144.110
```

另外唯讀確認：

- container healthy、non-root、read-only、無新增 capabilities
- container resolved environment 是 `production`，不得顯示其他 env 值
- image SHA 等於核准 SHA
- 外部 3000 仍不可連線
- `/health` 不輸出 mode、Secret 或 upstream 資訊
- 日誌無 Secret、Token、完整簽章、Authorization 或付款 payload

## 6. Vercel Production 設定（Runtime 仍關閉）

只有使用者另行授權正式環境變數後，才可在 Vercel Production 安全介面設定。只列名稱與允許的非秘密值，不記錄 Secret 真值：

```text
NEXT_PUBLIC_ENABLE_LINE_PAY=false
LINE_PAY_ENV=production
LINE_PAY_TRANSPORT=gateway
LINE_PAY_GATEWAY_URL=https://linepay-gateway.tsu-waterbottle.com
LINE_PAY_GATEWAY_TIMEOUT_MS=5000
LINE_PAY_CONFIRM_URL=https://tsu-waterbottle.com/api/product-orders/line-pay/confirm
LINE_PAY_CANCEL_URL=https://tsu-waterbottle.com/api/product-orders/line-pay/cancel
```

同一 Production scope 還必須存在下列 server-only secrets：

```text
LINE_PAY_CHANNEL_ID
LINE_PAY_CHANNEL_SECRET
LINE_PAY_GATEWAY_KEY_ID
LINE_PAY_GATEWAY_SECRET
SUPABASE_LINE_PAY_EXECUTOR_API_KEY
```

設定後建立 exact-head Production deployment，仍保持 flag 為 false，只執行不建立付款、不呼叫 LINE Pay 的 readiness 檢查。

## 7. 最終 Runtime 啟用門檻

以下全部成立，才可向使用者提出最後啟用授權：

- [ ] Production Gateway mode、image SHA、health、TLS、出口 IP 全部通過。
- [ ] Production Vercel env 名稱、scope、格式與 deployment injection 全部通過。
- [ ] Supabase executor readiness 通過，無資料庫寫入。
- [ ] Production LINE Pay Channel 與固定 IP 白名單由使用者人工確認。
- [ ] Sandbox E2E 已完成 Request、核准、Confirm、atomic finalization 與冪等核對。
- [ ] Production Runtime 仍為 disabled，尚未建立真實交易。

最後一步才是另行授權把 `NEXT_PUBLIC_ENABLE_LINE_PAY` 改為 `true` 並部署。第一筆 Production 小額交易也需要獨立授權，不能和 Runtime 啟用合併推定。
