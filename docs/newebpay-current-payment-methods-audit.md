# NewebPay Current Payment Methods Audit

本文件只盤點目前程式與文件中的 NewebPay 支付方式狀態。  
本輪沒有登入藍新後台、沒有呼叫藍新 API、沒有刷卡、沒有讀 env 真值、沒有輸出 HashKey / HashIV / MerchantID 真值、沒有改程式邏輯、沒有執行 SQL、沒有 push / deploy。

## 一、盤點範圍

本次檢查範圍：

- `src/lib/payments`
- `src/lib/newebpay`
- `src/app/api/**/newebpay*`
- `src/app/api/**/payment*`
- `.env.example`
- `docs` 內 NewebPay / LINE Pay 相關文件

本文件中的「程式已使用」只代表程式碼會送出該參數或已接入該流程，不代表藍新後台一定已啟用。  
藍新後台實際開通項目仍需人工登入後台確認，本輪未做後台確認。

## 二、NewebPay TradeInfo 目前送出的支付參數

### Unified NewebPay create route

主要路徑：

- `src/app/api/payments/newebpay/create/route.ts`
- `src/app/api/payments/newebpay/create/handler.ts`
- `src/lib/newebpay/paymentForm.ts`

目前 `createNewebPayMpgPaymentData()` 送出的基本 TradeInfo 欄位包含：

- `MerchantID`
- `RespondType`
- `TimeStamp`
- `Version`
- `MerchantOrderNo`
- `Amt`
- `ItemDesc`
- `ReturnURL`
- `NotifyURL`
- `ClientBackURL`
- `LangType`

支付工具參數：

| 參數 | 目前程式是否主動送出 | 狀態 |
| --- | --- | --- |
| `CREDIT` | 是，`paymentMode="credit"` 時送 `CREDIT=1` | 程式已使用 |
| `LINEPAY` | 否 | 未啟用 |
| `WEBATM` | 否 | 未使用 |
| `VACC` | 否 | 未使用 |
| `CVS` | 否 | 未使用 |
| `BARCODE` | 否 | 未使用 |
| `CVSCOM` | 否，程式碼未找到主動送出 | 未使用 |
| `TAIWANPAY` | 否 | 未使用 |
| `APPLEPAY` | 否 | 未使用 |
| `ANDROIDPAY` | 否 | 未使用 |
| `SAMSUNGPAY` | 否 | 未使用 |
| `ESUNWALLET` | 否 | 未使用 |
| `TWQR` | 否 | 未使用 |
| `AFTEE` | 否 | 未使用 |
| `InstFlag` | 是，課程付款送 `InstFlag=3,6`，非課程 NewebPay payment helper 送 `InstFlag=0` | 課程限定信用卡分期 |

`paymentMode` 目前只允許：

- `credit`
- `merchant_default`

行為：

- `credit`：TradeInfo 會加入 `CREDIT=1`，非課程交易明確帶 `InstFlag=0`。
- `merchant_default`：TradeInfo 不加入信用卡等支付工具參數，但明確帶 `InstFlag=0`，避免非課程交易套用分期。
- `linepay`：create handler 會直接回 `linepay_not_enabled`，不會送 NewebPay MPG `LINEPAY=1`。

### Course / test legacy MPG form helper

主要路徑：

- `src/lib/newebpay/mpg.ts`
- `src/app/api/payments/newebpay/course/start/route.ts`
- `src/app/api/payments/newebpay/test/start/route.ts`
- `src/app/payment/newebpay/redirect/page.tsx`

`createCoursePaymentMpgForm()` / `buildCoursePaymentTradeInfoFields()` 的 TradeInfo 型別固定包含：

- `CREDIT: "1"`
- `InstFlag`

目前課程 start / redirect 流程會送 `InstFlag=3,6`，只讓線上課程可用信用卡 3 期 / 6 期分期。test payment 與非課程 NewebPay payment helper 維持 `InstFlag=0`，不會主動送 `LINEPAY=1`、`WEBATM`、`VACC`、`CVS`、`BARCODE`、`TAIWANPAY` 等參數。

