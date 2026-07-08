# LINE Pay Sandbox Readiness Dry Run

本文件整理「正式填入 LINE Pay sandbox key 之前」的最後一次 dry-run 檢查。它只檢查流程、缺口與安全規則，不使用 key、不呼叫 LINE Pay API、不測付款，也不包含任何 Channel Secret、production env 真值、sandbox env 真值、真實交易資料、測試卡號、個資、藍新 HashKey / HashIV、TradeInfo 或 TradeSha。

## 一、目前狀態判斷

- `.env.example` 已有 LINE Pay 必要欄位。
- 尚未填入 sandbox key。
- 使用 key 前必須先詢問使用者。
- 不得要求使用者把 Channel Secret 貼到聊天室。
- 尚未做 sandbox 手動測試。
- 尚未做 production sign-off。
- 尚未套用白皮書額外規則。

## 二、Sandbox 前必要條件

進入 sandbox 手動測試前，需要逐項確認：

- [ ] `NEXT_PUBLIC_ENABLE_LINE_PAY` 可在測試環境設為 `true`。
- [ ] `LINE_PAY_ENV` 必須是 `sandbox`。
- [ ] `LINE_PAY_CHANNEL_ID` 必須使用 sandbox 資料。
- [ ] `LINE_PAY_CHANNEL_SECRET` 必須使用 sandbox 資料。
- [ ] `LINE_PAY_CONFIRM_URL` 指向 `/api/product-orders/line-pay/confirm`。
- [ ] `LINE_PAY_CANCEL_URL` 指向 `/api/product-orders/line-pay/cancel`。
- [ ] Payment provider 必須是 `line_pay`。
- [ ] NewebPay provider 必須維持 `newebpay`。
- [ ] 不可啟用藍新 MPG `LINEPAY=1`。

## 三、後端流程 Dry-Run 檢查

以下只列檢查項目，本文件不執行 route、不呼叫 API、不更新 DB。

### Request Route

- [ ] `productOrderId` 必填。
- [ ] Product order 必須可付款。
- [ ] 會建立 `provider=line_pay` 的 pending payment。
- [ ] 會呼叫 LINE Pay request API。
- [ ] 會寫入 `transactionId` / `paymentUrl` metadata。
- [ ] 會回 `paymentUrl.web` 給前端。
- [ ] Response 不應包含 Channel Secret、env 原始內容、個資、TradeInfo 或 TradeSha。

### Confirm Route

- [ ] 接 `orderId` / `transactionId`。
- [ ] 會讀 pending `line_pay` payment。
- [ ] 會讀 product order。
- [ ] 會呼叫 confirm API。
- [ ] `1172` / `1198` / timeout 會查 status / details。
- [ ] Outcome 安全才 mark paid。
- [ ] Sync `product_orders`。
- [ ] 導回 `/cart?linePay=success` / `/cart?linePay=pending` / `/cart?linePay=error`。
- [ ] 不應把 `transactionId`、`orderId` 或 `paymentId` 放到 cart query。

### Cancel Route

- [ ] 接 `orderId` / `transactionId`。
- [ ] 寫 `linePay.cancel` metadata。
- [ ] 不改 `payment.status`。
- [ ] 不改 `product_orders`。
- [ ] 導回 `/cart?linePay=canceled` / `/cart?linePay=error`。
- [ ] 不 mark paid。
- [ ] 不 mark failed。

## 四、前端流程 Dry-Run 檢查

- [ ] `LINE Pay` 字樣格式正確，中間有空格。
- [ ] Feature flag off 時不顯示或不啟用按鈕。
- [ ] Feature flag on 時顯示 `LINE Pay` 按鈕。
- [ ] 點擊後建立 product order。
- [ ] Request route 成功後只使用 `paymentUrl.web` 導頁。
- [ ] Loading 狀態防止重複送出。
- [ ] 失敗時顯示友善錯誤，不顯示原始錯誤物件。
- [ ] 回 cart query 顯示 `success` / `canceled` / `pending` / `failed` / `error`。
- [ ] 不顯示 `transactionId` / `orderId` / `paymentId`。
- [ ] 不顯示 secret / env 原始內容 / 個資。
- [ ] 不呼叫 NewebPay。
- [ ] 不使用藍新 MPG `LINEPAY=1`。

## 五、Sign-Off 前風險檢查

以下整理自既有 route smoke checklist、sandbox manual test plan 與 production sign-off checklist：

- [ ] `LINE Pay` 字樣格式正確。
- [ ] 付款成功流程可完成。
- [ ] 付款失敗可顯示給消費者。
- [ ] 訂單編號重複時可安全處理。
- [ ] 超過 20 分鐘才 confirm 時可安全處理。
- [ ] `cancelUrl` 正確跳回網站。
- [ ] 商品名稱在 LINE Pay 頁正常顯示。
- [ ] 商品圖示正常顯示，如有使用。
- [ ] Confirm API 遇 `1172` / `1198` 會查交易狀態。
- [ ] Timeout 策略已記錄。
- [ ] `orderId` 產生機制已記錄。
- [ ] 系統架構已記錄：`Web Service <=> Payment Server <=> LINE Pay`。
- [ ] 對外 IP / 白名單設定已確認。
- [ ] 退款流程與權限已確認，production 前不得跳過。
- [ ] 發票、付款金額與 coupon 規則已確認，production 前不得跳過。

## 六、白皮書狀態

- 使用者已提醒：後續若要用白皮書，必須先告知。
- 目前尚未指定要套用哪份白皮書。
- 未取得或未確認白皮書前，不可自行假設內容。
- 若白皮書與目前流程不同，下一包要先做差異盤點，不可直接改程式。

## 七、是否可以進入 Sandbox Key 填寫

目前可以進入「請使用者自行填入 sandbox key」前的準備階段，但還不能自動要求 key。

下一步必須先由助理回報使用者：

```text
接下來若要做 sandbox 手動測試，需要你到 Vercel 或 .env.local 自行填 LINE Pay sandbox Channel ID / Channel Secret，不要貼在聊天室。
```

在使用者確認要進入 sandbox 測試前，不應讀取 `.env.local`，不應讀取 production env，不應呼叫 LINE Pay API，也不應執行付款流程。

## 八、禁止事項

- 不要讀 `.env.local`。
- 不要讀 production env。
- 不要輸出 Channel Secret。
- 不要把 key 寫進文件。
- 不要把 key 寫進 commit。
- 不要把 key 貼到聊天室。
- 不要呼叫 LINE Pay API。
- 不要手動測試付款。
- 不要 mark paid。
- 不要更新 DB。
- 不要啟用藍新 `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。

## 文件安全要求

- 不放 Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放真實 `transactionId`。
- 不放真實 `orderId`。
- 不放真實 `paymentId`。
- 不放個資。
- 不放測試卡號。
- 不放藍新 HashKey / HashIV。
- 不放 TradeInfo / TradeSha。
