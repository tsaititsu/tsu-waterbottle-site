# LINE Pay Sandbox Manual Test Plan

本文件是之後手動測試 LINE Pay sandbox 時的操作計畫。它只整理測試步驟、檢查點與回報格式；本文件本身不代表已執行測試，也不包含任何 LINE Pay Channel Secret、production env 真值、真實交易資料、測試卡號、個資、藍新 HashKey / HashIV、TradeInfo 或 TradeSha。

## 一、測試目的

本文件用於 sandbox 手動測試商品訂單 LINE Pay 官方金流流程：

```text
cart
→ product order
→ LINE Pay request
→ paymentUrl
→ confirmUrl / cancelUrl
→ cart message
```

測試目標是確認商品購物車可以建立正式商品訂單、建立 `provider=line_pay` 的 pending payment、導向 LINE Pay sandbox 付款頁，並在 confirm / cancel 後回到 `/cart?linePay=...` 顯示友善訊息。

## 二、測試前禁止事項

- 不要使用 production Channel Secret。
- 不要把 LINE Pay Channel Secret 寫進文件。
- 不要使用正式環境測試交易。
- 不要真刷。
- 不要 push。
- 不要 deploy。
- 不要執行 SQL。
- 不要把藍新 MPG `LINEPAY=1` 打開。
- 不要修改 NewebPay 既有流程。
- 不要把 `transactionId` / `orderId` / `paymentId` 放到公開頁面 query。
- 不要把個資、電話、email、地址寫進文件。

## 三、Sandbox Env 檢查清單

只確認欄位名稱與環境方向，不要輸出真值。

- `NEXT_PUBLIC_ENABLE_LINE_PAY=true`
- `LINE_PAY_ENV=sandbox`
- `LINE_PAY_CHANNEL_ID`
- `LINE_PAY_CHANNEL_SECRET`
- `LINE_PAY_CONFIRM_URL`
- `LINE_PAY_CANCEL_URL`
- `LINE_PAY_TRANSPORT=gateway`
- `LINE_PAY_SANDBOX_E2E_ENABLED=true`（只限指定分支 Preview；測試後關閉）

確認項目：

- `LINE_PAY_CONFIRM_URL` 指向 `/api/product-orders/line-pay/confirm`。
- `LINE_PAY_CANCEL_URL` 指向 `/api/product-orders/line-pay/cancel`。
- payment provider 使用 `line_pay`。
- NewebPay 仍是 `newebpay`。
- 不使用藍新 MPG `LINEPAY=1`。

### Preview-only NT$1 E2E 邊界

- 啟動入口固定為 `POST /api/internal/line-pay/sandbox-e2e/start`，且需管理員登入。
- request body 只接受固定確認字串；金額與商品固定在 server 為 NT$1，不能由呼叫端改寫。
- confirm／cancel 使用 `/api/internal/line-pay/sandbox-e2e/confirm` 與 `/api/internal/line-pay/sandbox-e2e/cancel`。
- 三個入口都同時要求 Vercel Preview、Sandbox、Gateway、Runtime flag、E2E flag 與完整 Preview commit SHA；Production 一律回 404。
- 相同 exact-head Preview 會產生相同 database identity，避免重複操作建立第二筆付款請求。
- 回應只提供 Sandbox payment URL，不回傳 payment、order、attempt 或 transaction 識別碼。

## 四、測試流程 A：成功付款流程

以下只列手動測試步驟，本文件不執行實測。

1. 啟動本機或測試環境。
2. 確認 cart 有開運商品。
3. 填寫必要顧客資料與寄送資料。
4. 點 `LINE Pay` 按鈕。
5. 預期建立 `product_order`。
6. 預期建立 `provider=line_pay` 的 pending payment。
7. 預期 request route 回 `paymentUrl.web`。
8. 瀏覽器導向 LINE Pay sandbox 付款頁。
9. 完成 sandbox 付款認證。
10. LINE Pay 導回 `confirmUrl`。
11. confirm route 呼叫 confirm API。
12. confirm outcome 安全時 mark payment paid。
13. `product_orders.payment_status` sync paid。
14. 最後導回 `/cart?linePay=success`。
15. cart 顯示成功提示。

## 五、測試流程 B：使用者取消付款

以下只列手動測試步驟，本文件不執行實測。

1. 點 `LINE Pay` 按鈕。
2. 導到 LINE Pay sandbox 付款頁。
3. 使用者按取消。
4. LINE Pay 導回 `cancelUrl`。
5. cancel route 寫入 `linePay.cancel` metadata。
6. 不改 `payment.status`。
7. 不改 `product_orders`。
8. 最後導回 `/cart?linePay=canceled`。
9. cart 顯示取消提示。

## 六、測試流程 C：Confirm 例外 / Timeout

以下只列測試觀念，不在本文件中模擬。

- Confirm API `1172`。
- Confirm API `1198`。
- Confirm API timeout。
- 預期不直接 mark paid。
- 預期查 request status。
- 預期查 payment details。
- 只有交易資料、金額、幣別、`orderId`、`transactionId` 都一致才可 mark paid。
- mismatch / ambiguous 一律不可 mark paid。

## 七、測試流程 D：重複與防呆

手動測試時要檢查：

- `productOrder` 已 paid 不可重複付款。
- payment 已 paid 不可重複 mark。
- `orderId` 不一致要擋。
- `transactionId` 不一致要擋。
- amount 不一致要擋。
- currency 不是 `TWD` 要擋。
- provider 不是 `line_pay` 要擋。
- disabled flag 時不可付款。

## 八、LINE Pay Sign-Off 對照

- [ ] `LINE Pay` 字樣格式正確，中間有空格。
- [ ] `cancelUrl` 可正確跳回網站。
- [ ] 商品名稱在 LINE Pay 頁正常顯示。
- [ ] 若有商品圖，圖示顯示正常。
- [ ] 訂單編號重複要能處理。
- [ ] 超過 20 分鐘才 confirm 要能處理。
- [ ] Confirm API 遇 `1172` / `1198` 要查交易狀態。
- [ ] 交易完成速度需注意。
- [ ] 需記錄 timeout 策略。
- [ ] 需記錄 `orderId` 產生機制。
- [ ] 需記錄系統架構：`Web Service <=> Payment Server <=> LINE Pay`。

## 九、測試後要回報的格式

請使用遮蔽格式回報，不要貼完整交易識別碼或任何 secret。

```text
LINE Pay sandbox 手動測試結果

1. 基本資訊
- 測試日期：
- 測試環境：sandbox / production
- commit hash：

2. 測試項目
- 項目：
- 結果：通過 / 失敗
- 失敗錯誤碼：

3. 交易識別
- 是否有 transactionId：
- transactionId 遮蔽值：1234************0001
- 是否有 orderId：
- orderId 遮蔽值：LP_************_0001
- 是否有 paymentId：
- paymentId 遮蔽值：pay_************_0001

4. 資料狀態
- 是否有更新 DB：
- 是否有 mark paid：
- 是否有回 cart message：

5. 備註
- 備註：
```

## 十、正式環境前提醒

- production 測試會產生真實金流風險。
- 正式環境測試交易要當天取消 / 退款，避免實際出帳與手續費。
- production 測試前要先完成 sign-off checklist。
- 不可在未確認前開放給一般使用者。

## 文件安全要求

- 不放 Channel Secret。
- 不放 production env 真值。
- 不放真實 `transactionId`。
- 不放真實 `orderId`。
- 不放真實 `paymentId`。
- 不放個資。
- 不放測試卡號。
- 不放藍新 HashKey / HashIV。
- 不放 TradeInfo / TradeSha。
