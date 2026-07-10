# 紫微占卜付款資料建立失敗修正（2026-07-10）

## Production 證據

台北時間約 2026-07-10 17:22 的 Vercel runtime 紀錄為：

- `POST /api/divination/readings/create`：200
- `GET /api/admin/divination-one-dollar-test`：200
- `POST /api/divination/interpret`：402
- `POST /api/payments/newebpay/create`：400

`interpret` 的 402 是付款前 paid gate 的預期結果。付款 create request 沒有進入 NewebPay，也沒有發生刷卡或扣款。

## 實際根因

這次 production 事件不是已證實的 Supabase payment insert 失敗。當時 payment create 回 400，而既有 insert catch 會回 500；同一時間也沒有 payment insert 的 server error log。

比對 `1154017` 與 `19e770b` 後確認，舊瀏覽器 bundle 送出的占卜付款 request 沒有 `cardId` 與 `position`，新後端則要求付款前必須先保存完整牌卡資料，因此 request 在 payment insert 前被 400 擋下。前端舊 bundle 不認得新的安全錯誤碼，才顯示泛用的「線上付款資料建立失敗」。

本包修正如下：

- persisted reading 在 interpret 回 402 前先保存 `card_id`、`card_name`、`position`。
- payment create 若 client 沒送牌卡欄位，只能從該 reading 的 DB 欄位恢復，不依賴 sessionStorage，也不接受任意牌卡文字。
- reading DB 仍沒有完整牌卡資料時，維持拒絕建立付款。

## Payment payload 修正

管理員 Apple Pay NT$1 payment row 沿用正式占卜結構：

- `provider=newebpay`
- `item_type=ai_divination`
- `item_id=<reading id>`
- `currency=TWD`
- `status=pending`
- DB `item_name` 維持正式值「紫微牌卡占卜單次」

測試差異只放在允許的位置：

- `amount_twd=1`
- JSON `raw_payload` 內的 `test_payment`、`one_dollar_test_mode`、`divination_one_dollar_test`、`divination_apple_pay_test`、`original_amount`、`test_source`、`payment_method`
- MPG 使用 `APPLEPAY=1`、`InstFlag=0`、`Amt=1`

不新增 DB enum，不把 `apple_pay` 寫進受限制的 payment method 實體欄位，也不送 `CREDIT`、`LINEPAY`、`VACC`、`ANDROIDPAY` 或 `SAMSUNGPAY`。

## 安全階段與錯誤碼

付款建立順序為：metadata → duplicate lookup → payment insert → reading link → MPG form build。

- `payment_metadata_invalid`：付款 metadata 不合法，尚未 insert。
- `payment_insert_failed`：payment insert 失敗，尚未 link，也不建立 form。
- `payment_reading_link_failed`：payment 已建立但 reading link 失敗，不建立 form；使用者不得重複付款，需聯繫客服。
- `payment_duplicate_conflict`：reading 已有 payment、找到同 target 的 pending/paid payment，或 merchant order 發生 unique conflict；不再 insert。
- `payment_form_create_failed`：payment 與 reading 已建立關聯，但 MPG form 建立失敗。

Server log 只記錄 stage、安全錯誤碼、provider、source type、test mode、amount、HTTP status 與資料庫錯誤類別。不得記錄完整 readingId、paymentId、MerchantOrderNo、Supabase raw error、Authorization、email、env、MerchantID、HashKey、HashIV、TradeInfo 或 TradeSha。

## 殘留 payment 判斷

17:22 的觀測 request 回 400 且未到 insert，因此該次 request 不會留下 payment row，也不可能扣款。

本包未讀 production DB，無法替其他歷史嘗試宣稱一定沒有殘留 row。程式已新增同 provider/item type/item id 的 pending/paid payment lookup；若存在 insert 成功但 reading link 失敗的孤立 payment，下一次 request 會回 `payment_duplicate_conflict`，不會建立第二筆 pending payment。

## 本包邊界

- 未呼叫 NewebPay API。
- 未呼叫 OpenAI API。
- 未刷卡。
- 未執行 SQL。
- 未讀或修改 production DB。
- 未修改正式 NT$50 金額與 paid gate。
