# LINE Pay IP Whitelist Readiness

本文件整理 LINE Pay 後台「管理付款伺服器 IP」欄位要填什麼、目前 repo 內可判斷的部署線索，以及正式填寫前還缺哪些資料。本文件不填 IP、不猜 IP、不呼叫 LINE Pay API、不登入 Vercel、不讀取任何 env 真值。

## 一、這個 IP 是什麼

LINE Pay 後台的付款伺服器 IP 是：

- 商店付款伺服器呼叫 LINE Pay API 時的對外公網 IP。

它不是：

- 使用者 IP。
- 老師電腦的內網 IP。
- LINE Pay IP。
- Supabase IP。
- 藍新 IP。
- 網域名稱。
- `confirmUrl` / `cancelUrl` 的 URL。

換句話說，這個 IP 要代表「本網站後端 server 呼叫 LINE Pay request / confirm / status / details API 時，LINE Pay 看到的來源 IP」。

## 二、目前專案誰會呼叫 LINE Pay API

目前專案中，會由後端呼叫 LINE Pay API 的流程是：

- `POST /api/product-orders/line-pay/request`
  - 建立 product order LINE Pay request。
  - 呼叫 LINE Pay request payment API。

- `GET /api/product-orders/line-pay/confirm`
  - 接 LINE Pay redirect 回來的 `orderId` / `transactionId`。
  - 呼叫 LINE Pay confirm API。

- LINE Pay status / payment details helper
  - Confirm API 遇 `1172` / `1198` / timeout 時，用來查 request status / payment details。

因此，真正需要確認 outbound IP 的地方，是上述後端 API 實際部署與執行的環境。

## 三、目前部署環境盤點

本包只檢查 repo 內線索，不登入 Vercel、不呼叫 Vercel API、不讀 Vercel env。

- `vercel.json`：repo 根目錄目前未看到 `vercel.json`。
- `package.json`：
  - `dev`: `next dev`
  - `build`: `next build --webpack`
  - `start`: `next start`
  - `lint`: `eslint src`
- Repo docs：
  - `docs/supabase-setup.md` 提到網站部署到 Vercel，網域接到 Vercel，Supabase 作為資料庫。
  - LINE Pay 相關文件提到 Vercel Environment Variables 作為 key 填寫位置。
  - LINE Pay production sign-off 文件已列出「對外 IP 設定確認」。
- 目前 repo 內不能判斷：
  - Production 是否確定部署在 Vercel。
  - Vercel 專案是否有固定 outbound IP。
  - Sandbox 測試會由本機、Vercel preview、Vercel production，或其他 payment server 呼叫 LINE Pay API。

## 四、Vercel 預設狀態

依 Vercel 官方文件，預設 Vercel deployments 可能來自任意 IP；因此，Vercel 預設部署的 outbound IP 不應視為固定可白名單 IP。

LINE Pay IP 白名單不能這樣填：

- 不可直接猜測 Vercel outbound IP。
- 不可把網站網域當成付款伺服器 IP。
- 不可填老師本機 IP 作為 production IP。
- 不可填 LINE Pay IP。
- 不可填 Supabase IP。
- 不可填藍新 IP。

若 production LINE Pay request / confirm / status / details API 由 Vercel Functions 發出，就必須先確認 Vercel 專案是否啟用固定 outbound IP 方案。

## 五、Vercel 可用方案

以下只整理官方方案方向，不代表本專案已啟用，也不代表已查過 Vercel 專案設定。

### 1. Static IPs

- 用途：固定 outbound egress IP，適合需要第三方 API / 後端服務 IP allowlist 的情境。
- 適用：Vercel Pro / Enterprise。
- 重點：這是 outbound IP，不是 inbound 固定 IP。
- 可用於 LINE Pay「管理付款伺服器 IP」這類 allowlist 情境，因為 LINE Pay 要確認的是商店付款伺服器呼叫 LINE Pay API 時的來源 IP。
- 官方文件：`https://vercel.com/docs/networking/static-ips`

### 2. Secure Compute

