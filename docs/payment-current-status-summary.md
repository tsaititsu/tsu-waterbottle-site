# Payment Current Status Summary

本文件整理目前網站金流總狀態。  
文件不得放 MerchantID / HashKey / HashIV / LINE Pay Channel Secret / production env 真值 / TradeInfo / TradeSha。

## 一、目前金流總結

- NewebPay 信用卡一次付清：目前是網站正式金流主線。
- NewebPay 課程信用卡分期：只限線上課程付款，TradeInfo 送 `CREDIT=1` 與 `InstFlag=3,6`。
- NewebPay 商品 Apple Pay：只限商品 cart，TradeInfo 送 `APPLEPAY=1` 與 `InstFlag=0`。
- 非課程 NewebPay：明確不開分期，TradeInfo 維持 `InstFlag=0` 或不開分期。
- 官方 LINE Pay：使用 `provider=line_pay`，程式與文件已完成到可保存狀態，但目前暫停，不建議開放。
- 藍新 LINE Pay：尚未啟用，程式目前沒有送 NewebPay MPG `LINEPAY=1`。
- ATM / WebATM / 超商代碼 / 條碼：目前只是藍新手冊或後台可能支援的付款工具，程式未主動使用；若要啟用需另開小包。
- 匯款：維持既有郵局匯款流程。

## 二、NewebPay 目前狀態

### 1. 全站共用

目前 NewebPay 相關流程維持：

- provider: `newebpay`
- 信用卡付款：`CREDIT=1`
- 不送 `LINEPAY=1`
- 不混官方 `provider=line_pay`
- Notify route 依既有 `payments` 與各產品 sync helper 更新業務狀態

共用 create route 目前允許：

- `paymentMode=credit`
- `paymentMode=merchant_default`
- `paymentMode=product_order_apple_pay`，只限商品 cart / product order
- `paymentMode=apple_pay_test`，只限內部測試入口與測試 flag

`paymentMode=linepay` 會被擋下，不會送出 NewebPay MPG `LINEPAY=1`。

### 2. 線上課程

線上課程目前使用 NewebPay 信用卡：

- `CREDIT=1`
- `InstFlag=3,6`
- 只限課程付款
- paid 後走 course purchase sync
- 不是信用卡定期定額
- 不是藍新 LINE Pay
- 不是官方 LINE Pay `provider=line_pay`

`InstFlag=3,6` 只代表 NewebPay MPG 信用卡 3 期 / 6 期分期。

### 3. 非課程付款

以下非課程 NewebPay 交易不得出現 `InstFlag=3,6`：

- booking
- divination
- ai-chart
- product order / cart 商品
- test payment / redirect

目前程式狀態：

- 共用 NewebPay payment helper 明確帶 `InstFlag=0`
- test payment 維持 `InstFlag=0`
- 非課程 redirect 維持 `InstFlag=0`
- 不會讓商店後台預設分期影響非課程交易

## 三、官方 LINE Pay 保存狀態

官方 LINE Pay 目前保存為獨立 provider：

- provider: `line_pay`
- 商品訂單 LINE Pay request route 已完成
- 商品訂單 LINE Pay confirm route 已完成
- 商品訂單 LINE Pay cancel route 已完成
- cart LINE Pay 前端流程已完成
- cart return message 已完成
- safe outcome 後才 mark paid / sync product order 的流程已完成

目前尚未開放原因：

- 尚未填 LINE Pay key
- 尚未處理固定 IP 白名單
- 尚未 sandbox 手測
- 尚未 production sign-off
- 尚未確認白皮書額外要求
- 尚未確認退款、發票、coupon 與正式測試流程

目前決策：

- 先保存，不繼續開發
- 不刪除程式
- 不與 NewebPay 混用
- 不把官方 LINE Pay flow 當成藍新 MPG flow

## 四、藍新 LINE Pay 待決定狀態

依使用者提供資訊，藍新後台 LINE Pay 目前截圖顯示申請中。  
本輪沒有登入藍新後台確認，也沒有呼叫藍新 API。

目前程式狀態：

- 沒有送 `LINEPAY=1`
- 沒有把 NewebPay LINE Pay 當成 `provider=line_pay`
- 沒有把官方 LINE Pay confirm / cancel route 混進 NewebPay Notify

若未來改用藍新 LINE Pay：

- provider 應維持 `newebpay`
- LINE Pay 會是 NewebPay MPG 支付工具
- 可能需要送 `LINEPAY=1`
- 不使用官方 `provider=line_pay`
- 需另做「藍新 LINE Pay 可行性評估」
- 不能直接把官方 LINE Pay confirm / cancel 流程混進 NewebPay

## 五、各產品金流狀態

### 1. Booking

目前狀態：

- NewebPay 信用卡流程已接
- `CREDIT=1`
- `InstFlag=0`
- 前端信用卡入口受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制
- flag off 時信用卡選項 disabled，仍保留匯款
- Notify paid 後有 booking paid sync
- 不送 `LINEPAY=1`

### 2. Course

目前狀態：

- NewebPay 信用卡流程已接
- 課程限定信用卡分期已接
- `CREDIT=1`
- `InstFlag=3,6`
- paid 後有 `course_purchases` sync
- 課程分期不是信用卡定期定額
- 不送 `LINEPAY=1`

