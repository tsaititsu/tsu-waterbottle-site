# LINE Pay 結帳聚合初始化部署與回復邊界

本文件只封存 `20260728053215_line_pay_checkout_aggregate_initialization.sql`
的審查條件。本 PR 不部署、不連線 Production Supabase，也不啟用 LINE Pay。

## 影響範圍

Migration 只新增一個 service-role-only initializer、一個 private audit helper、
一條 audit INSERT Policy、兩條聚合驗證用 SELECT Policy、一個 partial unique
index，以及 dedicated function-owner 對品項／收件資料的 SELECT 權限。它不
建立或改寫既有資料表，也不改變既有訂單、付款或銀行轉帳資料。

Policy 意圖如下：

- Audit 讀取：不新增讀取 Policy，沿用既有 owner-scoped audit 可見性。
- Aggregate 驗證讀取：只讓 dedicated function-owner 讀取 LINE Pay 訂單的
  品項與收件資料。
- 新增：只有 dedicated function-owner role 可新增 `checkout_initialized`。
- 更新：不新增 Policy 或 table privilege。
- 刪除：不新增 Policy 或 table privilege。

兩條額外 SELECT Policy 只供 private audit helper 驗證完整 aggregate：

- 品項至少一筆，subtotal 合計、snapshot、訂單／付款／attempt 金額與幣別一致。
- 收件資料精確一筆；Production 仍須符合對應配送方式的必要欄位。

這些 Policy 不授權 `anon`、`authenticated` 或 `service_role` 直接新增、
修改或刪除 audit 資料。

## Backup／PITR 與 restore point

任何 Production 執行前，必須由人工確認 Supabase Backup／PITR 可用，並記錄
一個早於 Migration 的可用 restore point。不得下載或輸出備份內容，也不得在
本 PR 執行 restore。若無法證明 restore point 可用，停止部署。

## 上線順序

1. 確認 `LINE Pay Runtime disabled`，且沒有 request／confirm／callback 背景工作。
2. 鎖定 main 的完整 commit 與 Migration SHA-256。
3. 完成 Production 唯讀 preflight、Backup／PITR 與 restore point 核對。
4. 只使用另行核准的 exact-file runner 套用 initializer Migration。
5. 完成 function、ACL、Policy、index、資料筆數與歷史 fingerprint postflight。
6. Migration 成功後仍保持 `LINE Pay Runtime disabled`。
7. Runtime 切換必須是另一個 PR、另一輪 Preview／Sandbox 驗證與另一份授權。

禁止 `supabase db push`、`migration up`、apply-all、retry 或 fallback。

## 舊程式相容性

舊程式不呼叫新 initializer，因此 Migration 單獨套用時不改變既有 checkout
路徑。新 Runtime 不得早於 Migration 部署。若 Migration 尚未完成，舊 Runtime
可維持現況；若新 Runtime 已使用 initializer，禁止退回舊的多步驟建立流程。

## Reviewed recovery SQL

`supabase/deployment/line_pay_checkout_aggregate_initialization_recovery.sql`
是可審查但不得自動執行的回復 SQL，沒有連接任何 Production workflow。

只有同時符合下列條件，才可另行取得人工授權後使用：

- `LINE Pay Runtime disabled`。
- `checkout_initialized` audit event 精確為 0。
- initializer、private helper、三條 Policy、SELECT ACL 與 index 均通過
  owner、security mode、definition digest、ACL 與 canonical expression
  的 exact catalog 驗證。
- `service_role` 的 function `EXECUTE` ACL 不得帶 `GRANT OPTION`。
- Backup／PITR 與可用 restore point 已核對。

Recovery 只移除本 Migration 新增的 function、Policy 與 index；不處理資料，
不使用 CASCADE。只要已有任何 `checkout_initialized` audit event，Recovery
會以 `line_pay_initialization_recovery_requires_fail_forward` fail closed。
零筆檢查前會在同一 transaction 先鎖定品項、收件資料與 audit relations；
若 initializer 已經開始，Recovery 必須等它完成後重新觀察 audit，若 Recovery
先取得鎖，並行 initializer 必須等待且不能留下部分 aggregate。
此時必須保持 Runtime disabled，另建、另審並另行授權 exact fail-forward
recovery Migration，不得硬退、重試或直接操作 Production。
