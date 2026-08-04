# LINE Pay Sandbox／Production NT$1 雙環境測試

本流程用同一個管理員後台面板，各執行一次 LINE Pay Sandbox 與 Production NT$1 付款。測試商品只由伺服器建立，不存在公開商品目錄，也不能由瀏覽器改價。

## 安全邊界

- 只有 `ADMIN_EMAILS` 內的已登入管理員能呼叫測試 API。
- Preview 只接受 `LINE_PAY_ENV=sandbox`，Production 只接受 `LINE_PAY_ENV=production`。
- 兩種模式皆固定金額 NT$1、幣別 TWD、數量 1。
- Preview 使用 Sandbox capability cookie 與內部 callback；Production 使用正式購物車既有 capability cookie 與公開 callback。
- Production 付款網址只接受 `https://web-pay.line.me/web/...`；Sandbox 只接受 `https://sandbox-web-pay.line.me/...`。
- Production 測試商品與訂單明確標示「不出貨」，使用固定的非個資寄送資料以符合正式訂單契約。
- 同一個完整 commit SHA 與管理員帳號只會產生同一組 Production database identity，避免重新載入造成第二筆測試訂單。
- API 回應不提供 payment、order、attempt 或 transaction 識別碼。

## Preview Sandbox 設定

只確認變數名稱，不記錄或輸出 Secret 真值：

```text
VERCEL_ENV=preview
NEXT_PUBLIC_ENABLE_LINE_PAY=true
LINE_PAY_ENV=sandbox
LINE_PAY_TRANSPORT=gateway
LINE_PAY_SANDBOX_E2E_ENABLED=true
```

Preview 需要既有 Sandbox Channel、callback、Gateway 與 Supabase 設定。後台顯示「LINE Pay Sandbox E2E」後，勾選確認並執行一次 NT$1 Sandbox 測試。

## Production NT$1 設定

Production 除既有 LINE Pay Production 與 Gateway 設定外，還必須同時設定：

```text
LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED=true
LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION=RUN_LINE_PAY_PRODUCTION_NT1_ONCE
```

兩個值都不是金流 Secret；它們是 fail-closed 的臨時操作開關。只有 Vercel Production、完整 commit SHA 與兩個值完全一致時，後台才顯示「LINE Pay Production NT$1」。

## 執行順序

1. 部署 PR Preview，確認 `/admin` 只顯示 Sandbox NT$1 面板。
2. 由管理員完成 Sandbox 付款，回到 `/cart?linePay=success`。
3. 檢查 Sandbox payment 與 product order 已同步為 paid，且沒有重複訂單。
4. 通過 Preview checks 並取得完整 commit SHA 部署授權後，合併與正式部署。
5. 在 Production 啟用兩個臨時開關，確認 `/admin` 只顯示 Production NT$1 面板。
6. 由管理員確認「真實扣款 NT$1」後完成付款，回到 `/cart?linePay=success`。
7. 檢查 Production payment 與 product order 已同步為 paid，訂單標記「不出貨」，且沒有重複訂單。
8. 測試完成後將兩個 Production 臨時開關停用並重新部署，確認面板消失。

## 結果回報

只回報環境、commit、HTTP／付款結果與遮蔽後的識別碼。不得貼 Channel Secret、Gateway Secret、完整 transactionId、完整 orderId、完整 paymentId 或任何真實付款資料。
