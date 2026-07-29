# ADR 0073：將受控 Deployment Attestation 綁到封鎖中的 Runtime Policy

## 狀態

Accepted

目前只有 Server-only、test-only 的離線 Adapter contract。沒有讀取 GitHub
Environment、Supabase Secret 或環境變數，沒有建立 admin client、連線資料庫、
套用 Migration、啟用 Runtime、建立 route 或交付客戶。

## 背景

ADR 0072 已固定正式 admin binding 前的唯一順序：

1. Migration readiness
2. Runtime activation
3. existing `getSupabaseAdmin`

但 injected readiness fake 仍未聲明 Migration readiness 必須來自哪裡，也沒有
固定 Runtime activation 的所有權。如果直接把 caller boolean、一般環境變數或
應用程式版本當成 readiness，Migration 尚未完成時仍可能錯誤取得資料庫能力。

Supabase 的正式 Migration 應由受控 deployment／CI 流程依 migration history
套用，而不是由應用程式 runtime 或 Dashboard 任意修改。Repository 規範再要求
正式流程綁定 exact file、完整 commit SHA、Migration SHA、source validation、
preflight 與 postflight。

## 決策

### Migration readiness 只接受受控 deployment attestation

`d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server.ts` 建立單次
attestation seam。它只向 injected system boundary 發出固定 command：

- source 固定為 `APPROVED_PSQL_EXACT_FILE_RUNNER`
- Migration version、Repository path、SHA-256 與 RPC 名稱沿用 ADR 0072
- required checks 固定為 `SOURCE_VALIDATION`、`PREFLIGHT`、`MIGRATION`、
  `POSTFLIGHT`

Attestation response 必須是 exact object，只接受：

- 合法 40 字元 lowercase commit SHA
- exact Migration identity
- source validation／preflight／postflight 全部 `PASSED`
- Migration `APPLIED`
- Schema contract `VERIFIED`
- RPC execute grant `SERVICE_ROLE_ONLY_VERIFIED`

Provider message、SQL、connection string、Secret、環境名稱、任意 payload 或額外
欄位都不進 contract。任何 exception、not-verified、identity drift、畸形 commit
或加料 response 都使用固定安全 code，且 attestation capability 一經嘗試便不可
retry。

### Runtime activation 由 module-owned policy 決定

Runtime policy 固定為：

```text
BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION
```

Policy source 是 `MODULE_OWNED_STATIC_POLICY`，caller override 與 environment
override 都固定禁止。Migration attestation 通過後，Adapter 只會回傳既有
Migration readiness 所需的安全欄位；下一段 Runtime verifier 仍依同一 readiness
fingerprint 回傳 `INACTIVE`。

因此既有 ADR 0072 seam 會明確停止於 `RUNTIME_NOT_ACTIVE`，不會呼叫
`getSupabaseAdmin()`。Migration 已驗證不等於 Runtime 已獲授權，更不等於客戶
交付已開啟。

### Adapter 是單次、離線且不可正式呼叫

兩個 verifier 各只能消耗一次，Runtime 不能早於 Migration attestation。錯誤
不保存 provider diagnostics，也沒有 retry、fallback、第二個 attestation source
或其他 activation source。

整個 Adapter 固定：

- `productionCallable=false`
- `customerDeliveryAllowed=false`
- `databaseConnections=0`
- `reportMutations=0`
- `openAiRequests=0`

Production mode 在 attestation dependency 執行前 fail closed。模組沒有
`getSupabaseAdmin`、Supabase client、fetch、Secret 或 OpenAI 依賴。

## 驗證

- 完整 attestation 只檢查一次，之後 Runtime policy 回傳 inactive。
- 既有 Production binding readiness 收到 inactive 後回報
  `RUNTIME_NOT_ACTIVE`，admin factory 保持零次。
- Attestation exception、not-verified、加料 response 與畸形 commit 都使用固定
  allowlisted code；第二次呼叫固定拒絕。
- Runtime 在 attestation 前呼叫會固定拒絕，第二次呼叫也不會形成替代路徑。
- 額外 caller activation 欄位與 Production mode 都在 attestation 前拒絕。
- Runtime policy、Adapter、functions 與 errors 都 frozen。
- 測試只使用 synthetic commit 與 injected fake，沒有正式資料、Secret、資料庫
  connection、Migration execution、Report mutation 或 OpenAI request。

## 後果

- 後續正式接線不能由 route、Client、環境變數或 deployment 成功布林值直接啟用
  Runtime。
- 受控 Migration attestation 完成後仍必須另外取得本任務明確的 Production
  activation／deployment 授權。
- ADR 0074 已建立 release-scoped Runtime activation authorization 的離線
  exact-identity handoff contract；它仍不是正式授權，也不能把 policy 改成
  active。
- ADR 0075 已把該 handoff 綁入既有 blocked Runtime activation adapter 的離線
  順序；Adapter 會重驗 attested Release commit 與 readiness fingerprint，然後
  繼續回傳 inactive。
- ADR 0076 已只宣告正式 authorization Adapter 的 Server-only Port interface、
  exact Release command、safe decision 與固定 failure codes；正式來源仍未選擇，
  也沒有 Adapter implementation。
- 下一步必須先由老師選擇並另行授權正式 Release activation authorization 的
  受控來源；在此之前不得讀取正式 Environment、連線 Supabase、建立客戶 route
  或交付報告。
