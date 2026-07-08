# Divination NewebPay Live Test Report Template

本文件整理紫微占卜 NT$50 正式低金額測試後回報表。  
本輪只新增測試結果回報文件，不改程式邏輯、不呼叫藍新 API、不刷卡、不呼叫 OpenAI API 做實測、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

## 一、使用方式

- 本文件給人工正式低金額測試後填寫。
- 不要把 HashKey / HashIV / MerchantID 真值寫入。
- 不要把 OpenAI API key 寫入。
- 不要放完整 TradeNo / MerchantOrderNo / paymentId。
- 所有交易編號都要遮蔽中段，只保留前後少量字元。
- 若需附 server log，只貼摘要，並先遮蔽 key、完整交易編號與個資。
- ReturnURL 只代表使用者回站，不可單獨當成付款成功依據。

## 二、測試基本資料

| 欄位 | 填寫內容 |
| --- | --- |
| 測試日期 |  |
| 測試人員 |  |
| commit hash |  |
| 測試環境 | production |
| 測試金額 | NT$50 |
| 測試項目 | 成功付款 / 付款失敗 / OpenAI 失敗 / ReturnURL / NotifyURL |
| 結果 | 通過 / 失敗 / 待確認 |

## 三、付款資料遮蔽回報

| 欄位 | 填寫內容 / 預期 |
| --- | --- |
| paymentId | 遮蔽中段 |
| MerchantOrderNo | 遮蔽中段 |
| TradeNo | 遮蔽中段 |
| PaymentType | 只可填 `CREDIT` |
| InstFlag | 應為 `0` |
| 是否出現 LINE Pay | 是 / 否，預期否 |
| 是否出現分期 | 是 / 否，預期否 |
| 金額是否 NT$50 | 是 / 否 |

## 四、Notify / Return 檢查

| 欄位 | 填寫內容 |
| --- | --- |
| NotifyURL 是否收到 | 是 / 否 |
| Notify 是否 `Status=SUCCESS` | 是 / 否 |
| Notify 解密是否成功 | 是 / 否 |
| payment 是否更新 paid | 是 / 否 |
| `divination_readings` 是否 sync paid | 是 / 否 |
| ReturnURL 是否回到正確頁面 | 是 / 否 |
| ReturnURL 文案是否容易讓使用者困惑 | 是 / 否 |
| QueryTradeInfo fallback 是否有用到 | 是 / 否 |

補充：

- Notify 成功後才可作為正式 paid 依據。
- 若 Notify 未到或驗證失敗，需先確認藍新後台與 QueryTradeInfo fallback，不可手動把正式資料標 paid。
- ReturnURL 若文案或回站路徑讓占卜使用者困惑，請列為 P1 或 P2 修正。

## 五、paid gate / OpenAI 檢查

| 欄位 | 填寫內容 |
| --- | --- |
| 未付款前是否擋住完整解讀 | 是 / 否 |
| paid 後是否開啟解讀 | 是 / 否 |
| 是否呼叫 OpenAI | 是 / 否 |
| 模型是否為 `gpt-5.5` | 是 / 否 |
| 解讀是否產生 | 是 / 否 |
| 解讀是否保存 | 是 / 否 |
| 是否重複產生解讀 | 是 / 否 |
| OpenAI 失敗時是否有錯誤提示 | 是 / 否 |

補充：

- 未付款前不可產生完整解讀。
- paid gate 只應在 `divination_readings` paid 後開放。
- OpenAI 解讀失敗時，應有錯誤提示，且不應把 reading 標成 completed。
- 已 completed 的 reading 不應重複產生或覆蓋解讀。

## 六、錯誤紀錄

| 欄位 | 填寫內容 |
| --- | --- |
| 錯誤發生位置 | 前端 / create payment / NewebPay / Notify / Return / QueryTradeInfo / paid gate / OpenAI / DB sync |
| 錯誤碼 |  |
| 使用者看到的訊息 |  |
| server log 摘要 | 需遮蔽 key 與交易完整編號 |
| 是否需要修程式 | 是 / 否 |
| 建議修正包號 |  |

