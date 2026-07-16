# LINE Pay Gateway Sandbox 部署準備計畫

## 任務名稱

LINE Pay Fixed IP Gateway Phase 2A：Sandbox 部署準備。

## 目標

在不連線 DigitalOcean、不修改 DNS、不注入秘密、不執行付款的前提下，建立可人工審核的 Sandbox Compose、Caddy、主機檢查腳本、驗證腳本、rollback 流程與 CI，並修正完整 SHA、localhost URL、rollback log 權限與 DNS／固定 IP 文件邊界。

## 不包含的範圍

- 不 SSH 到 Droplet。
- 不部署或啟動遠端 container。
- 不修改 DigitalOcean、Reserved IP、防火牆、SSH 或 DNS。
- 不申請 TLS 憑證。
- 不修改 LINE Pay 後台或 Vercel 環境變數。
- 不建立或顯示真正的 Gateway secret。
- 不執行 Sandbox／Production 付款。
- 不操作 Supabase、Migration、付款或訂單資料。

## 現況

- Phase 1 Gateway 已存在 `infra/line-pay-gateway/`。
- Sandbox Gateway domain 已決定為 `linepay-gateway.tsu-waterbottle.com`。
- 入站 DNS 與出站 LINE Pay 白名單目前都使用 Reserved IPv4 `165.245.144.110`，但用途必須分開審核。
- 入站用途是 `https://linepay-gateway.tsu-waterbottle.com`；A record 必須是 `linepay-gateway.tsu-waterbottle.com → 165.245.144.110`。
- 出站用途是 Gateway 呼叫 LINE Pay Sandbox 時的來源 IP；LINE Pay 白名單固定使用 `165.245.144.110/32`，不得使用原始 Droplet IP `168.144.142.127`。
- 建立 A record 前必須先確認 Reserved IP 仍綁定正確 Droplet；部署初期建議 TTL `300`，DNS 生效前不得啟動 Caddy 自動申請正式憑證。
- 網域與公開 IP 不是秘密，但本任務不修改 DNS、Reserved IP 或 LINE Pay 後台。
- Gateway 使用 Node.js 24、TypeScript 與多階段 Dockerfile。
- Application port 是 `3000`，health endpoint 是 `GET /health`。
- Sandbox／Production upstream 由 `LINE_PAY_GATEWAY_ENV` 明確選擇。
- Gateway 已有 HMAC、replay、rate limit、body limit 與安全日誌。
- 現有 README 與安全規範已有停機／退場提醒。
- PR #24 已新增 Compose、Caddy、主機 preflight、TLS／egress 驗證與 image rollback 工具；合併後安全審查發現四項需在部署前修正的 guard。

## SOL 模式與 Codex 任務等級

```text
SOL 模式：極高
Codex 任務等級：極高
```

## PR 合併風險

- [x] 高風險：付款／點數／訂單
- [x] 高風險：正式部署／環境變數

本 PR 只準備部署資料，不執行部署，但內容會成為日後付款 Gateway 的主機操作依據，因此禁止 auto-merge。

## 執行步驟

### 第 1 階段

- 修改：以共用 validator 強制 image name 與完整 40 字元小寫 SHA，並要求所有 Compose 命令經受保護 wrapper。
- 驗證：合法完整 SHA 接受；短 SHA、任意 tag、大寫、額外字尾及 image name 注入全部拒絕。
- 完成條件：不能以直接 Compose、短 SHA 或任意 tag 繞過 release input 驗證。

### 第 2 階段

- 修改：嚴格解析 localhost health URL，並為 rollback log directory／file 強制 root ownership、限制權限與 symlink 拒絕。
- 驗證：userinfo、外部 hostname、query、fragment、額外 path、不合法 port 與不安全 log 路徑全部拒絕。
- 完成條件：health 驗證不可能連到外部主機；rollback 不會寫入不安全 log 路徑。

### 第 3 階段

- 修改：明確記錄 `linepay-gateway.tsu-waterbottle.com → 165.245.144.110` 的入站 DNS 與 `165.245.144.110/32` 的出站 LINE Pay 白名單用途，並擴充 GitHub Actions。
- 驗證：文件關鍵值、負向安全測試、Gateway／網站測試、Docker build、Compose config 與 Caddy syntax 全部通過。
- 完成條件：文件不混淆入站網址與出站來源 IP，且本次不實際修改 DNS 或外部服務。

## 資料庫影響

- 是否需要 Migration：否。
- 是否需要新 Policy：否。
- 是否影響既有資料：否。
- 是否需要回復 SQL：否。
- 是否使用 Preview Branch：否。

## 安全影響

- 是否接觸會員資料：否。
- 是否接觸出生或命盤資料：否。
- 是否接觸付款或點數：只接觸付款 Gateway 部署邊界，不執行交易。
- 是否新增外部服務：文件描述既有 DigitalOcean Droplet 與 Caddy，不建立資源。
- 是否新增環境變數：只新增 host example 與 Compose 控制變數，不放真值。

## 測試計畫

- 靜態檢查：`bash -n`、完整 SHA／health URL／log directory 負向測試、Compose config、公開網域／IP 文件與秘密檢查、`git diff --check`。
- 單元測試：Gateway 既有測試與網站 transport／LINE Pay 測試。
- 整合測試：Docker image build 由 CI 驗證。
- 手動測試：本階段不連線主機、不執行付款。
- 失敗情況：Production env、非核准 Sandbox domain、非完整 SHA、錯誤 egress、env／log 權限不符與 health/TLS 失敗均停止。
- 重複請求：沿用 Phase 1 replay tests。

## 回復方式

- 尚未部署時：不合併或 revert 本 PR 即可。
- 日後 Sandbox 部署失敗時：依 `SANDBOX_ROLLBACK_RUNBOOK.md` 使用已存在的上一個 image tag 回復；不刪除 Droplet、Reserved IP、logs 或 secrets。
- 永久退場：由有權限人員依既有安全規範與 runbook 人工執行，不由腳本自動刪除雲端資源。

## 完成條件

- [ ] 部署設定與 runbook 完成
- [ ] scripts 語法與負向檢查完成
- [ ] Gateway 與網站 LINE Pay 測試通過
- [ ] typecheck、lint、build 通過
- [ ] 沒有秘密與真實個資
- [ ] Draft PR 已建立
- [ ] GitHub checks 通過
- [ ] 等待人工安全審核
