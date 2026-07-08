# NewebPay Product / Divination / AI Chart Gap Audit

本文件盤點開運商品、紫微占卜、AI 命盤目前是否已經可以開 NewebPay 付款入口。  
本輪只讀程式與既有文件，不呼叫藍新 API、不呼叫 LINE Pay API、不刷卡、不讀 env 真值、不改程式、不執行 SQL。目標是找出剩下不足，再一個一個慢慢修。

## 一、盤點目的

- 確認商品、占卜、AI 命盤是否具備正式 NewebPay 上線條件。
- 釐清哪些是後端已完成但前端未開。
- 釐清哪些仍只是骨架、feature flag 關閉或缺交付流程。
- 避免把官方 `provider=line_pay` LINE Pay 與 NewebPay `provider=newebpay` 混用。
- 避免非課程付款誤帶課程分期 `InstFlag=3,6`。
- 避免用 dry-run / mock paid / fake paid 污染正式付款資料。

## 二、共同檢查項目

| 檢查項目 | Product order / cart | AI divination | AI chart |
| --- | --- | --- | --- |
| 前端入口是否存在 | cart 有匯款入口與官方 LINE Pay flow；正式 NewebPay checkout 尚未接 | 占卜結果流程有 NewebPay 按鈕 | AI 命盤結果頁有 NewebPay 骨架 |
| 前端入口是否 disabled | NewebPay 未出現在 cart 正式入口 | 由 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制，關閉時 disabled | 由 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制，預設關閉 |
| 是否有 feature flag 擋住 | NewebPay cart 入口尚未實作；官方 LINE Pay 由 `NEXT_PUBLIC_ENABLE_LINE_PAY` 控制 | 有，全站 NewebPay flag | 有，AI Chart 專用 flag |
| 是否能建立 pending payment | 後端可建立 `spiritual_product_order` pending payment | 可建立 `ai_divination` pending payment | 可建立 `ai_chart_report` pending payment |
| 是否 provider=newebpay | 商品 NewebPay helper 使用 `provider=newebpay`；官方 LINE Pay 另用 `line_pay` | 是 | 是 |
| 是否只送 CREDIT=1 | 是，NewebPay MPG 測試覆蓋 | 是，NewebPay MPG 測試覆蓋 | 是，NewebPay MPG 測試覆蓋 |
| 非課程是否 InstFlag=0 | 是，商品 / 占卜 / AI 命盤皆不開分期 | 是 | 是 |
| 是否沒有送 LINEPAY=1 | 是 | 是 | 是 |
| NotifyURL 是否有接 | 共用 `/api/payments/newebpay/notify` | 共用 `/api/payments/newebpay/notify` | 共用 `/api/payments/newebpay/notify` |
| ReturnURL 是否有接 | 共用 `/payment/newebpay/return`，ClientBackURL 回 cart | 共用 `/payment/newebpay/return`，ClientBackURL 回 ai-divination | 共用 `/payment/newebpay/return`，ClientBackURL 回 ai-chart |
| QueryTradeInfo fallback 是否有接 | notify fallback 測試覆蓋 product order | notify fallback 測試覆蓋 divination | notify fallback 測試覆蓋 ai chart |
| paid 後是否能 sync 對應資料表 | `syncProductOrderAfterPaymentPaid` 已存在 | `syncDivinationReadingAfterPayment` 已存在 | `syncAiChartReportAfterPayment` 已存在 |
| 是否有 paid gate | payment/order 狀態檢查存在；cart NewebPay flow 未開 | persisted reading 未 paid 會回 `PAYMENT_REQUIRED` | read API 未 paid 會回 `PAYMENT_REQUIRED` |
| 是否有測試 | 有 `productOrderPayment`、`productOrders`、`productOrderSync`、notify 測試 | 有 `divinationPayment`、`divinationSync`、`divinationReadings`、notify 測試 | 有 `aiChartPayment`、`aiChartSync`、`aiChartReports`、report completion/read、notify 測試 |
| 是否有正式實刷紀錄 | 本文件未確認 | 本文件未確認 | 本文件未確認 |
| 是否有清楚錯誤提示 | API 有錯誤碼；cart NewebPay 正式 flow 未接 | 前端有付款 / 解讀錯誤提示 | 前端有付款建立 / report read 狀態提示 |
| 是否避免假 paid 污染正式資料 | product order sync 以 payment id / 狀態防呆 | persisted reading 與本機 mock paid 分流 | paid missing content 與 report completion 分流，但正式入口仍關閉 |