錯誤紀錄注意：

- 不貼完整 TradeNo / MerchantOrderNo / paymentId。
- 不貼 `TradeInfo` / `TradeSha`。
- 不貼 HashKey / HashIV / MerchantID。
- 不貼 OpenAI API key。
- 不貼 OpenAI request / response 原始內容。
- 不貼信用卡資料或個資。

## 七、退款 / 取消交易紀錄

| 欄位 | 填寫內容 |
| --- | --- |
| 是否需要退款 / 取消交易 | 是 / 否 |
| 是否已在藍新後台處理 | 是 / 否 |
| 處理日期 |  |
| 金額 |  |
| 備註 |  |

注意：

- 不要放卡號。
- 不要放完整藍新交易序號。
- 不要放完整 TradeNo / MerchantOrderNo。
- 若退款 / 取消交易尚未完成，測試結論不可標示為完整通過。

## 八、修正優先級判定

### P0

以下為阻擋正式開放的問題：

- 付款成功但 payment 沒有 paid。
- `divination_readings` 沒有 sync paid。
- paid gate 被繞過。
- 未付款產生解讀。
- 金額錯誤。
- `LINEPAY=1` 被送出。
- `InstFlag` 不是 `0`。
- HashKey / HashIV / OpenAI key 外洩。
- `TradeInfo` / `TradeSha` 外洩。
- 信用卡資料或個資外洩。

### P1

以下需先修正或明確 workaround 才適合正式開放：

- ReturnURL 文案錯誤或容易讓使用者誤會已付款成功。
- Notify fallback 不穩。
- QueryTradeInfo fallback 不穩。
- OpenAI 失敗提示不佳。
- 重複解讀。
- 付款成功但使用者不知道下一步怎麼取得解讀。

### P2

以下可排入正式開放後優化：

- UI 文案微調。
- 客服說明補充。
- 文件補充。
- 測試回報格式補充欄位。
- 退款 / 取消交易 SOP 細節補充。

## 九、測試結論模板

### 1. 通過，可進下一包正式入口開啟檢查

結論：通過。  
本次紫微占卜 NT$50 正式低金額測試完成，NewebPay 信用卡一次付清流程、Notify paid、`divination_readings` paid sync、paid gate、OpenAI `gpt-5.5` 解讀與保存皆符合預期。可進入下一包正式入口開啟檢查。  
需追蹤事項：

- 

### 2. 部分通過，需修正 P1 / P2

結論：部分通過。  
核心付款與 paid gate 未發現 P0，但仍有 P1 / P2 事項需要修正或補文件。修正完成並重新確認後，再進入正式入口開啟檢查。  
需修正事項：

- P1：
- P2：

### 3. 不通過，需先修 P0

結論：不通過。  
本次測試發現 P0 問題，正式入口不可開放。需先修正 P0，重新做低金額測試，確認付款、paid gate、OpenAI 解讀與資料同步安全後再往下一包前進。  
P0 問題：

- 

## 十、安全要求

- 不放 HashKey / HashIV / MerchantID 真值。
- 不放 OpenAI API key。
- 不放 LINE Pay Channel Secret。
- 不放 production env 真值。
- 不放 sandbox env 真值。
- 不放完整 TradeNo。
- 不放完整 MerchantOrderNo。
- 不放完整 paymentId。
- 不放個資。
- 不放信用卡資料。
- 不放 `TradeInfo` / `TradeSha`。
- 不放測試卡號。
- 不放 OpenAI request / response 原始內容。

## 十一、本文件限制

- 本文件只是正式低金額測試後的回報表模板。
- 本文件沒有呼叫藍新 API。
- 本文件沒有呼叫 OpenAI API。
- 本文件沒有刷卡。
- 本文件沒有讀 `.env.local`。
- 本文件沒有讀 production env。
- 本文件沒有執行 SQL。
