# LINE Pay Route Smoke Checklist

本文件整理 LINE Pay 官方金流後端 route 的 smoke checklist。內容僅供部署前後檢查使用，不包含任何 Channel Secret、production env 真值、真實交易資料、測試卡號、個資、藍新 HashKey / HashIV、TradeInfo 或 TradeSha。

## 一、目前已完成後端流程

### Request route

- `POST /api/product-orders/line-pay/request`
- 建立 `provider=line_pay` 的 pending payment。
- 呼叫 LINE Pay request API。
- 寫入 `transactionId` / `paymentUrl` metadata。
- 回傳 `paymentUrl` 給前端導頁。

### Confirm route

- `GET /api/product-orders/line-pay/confirm`
- 接收 `orderId` / `transactionId`。
- preflight payment 與 product order。
- 呼叫 confirm API。
- `1172` / `1198` / timeout 會查 status / payment details。
- outcome 判定安全後才 mark paid。
- 同步 `product_orders` 付款狀態。

### Cancel route

- `GET /api/product-orders/line-pay/cancel`
- 接收 `orderId` / `transactionId`。
- 寫入 cancel metadata。
- 不改 `payment.status`。
- 不改 `product_orders`。

## 二、正式測試前必要 env 檢查

請只確認 env 名稱與狀態，不要輸出任何真值。

- `NEXT_PUBLIC_ENABLE_LINE_PAY`
- `LINE_PAY_ENV`
- `LINE_PAY_CHANNEL_ID`
- `LINE_PAY_CHANNEL_SECRET`
- `LINE_PAY_CONFIRM_URL`
- `LINE_PAY_CANCEL_URL`

檢查規則：

- `LINE_PAY_ENV` 的 sandbox / production 不可混用。
- `LINE_PAY_CONFIRM_URL` 必須指向 `/api/product-orders/line-pay/confirm`。
- `LINE_PAY_CANCEL_URL` 必須指向 `/api/product-orders/line-pay/cancel`。
- 不可使用藍新 MPG `LINEPAY=1`。
- payment provider 必須是 `line_pay`。
- 不可輸出 Channel Secret。

## 三、Request Route Smoke Checklist

以下項目是測試清單，不代表本文件有執行測試。

- [ ] LINE Pay disabled 時回 `line_pay_disabled`。
- [ ] `productOrderId` 缺失時回 `missing_product_order_id`。
- [ ] 商品訂單不可付款時回 `product_order_not_payable`。
- [ ] 已付款訂單不可重複建立。
- [ ] 正常 pending 訂單會建立 `line_pay` payment。
- [ ] 成功 response 有 `paymentUrl.web` / `transactionId`。
- [ ] `transactionId` 是 string，不轉 number。
- [ ] response 不含 `channelSecret` / `channelId` / env 原始內容 / phone / email / address / TradeInfo / TradeSha。

## 四、Confirm Route Smoke Checklist

以下項目是測試清單，不代表本文件有執行測試。

- [ ] 缺 `orderId` 回 `missing_line_pay_order_id`。
- [ ] 缺 `transactionId` 回 `missing_line_pay_transaction_id`。
- [ ] 19 位 `transactionId` 保持 string。
- [ ] 找不到 payment 回 `line_pay_payment_not_found`。
- [ ] provider 不是 `line_pay` 要擋。
- [ ] amount / currency 不一致要擋。
- [ ] confirm `returnCode=0000` 且驗證一致才 mark paid。
- [ ] `1172` / `1198` / timeout 要查 status / payment details。
- [ ] mismatch / ambiguous 不可 mark paid。
- [ ] paid 後 `product_orders` 同步 paid。
- [ ] response 不含 secret / env 原始內容 / 個資 / TradeInfo / TradeSha。

## 五、Cancel Route Smoke Checklist

以下項目是測試清單，不代表本文件有執行測試。

- [ ] 無 `orderId` / `transactionId` 可安全接住。
- [ ] 有 `orderId` 時驗證格式。
- [ ] 有 `transactionId` 時保持 string。
- [ ] 找到 pending payment 時寫入 `linePay.cancel` metadata。
- [ ] 不改 `payment.status`。
- [ ] 不改 `product_orders`。
- [ ] 不 mark failed。
- [ ] 不 mark paid。

## 六、LINE Pay Sign-Off 對照項目

- [ ] `LINE Pay` 字樣格式正確，中間有空格。
- [ ] 付款成功流程可完成。
- [ ] 付款失敗要能顯示給消費者。
- [ ] 訂單編號重複要能處理。
- [ ] 超過 20 分鐘才 confirm 要能處理。
- [ ] `cancelUrl` 能正確跳回網站。
- [ ] 商品名稱在 LINE Pay 頁正常顯示。
- [ ] 商品圖示若有使用，尺寸與顯示需正常。
- [ ] 正式環境測試交易務必當天取消付款，避免實際出帳與手續費。
- [ ] Confirm API 遇 `1172` / `1198` 要先查交易狀態。
- [ ] 交易完成回傳速度需注意。
- [ ] 需要記錄 timeout 策略。
- [ ] 需要記錄 `orderId` 產生機制。
- [ ] 需要記錄系統架構：Web Service <=> Payment Server <=> LINE Pay。

## 七、下一步建議

- `22I-2`：商品 cart 前端 LINE Pay 按鈕 skeleton，只顯示 disabled / feature flag gate。
- `22I-3`：商品 cart LINE Pay 按鈕接 request route，拿 `paymentUrl` 後導頁。
- `22I-4`：confirm / cancel 後簡易結果頁或導回 cart 訊息。
- `22I-5`：sandbox 手動測試腳本文件。
- `22I-6`：production sign-off checklist 補齊。

## 文件安全規則

- 不放 LINE Pay Channel Secret。
- 不放 production env 真值。
- 不放真實交易資料。
- 不放測試卡號。
- 不放個資。
- 不放藍新 HashKey / HashIV。
- 不放 TradeInfo / TradeSha。