## 三、商品 product order / cart 盤點

### 已完成

- `product_orders` / `product_order_items` / `product_shipping_info` schema 與 Supabase helper 已建立。
- `POST /api/product-orders/create` 可建立正式 product order，付款方式目前允許 `bank_transfer` / `newebpay`。
- `src/lib/payments/productOrderPayment.ts` 有 `spiritual_product_order` 對應 mapping。
- `/api/payments/newebpay/create` 已支援 `source=product_order` 與 `orderId`。
- 建立 NewebPay pending payment 後可連到 `product_orders.payment_id`。
- Notify paid 後可透過 `syncProductOrderAfterPaymentPaid` 同步 `product_orders.payment_status=paid` 與 `order_status=paid`。
- NewebPay TradeInfo 測試覆蓋商品交易 `CREDIT=1`、`InstFlag=0`、不送 `LINEPAY=1`。
- 官方 LINE Pay `provider=line_pay` flow 已保存且與 NewebPay 分開。

### 未完成

- cart 尚未接正式 NewebPay checkout 按鈕。
- cart 尚未呼叫 `/api/payments/newebpay/create` 並送 NewebPay MPG form。
- cart 目前主要「前往結帳」仍導向 `/bank-transfer`。
- 商品匯款與 product_order 是否穩定綁定仍需再做上線前確認。
- 物流 API 尚未接；第一版仍需人工出貨。
- 正式低金額刷卡 / Notify / ReturnURL / product order paid sync 還需人工測試。

### 風險

- 後端已可建立 pending payment，但前端未接正式 NewebPay checkout，不能宣稱商品信用卡正式可收款。
- 若跳過前端整合測試，可能產生孤兒 product order 或 pending payment。
- 商品是實體商品，付款完成不等於出貨完成；物流與人工出貨 SOP 必須清楚。
- 官方 LINE Pay flow 已存在但暫停，不能把 cart LINE Pay 當成 NewebPay LINE Pay。

### 建議下一包

- 22J-19：商品 cart NewebPay checkout 缺口修正。
- 後續再做商品 NewebPay dry-run、正式低金額測試、匯款 product_order 綁定確認、人工出貨 SOP。
- 商品第一版適合走「信用卡 + 匯款 + 人工出貨」，但必須先補 cart NewebPay checkout 與正式測試。

## 四、紫微占卜 ai-divination 盤點

### 已完成

- NT$50 付款 item `ai_divination_single` 與 `AI_DIVINATION_AMOUNT_TWD=50` 已存在。
- `src/lib/newebpay/divinationPayment.ts` 可建立 NewebPay payment payload。
- `src/components/divination/DivinationDrawPreview.tsx` 在 persisted reading 且需要付款時顯示信用卡線上付款入口。
- 前端入口由 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制；關閉時按鈕 disabled / 顯示尚未啟用。
- `POST /api/payments/newebpay/create` 可接 `source=ai_divination`、`readingId`。
- `divination_readings` 可 link pending payment，Notify paid 後可 mark reading paid。
- `POST /api/divination/interpret` 對 persisted reading 有 paid gate，未付款會回 `PAYMENT_REQUIRED`。
- paid 後可進入 OpenAI 解讀流程，完成後寫入 interpretation。
- 本機 mock paid 流程存在，但主要用於非 persisted / local 測試。
- NewebPay TradeInfo 測試覆蓋占卜交易 `CREDIT=1`、`InstFlag=0`、不送 `LINEPAY=1`。

### 未完成

- 尚未確認正式實刷紀錄。
- 尚未確認 production `NEXT_PUBLIC_ENABLE_NEWEBPAY` 實際狀態。
- 尚未做上線前完整 smoke test：建立 reading → 建立 NewebPay payment → Notify paid → paid gate 解鎖 → OpenAI 解讀完成。
- QueryTradeInfo fallback 雖有測試，仍需正式環境演練。

### 風險

- mock paid 與正式 persisted reading 必須維持分流，不能讓 mock paid 污染正式資料。
- 若 OpenAI API key 或解讀流程在 production 有問題，使用者可能付款後無法取得解讀。
- 若未做正式刷卡測試就開 flag，付款頁、NotifyURL、ReturnURL 任一環節都可能卡住。

### 建議下一包

- 22J-20：占卜 NT$50 NewebPay 上線前檢查。
- 之後再做低金額正式刷卡文件與實測回報，確認 paid gate、OpenAI 解讀與錯誤提示。

