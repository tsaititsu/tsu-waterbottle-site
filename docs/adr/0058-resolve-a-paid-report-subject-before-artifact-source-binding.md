# ADR 0058：先由 Server 解析已付款 Report 主體，再證明 Artifact 來源

## 狀態

Accepted

## 背景

ADR 0056 已要求正式人工審查紀錄必須綁定同一份 Report、canonical Snapshot
與 restricted Artifact；ADR 0057 則把 reviewer authorization 接到目前 Request
的 Server-verified admin session。現有 Report binding 仍只是 injected fake
adapter probe，尚未從網站正式 `ai_chart_reports` 讀取真實 Report 主體。

目前 restricted Artifact 只有 `chartId` 等結果 metadata，沒有從 canonical
Snapshot 一路傳遞的 Snapshot SHA-256。若在這個邊界直接宣稱 source matched，
會把「查到一份合法 Report」誤當成「這份 Artifact 確實由該 Report 的 Snapshot
產生」。

## 決策

在既有 Supabase Report repository 增加最小 Server-only lookup，只查：

- `id`
- `user_id`
- `payment_status`
- `chart_snapshot`

Repository 不查出生輸入、email、付款識別、Report 正文或其他不必要欄位。Provider
錯誤只回傳固定安全錯誤，不保存底層 message。

新增
`d1PalaceWritingHumanReviewReportSubject.server.ts`，以 Server 查回的資料依序驗證：

1. Request 提供的 Report ID 是 UUID。
2. Report 存在，且查回 ID 與 Request ID 完全相同。
3. Server row 有合法 owner UUID。
4. `payment_status` 精確為 `paid`。
5. `chart_snapshot` 能通過現有 N0 的完整 canonical Snapshot validator。
6. 驗證後由 Server 對 canonical Snapshot 計算 SHA-256。

成功 capability 只保存 Report UUID、Snapshot SHA-256、固定狀態與 fingerprint；
不保存 owner UUID、完整 Snapshot、出生資料、Report 正文、Prompt 或模型正文。

## Fail-closed 來源邊界

此 capability 只能宣告：

`PENDING_ARTIFACT_SNAPSHOT_PROOF`

它不能宣告 `MATCHED`。要完成 ADR 0056 的正式綁定，下一層必須先把同一個
canonical Snapshot digest 從 N0／source package 一路傳到 restricted Artifact，
再由程式逐位比對 Report Snapshot SHA 與 Artifact source SHA。只有相等時才能
建立正式 Report／Artifact binding。

## 單次能力與測試替換

成功 capability 使用 module-private exact-object identity，只能在同一程序消耗
一次；copy、clone、JSON 往返或第二次使用都拒絕。

測試可以注入 fake repository lookup，但只在 `NODE_ENV=test` 接受。Production
環境試圖替換正式 repository 時固定 fail closed，且不呼叫 injected function。

## 固定失敗分類

只允許：

- `REPORT_ID_INVALID`
- `REPORT_LOOKUP_UNAVAILABLE`
- `REPORT_NOT_FOUND`
- `REPORT_OWNER_INVALID`
- `REPORT_PAYMENT_REQUIRED`
- `REPORT_SNAPSHOT_INVALID`

底層 database message、owner、Snapshot 內容、stack 或任意動態字串都不得進入
錯誤或 capability。

## 本切片仍未開放

本切片是正式 Server read seam，但尚未接 API route、review coordinator 或正式
record writer。它固定：

- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `openAiRequests=0`

本切片不修改 Schema、RLS、付款、Report 狀態或任何 Supabase 資料，也不連線
Production。Server time、Artifact Snapshot digest 傳遞、正式 source match 與
write-once review record 仍須後續完成。

## 後果

- Client 不能提供 owner、paid 或 Snapshot SHA 來冒充正式 Report 主體。
- 未付款、owner 缺失、Snapshot 畸形與查詢漂移會在任何正式紀錄前停止。
- 完整命盤只在 Server 驗證期間存在，對下游只留下不可逆 digest。
- 下一個最小切片是把 Snapshot digest 納入 N0／writing source／restricted
  Artifact 的 source-bound contract，再完成精確相等比對。
