# LINE Pay Fixed IP Payment Proxy Architecture

本文件只定義 LINE Pay 官方金流使用 fixed IP payment proxy 的架構規格。  
本輪不新增 proxy 專案、不改現有程式邏輯、不呼叫 LINE Pay API、不部署、不執行 SQL，且不包含任何 key 或 env 真值。

## 一、推薦架構

```text
Vercel cart / API
→ fixed IP payment proxy
→ LINE Pay API
```

架構目標：

- 讓 LINE Pay API request / confirm / status / details 由固定 outbound IP 發出。
- LINE Pay 後台「管理付款伺服器 IP」填 proxy 的固定 IP `/32`。
- 保留目前 Vercel / Next.js 的商品訂單、付款狀態與 Supabase 資料流。
- 避免為了 LINE Pay 單一需求直接採用成本較高的 Vercel Static IP。

## 二、責任切分

### Vercel 保留

Vercel / Next.js 繼續作為主要商店與付款狀態系統：

- `product_orders`
- `payments`
- Supabase 讀寫
- mark paid
- `product_order` sync
- cart 前端
- product order create API
- LINE Pay request / confirm / cancel route 的使用者導回
- confirm outcome 判斷
- payment metadata 寫入
- 成功付款後的業務狀態更新

### Proxy 只負責

fixed IP payment proxy 只作 LINE Pay API outbound gateway：

- 呼叫 LINE Pay request API
- 呼叫 LINE Pay confirm API
- 呼叫 LINE Pay request status API
- 呼叫 LINE Pay payment details API
- 回傳 LINE Pay response 給 Vercel

proxy 不判斷商品訂單是否可付款。  
proxy 不決定是否 mark paid。  
proxy 不更新商店業務資料。

## 三、Proxy 不做的事

proxy 不應承擔主系統資料責任：

- 不直接寫 Supabase
- 不保存 Supabase service role key
- 不 mark paid
- 不 sync `product_orders`
- 不保存客戶個資
- 不保存商品訂單主資料
- 不處理 NewebPay
- 不啟用藍新 MPG `LINEPAY=1`
- 不產生商店側 payment status
- 不決定 LINE Pay outcome 是否安全
- 不把完整客戶資料轉送給 LINE Pay

若未來需要讓 proxy 持有 Supabase service role 或直接更新 DB，必須另開小包重新做安全設計，不可直接擴大 proxy 權限。

## 四、Proxy API 草案

以下是 proxy 對 Vercel 開放的內部 API 草案。  
這些 endpoint 只供 Vercel server-side route 呼叫，不給瀏覽器直接呼叫。

### `POST /line-pay/request`

用途：

- 由 proxy 呼叫 LINE Pay request payment API。
- 回傳 LINE Pay 的 `transactionId` 與 `paymentUrl` 給 Vercel。

建議輸入：

```json
{
  "orderId": "LP_product_order_xxx_1234567890",
  "amount": 1500,
  "currency": "TWD",
  "packages": [],
  "redirectUrls": {
    "confirmUrl": "https://example.com/api/product-orders/line-pay/confirm",
    "cancelUrl": "https://example.com/api/product-orders/line-pay/cancel"
  }
}
```

注意：

- 實際 payload 結構可沿用目前 Vercel 端既有 LINE Pay request payload helper。
- proxy 不應自行讀 `product_orders`。
- proxy 不應自行建立 `payments`。

### `POST /line-pay/confirm`

用途：

- 由 proxy 呼叫 LINE Pay confirm API。
- 回傳 confirm response 給 Vercel。

建議輸入：

```json
{
  "transactionId": "1234567890123456789",
  "amount": 1500,
  "currency": "TWD"
}
```

注意：

- `transactionId` 必須全程保留 string，不轉 number。
- proxy 不直接 mark paid。
- Vercel 收到 response 後，仍要做 amount / currency / orderId / transactionId outcome guard。

### `GET /line-pay/request-status`

用途：

- 由 proxy 呼叫 LINE Pay request status API。
- 用於 confirm `1172` / `1198` / timeout 等需要補查狀態的流程。

建議 query：

```text
orderId=LP_product_order_xxx_1234567890
```

注意：

- proxy 只回傳 LINE Pay 狀態資料。
- Vercel 才能判斷是否可進一步 mark paid。

### `GET /line-pay/payment-details`

用途：

- 由 proxy 呼叫 LINE Pay payment details API。
- 用於補查 transaction 細節。

建議 query：

```text
transactionId=1234567890123456789
```

注意：

- `transactionId` 必須保持 string。
- proxy 不做最終付款成功判斷。
- Vercel 才能比對本地 payment / product order。

## 五、安全規則

### LINE Pay key

- LINE Pay Channel Secret 放在 proxy server env。
- LINE Pay Channel Secret 不放在 Vercel。
- LINE Pay Channel Secret 不放在 repo。
- LINE Pay Channel Secret 不放在 docs。
- LINE Pay Channel Secret 不貼聊天室。
- LINE Pay Channel Secret 不出現在 terminal log。
- LINE Pay Channel Secret 不出現在測試檔。

