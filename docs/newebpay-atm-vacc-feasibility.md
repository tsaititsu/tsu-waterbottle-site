# NewebPay ATM transfer VACC feasibility

## 一、目的

本文件評估是否要啟用藍新 MPG 的 ATM 轉帳：

- `VACC=1`

本輪只做可行性評估，不啟用 `VACC=1`，不新增前端入口，不呼叫藍新 API，不刷卡，不讀 `.env.local`，不讀 production env，不輸出任何 key。

## 二、後台狀態

根據使用者提供的藍新後台截圖，目前可見狀態如下：

| 支付方式 | 後台狀態 | 備註 |
| --- | --- | --- |
| ATM 轉帳 | 啟用 | 後台看似啟用，但目前程式未送 `VACC=1`，前端也未放 NewebPay ATM 入口。 |
| WebATM | 未啟用 | 目前程式未送 `WEBATM=1`，不可開入口。 |
| 智慧 ATM2.0 | 未啟用 | 目前程式未使用相關欄位，不可自行加參數。 |

注意：

- 後台啟用不代表程式已送 `VACC=1`。
- 後台啟用不代表前端已開放。
- 後台啟用不代表可以直接正式上線。
- 本文件沒有登入藍新後台，也沒有呼叫藍新 API。

## 三、對應 NewebPay MPG 參數

| 支付工具 | 對應 MPG 參數 / 欄位 | 目前程式是否送出 |
| --- | --- | --- |
| ATM 轉帳 | `VACC` | 未送 `VACC=1` |
| WebATM | `WEBATM` | 未送 `WEBATM=1` |
| 智慧 ATM2.0 | `SourceType` / `SourceBankId` / `SourceAccountNo` 等相關欄位 | 未使用，不可自行亂加 |

目前程式主線仍是：

- NewebPay 信用卡：`CREDIT=1`
- 課程分期：只限課程付款帶 `InstFlag=3,6`
- 非課程付款：`InstFlag=0`
- 不送 `LINEPAY=1`
- 不送 `VACC=1`
- 不送 `WEBATM=1`

目前不可直接判定 ATM 轉帳已開放。必須等程式送出 `VACC=1`、前端有明確入口、取號資訊有使用者體驗設計、Notify / Return / paid sync 都完成測試後，才可視為可上線支付方式。

## 四、ATM 轉帳與信用卡差異

信用卡與 ATM 轉帳的付款模型不同：

| 項目 | 信用卡 | ATM 轉帳 |
| --- | --- | --- |
| 付款特性 | 即時授權 | 先取號，使用者之後轉帳 |
| 付款完成時間 | 通常立即 | 可能延遲數分鐘到數天 |
| paid 判斷 | Notify 成功後可更新 paid | 必須等使用者實際轉帳後 Notify 才可 paid |
| 使用者體驗 | 付款頁完成後通常立即回來 | 需要顯示轉帳帳號、期限與付款後等待說明 |
| 訂單狀態 | pending 時間較短 | pending 狀態可能維持較久 |
| 過期處理 | 授權失敗即失敗 | 需處理未付款過期 |
| 退款 / 取消 | 信用卡取消 / 退款流程 | 可能需人工處理或另接退款機制 |

啟用 ATM 轉帳前需特別確認：

- NotifyURL 收到付款完成後才可把 payment 標為 paid。
- ReturnURL / CustomerURL / ClientBackURL 的使用者體驗需要確認。
- 訂單需支援 pending 狀態較久。
- 需處理付款期限。
- 需處理未付款過期。
- 未付款不可開課程權限、不可產生占卜解讀、不可出貨。
- 退款方式與信用卡不同，可能需人工處理或另接機制。

目前 repo 可見 NewebPay 主線有 `NotifyURL`、`ReturnURL` 與 `ClientBackURL`。若未來啟用 ATM，是否需要額外 `CustomerURL` 或其他取號回頁欄位，需以藍新正式文件與實測結果確認，不可在本輪自行加參數。

## 五、是否要全站開放

### 方案 A：全站都開 ATM

優點：

- 不想刷卡的使用者可付款。
- 可補足信用卡以外的付款需求。
- 對習慣 ATM 轉帳的使用者較友善。

風險：

- 每個產品都要支援取號後 pending。
- paid gate 不能即時開。
- 未付款 / 過期處理複雜。
- 客服與對帳成本增加。
- 訂單可能長時間卡在 pending。
- 若一次全站開放，出錯時難以定位是哪個產品流程問題。

### 方案 B：只先開課程

優點：

- 課程金額較固定。
- `course_purchases` paid sync 已有。
- 可用單一產品先驗證 ATM Notify / Return / paid sync。

風險：

- 報名名額 / 課程權限要等付款完成才可開。
- 未付款保留名額問題需設計。
- 若使用者取號後不付款，是否要自動釋放名額需另做規則。
- 課程已經有信用卡 3 / 6 期分期，付款選項太多時可能增加理解成本。

### 方案 C：只先開商品 cart

優點：

- 商品可接受匯款 / ATM 這類非即時付款。
- 人工出貨流程比較能承接。
- 商品出貨前本來就適合再次確認付款狀態。

風險：

- 庫存保留要設計。
- 未付款取消要設計。
- 出貨前確認要設計。
- product order 與 NewebPay ATM payment 的對帳資訊要清楚。
- cart NewebPay 信用卡 checkout 尚未正式補入口，ATM 不應比信用卡先開。

