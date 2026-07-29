# ADR 0070：固定 Supabase RPC 的 data／error 邊界

## 狀態

Accepted

目前只有 Server-only、test-only 的 Supabase RPC repository source contract 與
injected mock；沒有建立 Supabase client、連線資料庫、套用 Migration、建立 route
或寫入 Report。

## 背景

ADR 0069 已把可信交付材料映射成 Migration 宣告的固定 17 欄 command，但
`invokeAtomicDeliveryRpc` 仍是任意 injected fake。應用程式還沒有證明下列真實
Supabase JavaScript 邊界：

```text
supabase.rpc(
  'deliver_ai_chart_report_after_review',
  command,
)
→ { data, error, count, status, statusText }
```

該 PostgreSQL function 使用 `returns table`，因此成功 `data` 是列陣列；本次呼叫
只允許單列結果。Supabase／PostgREST error 可能另帶 `details`、`hint`、status 或
任意 provider message，不能直接交給上層或序列化。

## 決策

### 固定唯一 function 與 exact command

Repository invoker 只呼叫：

```text
deliver_ai_chart_report_after_review
```

command 必須是上一層產生的 frozen exact object，精確包含 Migration 的 17 欄。
Report 與 expected owner 必須是 UUID；13 個 digest／receipt 欄位必須是小寫
SHA-256；review record 不得空白或超過 32 KiB；report content 不得空白。任何額外
owner、user 或 caller 欄位都在 `.rpc()` 前拒絕。

### 一次呼叫、沒有 repository retry

每次 invoker 只執行一次 injected `rpc` function。沒有 retry、fallback、第二次
讀取、第二次 publish 或 read-then-write 補救。Transport exception 收斂成固定
`SUPABASE_RPC_TRANSPORT_FAILED`，不保留 exception name、message 或 stack。

### 成功回應只接受單列五欄

Supabase response envelope 精確接受 `data`、`error`、`count`、`status` 與
`statusText`。成功時：

- `error` 必須為 `null`。
- `data` 必須恰好一列。
- 該列精確只有 result code 與四個 receipt／content digest 欄位。

Repository 只回傳 frozen 的五欄 row；下一層仍會再次驗證 result code 與每個
fingerprint 是否逐位等於原 command。空列、多列、加料欄位或畸形 envelope 都
收斂為固定 `SUPABASE_RPC_RESPONSE_INVALID`。

### Error 只保留 Migration 固定分類

PostgREST error 只解析固定四欄 shape，但不保存 `code`、`details` 或 `hint`。
`message` 只有完全等於 Migration 已知的八個固定 delivery failure message 時，
才可作為上層分類訊號；其他 message 一律改成 `SUPABASE_RPC_FAILED`。

因此 owner、payment、Snapshot、ledger、Report state 與 idempotency conflict
仍可被 ADR 0069 的 Adapter 轉成既有安全 code，而任意 provider 文字不會出現在
error serialization。

### Production 仍保持停用

Factory 只在 canonical `NODE_ENV=test` 接受 injected `rpc` source。Production
模式會在建立 invoker 時 fail closed，不會呼叫 Supabase。這一層不是正式
repository binding，也不代表 Migration 已套用或客戶交付已開放。

## 驗證

- 成功路徑只呼叫一次固定 function，並將單列陣列正規化給 ADR 0069 Adapter。
- 已知 owner mismatch 維持固定上層分類。
- 未知 message、details、hint、status 與敏感 marker 不進 error serialization。
- 額外 caller owner 欄位在 `.rpc()` 前拒絕。
- 空列、多列、額外 row 欄位與 transport exception 都只呼叫一次且不重試。
- Production factory 在任何 RPC call 前拒絕。
- 本切片沒有 Supabase connection、Migration、Report／Artifact 寫入、route、
  OpenAI request 或部署。

## 後果

- 應用程式已能離線證明 `.rpc(name, args)` 的真實 data／error 形狀，不再讓
  arbitrary fake 直接冒充 Supabase 回應。
- 上一層仍負責材料、owner、正文、receipt 與 idempotency 的完整 source binding；
  本層不重做命理或報告邏輯。
- ADR 0071 已建立 test-only admin client dependency factory，讓最小 owner lookup
  與本 RPC invoker 只能使用同一個 client，且 Production 在 client creation 前
  fail closed。
- ADR 0072 已在該 factory 前加入 test-only Migration／Runtime readiness 順序，
  並以 type-only 方式參照既有 admin binding。
- 下一個最小切片應先固定兩個 readiness trusted source 的離線 adapter contract；
  在正式 Migration、runtime activation 與 route 另行核准前，仍不得連線或交付。