- 用途：Dedicated network / dedicated static IP / NAT Gateway。
- 適用：Vercel Enterprise。
- 適合需要更高隔離、VPC peering、完整網路控制，或希望每個環境使用更完整 dedicated network 設計的情境。
- 若只需要 IP allowlisting，官方文件也提示可先評估 Static IPs；若需要 dedicated infrastructure、VPC peering 或完整隔離，再評估 Secure Compute。
- 官方文件：`https://vercel.com/docs/networking/secure-compute`

## 六、目前決策

- 若正式 production 繼續放在 Vercel，必須先確認是否啟用 Vercel Static IPs 或 Secure Compute。
- 若沒有固定 outbound IP，不能直接進 production sign-off。
- 若只是本機 sandbox 測試，可以暫時填本機當下公網 IP，但不適合正式環境。
- 最終 production 必須使用穩定固定 outbound IP。
- 若 LINE Pay 後台要求 IP 白名單，而目前部署平台無法提供固定 outbound IP，應先暫停 production 開放，改成先確認固定 egress 架構。
- 任何 production IP 填寫前，都應先回報使用者確認，不可由 Codex 自行填寫。

## 七、IP 白名單待確認事項

正式填 LINE Pay 後台前，需要逐項確認：

- [ ] 目前 production 是否部署在 Vercel。
- [ ] 實際呼叫 LINE Pay API 的後端環境是哪裡。
- [ ] Vercel 專案是否有固定 outbound IP。
- [ ] Vercel plan 是否支援 Static IPs。
- [ ] 是否要啟用 Vercel Static IPs。
- [ ] 是否需要 Secure Compute。
- [ ] 若沒有固定 outbound IP，是否需要固定 IP proxy。
- [ ] 若沒有固定 outbound IP，是否需要獨立 payment server。
- [ ] 若沒有固定 outbound IP，是否需要 NAT / egress fixed IP。
- [ ] 若沒有固定 outbound IP，是否有其他可固定 outbound IP 的方案。
- [ ] Sandbox 測試要用哪個環境打 LINE Pay API。
- [ ] Production 要用哪個環境打 LINE Pay API。
- [ ] LINE Pay 後台 Mask value 若是單一 IP，通常填 `/32`。
- [ ] 不可在沒有固定 IP 前亂填。
- [ ] 不可把網域名稱填進 IP 欄位。
- [ ] 不可把使用者當下網路 IP 當成 production payment server IP。

## 八、Codex 可查但不可做的事

Codex 可以：

- 查 repo 文件。
- 查部署設定檔。
- 查官方文件連結。
- 整理可能方案。
- 協助製作待確認清單。

Codex 不可以：

- 不要填 LINE Pay 後台。
- 不要讀取 key。
- 不要讀 `.env.local`。
- 不要讀 production env。
- 不要呼叫 LINE Pay API。
- 不要呼叫 Vercel API。
- 不要 deploy。
- 不要 push。
- 不要猜測並填入 IP。

## 九、下一步待使用者確認

- [ ] 目前網站 production 是否確定部署在 Vercel。
- [ ] Vercel plan 是否支援 Static IPs。
- [ ] 是否要啟用 Vercel Static IPs。
- [ ] 是否需要改用固定 IP payment server / proxy。
- [ ] LINE Pay sandbox 要先用本機測試，還是用 Vercel 測試環境。
- [ ] 若用 Vercel 測試環境，該環境是否也有固定 outbound IP。

## 十、下一步建議

- `22J-7`：由使用者確認部署平台與是否有固定 outbound IP。
- `22K-1`：使用者自行填 sandbox key 與 sandbox IP 白名單後，做 sandbox smoke test。
- `22K-2`：sandbox 成功付款測試。
- `22K-3`：sandbox 取消付款測試。

## 十一、禁止事項

- 不要填 LINE Pay 後台。
- 不要猜 IP。
- 不要填網域。
- 不要填 LINE Pay IP。
- 不要填 Supabase IP。
- 不要填藍新 IP。
- 不要讀 key。
- 不要輸出 secret。
- 不要呼叫 LINE Pay API。
- 不要 deploy。
- 不要 push。
- 不要修改 NewebPay 既有流程。
- 不要啟用藍新 `LINEPAY=1`。

## 十二、文件安全要求

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
