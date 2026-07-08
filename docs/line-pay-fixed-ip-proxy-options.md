# LINE Pay Fixed IP Proxy Options

本文件只評估 LINE Pay 官方金流在需要固定 outbound IP 時的低成本 payment proxy 方案。  
本輪不代表已採用、已部署、已填白名單、已呼叫 LINE Pay API，且不包含任何 key 或 production env 真值。

## 1. 背景

LINE Pay 後台的付款伺服器 IP 白名單，應填寫「商店付款伺服器呼叫 LINE Pay API 時的對外公網 IP」。

這不是：

- 使用者 IP
- 本機內網 IP
- 網站網域名稱
- LINE Pay IP
- Supabase IP
- NewebPay IP

目前商品 LINE Pay 架構已經把業務邏輯放在 Vercel / Next.js：

- 建立 `product_orders`
- 建立 `payments`
- mark paid
- sync `product_orders`
- 讀寫 Supabase

若 production 需要穩定固定 outbound IP，但 Vercel Static IP 成本不適合目前階段，可以考慮把「呼叫 LINE Pay API」抽成固定 IP payment proxy。

## 2. 推薦架構

```text
Vercel cart / API
→ fixed IP payment proxy
→ LINE Pay API
```

分工建議：

- Vercel 保留 `product_orders` / `payments` / mark paid / Supabase 邏輯。
- proxy 只負責呼叫 LINE Pay request / confirm / status / payment details API。
- proxy 不保存商品訂單主資料。
- proxy 不直接 mark paid。
- proxy 不直接更新 `product_orders`。
- proxy 不放 Supabase service role，除非後續另行設計並通過安全盤點。
- LINE Pay key 不貼到聊天室、不寫進文件、不寫進 commit。
- LINE Pay 白名單填 proxy 固定 IP，Mask 使用 `/32`。

## 3. 方案比較

| 方案 | 成本方向 | 維護量 | 適合度 | 本階段建議 |
| --- | --- | --- | --- | --- |
| Vercel Static IP | 高 | 低 | 最貼近現有部署 | 成本高，目前不建議 |
| AWS Lightsail + Static IP | 低 | 中 | 適合小型 payment proxy | 推薦優先評估 |
| DigitalOcean Droplet + Reserved IP | 低 | 中 | 適合小型 payment proxy | 可作為 Lightsail 替代 |
| Render Dedicated Outbound IP | 中到高，需確認 | 低到中 | 適合偏 managed 的 proxy | 備選方案 |

## 4. Vercel Static IP

### 優點

- 最少架構變更，仍由 Vercel Functions 直接呼叫 LINE Pay。
- 不需要額外 payment proxy server。
- 官方支援 static outbound egress IP，適合第三方 API IP allowlist。
- 與目前 Vercel deployment 流程一致。

### 缺點

- Vercel 官方文件標示 Pro 專案使用 Static IPs 需額外月費，且會有 Private Data Transfer 費用。
- Static IPs 是 outbound egress IP，不是 inbound 固定 IP。
- 若只為 LINE Pay 單一金流串接啟用，成本相對高。
- 若未啟用 Static IPs 或 Secure Compute，不可猜測 Vercel outbound IP，也不可把網站網域填入 LINE Pay 白名單。

### 判斷

Vercel Static IP 技術上最乾淨，但成本高，不建議目前採用。若未來交易量與維運需求增加，再重新評估。

## 5. AWS Lightsail + Static IP

### 架構

```text
Vercel cart / API
→ AWS Lightsail payment proxy
→ LINE Pay API
```

LINE Pay 白名單：

```text
Lightsail Static IP / 32
```

### 優點

- Lightsail 是低成本 VPS 方案，月費可預期。
- Lightsail Static IP 可綁定 instance，適合提供穩定 outbound IP。
- proxy 架構簡單，可只開少量 LINE Pay API endpoint。
- Vercel 仍保留既有 product order / payment / Supabase 邏輯。

### 缺點

- 需要維護一台小型 server。
- 需要處理 OS 更新、防火牆、部署、監控、log、安全設定。
- proxy 需要安全驗證，避免被外部濫用。
- 若 instance 停用或 IP 未正確綁定，白名單會失效。

### 適合做法

- proxy 只接收 Vercel server-to-server 請求。
- proxy 驗證 shared secret 或簽章。
- proxy 使用 LINE Pay Channel ID / Secret 呼叫 LINE Pay。
- proxy 回傳 LINE Pay response 給 Vercel。
- Vercel 再決定是否更新 metadata / mark paid / sync product order。
- 不把 Supabase service role 放到 proxy。

### 判斷

AWS Lightsail + Static IP 是目前低成本固定 IP payment proxy 的優先候選方案。

## 6. DigitalOcean Droplet + Reserved IP

### 架構

```text
Vercel cart / API
→ DigitalOcean Droplet payment proxy
→ LINE Pay API
```

LINE Pay 白名單：

```text
DigitalOcean Reserved IP / 32
```

### 優點

