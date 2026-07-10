# 客戶端「我的占卜紀錄／再次觀看」（2026-07-10）

小包編號：22J-42
基準：`5890d57`（占卜紀錄持久化與 user_id 歸戶）之後
本包**沒有呼叫 OpenAI、沒有重新解讀、沒有重新付款、沒有 SQL、沒有 DB schema 變更、未動金流與 paid gate**。

---

## 一、功能總覽

登入會員可以在會員中心查看自己的紫微占卜紀錄，並重新開啟已完成的付費解讀。

| 項目 | 路徑 |
|---|---|
| 會員中心入口 | `/account` →「我的占卜紀錄」卡片 |
| 紀錄列表頁 | `/account/divinations` |
| 單筆再次觀看頁 | `/account/divinations/[id]` |
| 列表 API | `GET /api/account/divination-readings`（可帶 `limit`，預設 20、上限 50） |
| 單筆 API | `GET /api/account/divination-readings/[id]` |

狀態文案：`pending_payment` 待付款（顯示「尚未完成付款」，**不提供重新付款**）、`paid` 付款完成等待解讀、`interpreting` 解讀產生中、`completed` 解讀完成（才顯示「查看解讀」）、`failed` 解讀暫時未完成請聯繫客服（**不提供重新呼叫 OpenAI**）。

## 二、安全規則（已以測試鎖定）

- **只能查看本人資料**：user id 一律由登入 token 推導；API 完全不接受 query/body 的 `userId`、`email` 等識別欄位（handler 只讀 `limit`）。
- **DB 查詢同時限制 `id` 與 `user_id`**；非本人、不存在、非 UUID 的 id 一律回 404 同文案，不洩漏紀錄是否存在。
- **匿名舊紀錄（user_id=null）不會出現在會員中心**：查詢以 `eq('user_id', <登入者>)` 過濾，null 永不匹配；空白 userId 直接拒絕。不做 email 猜測歸戶、不回補歷史紀錄。
- **completed 才能再次觀看完整解讀**：interpretation 在 helper mapper 依 status gate，非 completed 一律 null；列表 API 與查詢欄位完全不含 interpretation。
- **不回傳** `raw_payload`、`payment_id`、`merchant_order_no`、`user_id`、任何 key／env；錯誤回應固定文案。
- **interpretation 以純文字渲染**（白名單欄位 + `whitespace-pre-line` 保留換行），不使用 `dangerouslySetInnerHTML`。
- 本頁**不會重新呼叫 OpenAI、不會重複扣款、不改 reading status**（read-only）。

## 三、時間顯示

DB `created_at` / `interpreted_at` 維持 UTC 不動。新增 `src/lib/date/formatTaipeiDateTime.ts`：以 `Intl.DateTimeFormat`＋`timeZone: 'Asia/Taipei'` 的 `formatToParts` 組出固定格式（例 `2026/07/10 00:08`），不手動加 8 小時；null／invalid 回「—」。已測 `2026-07-09T16:08:00.000Z` → `2026/07/10 00:08`。

## 四、測試

- `jiti src/lib/date/formatTaipeiDateTime.test.ts`：UTC→台北、跨日、invalid。
- `jiti src/lib/supabase/divinationReadings.test.ts`：limit 正規化（20 預設／50 上限）、list/detail mapper（列表無 interpretation、completed 才輸出）、查詢以 user_id 過濾、select 欄位白名單、空 userId 拒絕、user_id 歸戶回歸。
- `jiti src/app/api/account/divination-readings/route.test.ts`：401、token 推導、client userId/email 無效、20/50、回應無敏感欄位、錯誤不洩漏；頁面 source 檢查（入口、空狀態、狀態文案、無 dangerouslySetInnerHTML、無 OpenAI 呼叫）；create route user_id 與 paid gate 回歸。
- `jiti "src/app/api/account/divination-readings/[id]/route.test.ts"`：401、非 UUID 404、非本人 404（回應與不存在一致）、completed 含解讀、pending 不含、無敏感欄位。
- 回歸：22J-39 create route 測試、divinationSync（NewebPay 未動）重跑通過。

## 五、已知限制

- 歷史匿名紀錄（歸戶修正部署前、或未登入抽的牌）不會出現在列表，無法回溯。
- 列表第一版無分頁（最多 50 筆），之後量大再加 cursor。
- `pending_payment` 紀錄第一版不提供續付入口，避免重複建立 payment（roadmap 另議）。
