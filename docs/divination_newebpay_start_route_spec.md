# 紫微牌卡占卜 NewebPay Start Route 草稿規格

## 1. 背景

正式網站目前已完成紫微牌卡占卜付款前的 mock 流程基礎：

```text
POST /api/divination/readings/create mock route
POST /api/divination/interpret mock route
mock payment gate
divination_readings SQL 草稿
付款 gate 規格文件
```

目前這些功能只作為開發與流程預覽使用，尚未連接正式付款、正式資料庫寫入或正式 AI 解讀。

尚未完成：

```text
divination_readings production SQL 執行
正式 NewebPay 占卜付款 start route
NewebPay notify 的 ai_divination 分支
正式付款 gate
正式 OpenAI 解讀
```

本文件只定義未來 `POST /api/payments/newebpay/divination/start` 的草稿規格，不代表目前已實作，也不應在 LINE Pay / 金流審核期間啟用。

## 2. 未來正式 route

未來正式 route：

```text
POST /api/payments/newebpay/divination/start
```

用途：

```text
為已建立的 divination_readings 產生 NT$50 NewebPay 付款表單。
```

request body：

```ts
{
  readingId: string
}
```

success response：

```ts
{
  ok: true,
  paymentId: string,
  readingId: string,
  merchantOrderNo: string,
  form: {
    MerchantID: string
    TradeInfo: string
    TradeSha: string
    Version: string
    actionUrl: string
  }
}
```

error response：

```ts
{
  ok: false,
  error: string
}
```

## 3. Server-side 檢查規則

route 必須檢查：

```text
1. 使用者必須登入
2. readingId 必須存在
3. divination_readings 必須查得到
4. reading.user_id 必須等於目前登入 user
5. reading.status 必須是 pending_payment
6. reading.card_id / position / question 必須已存在
7. 若 reading 已有 payment_id，不應重複建立付款
8. 若 reading.status 已是 paid / interpreting / completed，不應重新建立付款
```

正式版不可相信前端傳來的：

```text
amount
item_name
item_type
question
cardId
position
```

金額、商品名稱、商品類型與付款狀態必須由 server 固定決定。前端只應提供 `readingId`，server 再依 `readingId` 查 `divination_readings`。

## 4. payments 寫入規格

建立付款時，`payments` 應寫入：

```text
provider = newebpay
item_type = ai_divination
item_id = divination_readings.id
item_name = 紫微牌卡 AI 深度解讀
amount_twd = 50
currency = TWD
status = pending
merchant_order_no = generateMerchantOrderNo('DIVINATION')
raw_payload.source = newebpay_divination_start
```

`payments.item_id` 應放 `readingId`，讓付款與單次占卜穩定對應。這樣 notify route 收到付款結果後，可以從 `payments.item_id` 找回對應的 `divination_readings`。

建立 payment 後，應同步更新 `divination_readings`：

```text
payment_id = payments.id
merchant_order_no = merchantOrderNo
updated_at = now()
```

注意：目前 `divination_readings` SQL 尚未在 production 執行，因此以上內容只作為未來設計，不可現在實作或執行。

## 5. NewebPay 參數規格

應沿用課程付款 start route 與現有 NewebPay helper 的 MPG 參數：

```text
MerchantID
RespondType
TimeStamp
Version
MerchantOrderNo
Amt
ItemDesc
ReturnURL
NotifyURL
ClientBackURL
Email
LoginType
```

建議參數：

```text
Amt = 50
ItemDesc = 紫微牌卡 AI 深度解讀
ReturnURL = /api/payments/newebpay/return
NotifyURL = /api/payments/newebpay/notify
ClientBackURL = /ai-divination?readingId={readingId}
```

實際藍新參數、加密方式、`TradeInfo`、`TradeSha` 與表單格式，應以現有 NewebPay helper / 課程付款 route 實作為準。

## 6. merchant_order_no 規則

建議未來使用：

```ts
generateMerchantOrderNo('DIVINATION')
```

