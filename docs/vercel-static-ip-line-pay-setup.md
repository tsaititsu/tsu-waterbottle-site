# Vercel Static IP + LINE Pay IP Whitelist Setup

本文件整理 Vercel Static IP 與 LINE Pay「管理付款伺服器 IP」設定前的操作準備。它只作為人工操作指南，不代表已開啟 Vercel Static IP、不代表已操作 LINE Pay 後台，也不包含任何 LINE Pay key、production env 真值、sandbox env 真值或真實交易資料。

## 一、Vercel Static IP 要到哪裡開

請由使用者在 Vercel Dashboard 手動確認：

```text
Vercel Project
→ Project Settings
→ Networking
→ Static IPs
```

注意：

- 不要由 Codex 自動開啟。
- 不要呼叫 Vercel API。
- 不要用 CLI 自動操作。
- 不要在尚未確認費用與 project 前開啟。

## 二、開啟前要確認

開啟 Static IPs 前，請先人工確認：

- [ ] 目前方案是 Pro。
- [ ] Static IPs 可能會產生費用。
- [ ] 已選擇正確 Vercel project。
- [ ] 已選擇正確環境或 region，如 Vercel 後台有此選項。
- [ ] 確認這個 project 是實際會呼叫 LINE Pay API 的後端部署。
- [ ] 確認 LINE Pay request / confirm / status / details API 會從這個環境 outbound。
- [ ] 不要自動開啟，要由使用者在 Vercel 後台手動確認。

## 三、開啟後要記錄

開啟後只需記錄跟 IP 白名單有關的資訊：

- Vercel 顯示的 outbound static IP。
- 適用的 project。
- 適用的環境或 region，如 Vercel 後台有顯示。
- 設定日期。

不要記錄：

- LINE Pay Channel Secret。
- LINE Pay Channel ID 真值，除非已遮蔽。
- 任何完整 key。
- Production env 真值。
- Sandbox env 真值。
- 真實交易資料。

## 四、LINE Pay 後台 IP 白名單填法

請由使用者在 LINE Pay 商店後台手動操作：

```text
LINE Pay 商店後台
→ 開發者工具
→ 管理付款伺服器 IP
```

填寫規則：

- IP：填 Vercel outbound static IP。
- Mask：填 `32`。
- 不要填網域。
- 不要填本機 IP。
- 不要填 LINE Pay IP。
- 不要填 Supabase IP。
- 不要填藍新 IP。
- 不要填老師電腦內網 IP。
- 不要填 `confirmUrl` / `cancelUrl`。

如果 Vercel 尚未提供固定 outbound static IP，請先暫停，不要猜 IP。

## 五、使用者回報格式

使用者完成人工操作後，只需要回報：

```text
Vercel Static IP / LINE Pay IP 白名單設定回報

- Vercel Static IP 是否已開啟：是 / 否
- Static IP 是否已填入 LINE Pay 白名單：是 / 否
- Mask 是否填 32：是 / 否
- 使用的測試路線：A 本機 / B Vercel / C payment server / D 暫停
- 備註：
```

請不要回報：

- LINE Pay Channel Secret。
- 完整 LINE Pay key。
- Production env 真值。
- Sandbox env 真值。
- 未遮蔽的 `transactionId` / `orderId` / `paymentId`。
- 個資。

## 六、正式測試前提醒

- Vercel Static IP 是 outbound IP，用來讓 LINE Pay 辨識本網站後端呼叫 LINE Pay API 的來源。
- 網站網域不是付款伺服器 IP。
- 本機 IP 不適合作為 production IP。
- 沒有固定 outbound IP 前，不要進 production sign-off。
- 不要啟用藍新 MPG `LINEPAY=1`。
- NewebPay 既有流程維持不變。

## 文件安全要求

- 不放 Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放真實 `transactionId` / `orderId` / `paymentId`。
- 不放個資。
- 不放測試卡號。
- 不放藍新 HashKey / HashIV。
- 不放 TradeInfo / TradeSha。
