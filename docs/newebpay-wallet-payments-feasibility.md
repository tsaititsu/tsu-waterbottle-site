# NewebPay Apple Pay / Google Pay / Samsung Pay feasibility

## 一、目的

本文件評估是否要啟用藍新 MPG 的錢包支付工具：

- Apple Pay
- Google Pay
- Samsung Pay

本輪只做可行性評估，不啟用任何支付參數，不新增前端按鈕，不呼叫藍新 API，不刷卡。

## 二、後台狀態

根據使用者提供的藍新後台截圖，目前可見狀態如下：

| 支付方式 | 後台狀態 | 備註 |
| --- | --- | --- |
| Apple Pay 幕前支付 | 啟用 | 仍需程式送對應 MPG 參數並完成前端入口測試 |
| Apple Pay 幕後支付 | 尚未驗證 | 不適合直接列為可上線項目 |
| Google Pay | 啟用 | 仍需程式送對應 MPG 參數並完成前端入口測試 |
| Samsung Pay | 啟用 | 仍需程式送對應 MPG 參數並完成前端入口測試 |

注意：

- 後台啟用不代表程式已送參數。
- 後台啟用不代表前端已開放。
- 後台啟用不代表可以直接正式上線。

## 三、對應 NewebPay MPG 參數

| 支付工具 | 對應 MPG 參數 | 目前程式是否送出 |
| --- | --- | --- |
| Apple Pay | `APPLEPAY` | 未送 `APPLEPAY=1` |
| Google Pay | `ANDROIDPAY` | 未送 `ANDROIDPAY=1` |
| Samsung Pay | `SAMSUNGPAY` | 未送 `SAMSUNGPAY=1` |

目前程式主線仍是：

- NewebPay 信用卡：`CREDIT=1`
- 課程分期：只限課程付款帶 `InstFlag=3,6`
- 非課程付款：`InstFlag=0` 或不開分期
- 不送 `LINEPAY=1`

目前不可直接判定 Apple Pay / Google Pay / Samsung Pay 已開放。必須等程式送對應 MPG 參數、前端有明確入口、Notify / Return / paid sync 都完成測試後，才可視為可上線支付方式。

## 四、是否要全站開放

### 方案 A：全站都開

適用範圍：

- booking
- course
- divination
- product order
- ai-chart

優點：

- 使用者付款選擇更多。
- 行動裝置付款可能更方便。
- 可減少只靠信用卡頁面輸入卡號的摩擦。

風險：

- 每個產品都要重新測 Notify / Return / paid sync。
- Apple Pay / Google Pay / Samsung Pay 的實際顯示條件跟裝置、瀏覽器、作業系統、卡片支援度有關。
- 不同付款工具回傳的 `PaymentType` / `PaymentMethod` 需逐一確認。
- 若一次全站開放，問題來源會變多，不利於定位錯誤。
- 非課程交易仍不得出現 `InstFlag=3,6`。

### 方案 B：只先開課程

適用範圍：

- course

優點：

- 課程金額較明確。
- 課程付款與 `course_purchases` paid sync 已有主線。
- 可用單一產品先驗證 wallet payment 的 Notify / Return / paid sync。

風險：

- 課程目前已啟用信用卡分期 `InstFlag=3,6`。
- 需確認 wallet payments 與分期是否會同時顯示、互相排斥，或造成 NewebPay MPG 頁面理解混亂。
- 若無法確認 wallet payments 與分期的相容性，不建議第一輪就放在課程上混測。

### 方案 C：先不開

適用範圍：

- 全站維持目前付款方式。

優點：

- 保持目前 `CREDIT=1` 主線簡單穩定。
- 課程分期可先獨立測完。
- 避免在 LINE Pay、課程分期、商品 checkout 等事項尚未完全收斂前再增加支付變數。

風險：

- 暫時沒有 Apple Pay / Google Pay / Samsung Pay 的付款便利性。
- 若使用者期待行動錢包，需要用文件或客服話術說明目前付款方式。

## 五、與課程分期的關係

目前課程付款設定：

- `provider=newebpay`
- `CREDIT=1`
- `InstFlag=3,6`
- 只限課程付款
- 不是信用卡定期定額
- 不是 LINE Pay

若未來同時送：

- `APPLEPAY=1`
- `ANDROIDPAY=1`
- `SAMSUNGPAY=1`
- `InstFlag=3,6`

需要先確認：

- Apple Pay / Google Pay / Samsung Pay 是否可與分期選項並列。
- wallet payments 是否會影響分期顯示。
- 分期是否只適用信用卡一般刷卡，不適用 wallet payments。
- NewebPay Notify 回傳的付款類型是否會讓課程 paid sync 正確判讀。

在尚未確認前，建議不要先把 wallet payments 跟課程分期混測。若要測 wallet payments，可優先挑一個沒有分期的低金額產品，例如紫微占卜 NT$50。

## 六、各產品風險評估

### 1. Booking

現況：

- 前端已有信用卡 / 匯款類型入口盤點。
- 信用卡入口仍需依正式 feature flag 與實刷結果確認。
- 未看到 Apple Pay / Google Pay / Samsung Pay 前端入口。

