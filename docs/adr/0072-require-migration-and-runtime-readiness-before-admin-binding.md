# ADR 0072：在 admin binding 前固定 Migration 與 Runtime readiness

## 狀態

Accepted

目前只有 Server-only、test-only 的 readiness contract 與 injected probes。沒有讀取
Supabase 環境變數、建立正式 client、連線資料庫、套用 Migration、建立 route 或
交付客戶。

## 背景

ADR 0071 已把 owner lookup 與 atomic delivery RPC 綁到同一個 admin client，但
尚未證明取得該 client 前必須完成哪些 rollout 檢查。如果正式接線直接呼叫既有
`getSupabaseAdmin()`，可能在下列條件尚未成立時取得資料庫能力：

- 指定可信交付 Migration 尚未套用或套用版本不相符。
- atomic RPC 的 Schema contract 或 `service_role` execute grant 尚未驗證。
- D1 P1 trusted-delivery Runtime activation gate 尚未開啟。
- caller 以自填布林值或另一份 Migration 冒充 readiness。

## 決策

### 固定唯一前後順序

`d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server.ts` 的公開 seam
精確執行：

1. `VERIFY_MIGRATION_READINESS`
2. `VERIFY_RUNTIME_ACTIVATION`
3. `BIND_EXISTING_GET_SUPABASE_ADMIN`

Migration 不 ready 時不呼叫 activation；activation 不 active 時不呼叫 admin
factory。三段都各最多一次，沒有 application retry、fallback、第二個 client
或先綁 client 再補驗證的路徑。Admin owner lookup 綁定後仍須明確使用
`.retry(false)` 關閉 PostgREST GET transport retry。

### Migration 身分由 module-owned 常數鎖定

Readiness command 固定包含：

- Migration version `20260728120000`
- Repository-relative exact path
- tracked file SHA-256
  `8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66`
- RPC `deliver_ai_chart_report_after_review`

測試會直接重算 tracked Migration bytes 的 SHA；Migration 改變時 contract 必須
明確更新，不能讓 caller 自選版本、路徑、SHA 或 RPC。

Injected readiness outcome 只接受固定欄位，且必須同時確認 Schema contract 與
`service_role`-only execute grant。Provider message、SQL、connection metadata 或
任意附加 payload 都不保存。

### Runtime activation 綁定 Migration readiness fingerprint

Runtime activation command 包含固定 feature ID，以及已驗證 Migration outcome 的
canonical fingerprint。Activation outcome 必須回綁同一 fingerprint；disabled、
漂移、額外欄位或 adapter exception 都在 admin factory 前 fail closed。

這個 activation 目前只是 injected test probe，不是環境變數、Secret、route
參數或正式 feature flag。Caller 不能用布林值直接跳過前一段。

### 既有 admin binding 只作 type-only 參照

Readiness module 對 `src/lib/supabase/admin.ts` 的 `getSupabaseAdmin` 只有
TypeScript type-only import。測試通過前兩段後才把 injected 同名 dependency
交給 ADR 0071 factory；Production mode 則在第一個 probe 前拒絕。

因此這個切片不會載入正式 admin module、讀取
`NEXT_PUBLIC_SUPABASE_URL`／`SUPABASE_SERVICE_ROLE_KEY`、建立 client 或發送任何
Data API／RPC request。

## 驗證

- 成功路徑事件順序精確為 Migration → activation → admin binding；owner query 與
  RPC 只有真正消耗 repository bundle 後才各執行一次。
- Migration adapter exception、not-ready 與 malformed response 都讓 activation
  與 admin binding 保持零次。
- Activation adapter exception、inactive 與 malformed response 都讓 admin
  binding 保持零次。
- Admin factory exception 只保留固定安全 code，沒有 provider message 或 retry。
- 加料 dependency 與 Production 都在任何 probe／client call 前拒絕。
- Tracked Migration SHA 與 contract 常數逐位相同。
- 本切片沒有 Supabase connection、Migration application、Report／Artifact
  mutation、route、OpenAI request 或部署。

## 後果

- 正式接線不能再把 `getSupabaseAdmin()` 當第一步，也不能只靠應用程式版本推測
  Migration 已完成。
- ADR 0073 已進一步把 Migration readiness source 固定為受控 deployment
  attestation，並把 Runtime policy 固定為 blocked；這仍不代表正式 Migration
  已套用或 Runtime 已 ready。
- `customerDeliveryAllowed` 與 `productionCallable` 仍為 false。
- 下一個最小切片只能先建立 release-scoped Runtime activation authorization 的
  離線 handoff contract；讀取正式環境變數、連線 Production、套用 Migration、
  啟用 Runtime、建立 route 或交付客戶仍需另行明確授權。
