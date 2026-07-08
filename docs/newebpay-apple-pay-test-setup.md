# NewebPay Apple Pay 1 元內部測試入口

本文件記錄 NewebPay Apple Pay 1 元內部測試入口。  
本入口只用於內部測試，不是正式商品入口，不全站開放，不呼叫藍新 API 做實測，不刷卡。

## 一、目前狀態

Apple Pay 目前只做 1 元內部測試：

- 測試頁：`/internal/newebpay/apple-pay-test`
- 測試金額：NT$1
- provider：`newebpay`
- payment mode：`apple_pay_test`
- MPG 參數：`APPLEPAY=1`
- `InstFlag=0`

本入口不套進：

- 商品 cart 正式付款
- 課程付款
- 紫微占卜付款
- AI 命盤付款
- 官方 LINE Pay `provider=line_pay`

### 22J-29 商品正式流程臨時測試入口

22J-29 另新增商品正式流程測試入口：

- 說明頁：`/apple-pay-test`
- 商品頁：`/spiritual-products`
- 購物車：`/cart`
- payment mode：`product_order_apple_pay_test`

這條路線會建立正式 `product_order` 與 `provider=newebpay` pending payment，並等待既有 Notify paid sync `product_orders`。

注意：

- 這是臨時測試包，測完必須 revert。
- 商品前台與 cart 暫時顯示 / 結帳 NT$1。
- 實刷前需確認購物車只有 1 件商品。
- 不使用 `/internal/newebpay/apple-pay-test` 作為主要商品測試入口。

## 二、測試用途

此入口只用來確認 Apple Pay 內部實刷流程：

1. 內部測試頁建立 Apple Pay 1 元測試付款。
2. 後端檢查 Apple Pay test flag。
3. 後端檢查 1 元測試模式 flag。
4. production 類環境沿用 1 元測試模式二次確認。
5. 產生 NewebPay MPG Form Post 欄位。
6. 前端送出 Form Post 到 NewebPay。
7. 使用 Apple 裝置進行 Apple Pay 付款測試。

## 三、必要條件

測試前需確認：

- Apple 裝置。
- Apple Pay 已綁定可用信用卡。
- 藍新後台 Apple Pay 幕前支付可用。
- NewebPay 正式或測試環境資訊已由使用者自行填入正確位置。
- 不把 MerchantID / HashKey / HashIV 寫進文件。
- 不把 TradeInfo / TradeSha 貼到聊天室。

## 四、需要開啟的 flag

只列欄位名稱與預期設定，不放任何真值：

- `ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE=true`
- `NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION=CONFIRM_NEWEBPAY_ONE_DOLLAR_TEST`
- `ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE=true`
- `NEXT_PUBLIC_ENABLE_NEWEBPAY_APPLE_PAY_TEST_ENTRY=true`

預設狀態：

- `.env.example` 全部為關閉或空值。
- 未開 `NEXT_PUBLIC_ENABLE_NEWEBPAY_APPLE_PAY_TEST_ENTRY` 時，內部頁會回 404。
- 未開 `ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE` 時，後端不可建立 Apple Pay 測試付款。
- 未開 1 元測試模式時，後端不可建立 Apple Pay 測試付款。
- production 類環境沒有二次確認時，後端不可建立 Apple Pay 測試付款。

## 五、Apple Pay MPG 參數

Apple Pay 1 元測試付款應符合：

- `APPLEPAY=1`
- `InstFlag=0`
- `Amt=1`

不得包含：

- `CREDIT=1`
- `LINEPAY=1`
- `VACC=1`
- `WEBATM=1`
- `CVS=1`
- `BARCODE=1`
- `ANDROIDPAY=1`
- `SAMSUNGPAY=1`

## 六、與正式流程隔離

本入口不會：

- 建立 `product_order`
- 建立 `course_purchase`
- 建立 `divination_reading`
- 觸發 OpenAI
- 修改商品價格
- 修改課程價格
- 修改占卜價格
- 啟用商品 cart Apple Pay
- 啟用課程 Apple Pay
- 啟用紫微占卜 Apple Pay

測試資料需標記：

- `test_payment=true`
- `one_dollar_test_mode=true`
- `apple_pay_test=true`
- `test_source=apple_pay_test`

## 七、實刷前人工確認

實刷前需人工確認：

- 目前確實要做 Apple Pay 1 元內部測試。
- 測試人員使用 Apple 裝置。
- 測試交易金額為 NT$1。
- NewebPay 付款頁只顯示 Apple Pay 相關付款方式。
- 沒有顯示 LINE Pay。
- 沒有顯示 ATM。
- 沒有顯示 Google Pay / Samsung Pay。
- 不把測試資料當正式營收。

## 八、測完關閉

測完需關閉：

- `ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE`
- `NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION`
- `ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE`
- `NEXT_PUBLIC_ENABLE_NEWEBPAY_APPLE_PAY_TEST_ENTRY`

測試交易若需要退款 / 取消，需到藍新後台處理。  
測試 payment 必須標記為測試用途，不得混入正式營收。

## 九、禁止事項

- 不要全站啟用 Apple Pay。
- 不要套進商品 cart 正式付款。
- 不要套進課程付款。
- 不要套進紫微占卜付款。
- 不要套進 AI 命盤付款。
- 不要修改正式價格。
- 不要啟用 Google Pay / Samsung Pay。
- 不要啟用 `LINEPAY=1`。
- 不要啟用 `VACC=1`。
- 不要呼叫藍新 API 做實測。
- 不要刷卡，除非另包進入人工實刷測試。
- 不要輸出 MerchantID / HashKey / HashIV 真值。
- 不要輸出 TradeInfo / TradeSha。
