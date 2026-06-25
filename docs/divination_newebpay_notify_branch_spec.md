# 紫微牌卡占卜 NewebPay Notify 分支規格

## 1. 背景

現有 `POST /api/payments/newebpay/notify` 已負責：

```text
接收藍新付款通知
驗證 TradeSha
解密 TradeInfo
用 MerchantOrderNo 查 payments
更新 payments.status
課程付款成功後寫入 / 確認 course_purchases
```

未來需要新增：

```text
當 payment.item_type = ai_divination 時，同步更新 divination_readings。
```

此分支只處理付款同步，不處理 AI 解讀。AI 解讀應由付款完成後的前端流程呼叫 `/api/divination/interpret`，再由該 API 進行正式 payment gate 檢查。

## 2. ai_divination notify 分支目標

當藍新 notify 確認付款成功，且 `payment.item_type = ai_divination` 時：

```text
1. 確認 payment 對應到一筆 divination_readings
2. 確認付款金額為 NT$50
3. 確認 reading 狀態可從 pending_payment 變成 paid
4. 更新 reading.status = paid
5. 更新 reading.paid_at
6. 確認 reading.payment_id 與 merchant_order_no 綁定正確
```

此分支的核心目標是讓付款狀態與單筆占卜紀錄同步，讓後續 `/api/divination/interpret` 能安全判斷是否可以進入正式 AI 解讀。

## 3. 前置條件

此分支實作前必須完成：

```text
divination_readings SQL 已在 production 執行
POST /api/payments/newebpay/divination/start 已建立 payments
payments.item_type = ai_divination
payments.item_id = divination_readings.id
divination_readings.payment_id 已綁定 payments.id
divination_readings.merchant_order_no 已綁定 payments.merchant_order_no
```

若上述任一條件未完成，不應啟用正式 `ai_divination` notify 分支。

## 4. Notify 既有主流程不可破壞

`ai_divination` 分支必須在既有 notify 驗證與 `payments` 更新成功後執行。

要求：

```text
不得破壞 course 付款分支。
不得改變 test payment 行為。
不得繞過 TradeSha 驗證。
不得把 return route 當成付款可信來源。
```

也就是說，藍新通知仍必須先完成：

```text
TradeSha 驗證
TradeInfo 解密
MerchantOrderNo 查 payment
付款金額與 provider 驗證
payments.status 更新
```

之後才可進入 `ai_divination` 的業務同步。

## 5. 判斷條件

分支判斷：

```ts
if (payment.item_type === "ai_divination") {
  // run divination reading payment sync
}
```

只有 `payment.status` 已成功更新為 `paid` 時，才更新 `divination_readings`。

若藍新付款失敗，reading 應維持 `pending_payment` 或標記 `failed`，需依後續策略決定。第一版建議先不要在付款失敗時自動修改 reading 為 `failed`，避免使用者重試付款時流程變複雜；可先記錄 warning / raw payload，交由後續規格決定。

## 6. divination_readings 查找規則

優先方式：

```text
payment.item_id = divination_readings.id
```

輔助檢查：

```text
payment.id = divination_readings.payment_id
payment.merchant_order_no = divination_readings.merchant_order_no
payment.user_id = divination_readings.user_id
```

若找不到 reading：

```text
不得讓 notify 整體崩潰。
應記錄 error / warning。
payments 仍應維持已收到的付款狀態。
後台需人工處理。
```

原因是 `payments` 是金流通知的直接結果，若款項已成功，不能因 reading 同步失敗而抹掉付款狀態；但也不能讓該 reading 自動進入可解讀狀態。

## 7. 金額與商品檢查

必須明確檢查：

```text
payment.item_type = ai_divination
payment.amount_twd = 50
payment.currency = TWD
payment.provider = newebpay
```

若金額不符：

```text
不得更新 divination_readings.status = paid。
應記錄 failure_reason 或 warning。
需要人工處理。
```

正式版不可依前端傳來的金額判斷付款有效性，金額應以 `payments.amount_twd` 與藍新解密後的付款金額為準。

## 8. reading status 轉換規則

允許轉換：

```text
pending_payment → paid
```

如果 reading 已是：

```text
paid
interpreting
completed
```

則 notify 重送時應保持 idempotent：

```text
不得重複建立資料
不得重複觸發 AI 解讀
可以略過或確認狀態一致
```

如果 reading 是：

```text
failed
canceled
```

規則：

```text
不自動改成 paid，應記錄 warning，交由人工判斷。
```

這可以避免已取消或已標記失敗的占卜紀錄被重送通知意外改回可解讀狀態。

## 9. 建議更新欄位

