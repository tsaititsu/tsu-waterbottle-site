# LINE Pay Key Use Confirmation Checklist

本文件整理「真的要開始使用 LINE Pay sandbox key 前」必須先確認的事項。它不放任何 key 真值，不要求使用者把 key 貼到聊天室，也不代表已經開始 sandbox 手動測試。

## 一、目前狀態

- LINE Pay 後端 request / confirm / cancel 流程已完成。
- Cart 前端 `LINE Pay` 按鈕與導頁流程已完成。
- Cart return message 已完成。
- Env 欄位已在 `.env.example` 存在。
- 尚未填入 sandbox key。
- 尚未進行 sandbox 手動測試。
- 尚未進行 production sign-off。
- 白皮書尚未正式套用。

## 二、使用 Key 前必須先通知使用者

- 接下來若要進 sandbox 手動測試，會需要 LINE Pay sandbox Channel ID / Channel Secret。
- 使用 key 前，助理必須先回報使用者。
- 不得直接假設 key 已存在。
- 不得要求使用者把 Channel Secret 貼到聊天室。
- 使用者應自行填入：
  - Vercel Environment Variables。
  - 或本機 `.env.local`。
- Codex / terminal / log / docs / commit 都不得顯示 secret 真值。
- `LINE_PAY_CHANNEL_SECRET` 不可加 `NEXT_PUBLIC`。

## 三、需要使用者自行填入的欄位

只列欄位名稱，不放真值：

- `NEXT_PUBLIC_ENABLE_LINE_PAY`
- `LINE_PAY_ENV`
- `LINE_PAY_CHANNEL_ID`
- `LINE_PAY_CHANNEL_SECRET`
- `LINE_PAY_CONFIRM_URL`
- `LINE_PAY_CANCEL_URL`

Sandbox 建議：

- `NEXT_PUBLIC_ENABLE_LINE_PAY=true`
- `LINE_PAY_ENV=sandbox`
- `LINE_PAY_CONFIRM_URL` 指向 `/api/product-orders/line-pay/confirm`
- `LINE_PAY_CANCEL_URL` 指向 `/api/product-orders/line-pay/cancel`
- Channel ID / Secret 必須是 sandbox，不可混 production。
- 不可使用藍新 MPG `LINEPAY=1`。

## 四、使用者填 Key 後的回報方式

使用者不用貼 key。只需要回報：

- Sandbox key 已填入：是 / 否
- 填入位置：Vercel / `.env.local`
- `LINE_PAY_ENV` 是否為 sandbox：是 / 否
- `LINE_PAY_CONFIRM_URL` 是否已填：是 / 否
- `LINE_PAY_CANCEL_URL` 是否已填：是 / 否

禁止回報：

- Channel Secret 真值。
- Channel ID 真值也盡量不要完整貼出。
- Production env 真值。
- `transactionId` / `orderId` / `paymentId` 未遮蔽真值。
- 個資。

## 五、白皮書使用規則

- 使用者已提醒：白皮書要使用前必須先告知。
- 若下一步要套用白皮書，必須先請使用者提供 PDF 或官方連結。
- 不得自行假設白皮書內容。
- 不得用不明來源文件覆蓋官方文件。
- 若白皮書與目前實作不同，先做差異盤點，不直接改程式。
- 白皮書不可放 secret / env 真值 / 個資 / 真實交易資料。

## 六、進入 Sandbox 手測前最後確認

- [ ] Env 欄位存在。
- [ ] Sandbox key 已由使用者自行填好。
- [ ] 不曾在聊天室出現 Channel Secret。
- [ ] 不曾在 commit / docs / test 出現 key 真值。
- [ ] `LINE_PAY_CONFIRM_URL` 指向 confirm route。
- [ ] `LINE_PAY_CANCEL_URL` 指向 cancel route。
- [ ] Provider 是 `line_pay`。
- [ ] NewebPay 維持 `provider=newebpay`。
- [ ] 不使用藍新 MPG `LINEPAY=1`。
- [ ] `LINE Pay` 字樣格式正確。
- [ ] `orderId` 產生機制已文件化。
- [ ] Confirm `1172` / `1198` / timeout 處理已文件化。
- [ ] Cart return message 已完成。
- [ ] `cancelUrl` 導回 cart 已完成。

## 七、下一步建議

- `22K-1`：sandbox key 已由使用者自行填入後，做本機 / 測試環境 smoke test，不輸出 key。
- `22K-2`：sandbox 成功付款測試。
- `22K-3`：sandbox 取消付款測試。
- `22K-4`：sandbox confirm 例外 / timeout 測試規劃。
- `22K-5`：sandbox 測試結果修正。
- `22L`：production sign-off 前最後確認。

## 八、禁止事項

- 不要讀 `.env.local`。
- 不要讀 production env。
- 不要輸出 `LINE_PAY_CHANNEL_SECRET`。
- 不要把 key 寫進文件。
- 不要把 key 寫進 commit。
- 不要把 key 寫進測試檔。
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
