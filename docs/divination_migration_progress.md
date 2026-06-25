# 紫微牌卡占卜搬遷進度總表

## 1. 目前總原則

LINE Pay / 金流審核期間：

- 不 push
- 不部署
- 不動 main
- 不執行 production SQL
- 只做本機開發
- 可以本機 build
- 可以本機 commit

目前所有占卜正式付款、正式資料庫寫入、正式 OpenAI 解讀都尚未啟用。

## 2. 搬遷目標

目標：

```text
將原本 ziwei-card 的紫微牌卡占卜，逐步搬進 tsu-waterbottle-site 正式網站。
```

正式方向：

- 正式網站自己執行占卜流程
- 不再只是導流舊 ziwei-card
- 舊會員 / 舊點數 / 舊占卜紀錄暫不搬
- 付費模式改成單次 NT$50 解鎖一次 AI 深度解讀
- 不做儲值點數
- 不做每日免費

## 3. 已完成：前台 UI 與牌卡資料

- [x] 新增占卜提問表單 `DivinationQuestionForm`
- [x] 新增抽牌預覽 `DivinationDrawPreview`
- [x] 新增本機流程 wrapper `DivinationLocalPreview`
- [x] 新增本機結果預覽 `DivinationResultPreview`
- [x] 搬入牌背圖 `public/cards/back.png`
- [x] 搬入正位 14 張主星圖
- [x] 搬入反位 14 張主星圖
- [x] 搬入 `src/lib/divination/cards.ts`
- [x] `cards.ts` 已包含 `reversedImage`
- [x] 支援手動抽牌
- [x] 支援自動抽牌
- [x] 支援正位 / 反位隨機
- [x] 支援正位 / 反位圖顯示
- [x] 支援本機牌義預覽
- [x] 文案已整理成接近正式產品語氣

目前前台流程：

```text
填問題
→ 選手動 / 自動
→ 洗牌 / 抽牌
→ 顯示正反位牌圖
→ 按「就是這張，開始解讀」
→ 顯示牌義解讀預覽
```

## 4. 已完成：Mock API 流程

- [x] 新增 mock `POST /api/divination/readings/create`
- [x] 新增 mock `POST /api/divination/interpret`
- [x] interpret API 會從 server 端 `cards.ts` 查牌
- [x] interpret API 回傳 structured interpretation
- [x] 新增 mock payment gate
- [x] 沒有 mock payment gate 時，interpret API 回 402
- [x] 前端已串起 create reading → mock gate → interpret → result preview
- [x] 新增 `src/lib/divination/types.ts` 集中 API 型別

目前 mock API 不做：

- 不寫 Supabase
- 不接 NewebPay
- 不接 OpenAI
- 不產生正式付款
- 不產生正式占卜紀錄

## 5. 已完成：SQL 草稿與規格文件

- [x] `supabase/divination_readings_patch.sql`
  - `divination_readings` table 草稿
  - 尚未執行 production SQL

- [x] `docs/divination_payment_gate_spec.md`
  - NT$50 付款 gate 與資料表設計規格

- [x] `docs/divination_newebpay_start_route_spec.md`
  - NewebPay 占卜付款 start route 規格

- [x] `docs/divination_newebpay_notify_branch_spec.md`
  - NewebPay notify route 的 `ai_divination` 分支規格

- [x] `docs/divination_interpret_payment_gate_spec.md`
  - 正式 interpret API payment gate 規格

- [x] `docs/divination_openai_prompt_builder_spec.md`
  - 正式 OpenAI prompt builder 與 structured output 規格

## 6. 目前尚未啟用 / 尚未實作

- [ ] 尚未在 production 執行 `divination_readings` SQL
- [ ] 尚未建立正式 `divination_readings` 資料表
- [ ] 尚未新增正式 NewebPay 占卜付款 start route
- [ ] 尚未修改 NewebPay notify route 支援 `ai_divination`
- [ ] 尚未修改 return 後讀取 `readingId`
- [ ] 尚未將 interpret API 改成正式 payment gate
- [ ] 尚未接正式 OpenAI
- [ ] 尚未儲存正式 AI 解讀結果
- [ ] 尚未做後台占卜查詢
- [ ] 尚未做占卜紀錄頁
- [ ] 尚未做客服補救流程

## 7. 正式付款流程規劃

正式流程：