### Notify / query parsing

主要路徑：

- `src/lib/newebpay/notify.ts`
- `src/lib/newebpay/query.ts`
- `src/app/api/payments/newebpay/notify/route.ts`

Notify / query 會讀藍新回傳的：

- `PaymentType`
- `PaymentMethod`

測試中有覆蓋 `CREDIT` 與 `LINEPAY` 解析案例，但這只是「能解析 provider 回傳值」，不是本專案目前有送出 `LINEPAY=1`。

## 三、各產品目前接到哪裡

### Booking / 預約論命

目前狀態：

- 前端：`src/components/BookingForm.tsx`
- API：`POST /api/payments/newebpay/create`
- itemKey：`booking_consultation_60`
- source：`booking`
- paymentMode：`credit`
- TradeInfo 支付工具：`CREDIT=1`
- Notify sync：`syncNewebPayBookingAfterPayment`

入口：

- 付款方式選單保留郵局匯款。
- 信用卡線上付款由 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制。
- flag off 時信用卡選項 disabled，文案提示先用郵局匯款。

結論：

- 程式已接 NewebPay 信用卡。
- 前端是否顯示可用，取決於 production env 的 `NEXT_PUBLIC_ENABLE_NEWEBPAY`。
- 未送 `LINEPAY=1`。

### Course / 線上課程

目前狀態：

- 前端：`src/app/courses/courses-client.tsx`
- API：`POST /api/payments/newebpay/course/start`
- Redirect：`/payment/newebpay/redirect?paymentId=...`
- helper：`createCoursePaymentMpgForm()`
- provider：`newebpay`
- item_type：`course`
- TradeInfo 支付工具：`CREDIT=1`
- TradeInfo 分期：`InstFlag=3,6`
- Notify sync：`syncNewebPayCourseAfterPayment`

入口：

- 課程購買流程會建立 `payments` pending，再導到 `/payment/newebpay/redirect` 自動送 NewebPay form。
- 本輪未看到課程前端使用 `NEXT_PUBLIC_ENABLE_NEWEBPAY` gate。
- 課程購買仍受登入、購買資格與課程解鎖條件控制。

結論：

- 程式已接 NewebPay 信用卡。
- 沒有送 `LINEPAY=1`。
- 藍新後台實際是否只顯示信用卡，仍需人工確認後台與正式交易頁。

### Divination / AI 占卜

目前狀態：

- 前端：`src/components/divination/DivinationDrawPreview.tsx`
- API：`POST /api/payments/newebpay/create`
- itemKey：`ai_divination_single`
- source：`ai_divination`
- paymentMode：`credit`
- TradeInfo 支付工具：`CREDIT=1`
- Notify sync：`syncNewebPayDivinationAfterPayment`

入口：

- 正式 NewebPay 入口由 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制。
- flag off 時按鈕 disabled / 顯示線上付款尚未啟用。
- persisted reading 才走正式付款；本機 mock flow 仍存在。

結論：

- 程式已接 NewebPay 信用卡。
- 前端正式入口受全站 NewebPay flag 控制。
- 沒有送 `LINEPAY=1`。

### AI Chart / AI 命盤

目前狀態：

- 前端：`src/components/ChartResultSessionView.tsx`
- API：`POST /api/ai-chart/reports/create`
- API：`POST /api/payments/newebpay/create`
- itemKey：`ai_chart_report_single`
- source：`ai_chart_report`
- paymentMode：`credit`
- TradeInfo 支付工具：`CREDIT=1`
- Notify sync：`syncNewebPayAiChartAfterPayment`

入口：

- AI 命盤正式 NewebPay 入口由專屬 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制。
- `.env.example` 預設 false。
- flag off 時保留 legacy mock `ActionButton` 流程。
- 不會只因 `NEXT_PUBLIC_ENABLE_NEWEBPAY=true` 就開 AI 命盤正式付款。

結論：