若現有 helper 對 prefix 長度或格式有限制，應沿用 helper 的規則；若 helper 不支援 `DIVINATION`，未來可新增或調整 prefix，但仍需保持藍新可接受的訂單編號格式。

要求：

```text
merchant_order_no 必須同時存在 payments 與 divination_readings。
notify route 才能穩定找到付款與占卜紀錄。
```

建議關聯方式：

```text
payments.merchant_order_no = divination_readings.merchant_order_no
payments.item_id = divination_readings.id
divination_readings.payment_id = payments.id
```

## 7. Notify route 後續需求

未來 `POST /api/payments/newebpay/notify` 需要新增分支：

```text
若 payment.item_type = ai_divination：
1. 找到 divination_readings
2. 確認 payment.item_id = reading.id
3. 確認金額為 50
4. 付款成功後更新 reading.status = paid
5. 更新 reading.paid_at = now()
6. 確認 payment_id / merchant_order_no 已綁定
```

notify 是付款成功的可信來源，return 只負責導回前端。正式解讀 API 不應只依前端 query 判斷付款成功，必須由 server 查 `payments` 與 `divination_readings`。

未來 notify route 也應避免把 `ai_divination` 當成課程付款，不應寫入 `course_purchases`。

## 8. Return route 與前端導回

第一版建議導回：

```text
/ai-divination?readingId={readingId}&payment=success
```

前端收到 `readingId` 後，未來可載入 reading 狀態。若 `reading.status = paid`，才允許呼叫：

```text
POST /api/divination/interpret
```

第一版暫時不新增：

```text
/ai-divination/readings/[id]
```

原因：

```text
第一版先沿用 /ai-divination，降低 route 數量。
等占卜紀錄與結果頁成熟後，再拆單筆 reading page。
```

未來若結果頁、占卜紀錄、後台查詢都穩定後，再新增單筆 reading page 會比較乾淨。

## 9. Pseudo code

以下是未來 route 大致流程，只是 pseudo code，不是可直接貼上的正式程式：

```ts
export async function POST(request: Request) {
  // 1. parse body
  // const { readingId } = await request.json()

  // 2. require user
  // const userId = await getUserIdFromRequest(request)
  // if (!userId) return unauthorized

  // 3. find divination_readings by readingId
  // const reading = await findDivinationReading(readingId)

  // 4. validate owner and status
  // require reading.user_id === userId
  // require reading.status === "pending_payment"
  // require reading.payment_id is null
  // require reading.question / reading.card_id / reading.position exist

  // 5. create merchantOrderNo
  // const merchantOrderNo = generateMerchantOrderNo("DIVINATION")

  // 6. insert payment
  // provider = "newebpay"
  // item_type = "ai_divination"
  // item_id = reading.id
  // item_name = "紫微牌卡 AI 深度解讀"
  // amount_twd = 50
  // currency = "TWD"
  // status = "pending"
  // merchant_order_no = merchantOrderNo

  // 7. update divination_readings payment_id / merchant_order_no
  // reading.payment_id = payment.id
  // reading.merchant_order_no = merchantOrderNo

  // 8. build NewebPay MPG form
  // notifyUrl = `${siteUrl}/api/payments/newebpay/notify`
  // returnUrl = `${siteUrl}/api/payments/newebpay/return`
  // clientBackUrl = `${siteUrl}/ai-divination?readingId=${reading.id}`

  // 9. return form
  // return { ok: true, paymentId, readingId, merchantOrderNo, form }
}
```

正式實作時需要使用 Supabase admin client，但目前不要打開或修改 dirty admin file。

## 10. 目前不可實作原因

目前不可實作原因：

```text
1. divination_readings SQL 尚未在 production 執行
2. 金流 / LINE Pay 審核期間不應啟用新付款商品
3. notify route 尚未支援 ai_divination
4. interpret API 尚未正式檢查 payments + divination_readings
5. OpenAI 尚未放到正式付款 gate 後面
```

此外，目前 mock payment gate 只適合本機與開發流程驗證，不能被視為正式付款成功依據。

## 11. 下一步建議

下一步先做 notify route 的 `ai_divination` 分支規格文件，不實作。