### 3. Divination

目前狀態：

- NT$50 NewebPay 付款流程已接
- `CREDIT=1`
- `InstFlag=0`
- 正式入口受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制
- paid gate 依 DB paid 狀態判斷
- Notify paid 後有 divination reading sync
- 本文件沒有做實刷，本輪沒有刷卡
- 不送 `LINEPAY=1`
- 正式站不顯示 OpenAI API key / env / server config 類內部錯誤
- 若 AI 解讀服務設定或服務暫時不可用，使用者只會看到泛用維護或客服協助訊息

### 4. AI Chart

目前狀態：

- NewebPay 後端骨架已存在
- ai_chart report create / read / paid sync 相關流程已建立
- `CREDIT=1`
- `InstFlag=0`
- 正式付款入口由 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制
- 預設與目前建議狀態是關閉
- 不會因全站 `NEXT_PUBLIC_ENABLE_NEWEBPAY=true` 自動開啟 AI 命盤正式付款
- 不送 `LINEPAY=1`

### 5. Product order / Cart

目前 product order 狀態：

- `product_orders` / `product_order_items` / `product_shipping_info` / `product_shipments` schema 已建立
- product order create API 已建立
- product order payment helper 已建立
- NewebPay pending payment 後端骨架已完成
- Notify paid 後可 sync `product_orders`
- NewebPay 商品付款使用 `CREDIT=1`
- NewebPay 商品 Apple Pay 使用 `APPLEPAY=1`
- 商品 NewebPay 不分期，維持 `InstFlag=0`

目前 cart 狀態：

- cart 付款區已改為「付款方式」選單
- cart 正式 NewebPay 信用卡 checkout 已接到選單 CTA
- cart 正式 NewebPay Apple Pay checkout 已接到選單 CTA
- cart 保留郵局匯款入口
- cart 官方 LINE Pay 前端流程已完成，但目前保存暫停
- 官方 LINE Pay 使用 `provider=line_pay`，不是 NewebPay MPG `LINEPAY=1`

### 6. Bank transfer

目前狀態：

- 郵局匯款維持既有流程
- booking / cart 等前端仍可導向匯款頁
- product order schema 支援 `payment_method=bank_transfer`
- product order create API 支援 `paymentMethod=bank_transfer`
- 既有匯款提交流程是否和 `product_order` 穩定綁定，仍需後續小包做實測與欄位盤點
- 匯款不走 NewebPay，也沒有分期參數

## 六、目前不能做的事

- 不要啟用藍新 `LINEPAY=1`
- 不要開官方 LINE Pay production
- 不要填 LINE Pay key 到文件
- 不要把 Channel Secret 貼聊天室
- 不要直接開 production 付款
- 不要混用 `provider=line_pay` 與 `provider=newebpay`
- 不要讓非課程付款出現信用卡分期
- 不要把 LINE Pay 官方 flow 當成藍新 flow
- 不要把 NewebPay Notify 當成官方 LINE Pay confirm
- 不要把官方 LINE Pay confirm / cancel route 接進 NewebPay MPG

## 七、下一步建議

### A. 繼續目前 NewebPay 信用卡主線

建議作為目前最穩路線：

- 信用卡一次付清全站主線
- 課程 3 / 6 期分期
- 商品 cart 信用卡與 Apple Pay
- LINE Pay 先暫停
- product order cart 若要擴充，先測 Notify paid sync 與人工出貨 SOP，不碰 LINE Pay

### B. 等藍新 LINE Pay 申請通過後評估

若藍新後台 LINE Pay 申請通過，可另開小包：

- 做藍新 MPG LINE Pay 可行性評估
- provider 維持 `newebpay`
- 評估是否送 `LINEPAY=1`
- 評估 Notify / Return / 前端文案 / paid sync 是否可沿用
- 可能比官方 LINE Pay 固定 IP proxy 維護成本低

### C. 日後若仍要官方 LINE Pay

可從已保存的官方 LINE Pay 程式接回：

- 使用 `provider=line_pay`
- 需要固定 IP proxy 或其他白名單方案
- 需要 key 由使用者自行填入 env，不貼聊天室
- 需要 sandbox 手測
- 需要 production sign-off
- 需要退款 / 發票 / coupon / timeout 方案確認

## 八、安全要求

- 不放 HashKey / HashIV / MerchantID 真值
- 不放 LINE Pay Channel Secret
- 不放 production env 真值
- 不放 sandbox env 真值
- 不放真實 `transactionId` / `orderId` / `paymentId`
- 不放個資
- 不放 TradeInfo / TradeSha
- 不放測試卡號
- 不放真實付款截圖或付款頁敏感資訊

## 九、本文件限制

- 本文件只整理目前 repo 與既有文件可確認的狀態。
- 本文件沒有登入藍新後台。
- 本文件沒有登入 LINE Pay 後台。
- 本文件沒有讀 `.env.local`。
- 本文件沒有讀 production env。
- 本文件沒有做任何付款 API 呼叫。
- production 實際開關狀態仍需部署環境人工確認。
