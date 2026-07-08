# Product order NewebPay checkout setup

## 一、目前狀態

商品 cart 已補上 NewebPay 信用卡 checkout 前端入口。

本入口用途：

- 商品 cart 建立 `product_order`
- 建立 `provider=newebpay` pending payment
- 前端送出 NewebPay MPG Form Post
- 使用者前往藍新金流信用卡付款頁
- 付款完成後由既有 Notify paid sync 更新 `product_orders`

本文件只記錄商品 NewebPay 信用卡一次付清入口，不代表已做正式刷卡測試。

## 二、付款方式

商品 cart NewebPay checkout 固定使用：

- provider: `newebpay`
- NewebPay MPG: `CREDIT=1`
- `InstFlag=0`
- item key: `spiritual_product_order`
- source: `product_order`

商品 cart 不啟用：

- NewebPay MPG `LINEPAY=1`
- NewebPay MPG `VACC=1`
- NewebPay MPG `WEBATM=1`
- Apple Pay `APPLEPAY=1`
- Google Pay `ANDROIDPAY=1`
- Samsung Pay `SAMSUNGPAY=1`
- 官方 LINE Pay `provider=line_pay`

## 三、前端流程

cart 頁新增「信用卡付款」按鈕。

流程：

1. 使用者填寫郵局寄送資料。
2. 使用者勾選開運商品購買須知與退換貨政策。
3. 點擊「信用卡付款」。
4. 前端呼叫 `POST /api/product-orders/create` 建立商品訂單。
5. 前端呼叫 `POST /api/payments/newebpay/create` 建立 NewebPay pending payment。
6. 前端收到 NewebPay Form 欄位後送出 Form Post。
7. 使用者被導向 NewebPay MPG 付款頁。

前端不直接解密或解析 `TradeInfo`，也不接收 HashKey / HashIV。

## 四、後端流程

商品 NewebPay checkout 沿用既有後端：

- `POST /api/product-orders/create`
- `POST /api/payments/newebpay/create`
- `src/lib/payments/productOrderPayment.ts`
- `src/lib/newebpay/paymentForm.ts`
- `src/lib/supabase/productOrders.ts`

NewebPay create route 會：

- 驗證 product order 是否可付款。
- 建立 `provider=newebpay` pending payment。
- 將 `product_orders.payment_id` 連到該 payment。
- 產生 NewebPay MPG Form Post 欄位。

## 五、Notify paid sync

付款完成後仍以 NewebPay Notify 為準：

- `NotifyURL` 回到 `/api/payments/newebpay/notify`
- Notify 解密與驗章成功後才可 mark paid
- product order paid sync 由既有流程處理
- ReturnURL / ClientBackURL 不可單獨視為付款成功

## 六、物流與出貨

本包不接物流 API。

目前商品出貨仍為人工處理：

- 使用者填寫郵局寄送資料。
- payment paid 後，後台或人工流程確認訂單。
- 出貨與物流串接留到第二階段。

## 七、不影響範圍

本入口不影響：

- 既有郵局匯款流程。
- 課程 NewebPay 分期 `InstFlag=3,6`。
- 紫微占卜 NT$50 信用卡付款。
- AI Chart 付款 feature flag。
- 官方 LINE Pay 保存流程。
- 藍新 LINE Pay 申請中狀態。

## 八、上線前檢查

正式開放前仍需確認：

- 商品 cart 可建立 product order。
- NewebPay Form Post 正常送出。
- NewebPay 付款頁只顯示信用卡一次付清。
- 商品交易 `InstFlag=0`。
- 不顯示分期。
- 不顯示 LINE Pay。
- 不顯示 ATM / WebATM。
- 不顯示 Apple Pay / Google Pay / Samsung Pay。
- Notify paid 後 payment 變 paid。
- Notify paid 後 `product_orders.payment_status` sync paid。
- 出貨前有人工確認 SOP。

## 九、禁止事項

- 不要送 `LINEPAY=1`。
- 不要送 `VACC=1`。
- 不要送 `WEBATM=1`。
- 不要送 `APPLEPAY=1`。
- 不要送 `ANDROIDPAY=1`。
- 不要送 `SAMSUNGPAY=1`。
- 不要讓商品出現 `InstFlag=3,6`。
- 不要使用 `provider=line_pay`。
- 不要把官方 LINE Pay flow 混入 NewebPay。
- 不要把 ReturnURL 當成付款成功。
- 不要在未收到 Notify paid 前出貨。
- 不要輸出 MerchantID / HashKey / HashIV 真值。
- 不要輸出 TradeInfo / TradeSha。

## 十、下一步建議

- 商品 cart NewebPay 正式低金額測試文件。
- 商品 Notify paid sync 實測。
- 商品匯款 / 信用卡並行 SOP。
- 商品出貨人工流程文件。
- 第二階段再評估物流 API。