是否適合開 wallet payments：

- 可以作為中期候選，但不建議第一個開。
- 預約付款通常牽涉服務時段與後續人工流程，應先確認信用卡主線穩定。

風險：

- 若預約付款失敗或 pending，使用者可能誤以為預約已成立。
- 需確認 ReturnURL / NotifyURL 與預約狀態同步。

### 2. Course

現況：

- 課程可用 NewebPay 信用卡一次付清。
- 課程限定信用卡分期 `InstFlag=3,6` 已設定。
- 未看到 Apple Pay / Google Pay / Samsung Pay 前端入口。

是否適合開 wallet payments：

- 可以作為中期測試候選。
- 但需先釐清 wallet payments 與課程分期是否相容。

風險：

- 若 wallet payments 與分期同時出現，使用者可能不清楚差異。
- 若 wallet payments 不能分期，課程頁需避免把它描述成分期付款的一部分。

### 3. Divination

現況：

- 紫微占卜 NT$50 NewebPay 付款流程已有盤點。
- 非課程交易應維持 `InstFlag=0`。
- 未看到 Apple Pay / Google Pay / Samsung Pay 前端入口。

是否適合開 wallet payments：

- 若未來要做第一個 wallet payment 小規模測試，紫微占卜 NT$50 較適合。
- 金額低、流程短，較容易驗證 Notify / Return / paid gate。

風險：

- 必須確保 paid gate 不被繞過。
- OpenAI 解讀需維持 paid 後才產生。
- 不可因 wallet payment 測試而產生假 paid。

### 4. AI Chart

現況：

- AI Chart 正式付款入口仍應維持關閉。
- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 仍是關鍵控制。
- AI Chart 仍不建議開正式付款入口。

是否適合開 wallet payments：

- 不適合。
- AI Chart 不應成為 wallet payment 第一輪測試產品。

風險：

- 若 reportContent / OpenAI / paid gate 尚未完全確認，增加 wallet payments 只會擴大風險。

### 5. Product order / Cart

現況：

- 商品 cart 官方 LINE Pay flow 已保存但暫停。
- cart NewebPay 正式信用卡 checkout 尚未作為主線完成開放盤點。
- 未看到 Apple Pay / Google Pay / Samsung Pay 的 NewebPay 前端入口。

是否適合開 wallet payments：

- 暫不建議。
- 應先補齊商品 cart NewebPay 信用卡 checkout，再評估 wallet payments。

風險：

- 商品訂單、匯款、LINE Pay 保存流程、物流人工流程仍需避免混線。
- 不可把 official `provider=line_pay` 與 NewebPay wallet payments 混用。

## 七、測試需求

若未來要啟用 Apple Pay / Google Pay / Samsung Pay，至少需要測：

- Apple Pay 支付成功。
- Google Pay 支付成功。
- Samsung Pay 支付成功。
- Notify paid 是否正常。
- ReturnURL 是否正常。
- QueryTradeInfo fallback 是否正常。
- paid sync 是否正常。
- 付款失敗是否不會 mark paid。
- 裝置不支援時，NewebPay 頁面是否隱藏或無法選該支付工具。
- 非課程付款是否仍為 `InstFlag=0`。
- 課程分期是否未被 wallet payments 影響。
- 不送 `LINEPAY=1`。
- 不混用 official `provider=line_pay`。
- 不輸出 MerchantID / HashKey / HashIV 真值。

## 八、目前建議

短期建議：

- 不立即啟用 Apple Pay / Google Pay / Samsung Pay。
- 維持 NewebPay `CREDIT=1` 主線。
- 先把課程信用卡一次付清與課程 3 / 6 期分期測穩。
- LINE Pay 仍不開。

中期建議：

- 可先選一個產品做 wallet payment 小包測試。
- 建議優先考慮紫微占卜 NT$50，或課程付款。
- 不建議一次全站開放。

暫不建議：

- AI Chart 暫不開 wallet payments。
- Product order / cart 暫不開 wallet payments。
- 不要在商品 cart NewebPay 信用卡 checkout 尚未穩定前加入 wallet payments。

## 九、禁止事項

- 不要直接送 `APPLEPAY=1`。
- 不要直接送 `ANDROIDPAY=1`。
- 不要直接送 `SAMSUNGPAY=1`。
- 不要啟用 `LINEPAY=1`。
- 不要讓非課程出現 `InstFlag=3,6`。
- 不要混用 `provider=line_pay`。
- 不要把 official LINE Pay flow 當成 NewebPay wallet payments。
- 不要呼叫藍新 API。
- 不要刷卡。
- 不要讀 production env。
- 不要輸出 MerchantID / HashKey / HashIV 真值。
- 不要輸出 TradeInfo / TradeSha。
- 不要改 NewebPay 既有主線。

## 十、下一步建議

- 22J-24：ATM 轉帳 VACC 可行性評估。
- 22J-25：若要開 wallet payments，先做 divination wallet payment 小包。
- 22J-26：若要開 wallet payments，再做 course wallet payment 與分期相容測試。
- 22J-27：商品 cart NewebPay 信用卡 checkout 補入口。
