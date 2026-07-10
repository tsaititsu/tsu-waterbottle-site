# 紫微占卜 ReturnURL 結果頁與續跑修正（2026-07-10）

## 現象與根因

NewebPay Notify 已成功驗證付款，payment 也已更新為 paid，divination reading 同步完成；但付款完成後實際命中的是：

```text
POST /payment/newebpay/return
```

這個網址原本只有泛用付款結果 page。先前的占卜導向邏輯則位於另一支 `/api/payments/newebpay/return`，因此 production POST 沒有查詢本地 payment，也沒有導向本次占卜結果頁。

## ReturnURL 修正

`/payment/newebpay/return` 現在是實際接收 POST 的 Route Handler：

1. 從 NewebPay form body 讀取 `MerchantOrderNo`。
2. 只用該編號查詢本地 payments，不採信 query string 傳入的 reading id。
3. 確認 payment 的 provider 為 `newebpay`、item type 為 `ai_divination`，且本地 `item_id` 是合法 reading UUID。
4. 回傳 HTTP `303 See Other`，導向 `/ai-divination/result/<readingId>?payment=success`。

ReturnURL 只負責安全導頁，不會 mark paid。正式付款結果仍以 Notify 或其他可信任查詢結果為準。

### 為何使用 303

NewebPay ReturnURL 是 POST。`307`／`308` 會保留原本 HTTP method，可能把 POST 再送到結果頁；`303 See Other` 會讓瀏覽器改用 GET 開啟結果頁，符合付款完成後的導頁用途。

## 泛用付款結果頁

非紫微占卜 payment 仍回到泛用付款確認流程。泛用畫面已移到 `/payment/newebpay/result`，CTA 改為中性的「返回網站」。

畫面不再顯示完整 `MerchantOrderNo`，也不顯示 TradeNo、paymentId、raw payload、TradeInfo 或 TradeSha。

## 既有 paid reading 續跑

既有已付款但尚未解讀的 reading 不需要再次付款。

本人進入 `/ai-divination/result/<readingId>` 後：

- `pending_payment`：只顯示正在確認付款，不啟動解讀。
- `paid`：server 從 DB 取得 question、card、position 與 draw mode，再次驗證本地 payment 為同一使用者、同一 reading、`provider=newebpay`、`status=paid`，才原子更新為 `interpreting` 並開始解讀。
- `interpreting`：輪詢狀態，不開第二個 OpenAI request。
- `completed`：直接顯示既有 interpretation，重新整理也不重跑 OpenAI。
- `failed`：告知付款已完成但解讀暫時未完成，不要求再次付款，也不自動無限重試。

結果頁不依賴 sessionStorage，也不接受 client 重傳問題或牌卡內容。非 reading 本人一律視為找不到。

## 會員紀錄入口

付款完成後應返回本次解讀頁，而不是只停留在會員紀錄列表。會員紀錄是日後再次觀看入口，不是付款完成當下的主要 landing page。

`/account/divinations` 現在提供：

- completed：查看解讀
- paid：繼續產生解讀
- interpreting：查看解讀進度
- pending_payment：顯示尚未完成付款，不提供重新付款入口

既有 paid reading 必須在會員紀錄列表清楚顯示「繼續產生解讀」。會員紀錄列表也是付款返回失敗時的安全恢復入口，使用者可由該按鈕回到本次結果頁續跑解讀，不可要求客戶重新付款。列表在瀏覽器返回或重新顯示時會重新讀取最新狀態，不採用無限輪詢。

## 本包安全界線

- 未修改 production DB。
- 未手動修改 payment 或 reading 狀態。
- 未呼叫真實 OpenAI API。
- 未呼叫真實 NewebPay API。
- 未刷卡。
- 未執行 SQL。
- Apple Pay NT$1 與正式信用卡 NT$50 共用同一個本地 payment 對應與結果頁流程。
