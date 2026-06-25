# 紫微牌卡占卜 Interpret API Payment Gate 規格

## 1. 背景

正式網站目前已完成紫微牌卡占卜的 mock 解讀流程基礎：

```text
POST /api/divination/readings/create mock route
POST /api/divination/interpret mock route
mock payment gate
structured interpretation response
divination_readings SQL 草稿
NewebPay start route 規格
NewebPay notify ai_divination 分支規格
```

目前這些功能仍屬於開發流程與牌義預覽，尚未進入正式付款與正式 AI 解讀。

目前尚未完成：

```text
production 執行 divination_readings SQL
正式 NewebPay 占卜付款
notify 實際支援 ai_divination
interpret API 正式查 payments + divination_readings
正式 OpenAI 解讀
```

本文件定義未來 `POST /api/divination/interpret` 從 mock gate 改成正式 `divination_readings + payments` payment gate 的規格，不代表目前已實作。

## 2. 正式 Interpret API 目標

正式版 route 仍然是：

```text
POST /api/divination/interpret
```

但正式版不應再信任前端傳：

```text
question
drawMode
cardId
position
mockPaymentGate
cardMeaning
cardAdvice
```

正式版 request 應改成最小格式：

```ts
{
  readingId: string
}
```

或過渡期格式：

```ts
{
  readingId: string
  paymentId?: string
}
```

正式 interpret API 的核心責任是：

```text
1. 根據 readingId 查 divination_readings
2. 驗證此 reading 已完成付款
3. 驗證 payments 狀態與金額正確
4. 防止同一筆付款重複產生 OpenAI 成本
5. 通過 gate 後才呼叫 OpenAI
6. 將 structured interpretation 儲存回 divination_readings
7. 回傳 structured interpretation 給前端
```

## 3. Server-side 必查資料

正式版 `POST /api/divination/interpret` 必須查：

```text
divination_readings
payments
server 端 cards.ts
目前登入使用者
```

各自用途：

- `divination_readings`：取得 `question`、`draw_mode`、`card_id`、`position`、`status`、`payment_id`。
- `payments`：確認付款狀態、金額、商品類型、付款 provider。
- `cards.ts`：server 端重新取得牌義，不信任前端。
- current user：確認此 reading 屬於目前登入者。

正式版不得只依前端 body 判斷是否可以產生解讀。

## 4. reading 檢查規則

正式版必須檢查：

```text
readingId 必須存在
reading 必須查得到
reading.user_id 必須等於目前登入 user
reading.question 必須存在
reading.draw_mode 必須是 manual 或 auto
reading.card_id 必須存在
reading.position 必須是 upright 或 reversed
reading.status 必須是 paid / completed 其中之一
reading.payment_id 必須存在
```

若 `reading.status` 是：

```text
pending_payment
```

應回傳：

```text
尚未完成付款，無法產生解讀。
```

若 `reading.status` 是：

```text
canceled
failed
```

應回傳明確錯誤，不自動產生解讀。

若 `reading.status = completed` 且已有 `interpretation`，應直接回傳既有解讀，不重新呼叫 OpenAI。

## 5. payment 檢查規則

正式 payment gate 必須檢查：

```text
payment 必須查得到
payment.id = reading.payment_id
payment.user_id = reading.user_id
payment.provider = newebpay
payment.status = paid
payment.item_type = ai_divination
payment.item_id = reading.id
payment.amount_twd = 50
payment.currency = TWD
payment.merchant_order_no = reading.merchant_order_no
payment.paid_at 不可為空
```

任一條件不通過時，不可呼叫 OpenAI。

錯誤 response 建議：

```ts
{
  ok: false,
  error: "尚未通過付款 Gate，無法產生解讀。"
}
```

HTTP status 建議：

```text
402 Payment Required
```

## 6. 防止重複產生 OpenAI 成本

### reading.status = completed

代表已經產生過正式解讀。

此時：

```text
不應再次呼叫 OpenAI
直接回傳 divination_readings.interpretation
```