付款成功後，更新 `divination_readings`：

```text
status = paid
paid_at = payment.paid_at 或 now()
payment_id = payment.id
merchant_order_no = payment.merchant_order_no
updated_at = now()
error_message = null
```

不要在 notify route 中：

```text
呼叫 OpenAI
產生 interpretation
改成 completed
```

理由：

```text
notify 是付款同步，不應承擔 AI 解讀工作。
AI 解讀應由前端付款成功後呼叫 /api/divination/interpret，並在該 API 中通過 payment gate 後產生。
```

## 10. Pseudo code

以下是分支流程 pseudo code，不是可直接貼上的完整正式程式：

```ts
if (payment.item_type === "ai_divination" && payment.status === "paid") {
  // 1. find reading by payment.item_id
  // const reading = await findDivinationReading(payment.item_id)

  // 2. validate payment_id / merchant_order_no / user_id
  // require reading.payment_id === payment.id
  // require reading.merchant_order_no === payment.merchant_order_no
  // require reading.user_id === payment.user_id

  // 3. validate amount and currency
  // require payment.amount_twd === 50
  // require payment.currency === "TWD"
  // require payment.provider === "newebpay"

  // 4. if reading.status === "pending_payment", update to paid
  // update reading.status = "paid"
  // update reading.paid_at = payment.paid_at ?? now()
  // clear reading.error_message

  // 5. if reading.status is already paid/interpreting/completed, treat as idempotent
  // return ok without triggering AI interpretation

  // 6. if failed/canceled, log warning and do not auto-change
}
```

正式實作時需要使用 Supabase admin client，但目前不要打開或修改 dirty admin file。

## 11. 錯誤處理策略

建議處理方式：

| 情況 | 建議處理 |
| --- | --- |
| 找不到 reading | 不讓 notify 整體崩潰；記錄 warning；`payments` 保留已收到的付款狀態；交由後台人工處理。 |
| 金額不符 | 不更新 reading 為 `paid`；記錄 failure reason / warning；人工處理。 |
| `reading.user_id` 與 `payment.user_id` 不一致 | 不更新 reading；記錄 warning；人工處理。 |
| `merchant_order_no` 不一致 | 不更新 reading；記錄 warning；人工處理。 |
| `payment_id` 不一致 | 不更新 reading；記錄 warning；人工處理。 |
| reading 狀態不允許轉換 | 若為 `paid` / `interpreting` / `completed`，視為 idempotent；若為 `failed` / `canceled`，不自動修改，記錄 warning。 |
| 更新 reading 失敗 | 不回滾已成功的 payment；記錄 warning 或 error；人工處理。 |

原則：

```text
不要讓 notify 整體失敗到藍新一直重送，除非付款本身驗證失敗。
payments 保留 paid 狀態。
reading 錯誤交由人工處理。
必要時記錄 raw_payload / failure_reason / warning。
```

付款本身驗證失敗，例如 TradeSha 無效、TradeInfo 解密失敗、payment 找不到、金額與藍新通知不一致，仍應依既有 notify 主流程回傳錯誤。

## 12. Return route 角色

return route 只負責導回前端。

```text
notify route 才是付款可信來源。
前端看到 payment=success 不代表可以直接產生 AI 解讀。
interpret API 必須重新查 payment + reading gate。
```

因此即使前端網址是：

```text
/ai-divination?readingId=xxx&payment=success
```

也只能當作 UI 提示與下一步觸發依據，不能當成付款已完成的 server-side 證據。

## 13. 與 interpret API 的關係

正式流程：

```text
notify 將 reading.status 更新為 paid
前端導回 /ai-divination?readingId=xxx&payment=success
前端呼叫 /api/divination/interpret
interpret API 查 reading + payment
確認 status paid 後才呼叫 OpenAI
interpret API 成功後更新 reading.status = completed
```

OpenAI 不應在 notify route 中呼叫。

原因：

```text
notify 是金流 server-to-server 通知，應快速、穩定、可重送。
AI 解讀可能耗時、失敗或需要更細的防重複鎖定。
付款同步和 AI 解讀應分成兩個責任邊界。
```

## 14. 目前不可實作原因

目前不可實作原因：

```text
divination_readings SQL 尚未在 production 執行
NewebPay divination start route 尚未實作
金流 / LINE Pay 審核期間不應啟用新付款商品
interpret API 目前仍是 mock gate
OpenAI 尚未正式接入
```

另外，正式付款 gate 尚未改成查 `payments + divination_readings`，目前 mock gate 不能被視為正式付款依據。

## 15. 下一步建議

下一步先做正式 interpret API payment gate 規格文件，不實作。
