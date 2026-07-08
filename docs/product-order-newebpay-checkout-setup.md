# Product order NewebPay checkout setup

## 一、目前狀態

商品 cart 已正式接入 NewebPay checkout 前端入口。

目前商品 cart 支援：

- NewebPay 信用卡一次付清
- NewebPay Apple Pay

本流程使用正式商品金額，不使用 NT$1 測試模式，不恢復 `/apple-pay-test` 公開測試頁。

## 二、付款方式

商品 cart NewebPay 信用卡付款固定使用：

- provider: `newebpay`
- NewebPay MPG: `CREDIT=1`
- `InstFlag=0`
- item key: `spiritual_product_order`
- source: `product_order`

商品 cart NewebPay Apple Pay 固定使用：

- provider: `newebpay`
- NewebPay MPG: `APPLEPAY=1`
- `InstFlag=0`
- item key: `spiritual_product_order`
- source: `product_order`
- payment mode: `product_order_apple_pay`

商品 cart 不啟用：

- NewebPay MPG `LINEPAY=1`
- NewebPay MPG `VACC=1`
- NewebPay MPG `WEBATM=1`
- Google Pay `ANDROIDPAY=1`
- Samsung Pay `SAMSUNGPAY=1`
- 超商代碼 `CVS=1`
- 條碼繳費 `BARCODE=1`
- 官方 LINE Pay `provider=line_pay`

## 三、金額一致性

商品 NewebPay 付款必須使用正式商品金額。

以下金額需一致：

- cart total
- `product_orders.total_amount_twd`
- `product_order_items` 小計
- `payments.amount_twd`
- NewebPay `Amt`
- Notify 回來的 `Amt`

不可出現商品訂單為正式金額但 NewebPay `Amt=1`，也不可用 SQL 或程式覆寫正式商品價格。

## 四、前端流程

cart 頁顯示兩個 NewebPay 按鈕：

- 信用卡付款
- Apple Pay 付款（iPhone / Safari）

流程：

1. 使用者填寫郵局寄送資料。
2. 使用者勾選開運商品購買須知與退換貨政策。
3. 點擊「信用卡付款」或「Apple Pay 付款」。
4. 前端呼叫 `POST /api/product-orders/create` 建立正式商品訂單。
5. 前端呼叫 `POST /api/payments/newebpay/create` 建立 NewebPay pending payment。
6. 前端收到 NewebPay Form 欄位後送出 Form Post。
7. 使用者被導向 NewebPay MPG 付款頁。

前端不直接解密或解析 `TradeInfo`，也不接收 HashKey / HashIV。

## 五、後端流程

商品 NewebPay checkout 沿用既有後端：

- `POST /api/product-orders/create`
- `POST /api/payments/newebpay/create`
- `src/lib/payments/productOrderPayment.ts`
- `src/lib/newebpay/paymentForm.ts`
- `src/lib/supabase/productOrders.ts`

NewebPay create route 會：

- 驗證 product order 是否可付款。
- 依 payment mode 產生信用卡或 Apple Pay MPG payload。
- 建立 `provider=newebpay` pending payment。
- 將 `product_orders.payment_id` 連到該 payment。
- 產生 NewebPay MPG Form Post 欄位。

Apple Pay 商品付款 metadata 會保留安全欄位，例如 `paymentMode=product_order_apple_pay` 與 `paymentMethod=apple_pay`。

## 六、Notify paid sync

付款完成後仍以 NewebPay Notify 為準：

- `NotifyURL` 回到 `/api/payments/newebpay/notify`
- Notify 解密與驗章成功後才可 mark paid
- product order paid sync 由既有流程處理
- ReturnURL / ClientBackURL 不可單獨視為付款成功
- `PayTime` 會以台北時間解析後寫入 UTC `paid_at`

## 七、物流與出貨

本包不接物流 API。

目前商品出貨仍為人工處理：

- 使用者填寫郵局寄送資料。
- payment paid 後，後台或人工流程確認訂單。
- 商品出貨仍需人工確認。
- 物流串接留到第二階段。

## 八、不影響範圍

本入口不影響：

- 既有郵局匯款流程。
- 課程 NewebPay 分期 `InstFlag=3,6`。
- 紫微占卜 NT$50 信用卡付款。
- AI Chart 付款 feature flag。
- 官方 LINE Pay 保存流程。
- 內部 Apple Pay / 1 元測試基礎。

## 九、上線前檢查

正式開放前仍需確認：

- 商品 cart 可建立 product order。
- NewebPay Form Post 正常送出。
- 信用卡付款頁顯示信用卡一次付清。
- Apple Pay 付款頁顯示 Apple Pay。
- 商品交易 `InstFlag=0`。
- 商品交易不顯示課程分期。
- 商品交易不顯示 LINE Pay。
- 商品交易不顯示 ATM / WebATM。
- 商品交易不顯示 Google Pay / Samsung Pay。
- Notify paid 後 payment 變 paid。
- Notify paid 後 `product_orders.payment_status` sync paid。
- 出貨前有人工確認 SOP。

## 十、禁止事項

- 不要送 `LINEPAY=1`。
- 不要送 `VACC=1`。
- 不要送 `WEBATM=1`。
- 不要送 `ANDROIDPAY=1`。
- 不要送 `SAMSUNGPAY=1`。
- 不要讓商品出現 `InstFlag=3,6`。
- 不要使用 `provider=line_pay`。
- 不要把官方 LINE Pay flow 混入 NewebPay。
- 不要把 ReturnURL 當成付款成功。
- 不要在未收到 Notify paid 前出貨。
- 不要輸出 MerchantID / HashKey / HashIV 真值。
- 不要輸出 TradeInfo / TradeSha。

## 十一、下一步建議

- 商品 cart NewebPay 正式低金額測試。
- 商品 Notify paid sync 實測。
- 商品匯款 / 信用卡 / Apple Pay 並行 SOP。
- 商品出貨人工流程文件。
- 第二階段再評估物流 API。
