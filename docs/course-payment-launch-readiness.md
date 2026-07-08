# Course Payment Launch Readiness

本文件整理線上課程付款上線前檢查。  
本輪只新增文件，不改程式邏輯、不呼叫藍新 API、不刷卡、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

## 一、目前課程付款目標

線上課程付款目前目標如下：

- 線上課程可使用 NewebPay 信用卡一次付清
- 線上課程可使用 NewebPay 信用卡分期 3 / 6 期
- 課程付款 provider: `newebpay`
- 課程付款 NewebPay MPG: `CREDIT=1`
- 課程付款 NewebPay MPG: `InstFlag=3,6`
- 這不是信用卡定期定額
- 這不是 LINE Pay
- 不使用藍新 MPG `LINEPAY=1`
- 不使用官方 `provider=line_pay`

`InstFlag=3,6` 只應出現在課程付款，不可外溢到 booking / divination / ai-chart / product order / cart 商品。

## 二、前端入口檢查

課程付款前端入口目前在：

- `src/app/courses/page.tsx`
- `src/app/courses/courses-client.tsx`

目前確認：

- 課程頁會顯示課程列表與課程價格。
- 課程購買按鈕在 `CoursesPageClient` 的每個課程卡片中。
- 使用者需登入。
- 使用者需符合課程解鎖條件。
- 使用者需勾選課程購買須知。
- 點擊購買後會呼叫 `POST /api/payments/newebpay/course/start`。
- 成功後導到 `/payment/newebpay/redirect?paymentId=...`。
- 付款表單由 redirect 頁送到 NewebPay MPG。
- 前端目前沒有看到 LINE Pay 課程付款入口。
- 前端目前沒有看到非課程分期入口。
- 前端有建立付款單失敗、尚未登入、已購買、尚未符合資格等錯誤提示。

待確認：

- 課程卡片是否有明確顯示「信用卡 3 / 6 期分期」提示。
- NewebPay 付款頁是否正確顯示一次付清、3 期、6 期。
- 使用者看到的付款方式文案是否足夠清楚。

本包只盤點，不改 UI。

## 三、後端付款流程檢查

### Course payment create API

課程付款建立 API：

- `src/app/api/payments/newebpay/course/start/route.ts`

流程摘要：

1. 檢查 Supabase admin config。
2. 從 request 取得登入使用者。
3. 驗證 `courseId`。
4. 讀取使用者已購買課程。
5. 檢查是否已購買。
6. 檢查是否符合課程解鎖條件。
7. 產生 NewebPay merchant order no。
8. 建立 `payments` pending row。
9. 建立 NewebPay MPG form。
10. 回傳 `paymentId`、`courseId`、`merchantOrderNo`、`form`。

### NewebPay MPG payload builder

課程 MPG helper：

- `src/lib/newebpay/mpg.ts`
- `createCoursePaymentMpgForm()`
- `buildCoursePaymentTradeInfoFields()`

課程付款目前會帶：

- `CREDIT=1`
- `InstFlag=3,6`

### MerchantOrderNo

課程付款使用：

- `generateMerchantOrderNo('COURSE')`

格式由 `src/lib/newebpay/mpg.ts` 產生，包含 prefix、時間與隨機碼，最後限制在 NewebPay 可接受長度內。

### NotifyURL / ReturnURL

課程付款 URL 由：

- `buildNewebPayMerchantOrderUrl(config.siteUrl, pathname, merchantOrderNo)`

目前設定：

- NotifyURL: `/api/payments/newebpay/notify?merchantOrderNo=...`
- ReturnURL: `/api/payments/newebpay/return?merchantOrderNo=...`
- ClientBackURL: `/account/courses`

### paid sync course_purchases

Notify paid 後路徑：

- `src/app/api/payments/newebpay/notify/route.ts`
- `syncCourseAfterPayment()`
- `syncNewebPayCourseAfterPayment()`
- `markCoursePaidByPayment()`

資料表 sync helper：

- `src/lib/supabase/coursePurchases.ts`

行為摘要：

