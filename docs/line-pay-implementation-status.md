# LINE Pay Implementation Status

本文件整理目前 LINE Pay 官方金流串接狀態與上線前缺口。它只做實作盤點，不包含任何 Channel Secret、production env 真值、真實交易資料、測試卡號、個資、藍新 HashKey / HashIV、TradeInfo 或 TradeSha。

## 一、目前完成狀態

### 1. Helper 層

目前 `src/lib/linePay` 已完成以下 helper：

- Config
  - `normalizeLinePayEnvironment`
  - `getLinePayBaseUrl`
  - `createLinePayNonce`
  - `stringifyLinePayJsonBody`

- Signature
  - `buildLinePaySignature`
  - HMAC SHA256。
  - GET / POST message 組合。

- Headers
  - `buildLinePayRequestHeaders`
  - 產生 `Content-Type`、`X-LINE-ChannelId`、`X-LINE-Authorization`、`X-LINE-Authorization-Nonce`。

- Request payload
  - `buildLinePayRequestPayload`
  - 第一版只支援 `TWD`。
  - 驗證 amount、products、confirmUrl、cancelUrl。

- Confirm payload
  - `validateLinePayTransactionId`
  - `buildLinePayConfirmPayload`
  - `transactionId` 全程保持 string。

- Response parser
  - `parseLinePayRequestResponse`
  - `parseLinePayConfirmResponse`
  - `returnCode !== "0000"` 視為 API 失敗。

- Request client
  - `requestLinePayPayment`
  - 透過 injected `fetchFn` 呼叫 LINE Pay request API。
  - 不直接讀 production env。

- Confirm client
  - `confirmLinePayPayment`
  - 透過 injected `fetchFn` 呼叫 LINE Pay confirm API。
  - 不直接更新 DB、不 mark paid。

- Status client
  - `checkLinePayPaymentRequestStatus`
  - `getLinePayPaymentDetails`
  - 用於 confirm `1172` / `1198` / timeout 後的狀態查詢。

- Metadata helper
  - `buildLinePayRequestPaymentMetadata`
  - `buildLinePayConfirmPaymentMetadata`
  - `mergeLinePayPaymentMetadata`

- OrderId helper
  - `normalizeLinePayOrderId`
  - `buildLinePayOrderId`
  - `extractSourceIdFromLinePayOrderId`

- Confirm outcome guard
  - `resolveLinePayConfirmOutcome`
  - 只有結果安全、金額/幣別/orderId/transactionId 一致時，才允許後續 mark paid。

### 2. 後端 Request Route

目前已完成：

- `POST /api/product-orders/line-pay/request`
- Product order preflight。
- 建立 `provider=line_pay` pending payment。
- 呼叫 LINE Pay request API。
- 寫入 `transactionId` / `paymentUrl` metadata。
- 回傳 `paymentUrl.web` 給前端導頁。
- 不使用 NewebPay MPG `LINEPAY=1`。

### 3. 後端 Confirm Route

目前已完成：

- `GET /api/product-orders/line-pay/confirm`
- 接 `orderId` / `transactionId`。
- Preflight payment / product_order。
- 呼叫 LINE Pay confirm API。
- Confirm API `1172` / `1198` / timeout 時 fallback 查 request status / payment details。
- Outcome safe 才 mark paid。
- Sync `product_orders`。
- 最後導回：
  - `/cart?linePay=success`
  - `/cart?linePay=pending`
  - `/cart?linePay=error`

### 4. 後端 Cancel Route

目前已完成：

- `GET /api/product-orders/line-pay/cancel`
- 接 `orderId` / `transactionId`。
- 寫入 `linePay.cancel` metadata。
- 不改 paid / failed / canceled status。
- 不改 `product_orders`。
- 最後導回：
  - `/cart?linePay=canceled`
  - `/cart?linePay=error`

### 5. 前端 Cart

目前已完成：

- `NEXT_PUBLIC_ENABLE_LINE_PAY` feature flag gate。
- 按鈕字樣固定為 `LINE Pay`。
- Click handler。
- 建立 product order。
- 呼叫 `/api/product-orders/line-pay/request`。
- 取得 `paymentUrl.web` 後導頁。
- Cart return message：
  - `/cart?linePay=success`
  - `/cart?linePay=canceled`
  - `/cart?linePay=pending`
  - `/cart?linePay=failed`
  - `/cart?linePay=error`

## 二、目前不能直接 Production 開放的原因

- 尚未填入 production LINE Pay key。
- 使用 key 前必須先詢問使用者。
- 尚未完成 sandbox 手動測試。
- 尚未完成 production sign-off。
- 尚未確認 LINE Pay 後台白名單 / 對外 IP。
- 尚未確認正式 `confirmUrl` / `cancelUrl`。
- 尚未確認白皮書是否有額外要求。
- 尚未確認退款流程。
- 尚未確認發票 / 金額 / coupon 規則。
- 尚未完成正式交易當天取消 / 退款流程演練。
- 未完成前不可對一般使用者開放。

## 三、LINE Pay Key 使用提醒

- 需要使用串接 key 前，必須先回報使用者。
- 不得要求使用者把 Channel Secret 貼在聊天室。
- 只能由使用者自行填入 Vercel Environment Variables 或 `.env.local`。
- 文件、commit、log、終端回報都不可出現 key 真值。
- `LINE_PAY_CHANNEL_SECRET` 不可加 `NEXT_PUBLIC`。

## 四、白皮書狀態

- 使用者已提醒後續可能需要白皮書。
- 目前不可自行假設白皮書內容。
- 若要套用白皮書，必須先請使用者提供 PDF 或官方連結。
- 若白皮書與現有實作不同，先整理差異，不直接改程式。

## 五、下一步建議小包

- `22J-2`：LINE Pay env readiness checklist，不讀真值，只檢查欄位需求。
- `22J-3`：LINE Pay sandbox dry-run readiness，不呼叫 API，只檢查流程缺口。
- `22J-4`：填 key 前確認清單，等使用者確認後再進 sandbox。
- `22K-1`：sandbox 手動測試第一輪。
- `22K-2`：sandbox 測試結果修正。
- `22L`：production sign-off 前最後檢查。

## 六、禁止事項

- 不要放 Channel Secret。
- 不要放 production env 真值。
- 不要放真實 `transactionId` / `orderId` / `paymentId`。
- 不要放個資。
- 不要放測試卡號。
- 不要放藍新 HashKey / HashIV。
- 不要放 TradeInfo / TradeSha。
- 不要啟用藍新 `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。
