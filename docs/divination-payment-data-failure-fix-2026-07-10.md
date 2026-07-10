# 紫微占卜付款資料建立失敗修正紀錄（2026-07-10）

## 現象

- 管理員登入後抽牌。
- 點擊「管理員 Apple Pay 測試付款 NT$1」。
- 前端顯示「線上付款資料建立失敗，請稍後再試。」。
- 使用者沒有進入 NewebPay Apple Pay 付款頁。

## 根因

22J-48 新增付款前牌卡資料持久化，避免付款後會員紀錄顯示「尚未抽牌」。
該流程會在建立 NewebPay payment 前更新 reading 的 `card_id`、`card_name`、`position`。

原本 API 對多種失敗狀況回傳過於泛用或未被前端映射的 error code，例如：

- 測試模式未授權
- 測試模式未啟用
- reading 不屬於目前登入使用者
- 牌卡資料缺失
- 已有 pending payment
- NewebPay form payload 建立失敗

前端收到這些 error code 時沒有對應文案，因此只顯示「線上付款資料建立失敗」。

## 修正位置

- `src/app/api/payments/newebpay/create/handler.ts`
- `src/components/divination/DivinationDrawPreview.tsx`
- `src/lib/supabase/divinationReadings.ts`
- `src/app/api/payments/newebpay/create/divinationOneDollarTest.test.ts`
- `src/lib/supabase/divinationReadings.test.ts`

## API 安全錯誤碼

本次修正後，API 會回傳可辨識且不含 secret 的 error code：

- `unauthorized`
- `admin_required`
- `test_mode_disabled`
- `invalid_divination_draw_selection`
- `reading_card_data_missing`
- `divination_reading_not_found`
- `reading_not_owned`
- `payment_already_exists`
- `payment_create_failed`
- `payment_form_create_failed`

前端會對應顯示：

- 測試付款功能目前未啟用
- 找不到本次占卜紀錄，請重新抽牌
- 本次抽牌資料不完整，尚未建立付款
- 此筆付款已建立，請勿重複操作
- 付款資料建立失敗，請稍後再試

## 為何未進 Apple Pay 前不應重複付款

若 reading 已建立 pending payment 或已綁定 `merchantOrderNo`，代表系統已有一筆付款資料。
此時重複建立新的付款資料可能造成：

- 多筆 pending payment 對應同一筆 reading
- ReturnURL / NotifyURL 回來時無法明確判斷本次付款
- 使用者可能重複付款

因此 API 會以 `payment_already_exists` 擋下重複建立。

## 安全邊界

- 管理員 NT$1 測試付款仍需 server 端重新驗證登入者與 `ADMIN_EMAILS`。
- 非本人 reading 回 404，不建立 payment。
- 正式 NT$50 信用卡付款流程不改。
- 管理員 NT$1 Apple Pay payload 仍由 server 派生，不信任 client 指定 Apple Pay。
- 不輸出 env、key、TradeInfo、TradeSha 或 raw DB error。

## 本包未做

- 未實刷。
- 未呼叫 NewebPay API。
- 未呼叫 OpenAI API。
- 未執行 SQL。
- 未修改正式 NT$50 價格。
- 未修改 paid gate。
