# LINE Pay Gateway Sandbox 部署準備計畫

## 任務名稱

LINE Pay Fixed IP Gateway Phase 2A：Sandbox 部署準備。

## 目標

在不連線 DigitalOcean、不修改 DNS、不注入秘密、不執行付款的前提下，建立可人工審核的 Sandbox Compose、Caddy、主機檢查腳本、驗證腳本、rollback 流程與 CI。

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
- Gateway 使用 Node.js 24、TypeScript 與多階段 Dockerfile。
- Application port 是 `3000`，health endpoint 是 `GET /health`。
- Sandbox／Production upstream 由 `LINE_PAY_GATEWAY_ENV` 明確選擇。
- Gateway 已有 HMAC、replay、rate limit、body limit 與安全日誌。
- 現有 README 與安全規範已有停機／退場提醒。
- 尚無 Compose、Caddy、主機 preflight、TLS／egress 驗證與 image rollback 工具。

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

- 修改：新增 Compose、Caddyfile 與假值 env example。
- 驗證：Compose 可解析、Sandbox 環境被固定、Gateway port 只綁 localhost。
- 完成條件：設定中沒有秘密、Production 預設或公開 application port。

### 第 2 階段

- 修改：新增 deploy、rollback runbook 與 preflight／egress／health／TLS／rollback scripts。
- 驗證：所有 shell scripts 通過 `bash -n`，preflight 不安裝或修改系統。
- 完成條件：高風險步驟有執行前檢查、成功標準、停止條件與回復方式。

### 第 3 階段

- 修改：擴充 GitHub Actions。
- 驗證：Gateway tests、網站 LINE Pay tests、Docker build、Compose config 與部署範例檢查通過。
- 完成條件：本機完整測試與 GitHub checks 通過，建立高風險 Draft PR。

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

- 靜態檢查：`bash -n`、Compose config、placeholder／秘密檢查、`git diff --check`。
- 單元測試：Gateway 既有測試與網站 transport／LINE Pay 測試。
- 整合測試：Docker image build 由 CI 驗證。
- 手動測試：本階段不連線主機、不執行付款。
- 失敗情況：Production env、placeholder domain、錯誤 egress、env 權限不符與 health/TLS 失敗均停止。
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
