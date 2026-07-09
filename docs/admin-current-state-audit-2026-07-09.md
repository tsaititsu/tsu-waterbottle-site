# 後台現況盤點（2026-07-09）

小包編號：22J-37（純盤點文件，無程式變更）
基準 commit：`2acc85e fix: lock admin and booking email endpoints`
盤點範圍：`src/app/admin/*`、`src/app/api/admin/*`、`docs/security-hotfix-admin-email-2026-07-09.md`

---

## 重要結論（先講清楚）

- **目前不是完整後台。**
- **目前只是「簡易 admin guard ＋ 預約時段（booking slots）管理」**，其餘後台區塊全部是靜態骨架示意。
- **沒有商品管理**（開運商品資料來自程式內靜態檔，無法在後台上下架、改圖、改價）。
- **沒有訂單管理**（商品訂單、論命訂單、課程訂單都看不到、不能改狀態）。
- **沒有課程管理**（課程內容與價格在程式碼／DB，後台無介面）。
- **沒有占卜管理**（占卜紀錄無後台查詢介面）。
- **沒有會員管理**（不能查詢、停權、調整任何會員）。
- **沒有金流管理**（付款紀錄、對帳、退款都無介面；匯款回報也只有靜態卡片）。
- **沒有出貨管理**（實體商品出貨狀態無介面）。
- **沒有儀表板**（總覽卡片數字是寫死的靜態示意，未接資料庫）。

---

## 1. 目前 /admin 實際有哪些頁面

