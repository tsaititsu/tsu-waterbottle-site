# 後台與客戶紀錄功能盤點（2026-07-09）

小包編號：22J-38（純盤點文件，無程式變更）
基準 commit：`a39b035 docs: audit current admin state`
本文件不含任何 key / env 真值 / 完整交易編號。

---

## 一、目前問題

- **目前不是完整後台。**
- **目前 `/admin` 只有簡易 guard（ADMIN_EMAILS allowlist）與 booking slots 管理。**
- 目前看不到：
  - 誰預約了哪個時段（時段只能開關，看不到對應預約人）
  - 商品訂單
  - 商品出貨狀態
  - NewebPay 付款紀錄
  - 郵局匯款回報（只有靜態卡片，無審核介面）
  - 紫微占卜解讀紀錄
  - AI 命盤解讀紀錄
  - 客戶付款後是否成功產生解讀
  - 客戶自己過去買過／解讀過什麼（除了預約與課程）

另外三個盤點中發現的現況問題（不在本輪處理，先記錄）：

1. **占卜紀錄的 DB 持久化在 flag 後面**：`ENABLE_DIVINATION_DB_READINGS`（`.env.example` 預設 `false`）。若 production 未開啟，占卜紀錄「根本沒寫進 DB」，解讀結果只存在瀏覽器 sessionStorage，關掉分頁就再也看不到。做「我的占卜紀錄」前必須先確認／開啟這個 flag。
2. **占卜紀錄與登入會員沒有綁定**：目前用 localStorage 的匿名 `localUserId`，不是登入 user id。`divination_readings` 已有 `user_id` 欄位（型別上為 string | null），但寫入流程沒帶登入者 id。
3. **兩支既有 read API 沒有本人檢查**（只靠 UUID 難猜）：`GET /api/bookings/read?bookingId=`（回完整 PII 含生日）、`GET /api/ai-chart/reports/read?reportId=`（付款檢查有、本人檢查無）。後續做紀錄功能時建議一併補上授權。
4. **商品訂單沒有綁登入會員**（已確認：create 流程與 `product_orders` payload 完全沒有 user_id）。「客戶端我的商品訂單」動工前要先決定歸戶方式：補寫 user_id（可能需 schema）或以登入 email 比對 customer_email 過渡。

---

## 二、後台需要的資料檢視（缺什麼）

### 1. 預約紀錄後台（目前：無）

要看：預約時間、姓名、email、phone、服務項目（plan_name）、狀態（status）、付款狀態（payment_status）、是否寄信（confirmation/cancellation email flags）、建立時間、備註。
資料現況：`bookings` 表全部欄位都有，`listSupabaseBookings()`（不帶 userId）即可列全部。**只缺 admin API + UI。**

### 2. 商品訂單後台（目前：無）

要看：product_order id／order_no、客戶資料、商品明細（`product_order_items`）、訂單金額、payment_id、payment_status、order_status、shipping_status、付款方式（信用卡／Apple Pay／郵局匯款；`payment_method` 欄位為 `bank_transfer | newebpay`，Apple Pay 需從對應 payment 的 raw_payload／paymentMode 判讀＝**推測，需驗證**）、建立時間、出貨備註。
資料現況：`product_orders`＋`product_order_items`＋`product_shipping_info` 三表都存在，helper 只有 create／sync 方向。**缺查詢 helper、admin API、UI。**

### 3. 金流付款後台（目前：無）

要看：payment id、provider（newebpay／line_pay）、item_type（source_type）、item_id（source_id）、amount_twd、status、付款方式、MerchantOrderNo（**遮蔽顯示**）、TradeNo（**遮蔽顯示**）、paid_at、created_at、notify 狀態（notify_received_at、failure_reason）、QueryTradeInfo fallback 是否用過（**推測：可由 raw_payload 內的 source 標記判讀，實作前需確認**）。
資料現況：`payments` 表欄位齊全（含 merchant_order_no、provider_trade_no、notify_received_at、failure_reason、raw_payload）。**只缺 admin API + UI；raw_payload 不可直接吐給前端。**

### 4. 郵局匯款回報後台（目前：無）

