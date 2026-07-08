# NewebPay One Dollar Live Test Mode Design

本文件設計全站 NewebPay 1 元實刷測試模式。  
本輪只新增設計文件，不改程式邏輯、不改商品價格、不改課程價格、不改占卜價格、不呼叫藍新 API、不刷卡、不執行 SQL、不 push、不 deploy。

## 一、目的

為了測試 NewebPay 各付款流程，建立一個安全、可控、可關閉的 1 元實刷測試模式。

測試範圍包含：

- 課程付款
- 商品 cart
- 紫微占卜
- AI 命盤，若後續開啟
- Apple Pay 測試
- 信用卡一次付清測試
- 課程分期測試，若需要

這個模式的目的不是改正式售價，而是建立「明確標記為測試」的低金額付款資料，用來驗證 NewebPay Form Post、NotifyURL、ReturnURL、QueryTradeInfo fallback、paid sync 與前端體驗。

## 二、核心原則

- 不直接修改正式商品價格。
- 不直接修改正式課程價格。
- 不直接修改正式占卜價格。
- 不直接修改資料庫正式價格。
- 不直接修改正式商品、課程、占卜的資料來源價格。
- 只在測試模式下建立「1 元測試訂單」。
- 測試訂單必須明確標記 `test_payment=true`。
- 測試 payment / order / reading / purchase 必須可從後台或資料查詢中辨識。
- 測試訂單不可當作正式營收。
- 測試訂單不可自動出貨。
- 測試完成後要關閉測試模式。
- 1 元測試模式需由人工明確開啟，不可預設開啟。

## 三、建議 feature flag

只列欄位名稱，本文件不讀取任何真值：

- `ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE`
- `NEXT_PUBLIC_ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_NOTICE`
- `NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION`

建議規則：

- 預設 `false`。
- production 預設不可開。
- 若要在 production 實刷 1 元，必須人工確認。
- production 類環境即使 `ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE=true`，仍需二次確認值。
- 二次確認值使用固定常數 `CONFIRM_NEWEBPAY_ONE_DOLLAR_TEST`，不是 secret。
- 開啟前需確認只允許內部測試人員操作。
- 開啟時前端要明顯顯示「目前為 1 元測試模式」。
- 關閉後前端不可再顯示測試模式提示。
- 不可只開後端測試模式而不顯示前端提示。
- 不可只顯示前端提示而後端仍用正式金額。

### 22J-27 helper 初版

已新增 reusable helper：

- `src/lib/newebpay/oneDollarTestMode.ts`
- `src/lib/newebpay/oneDollarTestMode.test.ts`

目前 helper 只負責：

- 判斷 1 元測試模式是否開啟。
- 判斷 production 類環境是否有二次確認。
- 建立 1 元測試付款 context。
- 保留原始金額 metadata。
- 標記 `test_payment=true`。
- 避免敏感 NewebPay / OpenAI / LINE Pay key 類欄位被放進 metadata。

目前 helper 尚未接入商品 / 課程 / 占卜 / AI 命盤正式流程。

## 四、測試模式行為

### 1. 課程付款

測試模式開啟時：

- 原課程價格不改。
- 建立測試付款時 `amount=1`。
- `itemDesc` 加上「課程測試付款」。
- metadata 標記原價與 `test_payment=true`。
- metadata 應保留原課程 id / 課程名稱 / 原始價格摘要。
- 測試 `course_purchase` 不可混入正式營收統計。
- paid 後是否開課程權限需另行設計，避免 1 元測試讓一般課程權限被誤開。
- `InstFlag` 是否保留 `3,6` 需另行確認，避免 1 元無法分期或藍新分期規則不接受。

若目標是測「課程分期」：

- 不應假設 1 元可分期。
- 需先確認藍新 MPG 與銀行端是否允許 1 元分期。
- 若 1 元分期不可行，應改用指定低金額測試策略，不可直接改正式課程價格。

### 2. 商品 cart

測試模式開啟時：

- 商品原價不改。
- 建立測試 `product_order` 時 `total_amount=1`。
- 若有 `product_order_items`，小計需和訂單總額一致；不可留下商品小計正式金額但付款 1 元。
- `itemDesc` 加上「商品測試付款」。
- metadata 保留原商品金額、原商品品項與 `test_payment=true`。
- 測試訂單需明確標記 test。
- 測試訂單不自動出貨。
- 測試訂單需人工取消、退款或標記測試。
- 商品正式庫存與出貨流程不可因 1 元測試自動扣減或自動履約，除非後續另行設計。

### 3. 紫微占卜

