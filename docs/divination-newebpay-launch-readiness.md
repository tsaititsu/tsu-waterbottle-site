# Divination NewebPay Launch Readiness

本文件整理紫微占卜 NT$50 NewebPay 上線前安全檢查。  
本輪只做文件盤點，不改程式邏輯、不呼叫藍新 API、不呼叫 LINE Pay API、不刷卡、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

## 一、目前狀態

- 紫微占卜 NT$50 NewebPay 付款流程已存在。
- 付款 item 為 `ai_divination_single`，金額為 NT$50。
- provider 維持 `newebpay`。
- NewebPay MPG 使用 `CREDIT=1`。
- 非課程付款維持 `InstFlag=0`，占卜不開信用卡分期。
- 程式沒有送 NewebPay MPG `LINEPAY=1`。
- 占卜流程沒有使用官方 LINE Pay `provider=line_pay`。
- persisted `divination_readings` 有 paid gate；未付款時 `/api/divination/interpret` 會回 `PAYMENT_REQUIRED`。
- paid 後可進入 OpenAI 解讀流程，並將解讀結果保存到 `divination_readings`。
- Notify paid 後可透過 `syncDivinationReadingAfterPayment` 同步 `divination_readings.status=paid`。
- repo 內無法確認正式實刷紀錄；正式開入口前仍需低金額實刷測試。

## 二、前端入口檢查

目前確認：

- 入口頁位於 `src/app/ai-divination`，抽牌與結果流程由 `src/components/divination/DivinationDrawPreview.tsx` 承接。
- persisted reading 需要付款時，前端會顯示「信用卡線上付款 NT$50」。
- `NEXT_PUBLIC_ENABLE_NEWEBPAY` 不是 `"true"` 時，正式線上付款按鈕會 disabled，文案顯示「線上付款尚未啟用」。
- 未付款 persisted reading 不會直接顯示完整 OpenAI 解讀；會停在付款要求。
- 前端有錯誤提示，例如付款資料建立失敗、付款資料不完整、占卜紀錄缺失。
- 前端沒有顯示 LINE Pay 付款字樣。
- 前端沒有顯示分期付款字樣。
- 本機 / 非 persisted flow 仍有 mock paid，用於測試，不應當成正式付款。

待確認：

- 付款成功後使用者回站體驗仍需人工測試。
- NewebPay `ReturnURL` 目前導向共用 `/payment/newebpay/return` 頁，頁面說明正確強調「ReturnURL 不代表付款成功」。
- 目前 return page 的返回連結偏向 `/booking`，占卜正式上線前需確認是否會讓占卜使用者困惑。
- NewebPay `ClientBackURL` 會依 item key 回到 `/ai-divination`，但仍需實際確認藍新付款頁上的返回行為。

## 三、後端付款流程檢查

### 建立 divination reading

- API：`POST /api/divination/readings/create`
- 檔案：`src/app/api/divination/readings/create/route.ts`
- 當 `ENABLE_DIVINATION_DB_READINGS === "true"` 時，會建立 `divination_readings` pending record。
- 初始狀態為 `pending_payment`。
- raw payload 會過濾 `TradeInfo`、`TradeSha`、`HashKey`、`HashIV`、`interpretation`、`aiInterpretation` 等敏感或不應保存欄位。

### 建立 NewebPay payment

- API：`POST /api/payments/newebpay/create`
- 前端送：
  - `itemKey: "ai_divination_single"`
  - `source: "ai_divination"`
  - `paymentMode: "credit"`
  - `readingId`
- 後端會驗證 reading 是否存在、是否仍可付款、是否尚未 link payment。
- 建立 `payments` pending record 時使用 `provider=newebpay`、`itemType=ai_divination`。
- 建立 pending payment 後會把 `payment_id` 與 `merchant_order_no` link 回 `divination_readings`。

### MerchantOrderNo

- MerchantOrderNo 由 `generateNewebPayMerchantOrderNo()` 產生。
- 它只作為站內付款識別，不應暴露 HashKey / HashIV / TradeInfo / TradeSha。

### NotifyURL / ReturnURL

- `NotifyURL`：`/api/payments/newebpay/notify`
- `ReturnURL`：`/payment/newebpay/return`
- `ClientBackURL`：占卜付款為 `/ai-divination`
- 付款是否成功必須以 NotifyURL 驗證後的 paid 狀態為準，ReturnURL 只代表使用者回到網站。

### paid sync

- Notify paid 後會進入 NewebPay notify flow。
- `syncNewebPayDivinationAfterPayment` 只處理 `itemType=ai_divination`。
- `syncDivinationReadingAfterPayment` 會呼叫 `markDivinationReadingPaidByPayment`。
- `divination_readings` 從 `pending_payment` 或 null 狀態更新為 `paid`。
- `already_paid`、`not_found`、`invalid_state` 皆有結果分流。

### QueryTradeInfo fallback