要看：匯款人（payer_name）、金額、後五碼、回報時間、對應訂單（item_type + item_id + item_name）、審核狀態（status）、人工確認紀錄。
資料現況：`bank_transfer_submissions` 表存在，客戶端回報 API `/api/bank-transfer/submit` 已上線（需登入、防重複回報）。**缺 admin 查詢 API + UI。**「人工確認紀錄」（審核人、審核時間欄位）**目前找不到明確資料來源，可能需要 schema**——若要避免 schema 變更，第一版可只做 read-only 檢視＋LINE/人工流程。

### 5. 紫微占卜解讀後台（目前：無）

要看：reading id、使用者、問題、抽到的牌／星曜（card_id、card_name、position、draw_mode）、payment_id、payment_status／是否 paid、是否已產生 OpenAI 解讀（status：pending_payment → paid → interpreting → completed；interpretation 內容）、模型（**推測：raw_payload 或 interpretation 內可能有記錄；env `OPENAI_DIVINATION_MODEL=gpt-5.5`，實作前需確認每筆是否有存**）、解讀建立時間、錯誤狀態。
資料現況：`divination_readings` 表與完整 status 流程存在。**缺 admin API + UI，且受 `ENABLE_DIVINATION_DB_READINGS` flag 影響（見一、1）。**
客服可查詢但**不可任意重跑 OpenAI**（重跑＝另做功能、另計成本，不在 read-only 範圍）。

### 6. AI 命盤解讀後台（目前：無）