```text
填問題
→ 選手動 / 自動
→ 抽牌
→ 建立 divination_readings
→ 建立 NT$50 NewebPay 付款
→ 跳轉 NewebPay
→ notify 更新 payments + divination_readings
→ return 回 /ai-divination?readingId=xxx&payment=success
→ 前端呼叫 /api/divination/interpret
→ interpret API 查 reading + payment gate
→ 通過後呼叫 OpenAI
→ 儲存 structured interpretation
→ 前端顯示 AI 解讀
```

正式付款資訊：

```text
item_type = ai_divination
item_name = 紫微牌卡 AI 深度解讀
amount_twd = 50
currency = TWD
provider = newebpay
```

## 8. 正式資料表規劃

`divination_readings` 用來綁定單次占卜的：

- 使用者
- 問題
- 抽牌方式
- 牌卡
- 正反位
- 付款
- AI 解讀結果
- 狀態

狀態流：

```text
pending_payment
→ paid
→ interpreting
→ completed
```

其他狀態：

```text
failed
canceled
```

同一筆 `payment_id` 只能綁一筆 `divination_readings`，避免一筆付款重複使用。

## 9. 正式 OpenAI 規劃

OpenAI 只能在正式 interpret API payment gate 通過後呼叫。

不可呼叫 OpenAI 的地方：

- 前端 component
- readings/create route
- NewebPay notify route
- NewebPay return route
- mock payment gate

正式 OpenAI response 結構：

```ts
{
  summary: string
  cardMessage: string
  situationAnalysis: string
  advice: string
  reminder: string
}
```

正式版應使用 structured output / JSON schema，避免前端收到不穩定格式。

## 10. 審核期間禁止事項

- [ ] 不 push
- [ ] 不部署
- [ ] 不動 main
- [ ] 不執行 production SQL
- [ ] 不啟用正式 NewebPay 占卜商品
- [ ] 不接正式 OpenAI
- [ ] 不修改 production payments table
- [ ] 不修改 notify route 正式行為
- [ ] 不開放前台正式占卜付款入口

## 11. 等審核通過後的建議順序

1. 確認 production `payments` schema
2. 執行 `supabase/divination_readings_patch.sql`
3. 新增正式 create reading 寫入 Supabase
4. 新增 `POST /api/payments/newebpay/divination/start`
5. 修改 NewebPay notify route 支援 `ai_divination`
6. 修改 return / 前端讀取 `readingId`
7. 將 interpret API 改成正式 payment gate
8. 新增 OpenAI prompt builder
9. 接 OpenAI structured output
10. 儲存正式 interpretation
11. 補後台查詢與客服處理

OpenAI 一定要放在 payment gate 後面。

## 12. 目前不搬 / 不做的舊 ziwei-card 功能

- [ ] 不搬舊 LINE 登入
- [ ] 不搬舊點數制
- [ ] 不搬每日免費
- [ ] 不搬舊會員資料
- [ ] 不搬舊占卜紀錄
- [ ] 不搬舊回饋 / 通報流程
- [ ] 不搬舊 `/api/line/draw`
- [ ] 不搬舊 `/api/reading`

舊 ziwei-card 只作為參考，不整包複製。

## 13. 目前相關檔案索引

### 前台元件

```text
src/components/divination/DivinationLocalPreview.tsx
src/components/divination/DivinationQuestionForm.tsx
src/components/divination/DivinationDrawPreview.tsx
src/components/divination/DivinationResultPreview.tsx
```

### API

```text
src/app/api/divination/readings/create/route.ts
src/app/api/divination/interpret/route.ts
```

### 資料

```text
src/lib/divination/cards.ts
src/lib/divination/types.ts
public/cards/
```

### SQL / 文件

```text
supabase/divination_readings_patch.sql
docs/divination_payment_gate_spec.md
docs/divination_newebpay_start_route_spec.md
docs/divination_newebpay_notify_branch_spec.md
docs/divination_interpret_payment_gate_spec.md
docs/divination_openai_prompt_builder_spec.md
docs/divination_migration_progress.md
```

## 14. 目前 Git 注意事項

目前不要混入既有未提交檔案：

```text
src/app/terms/page.tsx
src/lib/supabase/admin.ts
supabase/bookings_permission_patch.sql
supabase/consultation_plan_seed_patch.sql
```

占卜相關 commit 應維持小包，不要混入上述舊檔案。

## 15. 下一步建議

下一步先停止新增正式功能，改做一次 git status 與占卜相關 commit 檢查，確認所有規格文件與 mock API 都已正確 commit。