### Vercel 呼叫 proxy

Vercel 呼叫 proxy 必須有 server-to-server auth：

- 內部 shared secret；或
- HMAC request signature；或
- 其他明確的 API auth。

最低要求：

- proxy 不接受未授權呼叫。
- proxy endpoint 不給瀏覽器直接呼叫。
- proxy response 不回傳 LINE Pay Channel Secret。
- proxy response 不回傳內部 auth secret。
- proxy log 不記錄完整 secret。

### IP 白名單

- LINE Pay 後台白名單填 proxy 固定 IP `/32`。
- 不填 Vercel 網域。
- 不填老師本機 IP 作為 production IP。
- 不填 LINE Pay IP。
- 不填 Supabase IP。
- 不填 NewebPay IP。

### 資料最小化

Vercel 傳給 proxy 的資料應只包含呼叫 LINE Pay 必要資料：

- `orderId`
- `transactionId`
- amount
- currency
- LINE Pay request / confirm 必要 body

不傳：

- Supabase service role key
- 客戶電話
- 客戶 email
- 客戶地址
- NewebPay TradeInfo
- NewebPay TradeSha
- HashKey / HashIV
- 信用卡資料

## 六、部署選項

### 優先評估

#### AWS Lightsail + Static IP

- 可用低成本 VPS 作 payment proxy。
- LINE Pay 白名單填 Lightsail Static IP `/32`。
- Vercel 呼叫 Lightsail proxy。
- Lightsail proxy 呼叫 LINE Pay。
- 需要維護 server、部署、防火牆、log 與安全更新。

#### DigitalOcean Droplet + Reserved IP

- 可用低成本 Droplet 作 payment proxy。
- LINE Pay 白名單填 Reserved IP `/32`。
- Vercel 呼叫 Droplet proxy。
- Droplet proxy 呼叫 LINE Pay。
- 需要確認 outbound traffic 是否穩定走 Reserved IP。

### 暫不建議

#### Vercel Static IP

- 技術上可行，維運簡單。
- 成本較高。
- 目前只為 LINE Pay fixed IP 需求啟用，投資報酬不佳。

#### 本機 IP

- 可短期用於 sandbox 探索。
- 不適合 production。
- 本機 IP 可能變動。
- confirmUrl / cancelUrl 需要可由 LINE Pay 導回，不一定能直接使用本機。

## 七、建議資料流

### Request payment

```text
cart click
→ Vercel 建立 product_order
→ Vercel 建立 provider=line_pay pending payment
→ Vercel 組 LINE Pay request payload
→ Vercel 呼叫 proxy POST /line-pay/request
→ proxy 呼叫 LINE Pay request API
→ proxy 回傳 transactionId / paymentUrl
→ Vercel 寫入 request metadata
→ Vercel 回 paymentUrl.web 給前端
→ 前端導向 LINE Pay
```

### Confirm payment

```text
LINE Pay redirect confirmUrl
→ Vercel 接 orderId / transactionId
→ Vercel 讀 pending line_pay payment
→ Vercel 讀 product_order
→ Vercel 呼叫 proxy POST /line-pay/confirm
→ proxy 呼叫 LINE Pay confirm API
→ proxy 回傳 confirm response
→ Vercel 做 outcome guard
→ 必要時 Vercel 呼叫 proxy 查 status / details
→ outcome 安全才 mark paid
→ Vercel sync product_orders
→ Vercel redirect /cart?linePay=success / pending / error
```

### Cancel payment

```text
LINE Pay redirect cancelUrl
→ Vercel 接 orderId / transactionId
→ Vercel 寫 cancel metadata
→ Vercel 不改 payment.status
→ Vercel 不改 product_orders
→ Vercel redirect /cart?linePay=canceled / error
```

cancel route 不需要呼叫 proxy，除非後續 LINE Pay 官方文件要求補查狀態。

## 八、下一步建議

- 22J-11：選定 AWS Lightsail 或 DigitalOcean。
- 22J-12：建立 proxy 專案 skeleton。
- 22J-13：proxy LINE Pay request API helper。
- 22J-14：proxy LINE Pay confirm API helper。
- 22J-15：Vercel 改成呼叫 proxy，不直接呼叫 LINE Pay。

## 九、禁止事項

- 不要把 LINE Pay Channel Secret 放進 repo。
- 不要把 LINE Pay Channel Secret 放進 docs。
- 不要把 LINE Pay Channel Secret 貼到聊天室。
- 不要把 Supabase service role 放到 proxy，除非另行設計。
- 不要讓 proxy 直接 mark paid。
- 不要讓 proxy 直接 sync `product_orders`。
- 不要讓 proxy 處理 NewebPay。
- 不要啟用藍新 MPG `LINEPAY=1`。
- 不要把真實 transactionId / orderId / paymentId 寫進文件。
- 不要把個資、電話、email、地址寫進文件。
- 不要放測試卡號。
- 不要放 NewebPay HashKey / HashIV。
- 不要放 TradeInfo / TradeSha。