## 五、AI 命盤 ai-chart 盤點

### 已完成

- `ai_chart_report_single` payment item 與 NT$100 report payment payload 已存在。
- `POST /api/ai-chart/reports/create` 可建立 pending AI chart report，且 `reportContent` 目前為 null。
- `POST /api/payments/newebpay/create` 可接 `source=ai_chart_report`、`reportId`。
- `src/lib/newebpay/aiChartSync.ts` 可在 Notify paid 後同步 AI chart report paid。
- `src/app/api/ai-chart/reports/read/handler.ts` 有 paid gate：未付款回 `PAYMENT_REQUIRED`，已付款但無內容回 `paid_missing_content`。
- `src/lib/ai-chart/reportGenerator.ts` 與 `reportCompletion.ts` 已存在 deterministic report completion helper。
- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制正式付款入口，預設應維持關閉。
- NewebPay TradeInfo 測試覆蓋 AI chart 交易 `CREDIT=1`、`InstFlag=0`、不送 `LINEPAY=1`。

### 未完成

- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 應維持關閉；不應開正式入口。
- paid 後 reportContent 產生流程尚未正式接成 active API / production flow。
- OpenAI / reportContent 正式交付流程尚未完成上線確認。
- 前端若開付款，可能遇到 paid report 但內容仍在準備中的狀態。
- 尚未正式實刷。

### 風險

- 最大風險不是付款本身，而是付款後交付內容不足。
- 若 reportContent 仍為 null，使用者付款後只能看到「分析內容準備中」，不適合正式收款。
- AI Chart 曾有 completion API 草稿清理紀錄，代表這條線目前應先跳過付款上線。

### 建議下一包

- 22J-21：AI 命盤 NewebPay / reportContent 缺口修正。
- 先完成 reportContent 產生、OpenAI 或 deterministic completion active flow，再重新評估付款入口。

## 六、三者優先順序建議

### 第一優先：紫微占卜 ai-divination

- 原因：NT$50 金額小，前端付款入口、pending payment、paid gate、OpenAI 解讀、Notify sync 都已形成完整鏈條。
- 還差什麼：正式低金額刷卡、Notify / ReturnURL / QueryTradeInfo fallback 驗證、production flag 確認、mock paid 與正式資料隔離確認。
- 下一包建議：22J-20 占卜 NT$50 NewebPay 上線前檢查。

### 第二優先：商品 product order / cart

- 原因：後端 product order / pending NewebPay payment / paid sync 完整度高，也適合第一版搭配人工出貨。
- 還差什麼：cart 正式 NewebPay checkout 尚未接，匯款綁 product_order 與人工出貨 SOP 仍需確認。
- 下一包建議：22J-19 商品 cart NewebPay checkout 缺口修正。

### 第三優先：AI 命盤 ai-chart

- 原因：付款骨架存在，但交付內容 reportContent / OpenAI completion 仍是主要缺口。
- 還差什麼：paid 後穩定產生報告內容、正式入口旗標策略、低金額實刷與結果頁驗證。
- 下一包建議：22J-21 AI 命盤 NewebPay / reportContent 缺口修正。

## 七、禁止事項

- 不要啟用藍新 MPG `LINEPAY=1`。
- 不要讓非課程付款出現 `InstFlag=3,6`。
- 不要混用 `provider=line_pay` 與 `provider=newebpay`。
- 不要用 fake paid / dry-run paid 污染正式付款資料。
- 不要略過 paid gate。
- 不要在未正式實刷前宣稱已正式可收款。
- 不要輸出 HashKey / HashIV / MerchantID 真值。
- 不要輸出 LINE Pay Channel Secret。
- 不要讀 `.env.local`。
- 不要讀 production env。
- 不要刷卡。
- 不要 deploy。

## 八、下一步建議

- 22J-19：商品 cart NewebPay checkout 缺口修正。
- 22J-20：占卜 NT$50 NewebPay 上線前檢查。
- 22J-21：AI 命盤 NewebPay / reportContent 缺口修正。
- 22J-22：商品 / 占卜 / AI 命盤正式低金額測試文件。

## 九、安全要求

- 不放 HashKey / HashIV / MerchantID 真值。
- 不放 LINE Pay Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放 transactionId / orderId / paymentId 真值。
- 不放個資。
- 不放 TradeInfo / TradeSha。
- 不放測試卡號。
