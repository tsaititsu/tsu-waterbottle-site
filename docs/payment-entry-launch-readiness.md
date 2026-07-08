# Payment Entry Launch Readiness Checklist

本文件整理付款入口上線前總檢查。  
本輪只新增文件，不改程式邏輯、不新增 API route、不新增前端按鈕、不呼叫藍新 API、不呼叫 LINE Pay API、不刷卡、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

## 一、目前可開放入口

### 1. 信用卡一次付清

目前主線線上刷卡方式：

- provider: `newebpay`
- NewebPay MPG: `CREDIT=1`
- 可作為全站主要線上刷卡方式
- 非課程交易維持 `InstFlag=0`
- 不送 NewebPay MPG `LINEPAY=1`
- 不混官方 `provider=line_pay`

注意：

- 仍需逐產品確認前端入口是否已接好。
- repo 只能確認程式流程，production 實際可刷需正式低金額測試與 Notify 驗證。

### 2. 線上課程信用卡分期

目前只允許線上課程使用信用卡 3 / 6 期分期：

- provider: `newebpay`
- NewebPay MPG: `CREDIT=1`
- NewebPay MPG: `InstFlag=3,6`
- 只限線上課程
- 非課程不得出現分期
- 不是信用卡定期定額
- 不是藍新 LINE Pay
- 不是官方 LINE Pay

### 3. 郵局匯款 / 銀行匯款

目前維持既有流程：

- booking 可使用郵局匯款
- cart / bank-transfer 頁可導向匯款說明與匯款回報
- 匯款回報後需人工確認

注意：

- product_order schema 支援 `payment_method=bank_transfer`
- product order create API 支援 `paymentMethod=bank_transfer`
- 既有匯款提交流程是否已和 product_order 穩定綁定，仍需另包確認

## 二、目前不可開放入口

### 1. 官方 LINE Pay

官方 LINE Pay 狀態：

- provider: `line_pay`
- 程式已保存
- 暫停開放
- 尚未決定 fixed IP proxy / 官方直串 / 是否放棄
- 尚未填 key
- 尚未處理 IP 白名單
- 尚未 sandbox 手測
- 尚未 production sign-off
- 不可開前端正式付款

### 2. 藍新 LINE Pay

NewebPay MPG LINE Pay 狀態：

- NewebPay MPG 參數：`LINEPAY=1`
- 藍新後台目前依使用者截圖為申請中
- 程式目前沒有送 `LINEPAY=1`
- 尚未啟用
- 不可開入口

若未來採用藍新 LINE Pay，provider 應維持 `newebpay`，不可使用官方 `provider=line_pay` 流程。

### 3. AI Chart 正式付款

AI 命盤付款狀態：

- NewebPay 後端骨架已存在
- 正式付款入口由 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制
- 目前建議維持關閉
- reportContent / OpenAI / 正式交付流程仍需完成與測試
- 不應開正式入口

### 4. Product order / cart 的 NewebPay 正式 checkout

商品 NewebPay 狀態：

- product order create API 已建立
- product order NewebPay pending payment 後端骨架已建立
- Notify paid sync product_orders 已建立
- cart 尚未接正式 NewebPay checkout 按鈕
- 不應視為已可對一般使用者開放

補充：

- cart 官方 LINE Pay flow 已完成，但屬 `provider=line_pay`，目前保存暫停
- 不能把官方 LINE Pay cart flow 視為 NewebPay 正式 checkout

### 5. ATM / WebATM / 超商代碼 / 條碼

目前狀態：

- 程式未主動送 `WEBATM`
- 程式未主動送 `VACC`
- 程式未主動送 `CVS`
- 程式未主動送 `BARCODE`
- 程式未主動送 `CVSCOM`
- 不可開入口

## 三、各產品入口檢查

### 1. Booking 預約

目前確認：

- 前端有付款方式選單
- 郵局匯款保留
- 信用卡線上付款入口由 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制
- flag off 時信用卡選項 disabled，文案提示先使用郵局匯款
- 後端 NewebPay payment 可建立
- Notify paid 後有 booking paid sync
- 非課程交易不分期，`InstFlag=0`
- repo 無法確認是否已實刷過

上線建議：