- 後端付款與 Notify sync 骨架已存在。
- 前端正式 NewebPay 入口預設關閉，需專屬 flag 才會顯示。
- 沒有送 `LINEPAY=1`。

### Product Order / Cart / 開運商品

目前 NewebPay 狀態：

- payment item：`spiritual_product_order`
- API：`POST /api/payments/newebpay/create`
- source：`product_order`
- paymentMode：`credit`
- TradeInfo 支付工具：`CREDIT=1`
- Notify sync：`syncNewebPayProductOrderAfterPayment`
- helper：`validateProductOrderPayableForNewebpay`
- helper：`buildProductOrderPaymentMapping`

前端 cart 狀態：

- `src/app/cart/page.tsx` 目前保留郵局匯款流程。
- cart 目前沒有正式 NewebPay checkout 按鈕。
- cart 目前另有官方 LINE Pay 前端流程，屬 `provider=line_pay`，不是 NewebPay MPG `LINEPAY=1`。

結論：

- 商品訂單 NewebPay 後端骨架已完成。
- 商品 cart 前端尚未接正式 NewebPay checkout。
- 沒有送 `LINEPAY=1`。
- 官方 LINE Pay 與 NewebPay 沒有混用 provider。

## 四、已完成但未開前端入口

### Product order NewebPay

已完成：

- `spiritual_product_order` itemKey
- product order payable validation
- pending payment 建立
- `product_orders.payment_id` link
- Notify paid 後 product order sync

尚未開前端：

- cart 沒有 NewebPay checkout 按鈕。
- cart 沒有呼叫 `/api/payments/newebpay/create`。
- cart 沒有自動送 NewebPay MPG form。

### AI chart NewebPay

已完成：

- pending report create API
- AI chart report payment create
- Notify paid sync
- result page DB read

未開原因：

- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 預設 false。
- report content / OpenAI /正式交付流程仍待決策。

### NewebPay test payment

已完成：

- `/api/payments/newebpay/test/start`
- `/payment/newebpay/test`
- `/payment/newebpay/redirect`
- `/dev/newebpay-test`

未開原因：

- `NEWEBPAY_ENABLE_TEST_PAYMENT` 預設 false。
- `NEXT_PUBLIC_ENABLE_NEWEBPAY` 預設 false。
- 這些只應用於受控 smoke test，不是一般使用者入口。

## 五、Disabled feature flag

`.env.example` 目前有以下安全預設：

- `NEXT_PUBLIC_ENABLE_NEWEBPAY=false`
  - 控制 booking / divination / dev test 等前端 NewebPay 顯示與可用狀態。
- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY=false`
  - 專門控制 AI 命盤正式 NewebPay 入口。
- `NEWEBPAY_ENABLE_TEST_PAYMENT=false`
  - 控制 1 元 NewebPay test payment API。
- `NEXT_PUBLIC_ENABLE_LINE_PAY=false`
  - 官方 LINE Pay 前端入口 flag，與 NewebPay MPG `LINEPAY=1` 無關。

本輪沒有讀 `.env.local`，也沒有讀 production env 真值。  
production 實際 flag 值仍需部署環境人工確認。

## 六、只是手冊或文件支援，程式未使用

以下項目目前沒有在 NewebPay TradeInfo 主動送出：

- `LINEPAY`
- `WEBATM`
- `VACC`
- `CVS`
- `BARCODE`
- `CVSCOM`
- `TAIWANPAY`
- `APPLEPAY`
- `ANDROIDPAY`
- `SAMSUNGPAY`
- `ESUNWALLET`
- `TWQR`
- `AFTEE`

補充：

- `merchant_default` 不送上述任何單一支付工具參數。
- 若藍新商店後台本身開了其他付款方式，`merchant_default` 可能由藍新頁面顯示後台預設可用方式；這不是程式主動送 `LINEPAY=1`。
- Notify / query parser 能保存藍新回傳的 `PaymentType` / `PaymentMethod`，不代表程式已啟用該支付方式。

## 七、LINEPAY=1 與 official line_pay 混用檢查

### 是否有任何地方誤開 NewebPay `LINEPAY=1`

本次程式盤點結果：

- 未發現 TradeInfo 主動送出 `LINEPAY=1`。
- `paymentMode="linepay"` 在 `handleCreateNewebPayPaymentRequest()` 會回 `linepay_not_enabled`。
- 測試中多處 assert `decrypted.has("LINEPAY") === false`。
- dev NewebPay test 頁文案明確寫目前 LINE Pay 尚未啟用，預設信用卡一次付清。

結論：

- 目前沒有誤開藍新 MPG `LINEPAY=1`。

### 是否有官方 `line_pay` 跟 NewebPay 混在一起

本次程式盤點結果：

- NewebPay 使用 `provider='newebpay'`。
- 官方 LINE Pay 使用 `provider='line_pay'`。
- 官方 LINE Pay route 在 `src/app/api/product-orders/line-pay/*`。
- NewebPay route 在 `src/app/api/payments/newebpay/*`。
- NewebPay Notify 不處理官方 LINE Pay confirm/cancel。
- 官方 LINE Pay confirm/cancel 不走 NewebPay Notify。
- 文件多處標明不使用藍新 MPG `LINEPAY=1`。

注意：

- cart 官方 LINE Pay flow 目前會建立 product order 後再呼叫 `/api/product-orders/line-pay/request`，這是 official `provider=line_pay` 流程，不是 NewebPay MPG。
- product order 的資料欄位命名仍可能出現 `paymentMethod`，但 provider 與 route 分離清楚。

結論：

- 目前沒有把官方 `line_pay` 當成 NewebPay MPG `LINEPAY=1` 使用。
- 目前沒有把 LINE Pay 官方憑證放入 `NEWEBPAY_*` 設定的程式跡象。

## 八、三層結論

### 1. 程式已使用

已在程式主動送出的 NewebPay 支付方式：

- `CREDIT=1`
- 課程限定 `InstFlag=3,6`
- 非課程 NewebPay 交易 `InstFlag=0`

已接產品：

- booking：NewebPay credit，前端受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制。
- course：NewebPay credit，透過 course start / redirect 流程，課程限定 `InstFlag=3,6`。
- divination：NewebPay credit，前端受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制。
- ai-chart：NewebPay credit，前端受 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制，預設關閉。
- product order：NewebPay credit 後端骨架與 Notify sync 已完成，cart 前端尚未接 NewebPay checkout。

### 2. 程式有骨架但未啟用

- AI chart NewebPay：後端與 result DB read 已有，但正式前端入口預設關閉。
- Product order NewebPay：後端 create / Notify sync 已有，但 cart 尚未接 NewebPay checkout。
- NewebPay test payment：受 `NEWEBPAY_ENABLE_TEST_PAYMENT` 控制，預設關閉。
- `merchant_default`：程式可建立不指定支付工具的 TradeInfo，但不是一般正式入口，且需人工確認藍新後台預設付款工具。

### 3. 藍新後台需人工確認

以下事項只能人工登入藍新後台確認，本輪沒有確認：

- 正式商店是否只啟用信用卡。
- 藍新後台是否有啟用 LINE Pay。
- 若使用 `merchant_default`，付款頁會顯示哪些付款工具。
- 信用卡一次付清是否正式可用。
- 是否有額外支付方式在後台被開啟。
- 正式 Merchant ID / HashKey / HashIV 是否正確設定於部署環境。
- Notify / Return URL 是否符合藍新後台與 production 網域設定。

## 九、安全確認

- 本輪沒有登入藍新後台。
- 本輪沒有呼叫藍新 API。
- 本輪沒有刷卡。
- 本輪沒有讀 `.env.local`。
- 本輪沒有讀 production env 真值。
- 本輪沒有輸出 HashKey / HashIV / MerchantID 真值。
- 本輪沒有改程式邏輯。
- 本輪沒有執行 SQL。
- 本輪沒有 push / deploy。