- 若 payment `itemType !== 'course'`，跳過 course sync。
- 若缺 `userId` 或 `itemId`，跳過並記錄。
- 若沒有既有 `course_purchases`，insert paid row。
- 若既有 row 不是 paid，update 成 paid。
- 若既有 row 已 paid，回傳 already_paid。

### QueryTradeInfo fallback

Notify route 中有 QueryTradeInfo fallback 流程：

- Notify 付款結果需要補查時，可用 QueryTradeInfo 查詢交易狀態。
- fallback 成功 mark paid 後，仍會走 course sync。
- 上線前需人工測試 fallback 是否能正確查詢正式交易。

### 假 paid 防護

上線前需特別確認：

- 不要用手動 UPDATE 把正式測試 payment 標成 paid。
- 不要把 dry-run cleanup / virtual paid 混入正式付款。
- `payments.status=paid` 應由正式 Notify / Return fallback / 明確受控測試流程產生。

## 四、非課程分期隔離檢查

目前隔離規則：

- booking 不可有 `InstFlag=3,6`
- divination 不可有 `InstFlag=3,6`
- ai-chart 不可有 `InstFlag=3,6`
- product order / cart 不可有 `InstFlag=3,6`
- test payment / redirect 不可有 `InstFlag=3,6`
- 非課程 NewebPay 應為 `InstFlag=0` 或不開分期
- 不可讓藍新後台預設分期影響非課程付款

目前程式狀態：

- 共用 NewebPay payment helper 明確帶 `InstFlag=0`
- 課程 payment start route 明確帶 `InstFlag=3,6`
- NewebPay redirect 頁只有 `payment.item_type === 'course'` 才帶 `InstFlag=3,6`
- test payment 維持 `InstFlag=0`
- paymentForm 測試已覆蓋 booking / divination / ai-chart / product order / merchant_default 的 `InstFlag=0`

## 五、測試清單

### 已有測試

- NewebPay MPG payload 測試
  - `src/lib/newebpay/mpg.test.ts`
  - 覆蓋課程 `CREDIT=1`
  - 覆蓋課程 `InstFlag=3,6`
  - 覆蓋 test payment `InstFlag=0`
  - 覆蓋不送 `LINEPAY`
- paymentForm 測試
  - `src/lib/newebpay/paymentForm.test.ts`
  - 覆蓋 booking / divination / ai-chart / product order `InstFlag=0`
  - 覆蓋 merchant_default `InstFlag=0`
  - 覆蓋不送 `LINEPAY`
- coursePayment 測試
  - `src/lib/newebpay/coursePayment.test.ts`
  - 覆蓋課程 pending payment metadata / insert payload
  - 覆蓋 provider=`newebpay`
  - 覆蓋 item_type=`course`
- payment create route 測試
  - `src/app/api/payments/newebpay/create/route.test.ts`
  - 覆蓋共用 NewebPay create route 與 product order safety
- notify parser / sync 測試
  - `src/lib/newebpay/notify.test.ts`
  - 覆蓋 course sync inserted / updated / already_paid / skipped / failed
  - 覆蓋 QueryTradeInfo fallback 後 course sync
- course_purchases sync 測試
  - `src/lib/supabase/coursePurchases.test.ts`
  - 覆蓋 course paid insert / update / already_paid decision
- Supabase payments 測試
  - `src/lib/supabase/payments.test.ts`
  - 覆蓋 payment paid context mapping 與敏感資料不外露

### 待補測試

- 課程前端 UI 是否明確顯示 3 / 6 期分期提示。
- 課程 redirect page 對真實 pending course payment 的 Form Post 整合測試。
- 正式 NewebPay 付款頁是否顯示一次付清 / 3 期 / 6 期。

### 上線前需人工確認

- 正式藍新後台已啟用信用卡分期。
- 正式付款頁顯示課程 3 / 6 期。
- 非課程付款頁不顯示分期。
- NotifyURL / ReturnURL 在 production 網域可正常收發。
- QueryTradeInfo fallback 可查正式交易。

## 六、上線前人工測試清單