要看：report id、使用者（user_id）、命盤資料摘要（title／chart_profile_id）、payment_id、payment_status、reportContent 是否存在（report_content null 與否）、產生時間、錯誤狀態（error_message）、目前正式付款是否仍關閉（由 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` flag 控制，`.env.example` 預設 false；**production 實際值不在本盤點讀取範圍，需到 Vercel 確認**）。
資料現況：`ai_chart_reports` 表欄位齊全。**缺 admin API + UI。**

### 7. 課程購買後台（目前：無）

要看：course_purchase id、課程名稱（course_id → `src/lib/courses.ts` 對照）、學員資料（user_id → profiles）、金額與是否分期（在 `payments` 表，course purchase 本身只有 payment_id 關聯）、payment_status、access_status（現況為 `status='paid'` 即開通，**沒有獨立 access_status 欄位＝推測需沿用 status**）、建立時間（purchased_at）。
資料現況：`course_purchases` 表存在，客戶端已有本人查詢 API。**缺 admin 學員名單 API + UI。**

### 8. 會員／客戶查詢（只盤點，不實作）

要查：email、phone、歷史預約、歷史訂單、歷史占卜、歷史命盤、課程購買紀錄。
資料現況：會員主檔在 Supabase `auth.users`＋`profiles`（id、display_name 等，經 `/api/auth/sync-profile` upsert）。**phone 目前找不到明確資料來源**（只有各訂單／預約上各自留的電話）。跨資料彙整查詢（依 email 串起所有紀錄）需要新的 admin API；占卜紀錄因 localUserId 問題（見一、2）目前無法可靠串到會員。

---

## 三、客戶端需要的紀錄頁

**目前沒有完整客戶中心。** `/account` 會員中心頁存在，但：

- 「付款紀錄」區塊資料來自 `mockPayment`（**localStorage**，換裝置／清瀏覽器即消失，不是 DB 真資料）。
- 統計卡片來自 `mockData` 靜態值。
- 真資料只有兩塊：`/account/bookings`（我的預約，走 `/api/bookings/list` 本人過濾 ✓）與 `/account/courses`（我的課程，走 `/api/account/course-purchases` ✓）。

各紀錄頁盤點：

| 頁面 | 應顯示 | 現況 |
|---|---|---|
| 1. 我的占卜紀錄 | 問題、抽牌結果、付款狀態、解讀結果、建立時間、再次觀看 | **完全沒有。** 且資料面有兩個前置：DB 持久化 flag、登入 user 綁定（見一、1、2）。解讀結果目前只存 sessionStorage，付完款換裝置即無法再看 |
| 2. 我的 AI 命盤紀錄 | 命盤報告、付款狀態、報告是否已產生、再次觀看 | **沒有列表。** 單筆再次觀看已可行（`/ai-chart/result/[id]`＋reports/read，含 402 付款檢查），但依賴使用者自己保留網址；缺「以登入者列出全部 reports」的 API 與頁面 |
| 3. 我的商品訂單 | 商品明細、金額、付款方式、payment_status、shipping_status、郵局匯款資訊 | **完全沒有。** 資料在 DB（三張表），缺本人查詢 API + 頁面 |
| 4. 我的預約紀錄 | 預約時間、服務項目、付款狀態、是否已確認 | **已有**（`/account/bookings`），可取消預約；欄位大致齊全 |
| 5. 我的課程 | 已購課程、付款狀態、是否開通 | **已有**（`/account/courses`），顯示已購課程；付款狀態細節（分期等）未顯示 |

---

## 四、資料來源盤點總表

「是否已可 read-only」＝資料表與資料寫入已存在，只補查詢 API + UI 即可上線。

| 功能 | 可能資料表 | 現有 helper | 現有 API | 現有前端頁面 | 已可 read-only | 需要新 API | 需要 schema | 風險 |
|---|---|---|---|---|---|---|---|---|
| 後台預約紀錄 | `bookings`（＋`consultation_plans`） | `listSupabaseBookings()` 可列全部 | 無 admin 版（bookings/list 為本人） | 無 | **是** | 是（admin list） | 否 | PII 多（生日、電話）；`/api/bookings/read` 無授權待補 |
| 後台商品訂單 | `product_orders`、`product_order_items`、`product_shipping_info` | productOrders.ts（create）、productOrderSync.ts（付款 sync） | 無 read | 無 | **是**（需新查詢 helper） | 是 | 否 | 收件地址 PII；Apple Pay 判讀方式＝推測需驗證 |
| 後台付款紀錄 | `payments` | payments.ts（mapPaymentRow 等） | 無 read | 無 | **是** | 是 | 否 | MerchantOrderNo／TradeNo 需遮蔽；raw_payload 不可吐給前端 |
| 郵局匯款回報審核 | `bank_transfer_submissions` | 無查詢 helper（submit route 內嵌查詢） | 只有客戶端 submit | 無 | **是**（檢視）；審核操作另議 | 是 | 審核人／審核時間欄位目前找不到＝可能需要 | 人工確認紀錄無處可寫；先 read-only 可避開 schema |
| 後台占卜解讀紀錄 | `divination_readings` | divinationReadings.ts（寫入導向） | 無 read | 無 | **視 flag 而定**：若 production 未開 `ENABLE_DIVINATION_DB_READINGS`，DB 內可能沒有資料 | 是 | 否（user 綁定用既有 user_id 欄位） | 解讀內容敏感；模型欄位是否有存＝推測 |
| 後台 AI 命盤紀錄 | `ai_chart_reports` | aiChartReports.ts | reports/read（單筆、無本人檢查） | 無列表 | **是** | 是（admin list） | 否 | report_content 大；錯誤狀態需一併顯示 |
| 後台課程學員 | `course_purchases`（＋`payments`、`profiles`） | coursePurchases.ts | 無 admin 版 | 無 | **是** | 是 | 否（access_status 沿用 status＝推測） | 分期資訊要 join payments |
| 會員查詢 | `auth.users`、`profiles`＋上述各表 | 無 | 無 | 無 | 部分（跨表彙整較大） | 是 | phone 目前找不到明確資料來源 | 占卜紀錄靠 localUserId 串不到會員 |
| 客戶：我的占卜紀錄 | `divination_readings` | 同上 | 無 read | 無（結果只在 sessionStorage） | **否**：先開 DB flag＋補登入 user_id 寫入，才有資料可列 | 是（本人 list＋單筆） | 否 | 本人限定；歷史匿名紀錄無法回溯歸戶 |
| 客戶：我的 AI 命盤紀錄 | `ai_chart_reports`（user_id 已存在） | aiChartReports.ts | reports/read（單筆） | `/ai-chart/result/[id]`（單筆再看 ✓） | **是**（list 缺） | 是（本人 list） | 否 | reports/read 建議補本人／付款雙重檢查 |
| 客戶：我的商品訂單 | `product_orders` 三表（**已確認：整個 create 流程沒有寫入 user_id，訂單未綁登入會員**） | productOrders.ts | 無 read | 無 | **否**：需先解決歸戶（補寫 user_id，或以登入 email 比對 customer_email 過渡） | 是 | user_id 欄位是否存在於 DB＝目前找不到明確資料來源，可能需要 | 不可用 order_no 猜他人訂單；email 歸戶有不一致風險 |
| 客戶：我的預約 | `bookings` | listSupabaseBookings(userId) | `/api/bookings/list` ✓ | `/account/bookings` ✓ | **已上線** | 否 | 否 | — |
| 客戶：我的課程 | `course_purchases` | — | `/api/account/course-purchases` ✓ | `/account/courses` ✓ | **已上線** | 否 | 否 | — |

找不到明確資料來源的項目已如實標註；標「推測」者一律需在實作小包中先驗證。

---

## 五、優先級建議（不實作）

**P0（最痛：錢已經在收，但雙方都看不到紀錄）**

- 後台預約紀錄 read-only（老師要知道誰約了哪個時段）
- 後台商品訂單 read-only（不看 DB 就無法出貨）
- 後台付款紀錄 read-only（對帳）
- 客戶端我的占卜紀錄（付 50 元的結果現在關瀏覽器就消失；含前置：DB flag＋user 綁定）
- 客戶端我的商品訂單

**P1**

- 後台占卜解讀紀錄 read-only
- 後台 AI 命盤紀錄 read-only
- 客戶端我的 AI 命盤紀錄
- 郵局匯款回報審核（第一版 read-only 檢視）

**P2**

- 出貨狀態管理（shipping_status 更新）
- 課程學員管理
- 客服查詢頁（依 email 彙整）
- 會員查詢

**P3**

- 正式 RBAC（profiles.role，取代 env allowlist）
- 操作稽核 log
- 儀表板統計（取代 /admin 靜態卡片）

---

## 六、建議小包順序（不實作）

- 22J-39：後台預約紀錄 read-only（建議順手補 `/api/bookings/read` 授權）
- 22J-40：後台商品訂單 read-only
- 22J-41：後台付款紀錄 read-only（遮蔽規則在此包定案）
- 22J-42：客戶端我的占卜紀錄（含前置：確認／開啟 `ENABLE_DIVINATION_DB_READINGS`、寫入登入 user_id）
- 22J-43：客戶端我的商品訂單（含前置：訂單歸戶方式定案，見一、4）
- 22J-44：後台占卜解讀紀錄 read-only
- 22J-45：郵局匯款回報審核 read-only／人工確認設計（schema 需求在此包定案）
- 22J-46：客戶端我的 AI 命盤紀錄（含 reports/read 本人檢查補強）
- 22J-47：後台 AI 命盤紀錄 read-only
- 22J-48：出貨人工 SOP／shipping_status 管理設計

**SEO 排最後，不在這批做。**

---

## 七、安全規則（所有後續小包必須遵守）

- 後台資料只限 `ADMIN_EMAILS` 內的 admin（沿用 `requireAdminUser`，fail closed）。
- 客戶端紀錄只限本人查看：一律以登入 token 推導 user id 過濾，**不可**信任 query string 的 user 參數。
- 不可讓客戶看到別人的紀錄；不可在 URL 猜 id 就看別人的資料（新增 read API 一律做本人／admin 檢查；既有 `/api/bookings/read`、`/api/ai-chart/reports/read` 在對應小包補上）。
- payment id／TradeNo／MerchantOrderNo 後台可遮蔽顯示（例：只顯示末 4–5 碼）。
- 前台不可顯示完整交易資料（客戶端只看得到自己的金額、狀態、末碼）。
- 不顯示 key／env／secret；`raw_payload` 不直接輸出到任何前端。
- 不執行 SQL；不改 schema（22J-45 若確定需要審核欄位，另開 schema 小包走正式流程）。

---

## 八、檢查紀錄

- `git status --short`：僅新增本文件（另有前輪未追蹤的 `docs/site-audit-2026-07-09.md`）。
- `git diff --check`：通過。
- `npm run build`：**sandbox 無法執行**（Linux SWC binary 受 registry 政策限制無法下載，與 22J-36／37 相同）。本輪為純 .md 文件、零程式變更，不影響 build。
