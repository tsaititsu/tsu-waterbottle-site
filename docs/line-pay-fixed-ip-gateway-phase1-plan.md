# LINE Pay Fixed IP Gateway Phase 1 執行計畫

SOL 模式：極高
Codex 任務等級：極高

## 目標

在不啟用正式付款、不部署、不搬移 LINE Pay Channel Secret 的前提下，建立可獨立部署的固定 IP Gateway，並讓網站 LINE Pay SDK 可明確選擇 direct 或 gateway transport。

## 不包含的範圍

- 不恢復購物車 LINE Pay 入口。
- 不修改付款成功資料庫交易、Migration、Production 或 DigitalOcean。
- 不實作退款、請款取消或自動重試。
- 不 commit、push 或建立 PR。

## 現況

- `src/lib/linePay` 已有 request、confirm、status、payment details 與官方簽章。
- 商品訂單已有 request／confirm／cancel route；LINE Pay 入口目前停用。
- 固定 IP proxy 只有設計與成本文件，沒有 Gateway 程式或 transport。

## PR 合併風險

- [x] 高風險：付款／訂單與安全邊界

## 執行步驟

1. 抽出 direct／gateway 統一 transport，加入 fail-closed 設定與 timeout。
2. 建立固定 operation Gateway、HMAC、replay cache、rate limit、Docker 與安全日誌。
3. 新增網站與 Gateway 測試，執行 typecheck、lint、build 與差異稽核。

## 資料庫影響

- Migration：否。
- Policy／正式資料：否。
- Supabase：不修改。

## 安全影響

- 接觸付款 transport 與內部 HMAC 邊界。
- 新增 server-only Gateway 環境變數名稱，不寫入真值。
- LINE Pay Channel Secret 第一階段仍由網站使用，Gateway 只轉送已簽章 headers。

## 測試計畫

- Gateway：HMAC、時間窗、replay、operation、body limit、timeout、非 JSON、安全日誌。
- 網站：direct 回歸、gateway request／confirm／status／details、timeout、fail closed、transactionId string。
- 專案：既有 LINE Pay 測試、typecheck、lint、build、`git diff --check`。

## 回復方式

移除 Gateway 目錄與 transport 新檔，將四個 LINE Pay client、barrel export 與 `.env.example` 還原至本任務前版本。由於入口預設未啟用且沒有資料庫變更，回復不需要資料修復。
