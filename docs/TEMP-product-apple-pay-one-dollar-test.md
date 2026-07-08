# TEMP 商品 Apple Pay 1 元正式測試

本文件記錄第 22J-29 小包的臨時測試狀態。

這是臨時測試包，不是正式價格調整。測試完成後，下一包必須 revert 回正式商品價格與正式 cart 流程。

## 目前測試狀態

- 商品前台暫時顯示 NT$1。
- cart 商品單價 / 小計 / 總金額暫時顯示 NT$1。
- product_order 建立時暫時以 NT$1 建立。
- NewebPay Apple Pay 付款暫時以 NT$1 建立。
- 測試入口：`/apple-pay-test`
- 商品入口：`/spiritual-products`
- cart 入口：`/cart`

## 測試方式

1. 打開 `/apple-pay-test`。
2. 前往開運商品。
3. 只加入 1 件商品。
4. 前往購物車。
5. 確認 cart 只有 1 件商品。
6. 點「Apple Pay 付款（測試 NT$1）」。
7. Form Post 到 NewebPay MPG。
8. 確認 NewebPay 顯示 Apple Pay。
9. 實刷 NT$1。
10. 等待 Notify paid sync product_orders。

## 付款參數

Apple Pay 1 元商品測試只允許：

- provider: `newebpay`
- paymentMode: `product_order_apple_pay_test`
- `APPLEPAY=1`
- `InstFlag=0`
- `Amt=1`

不得啟用：

- `CREDIT=1`
- `LINEPAY=1`
- `VACC=1`
- `ANDROIDPAY=1`
- `SAMSUNGPAY=1`
- `WEBATM=1`
- `CVS=1`
- `BARCODE=1`
- provider `line_pay`

## 測試資料標記

product_order item snapshot 與 payment raw payload 會標記：

- `test_payment=true`
- `product_apple_pay_one_dollar_test=true`
- `original_price`
- `original_total_amount`
- `test_price=1`

## 測完必做

1. Revert 這包臨時測試程式。
2. 確認商品頁不再顯示 NT$1。
3. 確認 cart 不再顯示 NT$1。
4. 確認 `/apple-pay-test` 是否需要移除。
5. 確認沒有一般客人用 NT$1 下單。
6. 測試交易若需要退款 / 取消交易，需到藍新後台處理。
7. 測試訂單不可當作正式營收。

## 禁止事項

- 不要改課程價格。
- 不要改紫微占卜價格。
- 不要改 AI 命盤價格。
- 不要用 SQL 改商品資料庫價格。
- 不要永久修改正式商品資料。
- 不要啟用 `LINEPAY=1`。
- 不要啟用 `VACC=1`。
- 不要啟用 Google Pay。
- 不要啟用 Samsung Pay。
- 不要使用 provider `line_pay`。
- 不要把 MerchantID / HashKey / HashIV 寫進文件。
- 不要把 TradeInfo / TradeSha 寫進文件。
