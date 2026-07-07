# LINE Pay 官方金流架構核對筆記

本文件根據 LINE Pay 官方 Developers 文件整理，用於核對本專案 `provider = line_pay` 的付款架構與目前實作差異。

安全規則：

- 不放任何 Channel Secret。
- 不放任何 production env 真值。
- 不放測試卡號或真實付款資訊。
- 不把 LINE Pay 官方金流憑證放進 `NEWEBPAY_*`。
- 不使用藍新 MPG 的 `LINEPAY=1`。

參考文件：

- LINE Pay Developers - Online payment: https://developers-pay.line.me/online
- LINE Pay Developers - Online API v3: https://developers-pay.line.me/online-api-v3
- LINE Pay Developers - Payment request: https://developers-pay.line.me/online-api-v3/request-payment
- LINE Pay Developers - Payment confirmation: https://developers-pay.line.me/online-api-v3/confirm-payment
- LINE Pay Developers - Implement basic payment: https://developers-pay.line.me/online/implement-basic-payment

## 1. LINE Pay 線上付款三方

LINE Pay 官方線上付款流程涉及三方：

1. `customer`
   - 使用 LINE Pay 的顧客。
   - 在商店網站選擇 LINE Pay 後，被導向 LINE Pay 認證畫面。
   - 完成認證或取消付款後，被導回商店指定的頁面。

2. `merchant server`
   - 本專案的後端。
   - 建立本地訂單與本地 `payments` pending row。
   - 呼叫 LINE Pay request API。
   - 接收 LINE Pay redirect 到 `confirmUrl` / `cancelUrl`。
   - 在 `confirmUrl` route 內呼叫 LINE Pay confirm API。
   - 只有 confirm 成功後，才可以把本地 payment 標記為 paid。

3. `LINE Pay server`
   - LINE Pay 官方付款伺服器。
   - 接收 merchant server 的 request / confirm / refund 等 API 呼叫。
   - 提供 `paymentUrl.web` / `paymentUrl.app` 給顧客完成 LINE Pay 認證。
   - 在顧客完成或取消認證後，將顧客導回 merchant server 指定 URL。

## 2. 官方基本付款流程

基本付款流程如下：

1. Merchant server 呼叫：
   - `POST /v3/payments/request`

2. LINE Pay server 回傳 request response：
   - `returnCode`
   - `returnMessage`
   - `info.transactionId`
   - `info.paymentUrl.web`
   - `info.paymentUrl.app`

3. Merchant server 將 customer 導向：
   - 桌機通常使用 `paymentUrl.web`
   - 行動裝置可使用 `paymentUrl.app`

4. Customer 在 LINE Pay 畫面完成認證，或取消付款。

5. LINE Pay server 依 request payload 的 `redirectUrls` 將 customer 導回：
   - `confirmUrl`
   - `cancelUrl`

6. Merchant server 在 `confirmUrl` route 讀取 LINE Pay redirect 參數，例如：
   - `transactionId`
   - `orderId` 或其他 LINE Pay redirect 附帶的訂單識別資訊

7. Merchant server 呼叫：
   - `POST /v3/payments/{transactionId}/confirm`

8. Confirm request body 使用：
   - `amount`
   - `currency`

9. Confirm response 的 `returnCode === "0000"` 後，才可以：
   - 將本地 `payments.status` 標記為 `paid`
   - 寫入 `provider_trade_no = transactionId`
   - 執行業務 paid sync，例如同步 `product_orders.payment_status = paid`

10. 基本付款若沒有採用分開請款，payment confirmation 後會自動 capture，付款即完成。

重要判斷：

- HTTP 200 只代表 API HTTP 層回應成功，不代表付款成功。
- LINE Pay API 是否成功要看 `returnCode`。
- `returnCode === "0000"` 才能視為該 API 呼叫成功。
- Request 成功只代表取得 LINE Pay 認證網址，不代表付款完成。
- Customer 完成 LINE Pay 認證後，仍必須由 merchant server 呼叫 confirm API。
- Confirm 成功後才可以 mark paid。

## 3. 目前專案已完成狀態

### Helper 層

目前已完成 LINE Pay helper：

- `src/lib/linePay/config.ts`
  - environment normalize
  - base URL
  - nonce
  - JSON body stringify

- `src/lib/linePay/signature.ts`
  - HMAC SHA256 signature
  - LINE Pay request headers

- `src/lib/linePay/requestPayload.ts`
  - `POST /v3/payments/request` payload builder
  - 第一版支援 `TWD`
  - 驗證 amount / products / redirect URLs

- `src/lib/linePay/confirmPayload.ts`
  - `transactionId` string validation
  - `POST /v3/payments/{transactionId}/confirm` payload builder

- `src/lib/linePay/responseParser.ts`
  - request response parser
  - confirm response parser
  - transactionId 保持 string
  - `returnCode !== "0000"` 會視為失敗

- `src/lib/linePay/requestClient.ts`
  - request payment client helper
  - 只透過 injected `fetchFn` 測試
  - 目前尚未被 product order route 呼叫

- `src/lib/linePay/confirmClient.ts`
  - confirm payment client helper
  - 只透過 injected `fetchFn` 測試
  - 不更新 DB，不 mark paid

- `src/lib/linePay/paymentMetadata.ts`
  - request / confirm metadata helper
  - 可合併 LINE Pay metadata
  - 目前 product order request route 尚未寫入 transactionId / paymentUrl metadata

- `src/lib/linePay/orderId.ts`
  - LINE Pay orderId normalize / build / extract
  - 用於建立 merchant-managed `orderId`

- `src/lib/linePay/index.ts`
  - barrel export