| 路徑 | 檔案 | 內容 |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx`（135 行） | 後台總覽「骨架」頁，靜態示意 |
| `/admin/booking-slots` | `src/app/admin/booking-slots/page.tsx`（678 行） | **唯一有實際功能的頁面**：論命預約時段管理 |
| （共用） | `src/app/admin/layout.tsx`（105 行） | admin 守門 layout，涵蓋以上所有頁面 |

就這兩頁＋一個守門 layout，沒有其他 admin 頁面。

## 2. /admin 畫面上目前會顯示什麼

通過 admin 驗證後：

- 左側：後台導覽（六項：總覽、開運商品、訂單管理、占卜紀錄、匯款回報、預約時段）。**只有「預約時段」有真實連結（`/admin/booking-slots`）**，其他五項只是頁內錨點。
- 右側：
  - 三張總覽卡片：「今日待處理 0」「待確認匯款 0」「開運商品數 11」——**數字全部寫死**，卡片上自己就標註「靜態示意，尚未接資料庫」。
  - 每個導覽項各一張說明卡，全部顯示「**靜態骨架：下一階段再接資料來源與操作功能。**」
- 頁面文案也自我聲明：「目前為新網站後台骨架，先做靜態畫面與登入保護，尚未接資料庫與正式 admin 權限。」（此文案是熱修前寫的，權限部分已由 22J-36 補上 allowlist 守門，但「骨架」的描述仍然正確。）

## 3. 目前是不是完整後台

**不是。** 除了預約時段管理，其他全部是無功能的靜態畫面。

## 4. 目前能管理什麼資料

只有一種：Supabase 的 `consultation_availability_slots` 資料表（水瓶先生論命的可預約時段）。

在 `/admin/booking-slots` 可以：

- 列出時段（篩選：只看未來／全部／開放／關閉）
- 單筆新增時段（日期＋起訖時間＋備註）
- 批次新增時段（日期區間＋星期幾＋每日起訖時間）
- 批次關閉時段（日期區間，整天或指定時間帶，含預設固定時段的關閉標記）
- 單筆開／關切換

## 5. 目前只有 booking slots 還是還有其他功能

**只有 booking slots。** 沒有其他可操作的後台功能。

## 6. /api/admin/booking-slots 四支 route 分別做什麼

| Route | Method | 功能 |
|---|---|---|
| `/api/admin/booking-slots` | GET | 列出時段（`scope=all` 或 `future`，future 為未來 90 天） |
| `/api/admin/booking-slots` | POST | 單筆新增時段（驗證起訖時間，`is_available: true`） |
| `/api/admin/booking-slots/batch` | POST | 批次新增：依日期區間＋星期產生時段，跳過重複（比對既有 start/end） |
| `/api/admin/booking-slots/bulk-close` | PATCH | 批次關閉：把區間內已開放時段設為不可用；預設固定時段則補建關閉標記 |
| `/api/admin/booking-slots/[id]` | PATCH | 更新單筆（`isAvailable`、`note`） |

四支全部套用 `requireAdminUser` 守門（22J-36）。

## 7. /api/admin/session 做什麼

`GET /api/admin/session`：讓前端確認「目前登入者是否為 admin」。內部就是跑一次 `requireAdminUser`，通過回 `{ ok: true, isAdmin: true }`，否則回 401／403。`src/app/admin/layout.tsx` 用它決定要不要渲染後台 UI。此 route 不讀寫任何資料。

## 8. 權限目前怎麼判斷

`src/lib/auth/admin.ts` 的 `requireAdminUser`（22J-36 熱修版）：

1. 從 `Authorization: Bearer <token>` 取 Supabase access token；沒有 → 401。
2. 用 Supabase Admin client `auth.getUser(token)` 驗證；無效 → 401。
3. 取使用者 email，與 server-only 環境變數 `ADMIN_EMAILS`（逗號分隔 allowlist）比對；比對 trim ＋ 大小寫不敏感；不在名單 → 403。

頁面端：`/admin/*` 由 layout 呼叫 `/api/admin/session` 驗證，通過才渲染 children。

注意：這是 **env allowlist 的熱修方案**，不是正式 RBAC（無 `profiles.role`、無資料庫角色欄位）。LINE 登入且無 email 的帳號無法成為 admin。

## 9. ADMIN_EMAILS 沒設定時會怎樣

**Fail closed，後台整個鎖死：**

- 所有 `/api/admin/*` 一律 403（即使是已登入的任何人）。
- `/admin/*` 頁面顯示「沒有管理權限」，不會渲染後台 UI。
- 前台（占卜、命盤、預約、購物）完全不受影響。
- 解法：在部署環境設定 `ADMIN_EMAILS` 後 redeploy。

## 10. 非 admin 會看到什麼

| 情境 | 頁面行為 | API 行為 |
|---|---|---|
| 未登入 | `/admin/*` 導回首頁 `/` | 401 `請先登入後再使用後台。` |
| 已登入但不在 ADMIN_EMAILS | 「沒有管理權限」卡片＋返回首頁按鈕，看不到任何後台操作 UI | 403 `沒有管理權限。` |

錯誤訊息不含 `ADMIN_EMAILS`、env 細節或名單內容。

## 11. 目前沒有做到哪些正式後台功能

- 商品管理（上下架、圖片、價格、庫存）——商品資料目前是 `src/lib/spiritualProducts.ts` 靜態檔
- 訂單管理（商品／論命／課程訂單查詢、狀態更新）
- 出貨管理（實體商品物流狀態）
- 金流管理（付款紀錄查詢、對帳、退款操作）
- 匯款回報審核（`bank_transfer_submissions` 有資料表與 API，但後台只有靜態卡片，無審核介面）
- 課程管理（課程、章節、學員名單）
- 占卜／命盤紀錄管理（客服查詢用）
- 會員管理（查詢、停權、角色）
- 儀表板（真實統計數據，目前卡片數字寫死）
- 論命預約「訂單」檢視（時段可以開關，但看不到誰預約了哪個時段）
- 正式 RBAC（profiles.role / app_metadata role，取代 env allowlist）
- 後台操作稽核 log（誰改了什麼時段沒有紀錄）

---

## 附註

- 本文件為純盤點，未變更任何程式、UI、權限、API、DB。
- 權限守門細節與部署需求見 `docs/security-hotfix-admin-email-2026-07-09.md`。
