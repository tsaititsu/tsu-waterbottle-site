# 紫微牌卡占卜付款 Gate 與資料表設計規格

## 1. 背景

正式網站目前已完成紫微牌卡占卜的本機流程雛形：

```text
填問題
→ 選手動 / 自動
→ 抽牌
→ 正反位
→ POST /api/divination/interpret mock API
→ structured JSON 結果
```

目前這個流程只提供牌義預覽，尚未接入正式收費與正式 AI 解讀。

目前尚未接入：

```text
NT$50 付款
正式 OpenAI 解讀
Supabase 寫入占卜紀錄
後台查詢
```

本文件只定義未來正式版的資料流、付款 gate、資料表欄位與 API 檢查規則，不代表目前已實作。

## 2. 正式產品規則

正式商品規則如下：

```text
商品類型 item_type：ai_divination
商品名稱 item_name：紫微牌卡 AI 深度解讀
金額 amount_twd：50
付款 provider：newebpay
付款時機：抽牌後，按「開始解讀」前
```

正式流程建議：

```text
填問題
→ 選手動 / 自動
→ 抽牌
→ 顯示牌卡與正反位
→ 建立 divination_readings
→ 建立 NT$50 藍新付款
→ 付款成功
→ 回到同一筆占卜
→ POST /api/divination/interpret
→ server 檢查 payment gate
→ 產生 AI 解讀
→ 儲存結果
→ 前端顯示結果
```

付款應綁定單次占卜紀錄，不應只綁定前端狀態。正式 OpenAI 解讀必須放在 server-side payment gate 後面。

## 3. 建議資料表：divination_readings

以下是建議資料表欄位設計，僅為規格，不是可執行 SQL migration。

| 欄位 | 建議型態 | 必填 | 說明 |
| --- | --- | --- | --- |
| `id` | uuid / text | 是 | 占卜紀錄 id，付款與解讀都綁定這個 id。 |
| `user_id` | uuid / text | 是 | 會員 id，用來確認這筆占卜屬於目前登入者。 |
| `payment_id` | uuid / text | 否 | 對應 `public.payments.id`。建立付款後寫入。 |
| `merchant_order_no` | text | 否 | 藍新訂單編號，方便付款 return / notify 後查找。 |
| `question` | text | 是 | 使用者占卜問題。 |
| `draw_mode` | text | 是 | `manual` 或 `auto`。 |
| `card_id` | text | 是 | 紫微牌卡 id，例如 `ziwei`、`tianji`。 |
| `card_name` | text | 是 | 紫微牌卡名稱，例如 `紫微星`、`天機星`。 |
| `position` | text | 是 | `upright` 或 `reversed`。 |
| `status` | text | 是 | `pending_payment`、`paid`、`interpreting`、`completed`、`failed`、`canceled`。 |
| `interpretation` | jsonb | 否 | AI 解讀 structured JSON。 |
| `error_message` | text | 否 | 失敗原因，給客服或後台排查。 |
| `created_at` | timestamptz | 是 | 建立時間。 |
| `updated_at` | timestamptz | 是 | 最後更新時間。 |
| `paid_at` | timestamptz | 否 | 付款完成時間。 |
| `interpreted_at` | timestamptz | 否 | AI 解讀完成時間。 |

建議在未來 migration 中加上必要限制：

- `payment_id` 應唯一，避免同一筆付款綁定多筆占卜。
- `status` 應限制在固定狀態集合。
- `draw_mode` 應限制在 `manual` / `auto`。
- `position` 應限制在 `upright` / `reversed`。

## 4. status 狀態設計

主要成功狀態流：

```text
pending_payment
→ paid
→ interpreting
→ completed
```

失敗或中止狀態：

```text
failed
canceled
```

狀態說明：

| 狀態 | 說明 |
| --- | --- |
| `pending_payment` | 已建立占卜紀錄，等待建立付款或等待付款完成。 |
| `paid` | 付款已成功，可進入 AI 解讀 gate。 |
| `interpreting` | server 正在產生 AI 解讀，用來避免重複呼叫 OpenAI。 |
| `completed` | AI 解讀已完成，`interpretation` 已保存。 |
| `failed` | 付款或解讀流程失敗，需要後台或客服判斷是否可重試。 |
| `canceled` | 使用者取消付款或流程中止。 |

若 `status = completed`，再次呼叫解讀 API 不應重新產生 OpenAI 解讀，應直接回傳既有 `interpretation`。

## 5. payments table 使用方式

建立占卜付款時，`payments` 應寫入：

```text
provider = newebpay
item_type = ai_divination
item_id = divination_readings.id
item_name = 紫微牌卡 AI 深度解讀
amount_twd = 50
currency = TWD
status = pending
merchant_order_no = 系統產生
```

付款成功後，由現有藍新 notify route 更新：

```text
status = paid
paid_at
provider_payment_id
provider_trade_no
notify_received_at
raw_payload
failure_reason = null
```

責任切分：

