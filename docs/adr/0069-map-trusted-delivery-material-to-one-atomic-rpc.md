# ADR 0069：將可信交付材料精確映射到單一原子 RPC

## 狀態

Accepted

目前已有 Server-only 離線 repository adapter、ADR 0070 的 test-only Supabase
RPC data／error source contract，以及 ADR 0071 的單一 admin client bundle
contract；尚未建立正式 Supabase client binding、連線資料庫、套用 Migration、
建立 route／worker 或交付客戶。

## 背景

ADR 0065 已建立一次性的 trusted-delivery contract，ADR 0067 也已設計單一
`deliver_ai_chart_report_after_review(...)` PostgreSQL transaction。但兩者之間
仍缺少應用程式層的精確映射：

- Metadata contract 不含 Report owner UUID，不能讓 Client 或一般 caller 補入。
- Metadata contract 不含 canonical human-review record 或 restricted artifact
  正文，不能只靠欄位名稱假定來源可信。
- RPC 有固定 17 個輸入；若 Adapter 自由增加、移除或改名，Migration 的安全檢查
  就不再是同一份契約。
- RPC 的 provider error 可能含不受控文字，不能直接進入應用程式 error。

## 決策

### Adapter 重新驗證已核准材料，不相信 caller 宣告

離線 Adapter 只接受三項固定輸入：

1. 尚未使用的原始 trusted-delivery contract capability。
2. Canonical human-review record。
3. 與該 record 綁定的 restricted artifact。

Adapter 先用既有 Strict parser 重驗 23 欄 review record、`APPROVED` decision、
空 issue codes 與 record fingerprint，再比較 canonical payload SHA、Report、
Snapshot、Gate 與 contract bindings。

Restricted artifact 必須通過固定欄位 allowlist、完整 canonical payload SHA、
artifact fingerprint、Writing Result parser、Fidelity Review parser，以及
Writing／Fidelity SHA 與 identity bindings。任何正文變動都會先造成 artifact
payload SHA 不相同，不能進入 owner lookup 或 RPC。

### Owner 只由 Server lookup 取得

Adapter input 不接受 `ownerUserId`、`userId` 或其他 owner 欄位。唯一的 expected
owner 由只接收已綁定 Report UUID 的 Server lookup port 回傳，且結果必須是固定
三欄 object 與合法 UUID。RPC 仍會在鎖定 Report 後再次比較資料庫內的
`user_id`，所以這個值只是 Server compare-and-set expectation，不是呼叫端權限。

目前 lookup port 只允許 `NODE_ENV=test` 的 injected fake；尚未接正式 repository。

### 報告正文由已審核 Writing Result deterministic 產生

Adapter 不接受 caller 傳入 `reportContent`。正文固定依 Writing Result 已驗證的
section 順序取出 `customerText`，以單一空白行連接。`report_content_sha256`
由這份實際字串的 UTF-8 bytes 計算。

這個格式目前只對單宮 D1 P1 寫作結果成立。未來十二宮與全盤報告必須另建更高階
formatter contract，不能偷偷在本 Adapter 拼接未審核內容。

### 固定一次 RPC 與 exact replay

Adapter 產生的 RPC command 精確只有 Migration 宣告的 17 個參數。Ledger
receipt、delivery claim 與 delivery receipt fingerprints 都由 module-owned
canonical hash 規則推導，caller 不能提供。

每次執行：

- owner lookup 精確一次。
- atomic RPC fake 精確一次。
- automatic retry 永遠為 false。
- 同一 capability 不可重複使用。
- 完全相同的新 capability 可接受 `EXISTING_EXACT_MATCH`。
- RPC 回傳必須精確五欄，且四個 receipt／content SHA 必須逐位等於 command。

### 錯誤只保留固定安全分類

Adapter 只把 Migration 已知的固定 message 映射為 allowlisted code，例如：

- `REPORT_NOT_FOUND`
- `REPORT_OWNER_MISMATCH`
- `REPORT_PAYMENT_REQUIRED`
- `REPORT_SNAPSHOT_MISMATCH`
- `DURABLE_REVIEW_LEDGER_CONFLICT`
- `REPORT_STATE_CONFLICT`
- `IDEMPOTENCY_CONFLICT`

其他 exception 一律收斂為 `ATOMIC_DELIVERY_RPC_FAILED`。Provider message、
stack、owner UUID、review record、模型正文與 artifact 都不進 error serialization。

## 驗證

- 成功路徑只產生固定 17 欄 RPC command，owner 與正文都不是 caller 欄位。
- 完全相同的新材料可驗證 `EXISTING_EXACT_MATCH`。
- 同一 contract 第二次執行在 owner lookup 前拒絕。
- Caller 加入 owner 欄位會在任何 port 呼叫前拒絕，且不消耗原 capability。
- Artifact 正文漂移會在 owner lookup 前拒絕，且不洩漏漂移文字。
- Known RPC conflicts 與未知 provider message 都只產生安全固定 code。
- Production mode 不可使用 injected fake，且失敗不消耗 capability。
- 本切片沒有 Supabase connection、Migration、Report mutation、Artifact 寫入、
  OpenAI request 或部署。

## 後果

- 應用程式層已能離線證明「已審核材料 → Server owner → 單一 atomic RPC」的完整
  參數映射，不再只驗證抽象三 Port 順序。
- Restricted artifact 的完整 hash 與 human-review record 成為正文發布前的必要
  binding；caller 不能單獨替換報告文字。
- `customerDeliveryAllowed` 與 `productionCallable` 仍為 false。本 Adapter 不是真正
  Supabase repository，也不能被 route 呼叫。
- ADR 0070 已固定
  `.rpc('deliver_ai_chart_report_after_review', command)` 的單次呼叫、單列 data、
  PostgREST error allowlist、transport failure 與 Production fail-closed 邊界。
- ADR 0071 已把 owner lookup 與 atomic RPC invoker 綁到同一個 test-only admin
  client，並固定最小 owner query、單列 response、零 retry 與 Production
  client-before-call fail-closed 行為。
- ADR 0072 已固定 Migration readiness → runtime activation →
  `getSupabaseAdmin` binding 的 test-only 順序；任何前段失敗都不能建立 client。
- ADR 0073 已把受控 deployment Migration attestation 與 module-owned blocked
  Runtime activation policy 收斂成單次離線 Adapter；attestation 通過仍不能建立
  admin client。正式 Environment、Runtime activation、caller、Report read gate
  與部署仍分別需要後續授權。
