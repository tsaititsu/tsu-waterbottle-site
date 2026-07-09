# 紫微占卜紀錄持久化與會員歸戶檢查（2026-07-09）

小包編號：22J-39
基準 commit：`ebc091c`（盤點）＋本包最小熱修
本包**沒有呼叫 OpenAI、沒有刷卡、沒有呼叫藍新、沒有 SQL、沒有 DB schema 變更**。

---

## 一、盤點結果（14 問）

1. **reading id 怎麼產生**：抽牌建立時 server 先以 `crypto.randomUUID()` 產生 local id；若 DB 持久化開啟，改用 `divination_readings` insert 回傳的 DB id（local id 存進 `external_reading_id`）。
2. **是否寫入 `divination_readings`**：**只有在 flag 開啟時才寫**（`createPendingDivinationReading`，status=`pending_payment`）。
3. **是否受 `ENABLE_DIVINATION_DB_READINGS` 控制**：是。`readings/create` 與 `interpret` 兩支 route 都以 `process.env.ENABLE_DIVINATION_DB_READINGS === "true"` 分流。
4. **`.env.example` 預設值**：`ENABLE_DIVINATION_DB_READINGS=false`。
5. **production 若沒開這個 flag 會發生什麼**：
   - 占卜紀錄**完全不寫 DB**，事後無從補查。
   - `interpret` 會走「本機 entitlement」路徑（`reserveLocalDivinationEntitlement`：每日免費額度＋client 傳 `mockPaid` 的 mock 付款），**而不是 DB paid gate**。這條路徑是開發／預覽用，不是正式收費閘門。
   - 換句話說：**flag 沒開＝正式金流與占卜紀錄整條對不起來**。`docs/divination-newebpay-launch-readiness.md` 也將此 flag 列為 production 人工確認項。**請務必到 Vercel 確認 production 已設 `ENABLE_DIVINATION_DB_READINGS=true`**（本包依規範未讀 production env 真值，無法代為確認）。
6. **解讀結果目前存在哪**：flag 開啟時存兩處——DB `interpretation` 欄位（`markDivinationReadingCompleted`）＋瀏覽器 sessionStorage；flag 關閉時**只存 sessionStorage**。
7. **sessionStorage / localStorage 各存什麼**：
   - sessionStorage `divination_reading_session`：本次抽牌流程狀態與解讀結果（分頁級，關閉即消失）。
   - localStorage `divination_local_user_id`：匿名 localUserId（裝置級）。追問草稿另存於 followUpStorage。
8. **paid 後 interpretation 是否寫回 DB**：是（flag 開啟時：paid → interpreting → completed，completed 時寫入 `interpretation`、`interpreted_at`、`result_summary`）。
9. **`divination_readings.user_id` 是否有寫入**：**熱修前：否**——helper 支援 `userId` 參數，但 `readings/create` route 呼叫時沒帶，`user_id` 恆為 null。**本包已修正**（見二）。
10. **是否用登入 user id**：熱修前否（route 完全不讀 Authorization）。熱修後：已登入時用 Supabase auth user id。
11. **匿名 localUserId 如何產生**：client 端 `DivinationLocalPreview` 在 localStorage 產生並保存（`crypto.randomUUID()`，SSR fallback `local-dev-user`），隨 request body 傳給 API；主要用於 flag 關閉時的本機 entitlement（每日免費額度）。
12. **付款後重新開頁能否找回解讀**：**同一個分頁**的流程內可以（NewebPay 跳轉回來 sessionStorage 仍在）；**關閉分頁後不行**——即使 flag 開啟、DB 有 interpretation，目前也沒有任何客戶端 read API／頁面可以再次觀看。
13. **換裝置能否找回**：不行（sessionStorage＋localStorage 都是裝置／分頁級）。
14. **「我的占卜紀錄」目前能不能做**：熱修後具備資料面前置（DB 有紀錄＋user_id 歸戶），但仍需：production flag 確認、以登入者過濾的 read API（list＋單筆，限本人）、前端頁面。**歷史匿名紀錄（user_id=null 的舊資料）無法回溯歸戶。**

## 二、本包修正內容（最小修改）

已確認可安全取得登入 user id（既有 `getUserIdFromRequest`，22J-36 亦在用），因此執行熱修：

1. `src/app/api/divination/readings/create/route.ts`：DB 持久化路徑內，以 Authorization token 解析登入者，`createPendingDivinationReading({ userId: authenticatedUserId, ... })` 寫入 `user_id`。未登入→null，匿名流程不變。
2. `src/components/divination/DivinationLocalPreview.tsx`：建立 reading 時附上 `Authorization: Bearer <token>`（已登入才帶）。
3. **paid sync／interpretation 不需改**：`buildDivinationPaidUpdatePayload`、`buildDivinationPendingPaymentLinkPayload`、`buildDivinationInterpretingUpdatePayload`、`buildDivinationCompletedUpdatePayload`、`buildDivinationFailedUpdatePayload` 都是 partial update，本來就不含 `user_id`，因此 create 時寫入的歸戶會一路保留——已用測試鎖住此行為。
4. 未新增 schema、未執行 SQL（`user_id` 欄位既存）；未動 OpenAI prompt／gpt-5.5 helper／paid gate／NewebPay。

## 三、測試

- `node_modules/.bin/jiti src/lib/supabase/divinationReadings.test.ts`：新增「所有 update payload 不含 user_id」「匿名 user_id=null」「登入寫入 user_id」「空白 userId 視為未登入」。
- `node_modules/.bin/jiti src/app/api/divination/readings/create/route.test.ts`（新增）：user id 只在持久化路徑內解析（flag=false 行為不變）、匿名 localUserId 流程保留、create route 不接觸 OpenAI／不含 `OPENAI_API_KEY`、interpret paid gate 未動、interpret 不寫 user_id、client 帶 token 邏輯存在。
- `node_modules/.bin/jiti src/lib/newebpay/divinationSync.test.ts`：既有測試重跑通過（NewebPay 同步未動）。

## 四、風險與後續

- **P0 待人工確認**：Vercel production 的 `ENABLE_DIVINATION_DB_READINGS` 是否為 `true`。若否，目前所有付費占卜紀錄都沒有落庫。
- sessionStorage 關閉即消失的風險依然存在：在「我的占卜紀錄」頁（22J-42 建議範圍：本人 list／單筆 read API＋頁面）完成前，客人關掉分頁就無法再看已付費的解讀。
- 匿名時段產生的舊紀錄無法歸戶；歸戶只對熱修部署後、登入狀態下建立的新 reading 生效。