以下只列清單，本輪不執行：

1. 課程付款頁可以建立付款。
2. NewebPay 付款頁顯示信用卡一次付清。
3. NewebPay 付款頁顯示 3 期。
4. NewebPay 付款頁顯示 6 期。
5. 非課程付款頁不顯示分期。
6. NotifyURL 回來後 payment 變 paid。
7. `course_purchases` 正確 sync。
8. ReturnURL 顯示付款結果。
9. fallback QueryTradeInfo 可查詢。
10. 不產生假 paid。
11. 不送 `LINEPAY=1`。
12. 不使用 `provider=line_pay`。

## 七、Production feature flag / env 檢查

本文件只列欄位名稱，不讀 `.env.local`，不讀 production env，不輸出真值。

NewebPay 必要 env 欄位：

- `NEWEBPAY_MERCHANT_ID`
- `NEWEBPAY_HASH_KEY`
- `NEWEBPAY_HASH_IV`
- `NEWEBPAY_ENV`
- `NEWEBPAY_VERSION`
- `NEXT_PUBLIC_SITE_URL`

課程付款相關 route / URL：

- NotifyURL 由 `NEXT_PUBLIC_SITE_URL` / config siteUrl 組出 `/api/payments/newebpay/notify`
- ReturnURL 由 `NEXT_PUBLIC_SITE_URL` / config siteUrl 組出 `/api/payments/newebpay/return`
- ClientBackURL 由 `NEXT_PUBLIC_SITE_URL` / config siteUrl 組出 `/account/courses`

課程付款相關 flag：

- 目前課程付款 route 沒有使用 `NEXT_PUBLIC_ENABLE_NEWEBPAY` gate。
- 若要在 production 控制課程付款入口，需另包評估是否新增 course-specific flag。
- `NEWEBPAY_ENABLE_TEST_PAYMENT` 只控制測試付款，不控制課程付款。

安全要求：

- 不讀 `.env.local`
- 不讀 production env
- 不輸出 MerchantID / HashKey / HashIV 真值
- 不把任何 key 放進文件或 commit

## 八、上線建議

### 可優先開

- 課程信用卡一次付清
- 課程信用卡 3 / 6 期

### 上線前仍需

- 正式低金額刷卡測試
- 確認 NotifyURL
- 確認 ReturnURL
- 確認 QueryTradeInfo fallback
- 確認 `course_purchases` sync
- 確認退款 / 取消交易 SOP
- 確認客服說明文案
- 確認分期只出現在課程交易

### 暫不開

- LINE Pay
- 非課程分期
- ATM / WebATM / 超商代碼 / 條碼
- AI Chart 正式付款

## 九、禁止事項

- 不要呼叫藍新 API
- 不要刷卡
- 不要啟用 `LINEPAY=1`
- 不要讓非課程出現分期
- 不要混用 `provider=line_pay`
- 不要輸出 HashKey / HashIV / MerchantID
- 不要讀 production env
- 不要執行 SQL
- 不要 push
- 不要 deploy
- 不要用假 paid 污染正式 payment / course_purchases

## 十、下一步建議

- `22J-18`：課程付款實測前安全檢查，不刷卡
- `22J-19`：課程付款正式低金額測試指引
- `22J-20`：課程付款測試結果回報與修正
- `22J-21`：課程付款正式上線檢查

## 十一、安全要求

- 不放 HashKey / HashIV / MerchantID 真值
- 不放 LINE Pay Channel Secret
- 不放 production env 真值
- 不放 sandbox env 真值
- 不放真實 `transactionId` / `orderId` / `paymentId`
- 不放個資
- 不放 TradeInfo / TradeSha
- 不放測試卡號

## 十二、本文件限制

- 本文件只根據 repo 與既有文件盤點。
- 本文件沒有登入藍新後台。
- 本文件沒有讀 `.env.local`。
- 本文件沒有讀 production env。
- 本文件沒有做任何付款 API 呼叫。
- 本文件沒有刷卡。
- production 實際 env、後台分期開通與付款頁顯示仍需人工確認。
