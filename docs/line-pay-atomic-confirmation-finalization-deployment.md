# LINE Pay 原子付款確認部署邊界

本文件只描述 `20260802160000_line_pay_atomic_confirmation_finalization.sql`
的審查與部署順序。它不授權執行 Sandbox／Production Migration、設定 Secret、
重新付款或啟用 LINE Pay Runtime。

## 影響範圍

- 新增一個 `SECURITY DEFINER` RPC：
  `finalize_product_order_line_pay_confirmation(...)`。
- 將既有 evidence 與 completion 核心 RPC 收回至
  `line_pay_payment_function_owner`，並撤銷 executor、`service_role` 與瀏覽器角色
  的直接 EXECUTE。
- 只允許 `line_pay_payment_executor` 執行新的原子 wrapper；該角色不得擁有
  relation／column ACL、private schema usage 或其他 owner-owned RPC 的 EXECUTE。
- 新增 `authenticator -> line_pay_payment_executor` 的精確 `SET=true` membership，
  不新增 LOGIN、INHERIT、SUPERUSER 或 BYPASSRLS 能力。

Migration 不修改商業資料 rows，不啟用 Runtime，也不改寫既有 Migration。

## Backup／PITR 與 restore point

任何 Production 執行前，必須由人工確認 Supabase Backup／PITR 可用，並記錄
一個早於本 Migration 的可用 restore point。不得下載、顯示或搬移備份內容。
無法確認 restore point 時必須停止。

## 固定部署順序

1. `20260719033404_line_pay_remediation_contracts.sql`
2. `20260728053215_line_pay_checkout_aggregate_initialization.sql`
3. 部署包含新 callback adapter 的 exact commit，但保持 Runtime disabled。
4. `20260802160000_line_pay_atomic_confirmation_finalization.sql`
5. 透過受控秘密通道設定 server-only `SUPABASE_LINE_PAY_EXECUTOR_JWT`，不得讀取
   或顯示真值。此 credential 只能代表最小權限的
   `line_pay_payment_executor`，不得改用 `service_role`；輪替必須透過受控秘密通道
   更新並重新部署，無有效 credential 時 callback 必須 fail closed。
6. 執行唯讀 catalog／ACL／callback readiness postflight。
7. 另行取得 Runtime 啟用與付款測試授權。

不得使用 `supabase db push`、`migration up`、apply-all、retry 或 fallback。

## 舊程式相容性

舊版 callback 會分開使用 `service_role` 呼叫 evidence 與 completion RPC；本
Migration 會撤銷該路徑。因此不得在舊版 callback 仍可能處理 LINE Pay 流量時
先套用 Migration。安全順序是先部署新程式且維持 Runtime disabled，再套用
exact-file Migration、設定 executor credential、完成唯讀驗證，最後另行授權啟用。

## 失敗與回復方式

Migration 本身只有一個 transaction；commit 前任何錯誤都必須完整 rollback。
不得準備或執行破壞性 rollback SQL。commit 後若 postflight、credential 或 callback
readiness 異常，必須保持 Runtime disabled，保留現況與稽核證據，並以另建、另審、
另行授權的 exact fail-forward recovery Migration 修正。只有經人工核准的災難復原
程序才能使用既有 restore point。

## 上線前檢查

- exact main commit、Migration SHA-256 與檔案路徑均已鎖定。
- Backup／PITR 與 restore point 已確認。
- executor 角色 attributes、membership、relation／column ACL 與 RPC allowlist 精確。
- split evidence／completion RPC 對 executor、`service_role` 與瀏覽器角色均拒絕。
- 原子 wrapper fresh completion、相同 evidence replay、不同 evidence conflict、
  evidence-then-completion rollback 均在 PostgreSQL 17 通過。
- Runtime disabled，且未建立付款、訂單或交易。
