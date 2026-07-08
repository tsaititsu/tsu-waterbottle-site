# NewebPay 課程信用卡分期設定

## 目的

本文件記錄本專案 NewebPay MPG 信用卡分期的程式規則。

本次設定只允許「線上課程」付款帶信用卡 3 期 / 6 期分期參數。其他付款維持不分期。

## 後台前提

- 藍新後台需已啟用信用卡分期付款。
- 程式只控制送到 NewebPay MPG 的 TradeInfo 參數。
- 實際可否刷分期仍以藍新商店設定、銀行授權與藍新回應為準。

## 程式規則

### 線上課程

線上課程付款維持：

- provider: `newebpay`
- 支付方式: NewebPay MPG 信用卡
- TradeInfo: `CREDIT=1`
- TradeInfo: `InstFlag=3,6`

`InstFlag=3,6` 代表信用卡分期可使用 3 期與 6 期。

### 非課程付款

以下付款不得開信用卡分期：

- 預約論命 booking
- 占卜 divination
- AI 命盤 ai-chart
- 開運商品 product order / cart 商品
- 匯款 bank transfer
- 測試付款

非課程 NewebPay MPG TradeInfo 需維持不分期：

- 若是信用卡付款，仍可帶 `CREDIT=1`
- `InstFlag=0`
- 不得帶 `InstFlag=3,6`

`InstFlag=0` 或未帶分期代表不開啟信用卡分期。本專案目前在共用 NewebPay payment helper 中明確帶 `InstFlag=0`，避免商店後台預設分期影響非課程交易。

## 不是定期定額

這是 NewebPay MPG 信用卡分期付款，不是信用卡定期定額。

- 信用卡分期: 單筆交易拆成 3 / 6 期
- 定期定額: 每期固定扣款的 recurring payment

本專案此處只做信用卡分期，不做定期定額。

## LINE Pay 分界

本設定不使用 NewebPay MPG `LINEPAY=1`。

官方 LINE Pay 方案已另外保存，使用：

- provider: `line_pay`
- route: product order LINE Pay request / confirm / cancel
- feature flag: `NEXT_PUBLIC_ENABLE_LINE_PAY`

官方 LINE Pay `provider=line_pay` 不可和 NewebPay `provider=newebpay` 混用。

NewebPay LINE Pay 若未來要評估，需另開小包，不可在本設定中順手打開 `LINEPAY=1`。

## 安全規則

- 不提交 HashKey / HashIV / MerchantID 真值。
- 不輸出 TradeInfo / TradeSha 原文。
- 不在文件保存任何付款密鑰。
- 不呼叫 NewebPay API。
- 不刷卡。
- 不執行 SQL。

## 本次預期狀態

- 線上課程: `CREDIT=1`, `InstFlag=3,6`
- booking: 不分期，`InstFlag=0`
- divination: 不分期，`InstFlag=0`
- ai-chart: 不分期，`InstFlag=0`
- product order / cart 商品: 不分期，`InstFlag=0`
- test payment: 不分期，`InstFlag=0`
- NewebPay `LINEPAY=1`: 不啟用
- 官方 LINE Pay `provider=line_pay`: 保持獨立保存，不修改
