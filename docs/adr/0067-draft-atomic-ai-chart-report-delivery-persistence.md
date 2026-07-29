# ADR 0067：以單一資料庫交易保存審查紀錄並交付 Report

## 狀態

Accepted

目前只有 Repository Draft Migration、source-contract tests 與隔離 PostgreSQL 17
integration tests；尚未套用 Supabase 或 Production。

## 背景

ADR 0065 與 ADR 0066 已把可信交付拆成 durable review ledger、Report atomic claim
與正文發布三項邏輯責任，並用離線 Probe 驗證順序、exact replay 及 partial-failure
reconciliation。進一步唯讀盤點既有 Report schema、repository、付款 callback 與
read gate 後，確認目前仍有以下缺口：

- `markAiChartReportCompleted()` 是先讀再更新，不能防止核對與寫入之間的狀態競態。
- 人工審查結果沒有不可變、可追查且不能由 Data API 直接寫入的正式帳本。
- Report 沒有綁定審查、Snapshot、Artifact 與交付結果的不可變 receipt。
- 付款成功只把 Report 標記為 paid；目前沒有 D1 生成、人工審查或正式交付 caller。
- 讀取 gate 只依 owner、付款及非空正文判斷，尚未要求可信交付 receipt。

若把三項邏輯責任直接實作成三次獨立 Supabase 寫入，後段失敗時仍會留下難以安全
判定的部分狀態。

## 決策

### 保留三項責任，但以單一交易實作

正式 Adapter 的邏輯順序仍是：

1. 建立或精確核對 durable review ledger。
2. 對鎖定的 Report 執行 owner、paid、pending、content absent 與 Snapshot
   compare-and-set。
3. 發布已驗證的正文並建立 immutable delivery receipt。

真正持久化時，三項責任必須由同一個 Server-only RPC
`deliver_ai_chart_report_after_review(...)` 在一個 PostgreSQL transaction 內完成。
任何 ledger、Report 或 receipt 步驟失敗，都由資料庫整筆 rollback，不能留下部分
交付。

### 審查帳本與交付 receipt 都不可變

Draft Migration 新增：

- `ai_chart_reports.chart_snapshot_sha256`
  - 由未來 Server Report 建立流程保存 canonical Snapshot SHA-256。
  - 舊資料可保持 null，但可信交付 RPC 對 null fail closed。
  - RPC 必須把這個持久化 SHA 與審查／Artifact 傳入的 Snapshot SHA 精確比對。
- `ai_chart_report_review_ledger`
  - 每個 Report／Gate 只能有一份 exact 審查紀錄。
  - 只保存固定 decision、23 欄 canonical review payload 與已驗證 fingerprints。
  - 不保存模型正文、Prompt、完整命盤或出生資料。
- `ai_chart_report_deliveries`
  - 每個 Report 只能有一份交付 receipt。
  - 保存 idempotency key、Snapshot／Artifact／Gate／review／claim／delivery
    fingerprints 與正文 SHA-256。
  - 不重複保存 Report 正文。

兩張表都啟用 RLS、撤銷 Data API 與一般角色權限，並以 trigger 拒絕 UPDATE／DELETE。
正式寫入只允許 `service_role` 執行固定 RPC；Client 不能直接建立或修改紀錄。

### RPC 在任何 Report mutation 前完成 exact validation

RPC 必須先驗證：

- UUID、SHA-256、idempotency key 與固定狀態格式。
- Review payload canonical JSON 文字不超過 32 KiB，其 SHA-256 與
  `record_payload_sha256` 相符；解析後精確只有核准的 23 個 key，且 decision、
  Report、Snapshot、Artifact、Gate 與 fingerprints 全部吻合。
- 待發布正文的 SHA-256 與 Server 傳入的 digest 相符。
- 鎖定 Report 的 owner、付款、狀態、正文空白、canonical Snapshot 存在，以及
  持久化 `chart_snapshot_sha256` 與來源 SHA 完全相同。

只有全部通過才可更新 `ai_chart_reports` 並插入 delivery receipt。完全相同的既有
ledger／delivery 可回傳 exact replay；同 Report 不同 idempotency 或任一 binding
漂移必須 fail closed。

Restricted Artifact 的 bounded readback、source-bound parser 與人工核准仍在
Server 記憶體中先完成。資料庫只接收已驗證的正文與固定安全 metadata，不負責解析
模型原始輸出。

### Repository Draft 不代表已部署或已交付

本 ADR 對應的 SQL 目前只存在 Repository：

`supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql`

目前已在無 host port、internal Docker network 的 PostgreSQL 17 synthetic database
驗證：

- 首次 publish 會在同一 statement 建立一筆 ledger、一筆 receipt 並完成 Report。
- 完全相同的 replay 只回傳 `EXISTING_EXACT_MATCH`，不會重複寫入。
- Snapshot SHA、review payload SHA、ledger binding 或 idempotency 漂移會 fail
  closed。
- Report 後段狀態衝突會 rollback 先前 ledger insert。
- Ledger／receipt trigger 拒絕 UPDATE／DELETE。
- RLS 已啟用且沒有 Data API policy；anon、authenticated 與 service_role 都不能
  直接讀寫，只有 service_role 可執行 RPC。

目前仍未：

- 在 Supabase 或 Production 套用 Migration。
- 以 Production schema、真實資料或遠端 concurrency 套用或驗證。
- 建立正式 Supabase Adapter、API route、worker 或付款後 caller。
- 修改既有 Report read gate。
- 讀取真實 Artifact、寫入真實 Report、連線 Production 或交付客戶。

因此 `customerDeliveryAllowed` 仍為 false，既有 production flow 不受影響。

Report create repository 已在 ADR 0068 完成應用程式層的
`chart_snapshot_sha256` Server 計算與 mock contract，但 Migration 尚未套用，
所以這項寫入尚未部署。

## 後果

- Durable ledger、atomic Report publish 與 immutable receipt 有一個可審查的最小
  schema／transaction 草案。
- Logical three-port design 不會被錯誤實作成三次可留下 partial state 的遠端寫入。
- Exact replay、binding conflict 與 Report state conflict 都有固定 fail-closed
  邊界。
- ADR 0068 已讓 Server Report repository 在建立 Snapshot 時同步計算並保存
  canonical `chart_snapshot_sha256`，且 Client 不能提供或覆寫 digest。
- 下一個最小切片可另行設計 Server trusted-delivery Adapter 及 Report read
  gate。套用
  Production Migration 仍須取得使用者對該精確檔案的另外明確授權，且 rollout
  順序必須先 Migration、後應用程式寫入。
