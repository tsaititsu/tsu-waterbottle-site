# ADR 0066：先以離線 Probe 驗證可信交付 reconciliation

## 狀態

Accepted

## 背景

ADR 0065 已把正式交付責任固定成 durable review ledger、Report atomic
compare-and-set claim、verified restricted artifact 正文發布三個 Port，也由 Server
bindings 推導唯一 idempotency key。但該 Contract 只宣告責任，尚未證明：

- 三個 Port 一定依固定順序呼叫。
- 完全相同的 replay 與新交付能被區分。
- 前段成功、後段失敗後，可以依同一 key reconciliation，而不是盲目 retry。
- Conflict、malformed outcome 或 Port exception 不會繼續呼叫下一段。

直接用 Supabase 或 Production 驗證會過早引入 schema、正式資料與持久化風險。

## 決策

### 只在 canonical test environment 開放 injected fake

`d1PalaceWritingTrustedDeliveryAdapterProbe.server.ts` 只接受：

- ADR 0065 module 親自建立、尚未消耗的 exact Contract。
- 唯一 `executePort` injected fake。
- 精確兩欄 input；copy、clone、額外欄位與非 test environment 都在 Port invocation
  前拒絕。

Probe 不接受 storage root、Supabase client、Report 正文、Artifact payload、retry
選項或 caller idempotency key。

### 固定三段命令與 binding

Port 順序固定為：

1. `ENSURE_DURABLE_REVIEW_LEDGER`
2. `COMPARE_AND_SET_REPORT_DELIVERY_CLAIM`
3. `PUBLISH_SOURCE_BOUND_REPORT_CONTENT`

每個 command 都綁定同一 Contract fingerprint、idempotency key 及安全來源
fingerprints。第二段必須綁定第一段 ledger receipt；第三段必須再綁定第二段
delivery claim。Outcome 只能使用固定狀態與 64 字元小寫 SHA-256 receipt
fingerprint，額外欄位一律拒絕。

### Replay 與 partial failure 使用封閉狀態

只接受以下完成組合：

- `CREATED → CLAIMED → PUBLISHED`：全新交付介面驗證。
- `EXISTING_EXACT_MATCH → EXISTING_EXACT_MATCH → EXISTING_EXACT_MATCH`：
  完全相同重播。
- `EXISTING_EXACT_MATCH → CLAIMED → PUBLISHED`：ledger 已完成後續接續。
- `EXISTING_EXACT_MATCH → EXISTING_EXACT_MATCH → PUBLISHED`：ledger 與 claim
  已完成後續接續。

其他 created／existing 組合視為 `RECONCILIATION_CONFLICT`。任何 idempotency 或
Contract binding 漂移視為 `IDEMPOTENCY_CONFLICT`。Port exception 或 malformed
outcome 會停在當段，不呼叫後續 Port。

Probe 不自行 retry。Contract 在第一次 Port invocation 前即完成單次消耗；失敗後
不能用同一物件重跑。未來真正 reconciliation 必須重新取得最新可信狀態並建立新的
等價 Contract。

### Probe 成功不等於客戶交付

Probe result 固定：

- `customerDeliveryStatus=BLOCKED_OFFLINE_ADAPTER_PROBE_ONLY`
- `customerDeliveryAllowed=false`
- `productionCallable=false`
- `actualAdapterWrites=0`
- `durableLedgerWrites=0`
- `reportMutations=0`
- `openAiRequests=0`
- `retryPerformed=false`

它只保存固定 outcome 名稱與 receipt fingerprints，不保存 Report 正文、Artifact
payload、Prompt、出生資料、完整命盤或 provider message。

## 後果

- 三段責任、exact replay 與 partial-failure reconciliation 已有可執行的離線
  Contract tests。
- Production Adapter 仍未實作；不存在 Supabase write、Migration、API route 或
  客戶可讀報告。
- 下一步應先以唯讀方式盤點既有 Report repository／schema，設計 durable ledger
  與原子 claim 的最小持久化邊界；任何 Migration 或 Production 寫入仍需另行取得
  使用者明確授權。
