# LINE Pay Sandbox Test Decision

本文件整理 LINE Pay sandbox 測試前可選的三種路線，以及目前建議與使用者需要回覆的選項。本文件不放任何 key 真值、不呼叫 LINE Pay API、不測試付款、不更新 DB，也不代表已經開始 sandbox 測試。

## 一、路線 A：本機 Sandbox 測試

### 說明

- 使用本機啟動 Next.js。
- LINE Pay 後台付款伺服器 IP 白名單填本機當下公網 IP `/32`。
- Key 只填在 `.env.local`。
- 不把 key 貼聊天室。

### 優點

- 最快開始測。
- 不需要先改 production 部署架構。
- 適合早期確認 request / confirm / cancel 流程是否能跑通。

### 缺點

- 本機 IP 可能會變。
- 不適合 production。
- 如果本機無法被 LINE Pay redirect 回來，需要額外處理公開網址。

### 需要確認

- 本機可對外接收 `confirmUrl` / `cancelUrl` 嗎？
- 若本機不能被 LINE Pay 導回，是否需要 ngrok / tunnel？
- Tunnel 網址是否可作 `confirmUrl` / `cancelUrl`？
- 付款伺服器實際 outbound IP 是本機還是 tunnel 服務？
- 若 outbound API 從本機發出，LINE Pay IP 白名單應使用本機當下公網 IP `/32`。
- 若 outbound API 由 tunnel / proxy 服務發出，需確認 LINE Pay 看到的來源 IP，不可猜測。

## 二、路線 B：Vercel Sandbox 測試

### 說明

- 使用 Vercel Preview / Production 測試環境。
- Key 填 Vercel Environment Variables。
- `confirmUrl` / `cancelUrl` 使用 Vercel 網址。
- 需要固定 outbound IP 才能填 LINE Pay IP 白名單。

### 優點

- 更接近未來 production 流程。
- `confirmUrl` / `cancelUrl` 可使用公開 Vercel 網址。
- 前端與後端在接近正式部署的環境中測試。

### 缺點

- 若沒有固定 outbound IP，不能亂填 LINE Pay IP 白名單。
- 需要確認 Vercel plan 與網路功能。
- 可能需要啟用 Static IPs 或 Secure Compute。

### 需要確認

- Vercel plan 是否支援 Static IPs。
- 是否啟用 Static IPs 或 Secure Compute。
- 沒有固定 outbound IP 時，不可亂填 IP。
- Preview / Production 測試環境使用的 `LINE_PAY_ENV` 是否為 `sandbox`。
- Sandbox key 是否只填在 Vercel Environment Variables，不貼到聊天室。

## 三、路線 C：固定 IP Payment Server / Proxy

### 說明

- LINE Pay request / confirm / status API 由固定 IP server 或 proxy 發出。
- Next.js 站台可仍在 Vercel。
- Payment server 負責 LINE Pay outbound API。
- 適合 production。

### 優點

- 可以明確提供穩定固定 outbound IP。
- 適合 LINE Pay IP allowlist 與 production sign-off。
- 可把金流 outbound API 集中在受控環境。

### 缺點

- 需要新增或維護 payment server / proxy。
- 需要重新規劃 secret 存放與呼叫邊界。
- 可能增加部署、監控與維運成本。

### 需要確認

- 要不要新增 payment server。
- Payment server 網域與 IP。
- 安全性與 secret 存放位置。
- 是否增加維護成本。
- Next.js 與 payment server 之間如何驗證請求。

## 四、目前建議

- 若只是先驗證流程，可先選 A，但要確認 `confirmUrl` / `cancelUrl` 能回到本機測試服務。
- 若要接近正式環境，應選 B 或 C。
- Production 不建議用本機 IP。
- 沒有固定 outbound IP 前，不進 production sign-off。
- 不管選哪條路，Channel Secret 都不得貼到聊天室，也不得寫進文件、commit 或測試檔。

## 五、使用者要回覆的選項

請使用者只回覆其中一個：

```text
A：先用本機 sandbox 測試
B：用 Vercel sandbox 測試
C：先規劃固定 IP payment server / proxy
D：暫停 LINE Pay 測試
```

若選 A，下一步需確認本機公開網址、`confirmUrl` / `cancelUrl` 與本機當下公網 IP。

若選 B，下一步需確認 Vercel plan、Static IPs / Secure Compute 是否可用，以及測試環境網址。

若選 C，下一步需先做 payment server / proxy 架構設計，不直接改金流流程。

若選 D，LINE Pay 測試暫停，保留目前文件與程式碼狀態。

## 六、禁止事項

- 不要放 Channel Secret。
- 不要放 production env 真值。
- 不要放 sandbox env 真值。
- 不要放真實 `transactionId` / `orderId` / `paymentId`。
- 不要放個資。
- 不要放測試卡號。
- 不要放藍新 HashKey / HashIV。
- 不要放 TradeInfo / TradeSha。
- 不要啟用藍新 `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。
- 不要猜 IP。
- 不要填 LINE Pay 後台。
- 不要呼叫 LINE Pay API。
- 不要手動測試付款。
