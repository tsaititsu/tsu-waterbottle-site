# Supabase 與資料庫規範

本規範適用於 Supabase、SQL、Migration、RLS、Edge Function 與資料存取程式。
通用安全規則以 `docs/SECURITY_RULES.md` 為唯一出處；本檔只放資料庫特有規則。

## 1. 環境隔離

- Codex 可在 Local 或已確認隔離的 Preview／測試 Supabase 建立 Schema、Migration 與測試資料。
- 禁止透過 Dashboard SQL Editor、Table Editor 或任意 SQL 直接修改正式 Supabase Schema。
- Preview 必須使用 Supabase Preview Branch 或獨立測試專案。
- 正式 `service_role` 金鑰不得出現在本機、Preview、PR 或 Log。
- 測試環境不得使用真實付款資料與不必要的會員個資。
- 無法確認目前連到哪個環境時，停止所有寫入操作。

## 2. Schema 變更

- 所有結構變更必須建立 Migration。
- 不可只在後台手動修改而沒有版本紀錄。
- 禁止直接對正式環境執行 `supabase db push`。
- Local／Preview 可建立新資料表、欄位與索引，但必須測試 Migration 可重現並確認 RLS／API 存取設定。
- 正式 Schema 只可由核准的 Migration deployment pipeline 套用；Codex 不直接執行正式推送。
- 刪除資料表、欄位、索引、Policy、Function 或 Storage 物件，以及改變既有資料型別，視為破壞性高風險，Codex 不執行正式操作。
- 高風險 Migration 必須附：
  - 影響範圍
  - 資料備份方式
  - 回復 SQL
  - 上線順序
  - 舊程式相容性

## 3. RLS 與權限

- 新資料表必須評估並明確設定 RLS。
- 不可因查詢失敗就關閉 RLS。
- 每條 Policy 必須說明：
  - 誰可以讀取
  - 誰可以新增
  - 誰可以更新
  - 誰可以刪除
- 一般會員只能存取自己的資料。
- 管理員權限必須由伺服器端驗證。
- 不信任前端傳入的 user_id、role、price、points 或 order_status。
- 新資料表是否可被 Data API 存取，必須依專案 Data API 設定與 `GRANT` 明確確認；API 存取權與 RLS 是兩道不同檢查，兩者都要通過。
- 不可只用 `TO authenticated` 當成資料擁有權驗證；涉及會員資料時必須加入正確的 owner 條件。

## 4. 正式資料新增

正式資料新增只可經 `docs/SECURITY_RULES.md` 核准的管理頁面或受控安全工具。必須具備：

- 白名單資料表與欄位。
- 每次新增筆數上限。
- 寫入前 dry-run。
- Transaction。
- Idempotency key 或唯一限制。
- 稽核紀錄。
- 只具必要權限的專用資料庫角色。

在上述機制尚未建立前，Codex 不得直接新增正式資料。

正式環境永久禁止 Codex 執行 `DELETE`、`TRUNCATE`、`DROP`、刪除 Schema 物件、無精確條件的 `UPDATE`、關閉 RLS，或修改正式付款、點數、訂單狀態與管理員權限。

## 5. 付款、點數與訂單

下列操作必須具備交易一致性與防重複機制：

- 儲值
- 扣點
- 加點
- 建立訂單
- 付款成功
- 退款
- Webhook
- 管理員調整點數

要求：

- 同一請求重送不得重複扣款或加點。
- Webhook 必須具備 idempotency。
- 點數不足時不得先產生成功結果。
- 失敗時不能留下只做一半的資料。
- 重要異動要保留稽核紀錄。
- 不直接刪除財務與點數歷史。

## 6. 查詢與效能

- 查詢只取需要的欄位。
- 大量列表必須分頁。
- 新增高頻查詢時評估索引。
- 避免 N+1 查詢。
- 不在前端直接暴露不必要的資料表欄位。
- 不使用 `select *` 當作長期正式方案，除非有充分理由。

## 7. 測試

資料庫修改至少測試：

- 正常會員
- 未登入使用者
- 其他會員
- 管理員
- 權限不足
- 重複請求
- 交易失敗
- 邊界值
- Migration 升級
- 必要時的回復流程

測試只能在本機或 Preview／測試環境執行。

完成後另外確認：

- Migration 可從乾淨狀態依序套用。
- 新增資料不會因重送而重複建立。
- 新資料表的 Data API 權限與 RLS 都符合預期。
- 沒有對正式 Supabase 執行寫入。
