# 紫微占卜付款後返回本次解讀頁流程

本文件記錄 22J-48 的修正目標與安全規則。付款完成後應返回本次解讀頁，而不是只停留在會員紀錄列表。會員紀錄是日後再次觀看入口，不是付款完成當下的主要 landing page。

## 目的

- Apple Pay / 信用卡付款完成後，使用者要回到本次占卜解讀畫面。
- 手機跳轉付款、Safari / LINE 內建瀏覽器回收分頁、重新整理頁面後，仍可依 reading id 從 DB 恢復狀態。
- 不依賴 `sessionStorage` 保存付款後解讀所需的問題與牌卡資料。
- 不要求使用者重新抽牌、重新付款或到會員列表找紀錄。

## 修正後流程

1. 使用者填寫問題並建立 pending reading。
2. 使用者確認牌卡後，建立 NewebPay payment 前，server 先把 `card_id` / `card_name` / `position` 補寫進 reading。
3. 建立 provider=`newebpay` pending payment。
4. 使用者前往 NewebPay 完成 Apple Pay 或信用卡付款。
5. NewebPay ReturnURL 回到網站。
6. ReturnURL 只使用本地可信任 `merchantOrderNo -> payment -> itemId` 關聯找出 readingId。
7. 網站導向 `/ai-divination/result/<readingId>?payment=success`。
8. 結果頁讀取本人 reading。
9. `pending_payment` 顯示正在確認付款，不產生解讀。
10. `paid` 顯示付款完成並觸發 server resume interpret。
11. server 從 DB 讀取問題、牌卡、正反位、抽牌方式，驗證本人與 paid 狀態後才呼叫 OpenAI。
12. `completed` 顯示完整 interpretation，並可從 `/account/divinations` 再次觀看。

## 安全規則

- ReturnURL 不直接 mark paid。
- ReturnURL 不信任 query string 任意 `readingId`。
- 結果頁 API 必須驗證使用者已登入。
- reading 必須屬於目前登入者；非本人一律回 404。
- interpret resume 不接受 client 重新傳入 question / card / position / drawMode。
- `pending_payment` 不可呼叫 OpenAI。
- `interpreting` 不可重複開第二個 OpenAI request。
- `completed` 直接顯示既有 interpretation。
- `failed` 不自動無限重試，也不可要求再次付款。

## 牌卡資料規則

- 前往 NewebPay 前，reading DB 必須已有：
  - question
  - card_id
  - card_name
  - position
  - draw_mode
  - user_id
  - status=`pending_payment`
- client 可傳 `cardId` / `position` 作為選牌結果，但 server 會自行用 card id 查牌名，不信任 client 傳牌名。
- 若缺牌卡資料，不建立 NewebPay payment，避免付款後會員紀錄顯示「尚未抽牌」。

## 金流隔離

- Apple Pay NT$1 管理員測試與正式信用卡 NT$50 共用同一個付款後返回解讀流程。
- 本包不改 paid gate、不改付款金額、不呼叫 NewebPay API、不呼叫 OpenAI API 做實測。
- 正式 paid 仍以 Notify / QueryTradeInfo fallback 的可信任結果為準。

## 禁止事項

- 不放 NewebPay MerchantID / HashKey / HashIV 真值。
- 不放 OpenAI API key。
- 不放 production env 真值。
- 不放 TradeInfo / TradeSha。
- 不放完整 TradeNo / MerchantOrderNo / paymentId。
- 不放個資或信用卡資料。
