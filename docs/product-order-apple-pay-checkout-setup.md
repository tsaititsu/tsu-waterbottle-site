# Product order Apple Pay checkout setup

## 一、目的

本文件記錄商品 cart 正式接入 NewebPay Apple Pay 的設定與安全邊界。

目前商品 cart 正式支援：

- NewebPay 信用卡付款
- NewebPay Apple Pay

兩者都使用正式商品金額，不使用 NT$1 測試模式。

## 二、NewebPay 參數

商品信用卡付款：

- provider: `newebpay`
- `CREDIT=1`
- `InstFlag=0`
- 不送 `APPLEPAY=1`

商品 Apple Pay 付款：

- provider: `newebpay`
- payment mode: `product_order_apple_pay`
- `APPLEPAY=1`
- `InstFlag=0`
- 不送 `CREDIT=1`

商品 Apple Pay 不送：

- `LINEPAY=1`
- `VACC=1`
- `WEBATM=1`
- `ANDROIDPAY=1`
- `SAMSUNGPAY=1`
- `CVS=1`
- `BARCODE=1`

## 三、正式商品金額

Apple Pay 使用正式商品金額。

需保持一致：

- cart total
- product order total
- product order item subtotal
- payment amount
- NewebPay `Amt`
- Notify `Amt`

不可覆寫為 NT$1，不可恢復 `/apple-pay-test` 公開測試頁，不可修改商品資料庫價格。

## 四、前端流程

cart 頁顯示：

- 信用卡付款
- Apple Pay 付款（iPhone / Safari）

Apple Pay 流程：

1. cart 建立正式 product order。
2. 前端以 `paymentMode=product_order_apple_pay` 呼叫 NewebPay create route。
3. 後端建立 `provider=newebpay` pending payment。
4. 前端送出 NewebPay Form Post。
5. 使用者在 NewebPay MPG 頁使用 Apple Pay 付款。

前端不解密 `TradeInfo`，不顯示 HashKey / HashIV，不顯示 TradeInfo / TradeSha。

## 五、後端流程

Apple Pay 商品付款只允許：

- `itemKey=spiritual_product_order`
- `source=product_order`
- `paymentMode=product_order_apple_pay`

不允許用於：

- booking
- course
- divination
- ai-chart
- manual test

payment metadata 只保留安全摘要，例如：

- `paymentMode=product_order_apple_pay`
- `paymentMethod=apple_pay`
- order id / order no / amount

不保留 customer phone / email / address，不保留 TradeInfo / TradeSha。

## 六、Notify paid sync

付款成功後仍以 Notify 為準：

- Notify 解密與驗章成功才 mark paid。
- Notify `Amt` 必須與本地 payment amount 一致。
- product order paid sync 由既有流程處理。
- `PayTime` 以台北時間解析後寫入 UTC `paid_at`。

ReturnURL / ClientBackURL 不代表付款成功。

## 七、物流與出貨

本包不接物流 API。

商品 paid 後仍需人工確認出貨：

- 檢查 payment paid。
- 檢查 product order sync paid。
- 人工確認收件資料。
- 人工安排出貨。

## 八、不啟用項目

本包不啟用：

- 藍新 LINE Pay `LINEPAY=1`
- ATM `VACC=1`
- Google Pay `ANDROIDPAY=1`
- Samsung Pay `SAMSUNGPAY=1`
- 課程 Apple Pay
- 紫微占卜 Apple Pay
- AI 命盤 Apple Pay
- 官方 LINE Pay `provider=line_pay`

## 九、測試重點

上線後低金額測試需確認：

- cart 顯示信用卡付款。
- cart 顯示 Apple Pay 付款。
- 信用卡 payload 有 `CREDIT=1`。
- Apple Pay payload 有 `APPLEPAY=1`。
- 兩者皆 `InstFlag=0`。
- Apple Pay 不送 `CREDIT=1`。
- 信用卡不送 `APPLEPAY=1`。
- 不送 LINEPAY / VACC / Google Pay / Samsung Pay。
- Notify paid sync product_orders。
- 商品出貨仍人工處理。

## 十、安全要求

- 不放 MerchantID 真值。
- 不放 HashKey / HashIV。
- 不放 TradeInfo / TradeSha。
- 不放信用卡資料。
- 不放個資。
- 不放 LINE Pay Channel Secret。
- 不把測試資料當正式營收。
