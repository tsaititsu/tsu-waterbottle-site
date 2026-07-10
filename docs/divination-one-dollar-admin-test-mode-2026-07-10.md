# 紫微占卜管理員限定 NT$1 實刷測試模式

日期：2026-07-10
小包：22J-45

## 目的

本模式只供管理員驗證紫微占卜 NewebPay 正式付款、Notify 與 paid gate。正式紫微占卜價格維持 NT$50，不修改商品、課程、預約或其他付款流程。

本文件不包含環境變數真值、管理員名單、production confirmation、MerchantID、HashKey、HashIV、TradeInfo 或 TradeSha。

## 正式與測試流程

- 一般使用者：只顯示並建立 NT$50 信用卡付款。
- 管理員未選測試模式：仍建立 NT$50 信用卡付款。
- 管理員且所有測試條件成立：額外顯示「管理員測試付款 NT$1」。
- NT$1 請求由 server 重新驗證，不信任前端傳入的測試欄位。
- 測試付款不使用 `mockPaid`，必須等 NewebPay Notify 驗證成功後才能通過 paid gate。

## 啟用條件

以下條件必須同時成立：

1. `ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE=true`
2. production confirmation 已正確設定
3. `ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE=true`
4. 使用者已有有效登入狀態
5. 使用者 email 位於 server-only `ADMIN_EMAILS` allowlist
6. 使用者明確選擇管理員 NT$1 測試付款

任一條件不成立時，admin status API 不開放測試入口；偽造測試 request 會由 create API 拒絕，不會建立 NT$1 payment。

## 付款與 metadata

NT$1 測試付款固定使用：

- provider：`newebpay`
- amount：`1`
- NewebPay `Amt=1`
- `CREDIT=1`
- `InstFlag=0`

不送出：

- `LINEPAY`
- `VACC`
- `APPLEPAY`
- `ANDROIDPAY`
- `SAMSUNGPAY`

pending payment metadata 包含：

- `test_payment=true`
- `one_dollar_test_mode=true`
- `divination_one_dollar_test=true`
- `original_amount=50`
- `test_source=divination`

metadata 不保存管理員 email、allowlist、confirmation 或金流 secret。

## 金額一致性與 paid gate

- payment DB `amount_twd`、pending metadata `amount` 與 NewebPay `Amt` 必須同為 1。
- Notify 與 QueryTradeInfo fallback 以本地 pending payment 的可信任金額進行比對。
- provider 回傳金額不是 1 時，不可 mark paid，也不可開啟解讀。
- 正式 NT$50 流程的 payment 與 provider 金額仍維持 50。
- payment 成功後沿用既有 divination reading paid sync；本模式不新增手動 paid 或假 paid 路徑。

## 管理員 status API

`GET /api/admin/divination-one-dollar-test`

- 必須攜帶有效登入 token。
- server 使用既有管理員 allowlist 驗證。
- 成功只回傳 `ok` 與 `enabled` boolean。
- 不回傳 env、`ADMIN_EMAILS`、production confirmation 或任何 secret。

## 測試限制

本小包只做程式與 mock 測試：

- 不呼叫 NewebPay API
- 不刷卡
- 不呼叫 OpenAI
- 不執行 SQL
- 不手動修改 payment 或 reading 狀態

實刷需另行人工確認；只有真實 Notify paid 後才可驗證完整解讀流程。

## 關閉方式

測試結束後將 `ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE` 關閉。若全站不再需要 1 元測試，也一併關閉總開關與前端測試提示。關閉後一般使用者與管理員都只能建立正式 NT$50 占卜付款。

## 隔離確認

- 商品 cart 金額與付款方式不受影響。
- 課程信用卡與 `InstFlag=3,6` 不受影響。
- 預約付款不受影響。
- 官方 `provider=line_pay` 保存流程不受影響。
- 不啟用藍新 `LINEPAY=1`、ATM 或 wallet payments。