### 方案 D：暫不開

優點：

- 先穩定信用卡與課程分期。
- 避免非即時付款狀態增加複雜度。
- 保持現有 paid sync 風險較低。

風險：

- 暫時無法提供 NewebPay ATM 轉帳。
- 不想刷卡的使用者仍需走既有郵局匯款 / 銀行匯款流程。

## 六、各產品風險評估

### 1. Booking

是否適合 ATM：

- 不建議作為第一個 ATM 測試產品。
- 預約服務通常和時段保留有關，非即時付款容易造成時段卡住。

主要風險：

- 使用者取號但未付款，預約名額可能被卡住。
- 若付款延遲，客服需判斷是否保留或釋放時段。
- 付款完成前不可把預約視為已確認。

建議：

- Booking 先維持信用卡 / 匯款主線。
- 若未來要開 ATM，需先設計預約 pending 期限與自動釋放規則。

### 2. Course

是否適合 ATM：

- 可作為後續候選，但不建議第一波就開。
- 課程權限需等付款完成才開。

主要風險：

- 報名名額是否保留需設計。
- 未付款訂單是否自動取消需設計。
- 課程已經有信用卡分期，ATM 入口與分期入口的文案要避免混淆。

建議：

- 課程先完成信用卡一次付清與 3 / 6 期正式測試。
- ATM 可等課程付款穩定後另包評估。

### 3. Divination

是否適合 ATM：

- 不建議。
- NT$50 小額付款不適合非即時 ATM 轉帳，使用者會被迫等待付款確認。

主要風險：

- 使用者期待立刻看解讀，但 ATM 付款不一定即時完成。
- paid gate 必須嚴格等待 Notify paid。
- 若付款延遲，使用者體驗會比信用卡差。

建議：

- 紫微占卜 NT$50 優先測信用卡一次付清。
- 不建議先開 ATM。

### 4. AI Chart

是否適合 ATM：

- 不適合。
- AI Chart 正式付款入口目前仍應維持關閉。

主要風險：

- reportContent / OpenAI / paid gate / 交付流程尚未作為上線完成狀態。
- 增加 ATM pending 會讓流程更複雜。

建議：

- AI Chart 不開 ATM。

### 5. Product order / Cart

是否適合 ATM：

- 若未來要測 ATM，商品 cart 可能是最適合的產品。
- 商品人工出貨流程較能承接非即時付款。

主要風險：

- cart NewebPay 信用卡 checkout 尚未正式補入口。
- 庫存保留、未付款過期、取消訂單、出貨前付款確認都需設計。
- ATM 取號資訊要清楚顯示給使用者。
- 需要避免和既有郵局匯款流程混淆。

建議：

- 先補商品 cart NewebPay 信用卡 checkout。
- 再另包設計商品 cart ATM 轉帳需求。
- 不建議在 cart 信用卡主線穩定前開 ATM。

## 七、測試需求

若未來要啟用 ATM 轉帳，至少要測：

- `VACC=1` 取號成功。
- CustomerURL / ReturnURL / ClientBackURL 是否能顯示取號資訊。
- NotifyURL 付款完成。
- QueryTradeInfo fallback。
- payment `pending` → `paid`。
- paid sync 對應資料。
- 未付款不可開課程權限。
- 未付款不可產生占卜解讀。
- 未付款不可出貨。
- 付款過期處理。
- 金額是否正確。
- 付款期限是否清楚。
- 使用者取消或關閉付款頁時的體驗。
- 不送 `LINEPAY=1`。
- 非課程仍 `InstFlag=0`。
- 課程若使用 ATM，不可誤帶課程分期語意。
- 不輸出 MerchantID / HashKey / HashIV 真值。

## 八、目前建議

短期建議：

- 不立即啟用 ATM 轉帳。
- 維持 NewebPay `CREDIT=1` 主線。
- 先完成課程信用卡一次付清與 3 / 6 期分期測試。
- 商品 cart 先補 NewebPay 信用卡 checkout，不先補 ATM。

中期建議：

- 若要測 ATM，建議先選商品 cart。
- 商品可用人工出貨承接非即時付款，但需先設計未付款 / 過期訂單流程。
- 不建議先給紫微占卜 NT$50。
- 課程可後續評估，但需處理名額 / 權限保留。

暫不開：

- AI Chart 不開 ATM。
- WebATM 不開。
- 智慧 ATM2.0 不開。
- LINE Pay 不開。

## 九、禁止事項

- 不要直接送 `VACC=1`。
- 不要直接送 `WEBATM=1`。
- 不要新增 `SourceType` / `SourceBankId` / `SourceAccountNo`。
- 不要啟用 `LINEPAY=1`。
- 不要讓非課程出現 `InstFlag=3,6`。
- 不要混用 `provider=line_pay`。
- 不要把官方 LINE Pay flow 當成 NewebPay ATM。
- 不要呼叫藍新 API。
- 不要刷卡。
- 不要讀 production env。
- 不要讀 `.env.local`。
- 不要輸出 MerchantID / HashKey / HashIV 真值。
- 不要輸出 TradeInfo / TradeSha。
- 不要改 NewebPay 既有信用卡主線。

## 十、下一步建議

- 22J-25：商品 cart NewebPay 信用卡 checkout 補入口。
- 22J-26：商品 cart ATM 轉帳需求設計。
- 22J-27：紫微占卜正式低金額測試結果回報。
- 22J-28：課程付款實測前安全檢查。