### Product order request route

目前已有：

- `src/app/api/product-orders/line-pay/request/route.ts`
- `src/app/api/product-orders/line-pay/request/handler.ts`

目前完成：

- route skeleton
- feature flag / server env gate
- `productOrderId` request body validation
- product order preflight reader
- product order payable checks
- request payload dry-run
- LINE Pay orderId 建立
- `provider = line_pay` pending payment 建立
- `product_orders.payment_id` 連到 pending payment

目前成功 response 仍刻意回 `501`：

- `error = "line_pay_product_order_request_not_implemented"`
- `preflight = true`
- `dryRun = true`
- `pendingPayment = true`

這是為了避免前端誤以為可以付款。

## 4. 目前尚未完成項目

目前尚未完成：

- 尚未呼叫 LINE Pay `POST /v3/payments/request`
- 尚未把 `transactionId` 寫入 payment metadata
- 尚未把 `paymentUrl.web` / `paymentUrl.app` 寫入 payment metadata
- 尚未把 `paymentUrl.web` 回給前端導頁
- 尚未有 LINE Pay `confirmUrl` route
- 尚未有 LINE Pay `cancelUrl` route
- 尚未呼叫 LINE Pay `POST /v3/payments/{transactionId}/confirm`
- 尚未在 confirm 成功後 `mark paid`
- 尚未同步 `product_orders.payment_status = paid`
- 尚未處理使用者取消付款
- 尚未有前端 LINE Pay 按鈕

## 5. 架構修正與注意事項

### `LINE_PAY_CONFIRM_URL` 不是 webhook

`LINE_PAY_CONFIRM_URL` 是 customer 完成 LINE Pay 認證後，LINE Pay redirect 回商店的 route。

它不是背景 webhook。

正確責任：

1. 接收 redirect 參數。
2. 驗證本地 pending payment / product order 狀態。
3. 由 server 呼叫 LINE Pay confirm API。
4. confirm `returnCode === "0000"` 後才 mark paid。

### `paymentUrl.web` / `paymentUrl.app` 的用途

`paymentUrl.web` / `paymentUrl.app` 是 LINE Pay request API 回傳後，merchant server 要提供給前端導向 LINE Pay 認證頁使用。

它不是付款完成證明。

### `transactionId` 必須保持 string

LINE Pay transactionId 可能是 19 位整數。

JavaScript number 會有精度風險，所以本專案必須：

- parser 轉成 string
- metadata 存 string
- confirm route 使用 string
- provider trade no 使用 string

### `returnCode=0000` 才算 API 成功

LINE Pay API response 通常有 HTTP 200。

但付款流程判斷不能只看 HTTP status。必須檢查：

- request API：`returnCode === "0000"` 才能使用 `paymentUrl`
- confirm API：`returnCode === "0000"` 才能 mark paid

### `provider=line_pay` 必須獨立於 `provider=newebpay`

本專案付款 provider 分離：

- NewebPay：`provider = newebpay`
- LINE Pay 官方金流：`provider = line_pay`

不可混用：

- 不使用藍新 MPG 的 `LINEPAY=1`
- 不把 LINE Pay 官方 Channel Secret 放到 `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV`
- 不把 LINE Pay request / confirm 流程塞進 NewebPay Notify

## 6. 目前實作與官方流程差異表

| 階段 | 官方流程 | 目前專案狀態 |
| --- | --- | --- |
| 建立本地訂單 | Merchant server 建立商店訂單 | 已有 `product_orders` |
| 建立本地 payment | Merchant server 建立 pending payment | 已完成 `provider=line_pay` pending payment |
| Request API | 呼叫 `POST /v3/payments/request` | 尚未呼叫 |
| Request response | 取得 `transactionId` / `paymentUrl` | helper 已有 parser，route 尚未接 |
| 顧客導頁 | 前端導向 `paymentUrl.web` / `paymentUrl.app` | 尚未接前端 |
| Confirm redirect | LINE Pay 導回 `confirmUrl` | 尚未建立 route |
| Confirm API | 呼叫 `POST /v3/payments/{transactionId}/confirm` | helper 已有 client，route 尚未接 |
| Mark paid | confirm `returnCode=0000` 後 mark paid | 尚未實作 |
| Product order sync | payment paid 後同步 order paid | NewebPay 已有類似架構，LINE Pay 尚未接 |
| Cancel | LINE Pay 導回 `cancelUrl` | 尚未建立 route |

## 7. 建議下一步小包順序

1. `22G-5`：呼叫 LINE Pay request API，寫入 `transactionId` / `paymentUrl` metadata，但不 mark paid。

2. `22H-1`：建立 product order LINE Pay confirm route skeleton，只接 redirect 參數，不呼叫 confirm API。

3. `22H-2`：confirm route preflight，讀 payment / product_order，驗證 pending 狀態。

4. `22H-3`：呼叫 confirm API，`returnCode=0000` 後才 mark paid 並 sync product_order。

5. `22H-4`：cancel route skeleton，處理使用者取消付款。

6. `22I`：前端 cart 接 LINE Pay 按鈕。

## 8. 上線前 gate

在以下條件完成前，不建議開前端 LINE Pay 入口：

- LINE Pay request API 已接通且只回安全導頁資料。
- Request response 已寫入 `transactionId` / `paymentUrl` metadata。
- Confirm route 已完成 server-side confirm。
- Confirm `returnCode=0000` 後才會 mark paid。
- Product order paid sync 已通過 dry-run。
- Cancel route 已能安全處理使用者取消。
- `NEXT_PUBLIC_ENABLE_LINE_PAY` 仍由 production env 明確控制。
