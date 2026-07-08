# LINE Pay Env Readiness Checklist

本文件只用於檢查 LINE Pay sandbox / production 上線前需要哪些 env 欄位、應放在哪裡，以及使用 key 前的安全規則。本文件不放任何 LINE Pay Channel Secret、production env 真值、sandbox env 真值、真實交易資料、測試卡號、個資、藍新 HashKey / HashIV、TradeInfo 或 TradeSha。

## 一、目的

本文件只檢查 LINE Pay 官方金流在 sandbox / production 上線前需要的 env 欄位與設定位置。

它不代表已完成 sandbox 測試，不代表已完成 production sign-off，也不包含任何 env 真值。

## 二、必要 Env 欄位

只列欄位名稱，不放值：

- `NEXT_PUBLIC_ENABLE_LINE_PAY`
- `LINE_PAY_ENV`
- `LINE_PAY_CHANNEL_ID`
- `LINE_PAY_CHANNEL_SECRET`
- `LINE_PAY_CONFIRM_URL`
- `LINE_PAY_CANCEL_URL`

## 三、欄位用途

- `NEXT_PUBLIC_ENABLE_LINE_PAY`：控制前端是否顯示並啟用 `LINE Pay` 按鈕。
- `LINE_PAY_ENV`：指定 LINE Pay 環境，第一版使用 `sandbox` 或 `production`。
- `LINE_PAY_CHANNEL_ID`：LINE Pay Channel ID。
- `LINE_PAY_CHANNEL_SECRET`：LINE Pay Channel Secret，只能供 server-side 使用，不可加 `NEXT_PUBLIC`。
- `LINE_PAY_CONFIRM_URL`：LINE Pay 認證完成後導回商店的 confirm route。
- `LINE_PAY_CANCEL_URL`：使用者取消付款後導回商店的 cancel route。

## 四、建議填寫位置

- 本機測試：`.env.local`。
- Vercel：Environment Variables。
- 不得寫進程式碼。
- 不得寫進文件。
- 不得寫進 commit。
- 不得貼到聊天室。

## 五、Sandbox 設定檢查

以下只列 sandbox 測試前的檢查規則，不放任何真值：

- `NEXT_PUBLIC_ENABLE_LINE_PAY=true`。
- `LINE_PAY_ENV=sandbox`。
- `LINE_PAY_CONFIRM_URL` 指向 `/api/product-orders/line-pay/confirm`。
- `LINE_PAY_CANCEL_URL` 指向 `/api/product-orders/line-pay/cancel`。
- Channel ID / Secret 使用 sandbox 資料。
- 不可混用 production key。
- 不可使用藍新 MPG `LINEPAY=1`。
- LINE Pay 官方金流 provider 必須維持 `line_pay`。
- NewebPay provider 必須維持 `newebpay`。

## 六、Production 設定檢查

以下只列 production 前的檢查規則，不讀取、不輸出任何 production env 真值：

- `LINE_PAY_ENV=production`。
- Production Channel ID / Secret 必須由使用者自行填入 Vercel Environment Variables。
- 使用 production key 前，必須先回報使用者確認。
- `LINE_PAY_CONFIRM_URL` 必須是正式網域，並指向 `/api/product-orders/line-pay/confirm`。
- `LINE_PAY_CANCEL_URL` 必須是正式網域，並指向 `/api/product-orders/line-pay/cancel`。
- 需確認 LINE Pay 後台白名單 / 對外 IP 設定。
- 需確認 production sign-off checklist。
- 未完成 sandbox 測試與 sign-off 前，不可對一般使用者開放。

## 七、Key 使用規則

- 需要使用 LINE Pay 串接 key 前，必須先跟使用者說。
- 不得要求使用者把 Channel Secret 貼在聊天室。
- 不得讓 Codex 顯示 `LINE_PAY_CHANNEL_SECRET`。
- 不得讓 terminal log 顯示 secret。
- 不得把 key commit。
- 不得把 key 寫進 docs。
- 不得把 key 寫進測試檔。
- 不得在回報中列出 env 真值。
- `LINE_PAY_CHANNEL_SECRET` 不可加 `NEXT_PUBLIC`。

## 八、白皮書狀態

- 目前已記錄使用者提醒：後續若要用白皮書，必須先告知使用者。
- 未取得白皮書 PDF 或官方連結前，不可自行假設內容。
- 若白皮書與現有實作衝突，先整理差異，不直接改程式。

## 九、.env.example 檢查結果

本包只檢查 `.env.example`，未讀取 `.env.local`，未讀取 production env。

- 已確認欄位是否存在：是。
- `NEXT_PUBLIC_ENABLE_LINE_PAY`：存在。
- `LINE_PAY_ENV`：存在。
- `LINE_PAY_CHANNEL_ID`：存在。
- `LINE_PAY_CHANNEL_SECRET`：存在。
- `LINE_PAY_CONFIRM_URL`：存在。
- `LINE_PAY_CANCEL_URL`：存在。
- 已確認 `.env.example` 沒有放 LINE Pay Channel Secret 真值。
- 已確認 `.env.example` 沒有放 production env 真值。
- 缺漏欄位：無。

若之後發現欄位缺漏，請在下一包處理 `.env.example`，不要在同一包直接改動其他流程。

## 十、下一步建議

- `22J-3`：補 `.env.example` 缺漏欄位，若 `22J-2` 發現缺欄位。
- `22J-4`：sandbox readiness dry-run checklist。
- `22J-5`：使用 key 前確認清單。
- `22K-1`：sandbox 手動測試第一輪。

## 文件安全要求

- 不放 Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放真實 `transactionId`。
- 不放真實 `orderId`。
- 不放真實 `paymentId`。
- 不放個資。
- 不放測試卡號。
- 不放藍新 HashKey / HashIV。
- 不放 TradeInfo / TradeSha。
