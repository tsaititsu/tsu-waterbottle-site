# ADR 0071：將 owner lookup 與 atomic RPC 綁定到同一個 Supabase admin client

## 狀態

Accepted

目前只有 Server-only、test-only 的 dependency factory contract 與 injected mock。
沒有讀取 Supabase 環境變數、建立正式 client、連線資料庫、套用 Migration、建立
route 或交付客戶。

## 背景

ADR 0069 已固定可信材料到 owner lookup／atomic RPC 的應用程式映射，ADR 0070
也已固定 Supabase `.rpc()` 的 data／error 邊界，但兩個 Port 仍可由 caller 分別
注入不同來源。這會留下幾個未證明的問題：

- owner lookup 可能來自一個 client，delivery RPC 卻來自另一個 client。
- owner lookup 的 table、欄位、filter 與單列語意尚未固定。
- provider error 或畸形 owner row 可能在 atomic RPC 前洩漏或被誤認成合法 owner。
- Production 若誤用測試 injection，可能在 rollout gate 完成前取得資料庫能力。

## 決策

### Factory 只取得一次 admin client

`d1PalaceWritingTrustedDeliverySupabaseAdminClientFactory.server.ts` 的公開 seam
精確接受一個 `getSupabaseAdmin` dependency。Factory 只在 canonical
`NODE_ENV=test` 呼叫一次，並從同一個回傳 client 建立：

1. `lookupExpectedOwner`
2. `invokeAtomicDeliveryRpc`

Bundle 精確只有這兩個 frozen function，可直接交給 ADR 0069 的 repository
adapter。Client 不會出現在結果、錯誤或可序列化 metadata。

### Owner lookup 使用最小欄位與唯一 Report filter

Owner lookup 固定執行：

```text
from('ai_chart_reports')
  .select('id,user_id')
  .eq('id', reportId)
  .retry(false)
  .maybeSingle()
```

Lookup command 必須是上一層建立的 frozen exact object，只能包含固定 adapter mode
與合法 Report UUID。Client 不能額外提供 owner、user 或 caller 欄位。

回應只接受 Supabase 的五欄 envelope，以及精確的 `id,user_id` row。Report ID
必須等於 command，owner 必須是合法 UUID。成功只回傳 ADR 0069 要求的 frozen
三欄 owner outcome。

### Owner failure 永遠先於 atomic RPC 停止

Provider error、not found、transport exception、加料 row、Report ID 漂移或畸形
owner 都使用固定 module-owned code fail closed。Provider message、code、details、
hint、status、owner UUID 與任意 payload 不進 error serialization。

Owner lookup 每次最多執行一次，並明確使用 PostgREST `.retry(false)` 關閉
GET transport retry；任何失敗都不呼叫 atomic RPC，也沒有 application retry、
fallback、第二次 client 或 read-then-write 補救。

### Production 仍不建立 client

Factory 在非 test mode 先拒絕，再呼叫 `getSupabaseAdmin`。因此本切片沒有讀取
環境變數，也沒有以正式 service role 建立 client。它只證明未來正式 binding
必須如何把同一 client 的最小 read 與唯一 atomic write 綁在一起。

## 驗證

- 同一 injected client 先執行一次 owner lookup，再執行一次固定 atomic RPC。
- Factory、owner query 與 RPC 的順序固定，client factory 只呼叫一次。
- Bundle 精確兩欄且 recursively immutable。
- Provider error、not found、額外 row、ID drift 與 transport exception 都在 RPC
  前停止，owner query 一次、RPC 零次。
- 偽造 owner command 在 table query 前拒絕。
- Production 在 client factory 前拒絕。
- 本切片沒有 Supabase connection、Migration、Report／Artifact mutation、route、
  OpenAI request 或部署。

## 後果

- ADR 0069 的兩個 database Port 不再能於同一次執行中來自不同 admin client。
- Owner lookup 只讀最少欄位；付款、Report state、Snapshot、ledger 與正文條件仍由
  atomic RPC 在同一 transaction 重新驗證，不把 pre-read 當授權依據。
- `customerDeliveryAllowed` 與 `productionCallable` 仍為 false。
- ADR 0072 已建立 test-only Production binding readiness contract，明確要求
  Migration readiness、runtime activation gate 與既有 `getSupabaseAdmin` binding
  的固定順序；前兩段失敗時 client factory 保持零次。
- ADR 0073 已建立受控 deployment attestation 與 module-owned blocked Runtime
  policy 的單次離線 Adapter；完整 attestation 仍固定停在 inactive。另行核准前
  仍不得讀正式憑證、呼叫 client、建立 route 或交付客戶。