### reading.status = interpreting

代表正在產生中。

此時：

```text
不應再次呼叫 OpenAI
回傳「解讀產生中，請稍後再試」
```

HTTP status 可用：

```text
409 Conflict
```

### reading.status = paid

代表已付款但尚未解讀。

此時才可以：

```text
將 status 改成 interpreting
呼叫 OpenAI
成功後寫入 interpretation
改成 completed
```

### reading.status = failed

需另行設計是否允許重試。第一版建議：

```text
不自動重試
回傳錯誤，交由後台或客服處理
```

## 7. status 轉換規則

正式 interpret API 只允許這條主線：

```text
paid
→ interpreting
→ completed
```

失敗時：

```text
paid 或 interpreting
→ failed
```

規則：

- 進入 OpenAI 前，先把 `status` 改成 `interpreting`。
- OpenAI 成功後，寫入 `interpretation`，改成 `completed`。
- OpenAI 失敗時，寫入 `error_message`，改成 `failed`。
- 不可在 `pending_payment` 狀態呼叫 OpenAI。

若 status update 失敗，不應呼叫 OpenAI，避免同一筆 reading 被多個請求同時產生解讀。

## 8. OpenAI 呼叫位置

OpenAI 必須放在 payment gate 完整通過之後。

流程：

```text
驗證 reading
→ 驗證 payment
→ 驗證 status 可解讀
→ server 端查 cards.ts
→ build prompt
→ 呼叫 OpenAI
→ parse structured response
→ 儲存 interpretation
→ 回傳前端
```

明確限制：

```text
notify route 不呼叫 OpenAI。
return route 不呼叫 OpenAI。
前端不能直接呼叫 OpenAI。
```

OpenAI API key、prompt、模型設定都必須只存在 server-side，不可暴露給前端。

## 9. Server-side card lookup

正式版不可使用前端傳來的牌義。

正式版應用：

```text
reading.card_id
reading.position
```

從：

```text
src/lib/divination/cards.ts
```

重新查：

```text
card.name
card.image
card.reversedImage
card.huaqi
card.element
card.core
uprightMeaning / reversedMeaning
advice.upright / advice.reversed
```

若找不到 card：

```text
不呼叫 OpenAI
reading.status 可標記 failed
error_message = card not found
```

這可以避免前端偽造牌義或傳入不存在的牌卡。

## 10. Structured interpretation response

正式成功 response：

```ts
{
  ok: true,
  readingId: string,
  interpretation: {
    summary: string
    cardMessage: string
    situationAnalysis: string
    advice: string
    reminder: string
  },
  card: {
    id: string
    name: string
    image: string
    reversedImage: string
    huaqi: string
    element: string
    core: string
  },
  position: "upright" | "reversed",
  paymentGate: {
    provider: "newebpay"
    status: "paid"
    itemType: "ai_divination"
    amountTwd: 50
    currency: "TWD"
  }
}
```

錯誤 response：

```ts
{
  ok: false,
  error: string
}
```

response 必須穩定，方便前端用固定欄位渲染，也方便後續後台與客服讀取同一份 structured interpretation。

## 11. interpret API pseudo code

以下為 pseudo code，不是完整可貼上的正式程式：

```ts
export async function POST(request: Request) {
  // 1. parse readingId
  // const { readingId } = await request.json()

  // 2. require current user
  // const userId = await getUserIdFromRequest(request)

  // 3. find divination_readings by readingId
  // const reading = await findReading(readingId)

  // 4. validate reading owner
  // require reading.user_id === userId

  // 5. if completed, return existing interpretation
  // if reading.status === "completed" && reading.interpretation return existing result

  // 6. validate reading.status === paid
  // reject pending_payment / failed / canceled / interpreting

  // 7. find payment by reading.payment_id
  // const payment = await findPayment(reading.payment_id)

  // 8. validate payment gate
  // require payment.status === "paid"
  // require payment.item_type === "ai_divination"
  // require payment.amount_twd === 50
  // require payment.item_id === reading.id

  // 9. find card from cards.ts
  // const card = ziweiCards.find(card => card.id === reading.card_id)

  // 10. update reading.status = interpreting
  // use a guarded update so only status === "paid" can be changed

  // 11. call OpenAI
  // build prompt from reading + card server-side data

  // 12. save structured interpretation
  // update reading.interpretation / interpreted_at / status

  // 13. update reading.status = completed

  // 14. return interpretation
}
```

