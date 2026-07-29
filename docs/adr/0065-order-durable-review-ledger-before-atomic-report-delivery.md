# ADR 0065：持久審查帳本必須先於原子 Report 交付

## 狀態

Accepted

## 背景

ADR 0064 已能在人工核准後重新核對 Report 的 owner、付款、Snapshot、狀態與正文
是否存在，並產生單次 `READY_STOPPED` coordination capability。但這個 capability
仍只存在程序記憶體；人工審查紀錄也只保存在私有暫存位置，尚不是 Production
durable ledger。

目前既有 `markAiChartReportCompleted()` 會先讀取 Report，再另外執行 update。兩個
動作之間可能有其他 worker 寫入、退款或改變狀態，因此不能把這條 read-then-write
流程當成 customer delivery 的 compare-and-set，也不能只靠 `report_content` 已存在
來證明某一次核准已安全交付。

## 決策

### 只接受 exact coordination capability

Trusted delivery adapter Contract 只消耗 ADR 0064 module 建立、尚未使用的原始
coordination 物件：

- Copy、clone、JSON 重建與 wrapper 都不具能力。
- Coordination 只能建立一份 Contract；第二次使用固定拒絕。
- Contract 本身也以 exact-object identity 單次交接給未來 Adapter。

### Idempotency key 由 Server bindings 決定

Idempotency key 由固定 Contract version 及下列已驗證 metadata canonical hash 產生：

- Report UUID。
- Canonical Snapshot SHA-256。
- Gate fingerprint。
- Human-review record fingerprint 與 payload SHA-256。
- Review envelope fingerprint。
- Customer-delivery coordination fingerprint。

Caller 不能提供、覆寫或重算另一個 key。只有所有 binding 完全相同的 replay 才能
取得既有結果；同 key 不同內容或同 Report 不同 key 都必須 fail closed。

### 三個 Port 的固定順序

未來 trusted Adapter 必須依序完成：

1. `ENSURE_DURABLE_REVIEW_LEDGER`
   - 先 exclusive-create 正式審查帳本，或讀回並驗證既有內容逐位相同。
   - Ledger 衝突不得進入 Report mutation。
2. `COMPARE_AND_SET_REPORT_DELIVERY_CLAIM`
   - 在同一原子操作中核對 Server owner、paid、pending、content absent、exact
     Snapshot 與同一 idempotency key。
   - 只能取得新的 exclusive claim，或確認已存在的是完全相同交付。
3. `PUBLISH_SOURCE_BOUND_REPORT_CONTENT`
   - 只能接收已驗證 restricted artifact 及前一步 exact claim。
   - 寫入結果也必須支援 exact replay；不能用一般 read-then-write 取代。

Partial failure 不能盲目 retry。後續呼叫必須以相同 idempotency key 先 reconciliation
既有 ledger／claim／delivery receipt，再決定回傳既有成功或固定衝突。

### Contract 不等於 Adapter

本切片只宣告上述責任、固定 failure codes、idempotency key 與安全狀態：

- `status=PORTS_DECLARED_NOT_IMPLEMENTED`
- `customerDeliveryStatus=BLOCKED_PENDING_DURABLE_DELIVERY_ADAPTER`
- `customerDeliveryAllowed=false`
- `reportMutationAllowed=false`
- `productionCallable=false`

本層不讀 restricted artifact、不呼叫 Supabase、不建立 schema／route、不寫 ledger
或 Report，也不發 OpenAI request。

## 後果

- 人工核准的 audit record 不會在 Report 已發布後才補寫。
- Report 狀態競態不能再由先讀後寫流程假裝安全。
- Exact replay、binding conflict 與 partial failure 有明確不同語意。
- 下一個切片可以用 offline injected fake 驗證三個 port 的順序及 outcome contract，
  仍不需要碰 Production。
- 真正 durable ledger schema、atomic transaction／RPC、Report delivery state 與
  restricted artifact read adapter 仍需後續設計；任何 Production Migration 或正式
  寫入都必須另外取得使用者明確授權。