- 付款狀態存在 `payments.status`。
- 占卜業務狀態存在 `divination_readings.status`。
- `payments.item_id` 應指向 `divination_readings.id`。
- `payments.item_type = ai_divination` 時，不應開通課程，也不應寫入 `course_purchases`。

未來藍新 notify route 需要把 `ai_divination` 加入可支援商品檢查，並在付款成功後更新對應 `divination_readings` 為 `paid`。

## 6. interpret API payment gate

正式版：

```text
POST /api/divination/interpret
```

正式版 request 建議只傳：

```ts
{
  readingId: string
}
```

或在初期保守設計為：

```ts
{
  readingId: string
  paymentId: string
}
```

正式版 server 不應信任前端傳來的：

```text
question
cardId
position
cardMeaning
```

正式版 server 應執行：

1. 依 `readingId` 查 `divination_readings`。
2. 確認 reading 屬於目前登入者。
3. 確認 `reading.status = paid`。
4. 查 `payments`。
5. 確認：

   ```text
   payment.status = paid
   payment.item_type = ai_divination
   payment.amount_twd = 50
   payment.item_id = reading.id
   payment.user_id = current user
   ```

6. 確認尚未完成解讀。
7. 從 server 端 `cards.ts` 依 `reading.card_id` 重新查牌義。
8. 將 `reading.status` 改成 `interpreting`。
9. 呼叫 OpenAI。
10. 儲存 structured interpretation。
11. 將 `reading.status` 改成 `completed`。
12. 回傳 structured interpretation 給前端。

若 `reading.status = completed` 且已有 `interpretation`，可直接回傳既有結果，不重新呼叫 OpenAI。

## 7. 防止重複使用付款

防重複策略：

- 同一筆 `payment_id` 只能綁一筆 `divination_readings`。
- 同一筆 `merchant_order_no` 只能對應一筆付款與一筆占卜。
- 同一筆 reading 如果已經 `completed`，再次呼叫 interpret 不應重新呼叫 OpenAI。
- 再次呼叫時可以直接回傳既有 `interpretation`。
- 若 `status = interpreting`，應回傳「解讀中」或要求稍後重試，避免同時產生多次。
- 若 `status = failed`，是否允許重試要另行設計。

建議最小安全設計：

```text
completed → 回傳既有結果
interpreting → 不重複呼叫 OpenAI
paid → 可進入 interpreting
failed → 暫不自動重試，交由後台或客服判斷
```

## 8. 付款完成後導回頁面

### 方式 A

```text
/ai-divination?readingId=xxx&payment=success
```

優點：

- 沿用現有 `/ai-divination` 頁面。
- 前端改動較小。
- 可在同一頁載入付款後狀態，接著呼叫 interpret。

缺點：

- `/ai-divination` 頁面要能根據 `readingId` 載入狀態。
- 若未來結果內容變多，頁面會逐漸變複雜。

### 方式 B

```text
/ai-divination/readings/[id]
```

優點：

- 單筆占卜結果頁比較乾淨。
- 適合未來做占卜紀錄、重新查看、客服查詢。
- 路由語意清楚。

缺點：

- 需要新增 route。
- 需要額外設計讀取 loading、付款失敗、找不到紀錄等狀態。

目前建議：

```text
第一階段先用方式 A。
後續正式結果頁與占卜紀錄成熟後，再改成方式 B。
```

## 9. API 路線規劃

未來可能需要的 API：

| Route | Method | 用途 |
| --- | --- | --- |
| `/api/divination/readings/create` | POST | 建立 `divination_readings`，保存問題、抽牌方式、牌卡與正反位，狀態為 `pending_payment`。 |
| `/api/payments/newebpay/divination/start` | POST | 建立 NT$50 藍新付款，寫入 `payments`，並把 `payment_id` / `merchant_order_no` 綁回 reading。 |
| `/api/divination/readings/[id]` | GET | 讀取單筆占卜紀錄、付款狀態與解讀狀態。 |
| `/api/divination/interpret` | POST | 檢查 payment gate，通過後產生或回傳 AI 解讀。 |

這些 route 只列為規劃，不代表目前已實作。

## 10. 實作順序建議

建議小步驟順序：

1. 先新增 `divination_readings` SQL migration 檔，但不在 production 執行。
2. 新增 create reading mock route。
3. 新增 divination payment start route。
4. 付款成功後綁定 reading。
5. `POST /api/divination/interpret` 加 payment gate。
6. 最後才接 OpenAI。

重要原則：

```text
正式 OpenAI 必須放在 payment gate 後面。
```

原因：

- 避免未付款使用者直接打 API 消耗 OpenAI 成本。
- 避免同一筆付款重複產生多次 AI 解讀。
- 讓客服能用 reading / payment 對照排查。

## 11. 暫不做事項

目前不要做：

```text
不接 OpenAI
不執行 production SQL
不啟用正式付款
不部署
不處理點數制
不搬舊 ziwei-card 使用者資料
不做每日免費
不做儲值
```

也暫不做：

- 不新增 API route。
- 不新增 SQL migration。
- 不修改付款 notify route。
- 不修改現有 mock interpretation。
- 不修改後台。
- 不合併舊占卜系統資料。

