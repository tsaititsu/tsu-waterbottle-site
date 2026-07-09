# Cart Payment Method UI

本文件記錄商品 cart 付款方式選單。
文件不得放 MerchantID / HashKey / HashIV / LINE Pay Channel Secret / production env 真值 / TradeInfo / TradeSha。

## 一、目前 UI

商品 cart 使用「付款方式」選單，不再以多顆並排按鈕呈現付款入口。

目前選項：

- 信用卡付款
- Apple Pay 付款（iPhone / Safari）
- 郵局匯款

主要 CTA 依選項變化：

- 選信用卡付款：`前往信用卡付款`
- 選 Apple Pay：`前往 Apple Pay 付款`
- 選郵局匯款：`郵局匯款`

`繼續逛逛` 保留為次要動作。

## 二、信用卡付款

商品信用卡付款使用 NewebPay：

- provider: `newebpay`
- MPG: `CREDIT=1`
- `InstFlag=0`
- 使用正式商品金額

信用卡付款不送：

- `APPLEPAY=1`
- `LINEPAY=1`
- `VACC=1`
- `ANDROIDPAY=1`
- `SAMSUNGPAY=1`

## 三、Apple Pay

商品 Apple Pay 使用 NewebPay：

- provider: `newebpay`
- MPG: `APPLEPAY=1`
- `InstFlag=0`
- 使用正式商品金額

Apple Pay 不送：

- `CREDIT=1`
- `LINEPAY=1`
- `VACC=1`
- `ANDROIDPAY=1`
- `SAMSUNGPAY=1`

## 四、郵局匯款

郵局匯款是人工確認流程，不走 NewebPay。

郵局匯款不會：

- 呼叫 NewebPay create API
- 建立 NewebPay payment
- 送任何 NewebPay MPG 參數
- 送 `LINEPAY=1`
- 送 `VACC=1`

## 五、LINE Pay 狀態

官方 LINE Pay 仍維持保存暫停狀態，不放入 cart 付款方式選單。

不可把官方 `provider=line_pay` 與 NewebPay `provider=newebpay` 混用。

## 六、紫微占卜正式站錯誤文案

紫微占卜正式站不得顯示：

- OpenAI API Key
- env 或 server config 細節
- API key missing
- 本機測試 / local test

若 AI 解讀服務設定或服務暫時不可用，使用者只應看到泛用維護或客服協助訊息。

production 需由使用者在 Vercel Environment Variables 設定 `OPENAI_API_KEY`。
紫微占卜模型設定維持 `OPENAI_DIVINATION_MODEL=gpt-5.5`。

不要把 OpenAI key 寫進文件、commit、測試檔或聊天室。

## 七、禁止事項

- 不要改商品價格。
- 不要恢復 `/apple-pay-test`。
- 不要啟用 NewebPay `LINEPAY=1`。
- 不要啟用 NewebPay `VACC=1`。
- 不要啟用 Google Pay / Samsung Pay。
- 不要讓商品出現 `InstFlag=3,6`。
- 不要修改課程分期。
- 不要修改紫微占卜金額。
- 不要輸出 MerchantID / HashKey / HashIV 真值。
- 不要輸出 OpenAI API key。
