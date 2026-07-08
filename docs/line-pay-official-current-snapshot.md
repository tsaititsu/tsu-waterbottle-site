# LINE Pay Official Current Snapshot

本文件保存目前「官方 LINE Pay 直串 / 固定 IP proxy」方案的完整快照。  
本輪只新增文件，不改程式邏輯、不刪除任何官方 LINE Pay 程式、不改成藍新 LINE Pay、不新增 proxy 專案、不呼叫 LINE Pay API、不部署、不執行 SQL，且不包含任何 key 或 env 真值。

## 一、目前保留的 LINE Pay 方案

目前保留的是「LINE Pay 官方金流」方案：

- `provider = line_pay`
- 這不是藍新 MPG 的 `LINEPAY=1`
- 這不是 NewebPay payment method 的其中一個開關
- 這是一條獨立於 NewebPay 的官方 LINE Pay provider 路線

目前決策狀態：

- 暫時不決定是否繼續官方 LINE Pay。
- 暫時不改成藍新 LINE Pay。
- 暫時不刪除官方 LINE Pay 程式。
- 目前先保存完整實作與文件，等使用者思考後再決定下一步。

若未來繼續官方 LINE Pay，可以從本文件接回目前進度。  
若未來改走藍新 LINE Pay，也應先另做可行性評估，不要直接覆蓋或刪除官方 LINE Pay。

## 二、目前已完成的官方 LINE Pay 程式

### Helper 層

目前 `src/lib/linePay` 已建立官方 LINE Pay 基礎能力：

- config
  - `normalizeLinePayEnvironment`
  - `getLinePayBaseUrl`
  - `createLinePayNonce`
  - `stringifyLinePayJsonBody`
- signature
  - `buildLinePaySignature`
  - HMAC SHA256
  - GET / POST message 組合
- request headers
  - `buildLinePayRequestHeaders`
  - `Content-Type`
  - `X-LINE-ChannelId`
  - `X-LINE-Authorization`
  - `X-LINE-Authorization-Nonce`
- request payload
  - `buildLinePayRequestPayload`
  - 第一版只支援 `TWD`
  - 驗證 orderId、amount、products、confirmUrl、cancelUrl
- confirm payload
  - `validateLinePayTransactionId`
  - `buildLinePayConfirmPayload`
  - `transactionId` 全程保持 string，不轉 number
- response parser
  - `parseLinePayRequestResponse`
  - `parseLinePayConfirmResponse`
  - `returnCode !== "0000"` 視為 API 失敗
- request client
  - `requestLinePayPayment`
  - 使用 injected fetch
  - 不直接讀 production env
- confirm client
  - `confirmLinePayPayment`
  - 使用 injected fetch
  - 不直接更新 DB
  - 不直接 mark paid
- status client
  - `checkLinePayPaymentRequestStatus`
  - `getLinePayPaymentDetails`
  - 用於 confirm `1172` / `1198` / timeout 後查狀態
- payment metadata
  - `buildLinePayRequestPaymentMetadata`
  - `buildLinePayConfirmPaymentMetadata`
  - `mergeLinePayPaymentMetadata`
- orderId
  - `normalizeLinePayOrderId`
  - `buildLinePayOrderId`
  - `extractSourceIdFromLinePayOrderId`
- confirm outcome guard
  - `resolveLinePayConfirmOutcome`
  - 只有結果安全、金額/幣別/orderId/transactionId 一致時，才允許後續 mark paid
- barrel export
  - `src/lib/linePay/index.ts`

### 後端

目前商品訂單官方 LINE Pay 後端流程已建立：

- product order LINE Pay request route
  - `POST /api/product-orders/line-pay/request`
  - product order preflight
  - 建立 `provider=line_pay` pending payment
  - 呼叫 LINE Pay request API
  - 寫入 `transactionId` / `paymentUrl` metadata
  - 回傳 `paymentUrl.web` 給前端導頁
- product order LINE Pay confirm route
  - `GET /api/product-orders/line-pay/confirm`
  - 接收 `orderId` / `transactionId`
  - preflight payment / product_order
  - 呼叫 LINE Pay confirm API
  - Confirm API `1172` / `1198` / timeout 時 fallback 查 request status / payment details
  - outcome safe 才 mark paid
  - sync `product_orders`
  - 最後導回 `/cart?linePay=success` / `/cart?linePay=pending` / `/cart?linePay=error`
