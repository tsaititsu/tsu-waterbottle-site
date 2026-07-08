# LINE Pay Production Sign-Off Checklist

本文件是 LINE Pay 官方金流正式上 production 前的 sign-off checklist。它只整理確認項目、key 使用規則、官方文件使用規則、正式測試風險與遮蔽回報格式；本文件本身不代表已執行 production 測試，也不包含任何 Channel Secret、production env 真值、真實交易資料、測試卡號、個資、藍新 HashKey / HashIV、TradeInfo 或 TradeSha。

## 一、正式環境前置條件

- [ ] Sandbox 流程已完整測過。
- [ ] Request / confirm / cancel route smoke checklist 已通過。
- [ ] Cart 前端 LINE Pay 流程已測過。
- [ ] `confirmUrl` 已確認指向 `/api/product-orders/line-pay/confirm`。
- [ ] `cancelUrl` 已確認指向 `/api/product-orders/line-pay/cancel`。
- [ ] LINE Pay 官方金流 provider 固定使用 `line_pay`。
- [ ] NewebPay 維持 `provider=newebpay`。
- [ ] 不使用藍新 MPG `LINEPAY=1`。

## 二、LINE Pay 串接 Key 使用規則

使用 LINE Pay 串接 key 前，必須先回報使用者確認。不得要求使用者把 Channel Secret 貼在聊天室。

Channel ID / Channel Secret 只能填在：

- Vercel Environment Variables。
- 或本機 `.env.local`。

Key 安全規則：

- 不得把 key 寫進 commit。
- 不得把 key 寫進文件。
- 不得讓 Codex / terminal / log 顯示 key 真值。
- 不得輸出 `LINE_PAY_CHANNEL_SECRET`。
- 不得輸出 production env 真值。
- `LINE_PAY_CHANNEL_SECRET` 不可加 `NEXT_PUBLIC`。

正式環境只列欄位名稱，不放真值：

- `NEXT_PUBLIC_ENABLE_LINE_PAY`
- `LINE_PAY_ENV`
- `LINE_PAY_CHANNEL_ID`
- `LINE_PAY_CHANNEL_SECRET`
- `LINE_PAY_CONFIRM_URL`
- `LINE_PAY_CANCEL_URL`

## 三、白皮書 / 官方文件使用規則

- 若後續需要使用 LINE Pay 白皮書，必須先告知使用者需要哪一份。
- 不得自行假設白皮書內容。
- 使用者提供 PDF 或官方連結後，才能納入開發規則。
- 白皮書內容不得放入 secret、production env、個資。
- 若白皮書與現有實作衝突，需先整理差異，不可直接大改。

## 四、LINE Pay Sign-Off 對照

依 Online Merchant Sign-off Flow 整理以下正式上線前檢查項目：

- [ ] `LINE Pay` 字樣格式正確，中間有空格。
- [ ] 付款成功流程可完成。
- [ ] 付款失敗可顯示給消費者。
- [ ] 訂單編號重複時可安全處理。
- [ ] 超過 20 分鐘才 confirm 時可安全處理。
- [ ] `cancelUrl` 正確跳回商家網站。
- [ ] 商品名稱在 LINE Pay 頁正常顯示。
- [ ] 商品圖示正常顯示，如有使用。
- [ ] 退款流程與操作權限已確認。
- [ ] 發票金額與付款金額一致。
- [ ] 使用 Coupon 時金額處理正確。
- [ ] 交易完成速度符合需求。
- [ ] API timeout 處理已確認。
- [ ] `orderId` 產生機制已記錄。
- [ ] Confirm API 遇 `1172` / `1198` 會查交易狀態。
- [ ] 系統架構描述已記錄：`Web Service <=> Payment Server <=> LINE Pay`。
- [ ] 連線 timeout 設定已確認。
- [ ] 對外 IP 設定已確認，如 LINE Pay 或營運審核需要。

## 五、正式測試風險提醒

- Production 測試會產生真實金流風險。
- 正式環境測試交易務必當天取消或退款。
- 未完成 sign-off 前不可開放一般使用者。
- 不可在 production 直接測未知流程。
- 不可用真實顧客個資做測試。
- 不可用未遮蔽 `transactionId` / `orderId` / `paymentId` 回報。

## 六、Production 測試回報格式

請使用遮蔽格式回報，不要貼完整交易識別碼或任何 secret。

```text
LINE Pay production 測試結果

1. 基本資訊
- 測試日期：
- 測試人員：
- commit hash：
- LINE_PAY_ENV：production

2. 測試項目
- 測試項目：
- 測試結果：通過 / 失敗

3. 交易識別
- transactionId：1234************0001
- orderId：LP_************_0001
- paymentId：pay_************_0001

4. 流程結果
- 是否 request 成功：
- 是否 confirm 成功：
- 是否 mark paid：
- 是否 product_order sync paid：
- 是否 cancelUrl 可回 cart：
- 是否退款 / 取消完成：

5. 備註
- 備註：
```

## 七、禁止事項

- 不要放 LINE Pay Channel Secret。
- 不要放 production env 真值。
- 不要放真實 `transactionId`。
- 不要放真實 `orderId`。
- 不要放真實 `paymentId`。
- 不要放個資。
- 不要放測試卡號。
- 不要放藍新 HashKey / HashIV。
- 不要放 TradeInfo / TradeSha。
- 不要啟用藍新 `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。