測試模式開啟時：

- 原本 NT$50 不改。
- 測試付款 `amount=1`。
- paid gate 可測。
- metadata 標記原價、測試用途與 `test_payment=true`。
- OpenAI 是否真的產生解讀需可控制，避免測試浪費 API 成本。
- 若要測 paid gate，可考慮只測付款後狀態解鎖，不一定每次都呼叫 OpenAI。
- 若要測完整流程，需明確記錄已花費 OpenAI 成本。

### 4. AI 命盤

目前若 AI 命盤正式付款未開，測試模式不應直接開啟 AI 命盤正式付款入口。

AI 命盤要進入 1 元測試模式前，至少需先確認：

- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 的正式策略。
- reportContent / OpenAI / paid gate 是否完成。
- 付款後是否能穩定交付報告。
- 測試資料是否能和正式報告分開。

在未完成前，AI 命盤不應因全站 1 元測試模式而被順手開放。

## 五、Apple Pay 測試模式

Apple Pay 測試可以使用 1 元，但需要另行小包實作與測試。

測試前提：

- 需 Apple 裝置。
- 需已綁定可用信用卡。
- 藍新後台 Apple Pay 幕前支付需可用。
- MPG payload 可送 `APPLEPAY=1`。
- 不要同時送 `LINEPAY=1`。
- 不要同時送 `VACC=1`。
- `InstFlag=0`。

是否同時送 `CREDIT=1` 需評估：

- 若目標是只測 Apple Pay，建議只送 `APPLEPAY=1`。
- 若同時送 `CREDIT=1` 與 `APPLEPAY=1`，NewebPay MPG 頁可能同時顯示多個支付選項，測試結果較難判讀。
- Apple Pay 測試不應和課程分期同包混測。

## 六、金額一致性規則

1 元測試模式最重要的是金額一致。

以下金額必須一致：

- payment amount
- order `total_amount`
- product_order_items 小計
- NewebPay `Amt`
- Notify 回來的 `Amt`
- QueryTradeInfo 查回的交易金額
- paid sync 使用的本地 payment amount

不可出現：

- 訂單 19800，但付款 1 元。
- 商品小計 3000，但 payment amount 1 元。
- 課程原價完整寫進可付款總額，但 NewebPay `Amt=1`。
- Notify amount 與本地 payment amount 不一致。
- ReturnURL 顯示成功，但本地 amount mismatch 還是 mark paid。
- 1 元 payment sync 到正式營收欄位且無 test 標記。

建議規則：

- 測試模式下，測試訂單本身的應收金額就是 1 元。
- 正式原價只放在安全 metadata，不能參與本次 payment amount。
- Notify amount 不等於本地 payment amount 時，一律不可 mark paid。
- 測試資料需能被報表或人工流程排除。

## 七、測完後還原 SOP

1. 關閉 `ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE`。
2. 關閉或確認 `NEXT_PUBLIC_ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_NOTICE` 不再顯示。
3. 確認前端不再顯示 1 元測試提示。
4. 確認新訂單恢復正式金額。
5. 檢查測試 payment。
6. 檢查測試 `product_order`。
7. 檢查測試 `course_purchase`。
8. 檢查測試 `divination_reading`。
9. 檢查 AI 命盤測試資料，若後續曾開啟。
10. 需要退款或取消交易就到藍新後台處理。
11. 測試資料標記為 test，不混入正式營收。
12. 確認沒有測試訂單進入自動出貨。
13. 確認客服與人工對帳紀錄標註測試用途。

## 八、禁止事項

- 不要手動把正式商品價格改成 1 元。
- 不要手動把正式課程價格改成 1 元。
- 不要手動把正式占卜價格改成 1 元。
- 不要修改資料庫正式價格來達成測試。
- 不要讓一般使用者看到 1 元付款。
- 不要讓測試訂單自動出貨。
- 不要把測試資料當正式營收。
- 不要讓 1 元測試繞過 paid gate。
- 不要送 `LINEPAY=1`。
- 不要在 Apple Pay 測試包順手啟用 ATM / LINE Pay / wallet 混測。
- 不要讀 production env。
- 不要輸出 HashKey / HashIV / MerchantID。
- 不要輸出 TradeInfo / TradeSha。
- 不要刷卡。
- 不要呼叫藍新 API。
- 不要 push。
- 不要 deploy。

## 九、下一步建議

- 22J-28：商品 cart 1 元測試模式。
- 22J-29：紫微占卜 1 元測試模式。
- 22J-30：Apple Pay 1 元測試入口。
- 22J-31：測試模式關閉檢查。