- 若尚未做正式低金額刷卡測試：只開匯款
- 若要開信用卡：先做正式低金額刷卡、Notify、Return、booking sync 測試

### 2. Courses 線上課程

目前確認：

- 前端課程購買會呼叫 `/api/payments/newebpay/course/start`
- 成功後導到 `/payment/newebpay/redirect?paymentId=...`
- NewebPay 信用卡一次付清已接
- NewebPay 信用卡分期 3 / 6 期已接
- TradeInfo 送 `CREDIT=1`
- TradeInfo 送 `InstFlag=3,6`
- paid 後有 `course_purchases` sync
- 課程購買受登入、購買資格、前置課程與購買須知勾選控制

上線建議：

- 可優先開放
- 正式開放前仍需確認 NewebPay 正式刷卡測試
- 分期測試需確認課程交易才有 `InstFlag=3,6`

### 3. Divination 紫微占卜

目前確認：

- NT$50 NewebPay payment flow 已接
- 正式付款入口受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制
- paid gate 依 DB paid 狀態判斷
- Notify paid 後有 divination reading sync
- 非課程交易不分期，`InstFlag=0`
- repo 無法確認是否已實刷過

上線建議：

- 若未實刷，需先測試
- 測試通過後再開正式入口

### 4. AI Chart 命盤

目前確認：

- NewebPay 後端骨架已存在
- ai_chart report create / read / paid sync 相關流程已建立
- 正式付款入口由 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制
- 非課程交易不分期，`InstFlag=0`
- OpenAI / reportContent 正式交付流程仍未作為上線完成狀態

上線建議：

- 正式付款入口維持關閉
- 等 reportContent / OpenAI / 交付流程穩定後再評估

### 5. Product order / Cart 開運商品

目前確認：

- product_order schema 已建立
- product order create API 已建立
- NewebPay pending payment 後端骨架已建立
- Notify paid sync product_orders 已建立
- 商品 NewebPay 不分期，`InstFlag=0`
- cart 尚未接正式 NewebPay checkout
- cart 目前保留匯款入口
- 官方 LINE Pay 已完成但保存暫停
- 藍新 LINE Pay 未啟用

上線建議：

- 商品上線第一版可先走匯款 / 人工確認
- NewebPay checkout 需另包接 cart 前端並測 Notify paid sync
- LINE Pay 不作為本階段商品正式付款入口

### 6. Bank transfer 匯款

目前確認：

- 匯款說明頁存在
- 匯款回報表單存在
- 回報後需人工確認
- 不走 NewebPay
- 不涉及 LINE Pay
- 不涉及分期

待確認：

- 匯款回報是否能穩定綁 product_order
- 人工對帳與出貨 SOP 是否已文件化

上線建議：

- 可維持既有入口
- 商品正式上線前需補 product_order 對帳確認

## 四、Feature Flag 檢查

本文件只列欄位名稱與建議，不讀 `.env.local`，不讀 production env，不輸出任何真值。

`.env.example` 與程式中目前相關 flag：

- `NEXT_PUBLIC_ENABLE_NEWEBPAY`
  - 影響 booking / divination / NewebPay test 等前端入口
  - 若只先開課程付款，可不依賴此 flag
  - 若要開 booking / divination 信用卡，需人工確認 production 是否設為 true
- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY`
  - 建議 production 維持 false
  - AI Chart reportContent / OpenAI / 交付流程穩定前不開
- `NEWEBPAY_ENABLE_TEST_PAYMENT`
  - 建議 production 維持 false
  - 只用於受控 smoke test
- `NEXT_PUBLIC_ENABLE_LINE_PAY`
  - 建議 production 維持 false
  - 官方 LINE Pay 暫停保存
- `ENABLE_DIVINATION_DB_READINGS`
  - 影響 divination DB reading flow
  - 若要正式開 divination 付款與 paid gate，需人工確認相關讀取流程

建議 production true：

- 課程付款不需新增 public flag；依現有課程購買流程與正式 NewebPay env 運作
- `NEXT_PUBLIC_ENABLE_NEWEBPAY` 只有在 booking / divination 等信用卡入口測試通過後才建議設為 true

建議 production false：

- `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY`
- `NEWEBPAY_ENABLE_TEST_PAYMENT`
- `NEXT_PUBLIC_ENABLE_LINE_PAY`

需要人工確認：

- `NEXT_PUBLIC_ENABLE_NEWEBPAY`
- `ENABLE_DIVINATION_DB_READINGS`
- 正式 NewebPay env 與 Notify / Return URL

## 五、上線前測試清單

### NewebPay

- 測試信用卡 1 元或低金額正式刷卡
- 確認 NotifyURL 正常
- 確認 ReturnURL 正常
- 確認 QueryTradeInfo fallback 正常
- 確認 paid sync 正常
- 確認 `payments.status=paid` 只由正式成功付款或明確 dry-run 標記流程更新
- 不要把假 paid 混進正式資料

### 課程分期

- 課程交易確認 `InstFlag=3,6`
- 非課程交易確認 `InstFlag=0`
- 課程付款後 `course_purchases` sync
- 分期交易不可套用到商品
- 分期交易不可套用到占卜
- 分期交易不可套用到預約
- 分期交易不可套用到 AI Chart

### 匯款

- 匯款回報是否可查
- 匯款人工確認 SOP
- product_order 是否可對應
- 客服確認款項後如何標記訂單與安排出貨

### LINE Pay

- 官方 LINE Pay 暫停
- 藍新 LINE Pay 申請中
- 不可開入口
- 不可送 `LINEPAY=1`
- 不可把官方 `provider=line_pay` 當成 NewebPay payment method

## 六、正式上線建議

### 第一層：可優先上線

- 課程信用卡一次付清
- 課程信用卡 3 / 6 期分期
- 已穩定的匯款入口

條件：

- 完成 NewebPay 正式低金額刷卡測試
- 完成 Notify / Return / course_purchases sync 確認
- 確認課程分期只出現在課程交易

### 第二層：需測試後上線

- Booking 信用卡
- Divination NT$50
- Product order NewebPay checkout

條件：

- 各產品都需完成低金額刷卡
- 各產品都需確認 paid sync
- 商品 cart 需先補正式 NewebPay checkout 前端

### 第三層：暫不開放

- 官方 LINE Pay
- 藍新 LINE Pay
- AI Chart 正式付款
- ATM / WebATM / 超商代碼 / 條碼
- 商品物流 API

## 七、禁止事項

- 不要啟用藍新 `LINEPAY=1`
- 不要開官方 LINE Pay 前端正式付款
- 不要讓非課程付款出現分期
- 不要把 `provider=line_pay` 與 `provider=newebpay` 混用
- 不要用假 paid 污染正式付款資料
- 不要輸出 HashKey / HashIV / MerchantID 真值
- 不要輸出 LINE Pay Channel Secret
- 不要讀 production env
- 不要刷卡
- 不要 deploy
- 不要把測試用 transaction / order / payment id 公開貼出

## 八、下一步建議

### A. 先開課程付款

- 確認課程前端入口
- 測 NewebPay 信用卡一次付清
- 測 NewebPay 課程 3 / 6 期
- 確認 paid 後 `course_purchases` sync

### B. 再處理商品 cart NewebPay checkout

- 接商品正式 NewebPay checkout
- 測 Notify paid sync product_orders
- 補匯款人工出貨流程
- 暫不接物流 API

### C. LINE Pay 暫停

- 等藍新 LINE Pay 申請結果
- 或之後重新評估官方 LINE Pay / fixed IP proxy
- 任何 LINE Pay 路線都需另開小包評估，不在目前付款入口直接開

## 九、安全要求

- 不放 HashKey / HashIV / MerchantID 真值
- 不放 LINE Pay Channel Secret
- 不放 production env 真值
- 不放 sandbox env 真值
- 不放真實 `transactionId` / `orderId` / `paymentId`
- 不放個資
- 不放 TradeInfo / TradeSha
- 不放測試卡號
- 不放真實付款頁截圖或付款表單內容

## 十、本文件限制

- 本文件只根據 repo 與既有文件盤點。
- 本文件沒有登入藍新後台。
- 本文件沒有登入 LINE Pay 後台。
- 本文件沒有呼叫任何付款 API。
- 本文件沒有刷卡。
- production 實際 env 與後台開通狀態仍需人工確認。