- `persistNewebPayNotifyQueryFallback` 測試已覆蓋 divination fallback。
- fallback 可在 Notify 異常時依查詢結果補寫 payment paid，再呼叫 divination sync。
- 上線前仍需正式環境測試確認 QueryTradeInfo fallback 可用。

### 假 paid 防護

- persisted reading 的正式 paid gate 依 DB status 判斷。
- 本機 mock paid 只在非 persisted / local entitlement flow 中使用。
- 正式 flow 不應使用 mock paid、dry-run paid 或手動改狀態來宣稱已付款。

## 四、OpenAI 解讀流程檢查

- 付款前 persisted reading 不可產生完整 OpenAI 解讀，會回 `PAYMENT_REQUIRED`。
- paid 後 `decideDivinationInterpretationStart` 才會回 `should_interpret`。
- 開始解讀前會先將 reading 狀態更新為 `interpreting`。
- OpenAI 解讀成功後會寫入 `interpretation`、`result_summary`，並將狀態更新為 `completed`。
- OpenAI API key 缺失、請求失敗或回應格式異常時，會回安全錯誤並標記 reading `failed`。
- 已在 `interpreting` 的 reading 會回 `DIVINATION_READING_INTERPRETING`，避免重複啟動。
- 已 `completed` 的 reading 會回 `DIVINATION_READING_ALREADY_COMPLETED`，避免重複解讀覆蓋。
- 狀態有 `pending_payment`、`paid`、`interpreting`、`completed`、`failed`、`canceled` 分流。

## 五、上線前人工測試清單

以下只列清單，本文件不執行：

1. 未付款不能看完整解讀。
2. 可建立 NT$50 NewebPay payment。
3. NewebPay 付款頁只顯示信用卡一次付清。
4. NewebPay 付款頁不顯示分期。
5. NewebPay 付款頁不顯示 LINE Pay。
6. NotifyURL 成功後 `payments.status` 變 paid。
7. `divination_readings` 正確 sync paid。
8. paid 後可產生 OpenAI 解讀。
9. ReturnURL 顯示正確結果，且不把 ReturnURL 當成付款成功依據。
10. ClientBackURL / 使用者返回流程可回到占卜情境。
11. fallback QueryTradeInfo 可查詢。
12. 不使用假 paid。
13. 錯誤時不產生解讀。
14. OpenAI 失敗時 reading 進入 failed，且使用者看到友善錯誤。
15. 重複點擊不會產生重複解讀或重複 link payment。

## 六、目前缺口

- 缺正式低金額實刷紀錄。
- 缺 production `NEXT_PUBLIC_ENABLE_NEWEBPAY` 與 `ENABLE_DIVINATION_DB_READINGS` 人工確認。
- 需確認 OpenAI production env 與模型設定是否完成，但不要在文件或回報中輸出真值。
- 需人工測試 ReturnURL / ClientBackURL 返回體驗；目前共用 return page 偏預約頁文案與返回連結。
- 需確認付款結果頁文案是否適合占卜使用者。
- 需補客服 SOP：付款成功但解讀失敗、付款 pending、重複付款、使用者找不到結果。
- 需補退款 / 取消交易 SOP。
- 需確認 QueryTradeInfo fallback 正式環境權限與操作 SOP。

## 七、上線建議

- 紫微占卜可以進入正式低金額測試準備階段。
- 在商品 / AI 命盤兩條線中，紫微占卜最適合第一個開放測試，因為金額低、流程較完整、paid gate 與 OpenAI 解讀已接好。
- 測試前仍需確認：
  - production flag 是否要開。
  - DB persisted reading flow 是否已開。
  - ReturnURL / ClientBackURL 是否讓使用者能回到占卜流程。
  - OpenAI 失敗與客服 SOP 是否可處理。
- 測試通過前，不應宣稱已正式可收款。

## 八、禁止事項

- 不要呼叫藍新 API。
- 不要呼叫 LINE Pay API。
- 不要刷卡。
- 不要用假 paid 污染正式資料。
- 不要略過 paid gate。
- 不要啟用 NewebPay MPG `LINEPAY=1`。
- 不要讓占卜出現 `InstFlag=3,6`。
- 不要使用官方 `provider=line_pay`。
- 不要輸出 HashKey / HashIV / MerchantID 真值。
- 不要讀 `.env.local`。
- 不要讀 production env。
- 不要執行 SQL。
- 不要 push。
- 不要 deploy。

## 九、下一步建議

- 22J-20：紫微占卜正式低金額測試指引。
- 22J-21：紫微占卜測試結果修正。
- 22J-22：紫微占卜正式入口開啟檢查。
- 22J-23：商品 cart NewebPay checkout 缺口修正。

## 十、安全要求

- 不放 HashKey / HashIV / MerchantID 真值。
- 不放 LINE Pay Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放 transactionId / orderId / paymentId 真值。
- 不放個資。
- 不放 TradeInfo / TradeSha。
- 不放測試卡號。