- Droplet 成本低，適合小型 proxy。
- Reserved IP 指派到 Droplet 時可作為穩定 public IP。
- DigitalOcean 文件支援設定 outbound traffic 走 Reserved IP。
- 架構與 Lightsail 類似，Vercel 可保留既有業務邏輯。

### 缺點

- 需要維護 VPS。
- Reserved IP 若要作為 outbound 來源，需確認並設定 Droplet route / gateway。
- 需要處理 OS 更新、防火牆、部署、監控、log、安全設定。
- proxy 需要額外保護，避免被外部濫用。

### 適合做法

- Droplet 只作 LINE Pay payment proxy。
- LINE Pay 白名單填 Droplet 的 Reserved IP `/32`。
- Vercel 呼叫 Droplet proxy。
- Droplet proxy 呼叫 LINE Pay。
- Vercel 保留 `payments` / `product_orders` / mark paid / sync 邏輯。

### 判斷

DigitalOcean Droplet + Reserved IP 也是低成本可行方案。若團隊熟悉 DigitalOcean，這會是 Lightsail 的同級替代方案。

## 7. Render Dedicated Outbound IP

### 架構

```text
Vercel cart / API
→ Render service with dedicated outbound IP
→ LINE Pay API
```

LINE Pay 白名單：

```text
Render dedicated outbound IP / 32
```

若 Render 提供的是一組多個 dedicated outbound IP，需依 LINE Pay 後台規則確認是否能填多筆 IP。

### 優點

- 比 VPS 更偏 managed，可能降低 OS 維護成本。
- Render 支援 dedicated outbound IP，可用於第三方 API allowlist。
- 適合不想自行管理 VPS 的情境。

### 缺點

- 需要確認 Render plan 與 dedicated outbound IP 價格。
- Dedicated IP 可能是一組 IP，不一定只有單一 IP。
- 仍需要部署與維護 proxy service。
- 仍需設計 Vercel 與 proxy 之間的安全驗證。

### 判斷

Render dedicated outbound IP 可作為替代方案，但需先確認價格、方案限制、IP 數量與 LINE Pay 後台白名單規則。

## 8. 目前推薦

目前不建議優先採用 Vercel Static IP，原因是成本高，且 LINE Pay 目前仍處於 sandbox / sign-off 前準備階段。

較適合的低成本路線：

1. AWS Lightsail + Static IP
2. DigitalOcean Droplet + Reserved IP
3. Render dedicated outbound IP

推薦第一版方向：

```text
Vercel cart / API
→ low-cost fixed IP payment proxy
→ LINE Pay API
```

並維持以下原則：

- proxy 只負責呼叫 LINE Pay。
- LINE Pay Channel Secret 不貼到聊天室。
- LINE Pay Channel Secret 不寫進文件。
- LINE Pay Channel Secret 不寫進 commit。
- LINE Pay 白名單填 proxy 固定 IP `/32`。
- Vercel 保留 `product_orders` / `payments` / mark paid / Supabase 邏輯。
- 不把 Supabase service role 放到 proxy，除非後續另行設計。
- 不使用藍新 MPG `LINEPAY=1`。
- NewebPay 保持 `provider=newebpay`。
- LINE Pay 官方金流保持 `provider=line_pay`。

## 9. 後續小包建議

- 22J-10：固定 IP proxy API boundary 設計文件，不寫程式。
- 22J-11：Vercel 與 proxy 間 server-to-server auth 設計。
- 22J-12：proxy 不持有 Supabase service role 的資料流設計。
- 22K-1：選定 sandbox 測試路線後，由使用者自行填 key 與 IP 白名單。
- 22K-2：sandbox request / confirm / cancel 第一輪手測。

## 10. 禁止事項

- 不要把 LINE Pay Channel Secret 貼到聊天室。
- 不要把 production env 真值寫進文件。
- 不要把 sandbox env 真值寫進文件。
- 不要把 Supabase service role 放到 proxy，除非另行設計。
- 不要把真實 transactionId / orderId / paymentId 寫進文件。
- 不要把個資、電話、email、地址寫進文件。
- 不要放測試卡號。
- 不要放 NewebPay HashKey / HashIV。
- 不要放 TradeInfo / TradeSha。
- 不要啟用藍新 MPG `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。

## 11. 官方參考

- Vercel Static IPs: https://vercel.com/docs/networking/static-ips
- Vercel Secure Compute: https://vercel.com/docs/networking/secure-compute
- AWS Lightsail static IP addresses: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-static-ip-addresses-in-amazon-lightsail.html
- AWS Lightsail pricing: https://aws.amazon.com/lightsail/pricing/
- DigitalOcean Reserved IP pricing: https://docs.digitalocean.com/products/networking/reserved-ips/details/pricing/
- DigitalOcean outbound traffic over Reserved IP: https://docs.digitalocean.com/products/networking/reserved-ips/how-to/outbound-traffic/
- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets
- Render outbound IP addresses: https://render.com/docs/outbound-ip-addresses
- Render dedicated IPs: https://render.com/docs/dedicated-ips
