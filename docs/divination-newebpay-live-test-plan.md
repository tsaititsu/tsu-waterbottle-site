# Divination NewebPay Live Test Plan

本文件整理紫微占卜 NT$50 正式低金額測試指引。  
本輪只新增測試指引文件，不改程式邏輯、不呼叫藍新 API、不刷卡、不呼叫 OpenAI API 做實測、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

## 一、測試目的

- 測試紫微占卜 NT$50 NewebPay 正式付款流程。
- 確認 persisted `divination_readings` paid gate 正常運作。
- 確認 NewebPay Notify paid 後可同步 payment 與 `divination_readings` paid 狀態。
- 確認 paid 後才會呼叫 OpenAI 產生解讀。
- 確認紫微占卜 OpenAI 模型使用 `gpt-5.5`。
- 本文件只是測試指引，本輪不實刷。

## 二、測試前條件

測試前需人工確認：

- NewebPay 正式環境資料已填在正確位置。
- 文件、commit、log、聊天室都不顯示 MerchantID / HashKey / HashIV 真值。
- 紫微占卜付款入口已確認。
- 付款 provider 是 `newebpay`。
- NewebPay MPG 使用 `CREDIT=1`。
- 紫微占卜是非課程交易，應維持 `InstFlag=0`。
- 不送 NewebPay MPG `LINEPAY=1`。
- 不使用官方 LINE Pay `provider=line_pay`。
- `OPENAI_DIVINATION_MODEL=gpt-5.5`。
- `OPENAI_API_KEY` 已由使用者自行填入環境變數。
- 不把 OpenAI key 貼到聊天室、文件、commit 或測試回報。
- `ENABLE_DIVINATION_DB_READINGS` 與正式 paid gate 設定需由使用者人工確認。
- `NEXT_PUBLIC_ENABLE_NEWEBPAY` 是否開啟紫微占卜付款入口需由使用者人工確認。

## 三、正式測試流程

以下只列步驟，本文件不執行：

1. 打開紫微占卜頁。
2. 建立一筆占卜問題。
3. 建立 NT$50 NewebPay payment。
4. 確認 NewebPay 付款頁只顯示信用卡一次付清。
5. 確認 NewebPay 付款頁不顯示分期付款。
6. 確認 NewebPay 付款頁不顯示 LINE Pay。
7. 完成低金額正式刷卡。
8. 等待 NotifyURL 回到 `/api/payments/newebpay/notify`。
9. 確認 payment 狀態變為 paid。
10. 確認 `divination_readings` 同步為 paid。
11. 確認 paid gate 開放，未付狀態不再阻擋該筆 reading。
12. paid 後才產生 OpenAI 解讀。
13. 確認解讀結果保存到 `divination_readings`。
14. 確認 ReturnURL / ClientBackURL 體驗不會讓使用者困惑。
15. 確認 fallback QueryTradeInfo 可查詢付款狀態。

## 四、失敗測試流程

以下只列步驟，本文件不執行：

- 未付款不可看完整解讀。
- NotifyURL 未到或未驗證成功時，不可直接把 payment 標成 paid。
- OpenAI 失敗時要有友善錯誤提示，且 reading 不應被標成 completed。
- 重複送出不應重複扣款。
- 重複送出不應重複產生解讀或覆蓋已完成解讀。
- 假 paid、mock paid、dry-run paid 不可混入正式資料。
- 付款失敗不可產生 OpenAI 解讀。
- ReturnURL 回站不可被當成付款成功依據。
- 若 fallback QueryTradeInfo 查不到成功交易，不可 mark paid。

## 五、測試後要回報格式

正式低金額測試後，請用以下格式回報。敏感識別碼只保留前後少量字元，中段遮蔽。

- 測試日期：
- commit hash：
- 測試環境：production
- 付款金額：NT$50
- paymentId：遮蔽中段
- MerchantOrderNo：遮蔽中段
- TradeNo：遮蔽中段
- 是否 Notify 成功：是 / 否
- 是否 payment paid：是 / 否
- 是否 `divination_readings` paid：是 / 否
- 是否產生 OpenAI 解讀：是 / 否
- 使用模型是否為 `gpt-5.5`：是 / 否
- 是否有錯誤：
- 錯誤碼或錯誤摘要：
- 是否需要退款 / 取消交易：是 / 否
- 備註：

禁止在回報中貼出：

- 完整 MerchantOrderNo。
- 完整 TradeNo。
- 完整 paymentId。
- MerchantID / HashKey / HashIV。
- OpenAI API key。
- `TradeInfo` / `TradeSha`。
- 信用卡資料。
- 個資。

## 六、安全要求

- 不放 MerchantID 真值。
- 不放 HashKey / HashIV。
- 不放 OpenAI API key。
- 不放 LINE Pay Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放 `TradeInfo` / `TradeSha`。
- 不放完整 TradeNo / MerchantOrderNo。
- 不放完整 paymentId。
- 不放個資。
- 不放信用卡資料。
- 不放測試卡號。
- 不放付款頁完整表單內容。
- 不放 OpenAI request / response 原始內容。

## 七、正式測試後處理

- 若測試成功，下一包才做正式入口開啟檢查。
- 若測試失敗，先整理錯誤碼與流程，不要直接重複刷卡。
- 若 Notify 未到，先確認藍新後台交易狀態與 QueryTradeInfo fallback，不要手動把正式資料標 paid。
- 若 OpenAI 解讀失敗，先確認 reading 狀態與錯誤摘要，不要重複扣款測試。
- 若需要退款，依藍新後台退款 / 取消交易 SOP 處理。
- 不要把測試資料混成正式營收紀錄，需標記測試用途。
- 測試完成後需確認是否有客服、退款、付款 pending、解讀失敗的處理紀錄。

## 八、下一步建議

- 22J-21：紫微占卜正式低金額測試結果回報格式與修正清單。
- 22J-22：紫微占卜正式入口開啟檢查。
- 22J-23：商品 cart NewebPay checkout 缺口修正。

## 九、本文件限制

- 本文件只根據 repo 與既有文件整理測試指引。
- 本文件沒有讀 `.env.local`。
- 本文件沒有讀 production env。
- 本文件沒有登入藍新後台。
- 本文件沒有呼叫藍新 API。
- 本文件沒有呼叫 OpenAI API。
- 本文件沒有刷卡。
- 本文件沒有執行 SQL。