正式實作時需要使用 Supabase admin client，但目前不要打開或修改 dirty admin file。

## 12. 錯誤處理策略

| 錯誤 | 建議處理方式 |
| --- | --- |
| `readingId` 缺失 | 回傳 400，不查 DB，不呼叫 OpenAI。 |
| reading 不存在 | 回傳 404，不呼叫 OpenAI。 |
| `reading.user_id` 不符 | 回傳 403，不呼叫 OpenAI。 |
| reading 尚未付款 | 回傳 402，訊息可用「尚未完成付款，無法產生解讀。」 |
| payment 不存在 | 回傳 402 或 409，不呼叫 OpenAI。 |
| `payment.status` 不是 `paid` | 回傳 402，不呼叫 OpenAI。 |
| `payment.amount_twd` 不是 50 | 回傳 402 或 409，不呼叫 OpenAI，記錄 warning。 |
| `payment.item_type` 不是 `ai_divination` | 回傳 402 或 409，不呼叫 OpenAI。 |
| `payment.item_id` 與 `reading.id` 不符 | 回傳 402 或 409，不呼叫 OpenAI。 |
| `card_id` 找不到 | 不呼叫 OpenAI，可把 reading 標記 `failed` 並記錄 `error_message`。 |
| OpenAI 失敗 | 記錄 `error_message`，將 reading 改成 `failed`，回傳一般化錯誤。 |
| structured response parse 失敗 | 記錄 `error_message`，將 reading 改成 `failed`。 |
| Supabase 更新失敗 | 不應回傳完整 stack；回傳一般化錯誤，必要時保留 server log。 |

原則：

- payment gate 沒通過時，不可呼叫 OpenAI。
- OpenAI 失敗時，要記錄 `error_message`。
- 已付款但 AI 失敗時，後續需有客服補救策略。
- 不應把錯誤堆疊直接回傳給前端。

## 13. 與 mock gate 的差異

### 目前 mock gate

```text
前端 create reading mock route 回傳 mockPaymentGate
interpret route 檢查 mockPaymentGate
不查 DB
不查 payments
不寫 interpretation
不接 OpenAI
```

### 正式 gate

```text
interpret route 只收 readingId
server 查 divination_readings
server 查 payments
server 查 cards.ts
通過 paid gate 才呼叫 OpenAI
儲存 interpretation
防止重複解讀
```

mockPaymentGate 不可出現在正式 production 解讀流程。

未來若仍需要開發測試模式，必須用明確環境變數限制，只能在非 production 使用，且不可與正式付款流程混用。

## 14. 前端配合事項

前端未來流程：

```text
付款成功導回 /ai-divination?readingId=xxx&payment=success
前端讀取 readingId
前端呼叫 POST /api/divination/interpret，body 只送 readingId
interpret API 成功後顯示 AI 解讀結果
```

暫時不需要前端送：

```text
question
drawMode
cardId
position
mockPaymentGate
```

前端可以顯示 loading 與付款成功提示，但是否真的能解讀，必須以 `POST /api/divination/interpret` 的 server-side gate 結果為準。

## 15. 目前不可實作原因

目前不可實作原因：

```text
divination_readings SQL 尚未在 production 執行
NewebPay divination start route 尚未實作
notify route 尚未支援 ai_divination
正式 OpenAI prompt 尚未設計
金流 / LINE Pay 審核期間不應啟用新付款商品
```

此外，目前正式網站仍在審核狀態，不應新增或啟用新的正式付款商品。

## 16. 下一步建議

下一步先做正式 OpenAI prompt builder 規格文件，不實作。