- product order LINE Pay cancel route
  - `GET /api/product-orders/line-pay/cancel`
  - 接收 `orderId` / `transactionId`
  - 寫入 `linePay.cancel` metadata
  - 不改 paid / failed / canceled status
  - 不改 `product_orders`
  - 最後導回 `/cart?linePay=canceled` / `/cart?linePay=error`
- 付款狀態同步
  - safe outcome 後才 mark `payments` paid
  - mark paid 後才 sync `product_orders.payment_status=paid`
  - 不使用藍新 MPG `LINEPAY=1`

### 前端

目前商品 cart 已建立 LINE Pay 前端入口能力：

- cart LINE Pay 按鈕
- `NEXT_PUBLIC_ENABLE_LINE_PAY` feature flag gate
- 按鈕字樣固定為 `LINE Pay`
- click handler
- 建立 product order
- 呼叫 `/api/product-orders/line-pay/request`
- 取得 `paymentUrl.web`
- 導向 LINE Pay 付款頁
- cart return message
  - `/cart?linePay=success`
  - `/cart?linePay=canceled`
  - `/cart?linePay=pending`
  - `/cart?linePay=failed`
  - `/cart?linePay=error`

### 文件

目前已建立的 LINE Pay 文件：

- `docs/line-pay-architecture-notes.md`
- `docs/line-pay-route-smoke-checklist.md`
- `docs/line-pay-sandbox-manual-test-plan.md`
- `docs/line-pay-production-signoff-checklist.md`
- `docs/line-pay-implementation-status.md`
- `docs/line-pay-env-readiness-checklist.md`
- `docs/line-pay-sandbox-readiness-dry-run.md`
- `docs/line-pay-key-use-confirmation-checklist.md`
- `docs/line-pay-ip-whitelist-readiness.md`
- `docs/line-pay-sandbox-test-decision.md`
- `docs/vercel-static-ip-line-pay-setup.md`
- `docs/line-pay-fixed-ip-proxy-options.md`
- `docs/line-pay-fixed-ip-proxy-architecture.md`
- `docs/line-pay-fixed-ip-proxy-cost-guard-sop.md`

## 三、目前尚未做的事情

目前尚未進行：

- 尚未填 LINE Pay key。
- 尚未填 IP 白名單。
- 尚未做 sandbox 手測。
- 尚未做 production sign-off。
- 尚未建立 fixed IP proxy。
- 尚未決定 AWS Lightsail / DigitalOcean / Oracle / 藍新。
- 尚未套用白皮書。
- 尚未 push / deploy 最新 LINE Pay 流程。
- 尚未確認正式 `confirmUrl` / `cancelUrl`。
- 尚未確認 LINE Pay 後台付款伺服器 IP 白名單。
- 尚未確認退款流程。
- 尚未確認發票 / coupon / 金額規則。

在以上事項完成前，不建議對一般使用者開放官方 LINE Pay。

## 四、目前卡點

目前官方 LINE Pay 卡點集中在固定 IP 與正式測試成本：

- 官方 LINE Pay 需要付款伺服器 IP 白名單。
- 付款伺服器 IP 指的是 merchant server 呼叫 LINE Pay API 的 outbound public IP。
- Vercel 預設 outbound IP 不應視為固定可白名單 IP。
- Vercel Static IP 每月成本較高，暫不一定划算。
- AWS Lightsail 約低成本，但需要主機維護、資安設定與刪除 SOP。
- DigitalOcean Droplet / Reserved IP 也可評估，但同樣需要維護 proxy。
- Cloudflare Worker 一般方案不適合固定 IP 白名單。
- 藍新 LINE Pay 一年 5000-6000 可能更方便，但要另行評估費用、流程、Notify、前端與業務同步。

目前不應直接二選一硬改。  
建議先保存官方 LINE Pay，等使用者決定「固定 IP proxy」或「藍新 LINE Pay」後再往下一包走。

