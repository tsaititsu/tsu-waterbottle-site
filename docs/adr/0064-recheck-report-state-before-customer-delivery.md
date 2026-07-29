# ADR 0064：客戶交付前重新核對 Report 最新狀態

## 狀態

Accepted

## 背景

ADR 0063 已能把 write-once 人工審查紀錄讀回成可信的 verified record，但核准
發生在某一個時間點。Report 在核准後仍可能被退款、標成失敗、替換 Snapshot，
或已由其他流程寫入正文。若下一層只信任舊紀錄中的 `APPROVED`，就可能把合法
Artifact 交給錯誤 Report，或重複發布已存在的內容。

另一方面，目前 `ai_chart_reports` 尚未具備專用的人工審查交付狀態與 durable
review ledger。本切片不能藉由新增一個協調器就假裝完整交付流程已存在。

## 決策

### 只消耗 verified approval

Readback module 會把每個成功讀回的原始物件登記為同程序 capability。交付協調器
只接受未消耗且 decision=`APPROVED` 的 exact object identity：

- Copy、clone、JSON 重建、wrapper 及第二次使用固定拒絕。
- `REPAIR_REQUIRED` 與 `REJECTED` 在呼叫 Report state probe 前拒絕。
- Probe 一旦開始，後續失敗也不會讓同一 approval 重試。

### 最新 Report 狀態是另一個唯讀信任邊界

目前以 `NODE_ENV=test` 的 injected probe 固定未來 adapter Contract。Probe command
只含：

- Report UUID。
- Canonical Snapshot SHA-256。
- Gate fingerprint。
- Human-review record fingerprint。

Outcome 必須使用 exact object shape，並逐一綁回相同 Report、Snapshot、Gate 與
record；同時要求：

- Report 存在。
- Report owner 仍由 Server 驗證為有效。
- Payment status 為 `PAID`。
- Report status 為 `PENDING`。
- Report content 為 `ABSENT`。
- Source binding 為 `MATCHED`。

額外欄位、身分漂移、未付款、終止或其他狀態、已有正文及 adapter exception 都
以固定 allowlisted error code fail closed。錯誤不保存底層 provider message、
Report 正文、命盤、出生資料、reviewer 或 owner。

### Ready stopped 仍不是 customer delivery

狀態核對通過後只建立 frozen、同程序 exact-object、單次 coordination capability：

- `status=READY_STOPPED`
- `stage=LATEST_REPORT_DELIVERY_STATE_VERIFIED`
- `customerDeliveryStatus=BLOCKED_PENDING_TRUSTED_DELIVERY_ADAPTER`
- `customerDeliveryAllowed=false`
- `reportMutationAllowed=false`
- `productionCallable=false`

本層沒有 Supabase adapter、durable review ledger、Report compare-and-set、API
route、storage write、Report mutation 或 OpenAI request。

## 後果

- 人工核准與 Report 最新交付資格成為兩個獨立、可測的信任邊界。
- 舊的合法核准不能跳過付款、Snapshot、狀態與既有正文的重新確認。
- 修正或拒絕紀錄不會碰觸交付狀態 probe。
- 下一個切片可以只消耗 exact coordination capability，設計 trusted delivery
  adapter 的 durable ledger、compare-and-set 與 idempotency 順序。
- 在該 adapter 另行完成並取得對應授權前，客戶仍不能取得這份報告。
