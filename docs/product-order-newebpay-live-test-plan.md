# Product Order NewebPay Live Test Plan

本文件整理商品 cart NewebPay 信用卡正式低金額測試指引。  
本輪只新增測試指引文件，不改程式邏輯、不呼叫藍新 API、不刷卡、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

## 一、測試目的

本測試用來確認商品 cart 的正式 NewebPay 信用卡付款鏈路：

- cart 建立 `product_order`
- `product_order` 建立 `provider=newebpay` pending payment
- 前端送出 NewebPay MPG Form Post
- 使用者完成 NewebPay 信用卡付款
- Notify paid 後更新 payment 狀態
- Notify paid 後同步 `product_orders.payment_status=paid`

商品 cart NewebPay 正式低金額測試需確認：

- 商品只走 `CREDIT=1`
- 商品 `InstFlag=0`
- 不送 `LINEPAY=1`
- 不送 `VACC=1`
- 不送 Apple Pay / Google Pay / Samsung Pay 參數
- ReturnURL / ClientBackURL 不單獨視為付款成功
- 出貨仍需人工確認

本文件只是測試指引，本輪不實刷。

## 二、測試前條件

測試前需逐項確認：

- NewebPay 正式環境資料已填在正確位置。
- 不在文件中顯示 MerchantID / HashKey / HashIV 真值。
- cart 有測試商品。
- 商品金額可用低金額測試；若正式商品無低金額，需先決定測試商品策略。
- `POST /api/product-orders/create` 已可用。
- `POST /api/payments/newebpay/create` 已可用。
- NotifyURL 已設定。
- ReturnURL / ClientBackURL 已設定。
- cart 前端「信用卡付款」會先建立 `product_order`。
- NewebPay create API 會建立 `provider=newebpay` pending payment。
- 商品 NewebPay 交易固定 `CREDIT=1`。
- 商品 NewebPay 交易固定 `InstFlag=0`。
- 不送 `LINEPAY=1`。
- 不送 `VACC=1`。
- 不送 `APPLEPAY=1` / `ANDROIDPAY=1` / `SAMSUNGPAY=1`。
- 物流 API 尚未接，出貨仍人工處理。
- 官方 LINE Pay 保存暫停。
- 藍新 LINE Pay 未啟用。

## 三、正式測試流程

以下只列測試步驟，本文件不執行實測：

1. 打開 cart。
2. 加入測試商品。
3. 填寫必要收件 / 聯絡資料。
4. 點信用卡付款。
5. 確認建立 `product_order`。
6. 確認建立 `provider=newebpay` pending payment。
7. 確認前端 Form Post 到 NewebPay MPG。
8. 確認 NewebPay 付款頁只顯示信用卡一次付清。
9. 確認不顯示課程分期。
10. 確認不顯示 LINE Pay。
11. 確認不顯示 ATM。
12. 確認不顯示 Apple Pay / Google Pay / Samsung Pay。
13. 完成低金額正式刷卡。
14. 等待 NotifyURL。
15. 確認 payment 狀態變 `paid`。
16. 確認 `product_orders.payment_status` sync `paid`。
17. 確認 ReturnURL 顯示付款結果且不讓使用者誤以為 ReturnURL 單獨代表付款完成。
18. 確認商品仍需人工出貨。
19. 確認 fallback QueryTradeInfo 可查詢。

## 四、失敗測試流程

以下只列應觀察項目，本文件不執行實測：

- 使用者取消付款時，不應 mark paid。
- 付款失敗時，不應 mark paid。
- NotifyURL 未到時，不應只因 ReturnURL 有到就 mark paid。
- ReturnURL 有到但 Notify 未到時，需以 pending / 查詢狀態處理。
- QueryTradeInfo fallback 可作為人工或系統補查依據。
- `product_order` 已 paid 時不可重複 paid。
- 假 paid 不可混入正式資料。
- 未付款不可出貨。
- NewebPay 表單送出失敗時，前端需顯示友善錯誤。
- 建立 `product_order` 成功但付款建立失敗時，需人工確認是否有 pending 訂單需要處理。

## 五、測試後回報格式

正式低金額測試後，請用以下格式回報。所有交易編號需遮蔽中段：

| 欄位 | 回報內容 |
| --- | --- |
| 測試日期 |  |
| commit hash |  |
| 測試環境 | production |
| 測試商品 |  |
| 測試金額 |  |
| productOrderId | 遮蔽中段 |
| paymentId | 遮蔽中段 |
| MerchantOrderNo | 遮蔽中段 |
| TradeNo | 遮蔽中段 |
| 是否成功進藍新付款頁 | 是 / 否 |
| 是否只顯示信用卡一次付清 | 是 / 否 |
| 是否沒有分期 | 是 / 否 |
| 是否沒有 LINE Pay | 是 / 否 |
| 是否沒有 ATM | 是 / 否 |
| 是否沒有 Apple Pay / Google Pay / Samsung Pay | 是 / 否 |
| Notify 是否成功 | 是 / 否 |
| payment 是否 paid | 是 / 否 |
| product_orders 是否 paid | 是 / 否 |
| ReturnURL 體驗是否正常 | 是 / 否 |
| 是否需要退款 / 取消交易 | 是 / 否 |
| 備註 |  |

## 六、安全要求

- 不放 MerchantID 真值。
- 不放 HashKey / HashIV。
- 不放 LINE Pay key。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放完整 TradeNo。
- 不放完整 MerchantOrderNo。
- 不放完整 paymentId。
- 不放完整 productOrderId。
- 不放個資。
- 不放信用卡資料。
- 不放 TradeInfo / TradeSha。
- 不放測試卡號。
- 不放 NewebPay Form Post 完整原始資料。
- 不把 ReturnURL query 或 Notify payload 原文貼到文件或聊天室。

## 七、正式測試後處理

- 若測試成功，下一包才做商品 cart 正式入口開啟檢查。
- 若測試失敗，先整理錯誤碼、發生位置與流程，不要直接重複刷卡。
- 若需要退款，依藍新後台退款 / 取消交易 SOP 處理。
- 測試訂單需標記測試用途。
- 出貨不可自動進行，仍需人工確認。
- 若 Notify 未到但付款頁顯示成功，先查 QueryTradeInfo，不要手動改 paid。
- 若 payment 已 paid 但 `product_orders` 未 sync，先保留交易證據並另開修正包。

## 八、下一步建議

- 22J-27：商品 cart 正式測試結果回報表。
- 22J-28：商品 cart 正式入口開啟檢查。
- 22J-29：商品匯款與 `product_order` 綁定穩定性檢查。
- 22J-30：商品出貨人工 SOP。