## 五、之後如果繼續官方 LINE Pay，要從哪裡接

若使用者決定繼續官方 LINE Pay，建議從以下順序接回：

1. 重新確認 sandbox 測試路線：
   - A：本機 sandbox 測試
   - B：Vercel sandbox 測試
   - C：固定 IP payment proxy
   - D：暫停 LINE Pay 測試
2. 若選 fixed IP proxy，先完成 cost guard SOP。
3. 選定 AWS Lightsail、DigitalOcean 或其他固定 IP proxy。
4. 建立固定 IP proxy 前，再次確認成本、刪除 SOP、auth 與 secret 存放位置。
5. LINE Pay 白名單填 proxy fixed IP `/32`。
6. LINE Pay key 由使用者自行填 env，不貼聊天室。
7. 進行 sandbox 手動測試。
8. 修正 sandbox 測試發現的問題。
9. 完成 production sign-off。
10. 正式開放前再次確認 feature flag 與未完成入口。

接回時優先查看：

- `docs/line-pay-implementation-status.md`
- `docs/line-pay-sandbox-readiness-dry-run.md`
- `docs/line-pay-key-use-confirmation-checklist.md`
- `docs/line-pay-fixed-ip-proxy-architecture.md`
- `docs/line-pay-fixed-ip-proxy-cost-guard-sop.md`

## 六、之後如果改用藍新 LINE Pay，要注意

若使用者決定改走藍新 LINE Pay，需要重新設計，不可把官方 LINE Pay 與藍新 LINE Pay 混在一起。

注意事項：

- provider 應維持 `newebpay`。
- 藍新 LINE Pay 是 NewebPay MPG 支付方式，不是 `provider=line_pay`。
- 不可混用官方 LINE Pay metadata。
- 不可混用官方 LINE Pay confirm route。
- 不可混用官方 LINE Pay transactionId / orderId 規則。
- 需另做一包「藍新 LINE Pay 可行性評估」。
- 評估內容應包含：
  - 藍新 MPG 支付參數
  - 是否要開 `LINEPAY=1`
  - Notify paid sync 是否沿用
  - Return URL 體驗
  - 費用
  - 測試流程
  - 是否影響現有 `CREDIT=1`
- 不要直接刪官方 LINE Pay 程式。
- 先用 feature flag 關閉保存，等使用者確認後再決定是否移除或保留。

## 七、安全保存規則

保存期間必須遵守：

- 不要刪官方 LINE Pay 程式。
- 不要把 key 寫進文件。
- 不要把 key 寫進 commit。
- 不要把 Channel Secret 貼聊天室。
- 不要輸出 env 真值。
- 不要放 transactionId / orderId / paymentId 真值。
- 不要放個資。
- 不要放測試卡號。
- 不要放藍新 HashKey / HashIV。
- 不要放 TradeInfo / TradeSha。
- 不要啟用藍新 MPG `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。
- 不要讓官方 LINE Pay route 在未完成 sandbox / sign-off 前對一般使用者開放。

若需要使用 key：

- 使用前必須先回報使用者。
- 不得要求使用者把 Channel Secret 貼到聊天室。
- 使用者應自行填入 Vercel Environment Variables 或本機 `.env.local`。
- Codex / terminal / log / docs / commit 都不得顯示 secret 真值。

## 八、建議 Git 保存方式

目前所有官方 LINE Pay helper、後端 route、前端 cart 入口與文件都已透過 commit 保存。

本輪只新增 snapshot 文件：

- `docs/line-pay-official-current-snapshot.md`

本輪不做：

- 不建立 branch。
- 不建立 tag。
- 不 push。
- 不 deploy。
- 不刪程式。
- 不改成藍新。

若使用者之後要長期封存官方 LINE Pay 實作，可另開一包：

- 建立 git tag；或
- 建立保存 branch；或
- 整理封存說明；或
- 決定是否保持 feature flag 關閉但保留程式。

目前建議保持現狀：

- 官方 LINE Pay 程式保留。
- LINE Pay feature flag 未確認前不開放 production。
- 等使用者決定繼續官方 LINE Pay、固定 IP proxy，或改評估藍新 LINE Pay。
