# 紫微占卜線上付款入口 flag 說明（2026-07-09）

小包編號：22J-41A（純盤點，無程式變更、無 commit）
本文件不含任何 key／production env 真值。不呼叫藍新／OpenAI 做測試。

---

## 一、結論

「線上付款尚未啟用」按鈕 disabled 的原因是 **client-side feature flag `NEXT_PUBLIC_ENABLE_NEWEBPAY` 未設為 `"true"`**。程式判斷正確，**不需要改程式**。

## 二、盤點細節

1. **顯示位置**：`src/components/divination/DivinationDrawPreview.tsx`（手動抽牌與自動抽牌兩個區塊的付款按鈕，行 1137、1185 附近）。
2. **控制邏輯**：檔案第 74 行 `const isNewebPayEnabled = process.env.NEXT_PUBLIC_ENABLE_NEWEBPAY === "true"`；非 `"true"` 時按鈕 disabled 並顯示「線上付款尚未啟用」。此行為與 `docs/divination-newebpay-launch-readiness.md` 第 26 行的既有設計說明一致（這是刻意的上線保險，不是 bug）。
3. **`.env.example` 是否有**：有，第 16 行，預設 `NEXT_PUBLIC_ENABLE_NEWEBPAY=false`。
4. **flag 影響範圍（重要）**：此 flag 同時控制**兩個**信用卡付款入口——
   - 紫微占卜（`DivinationDrawPreview.tsx`）
   - 水瓶先生論命預約（`BookingForm.tsx` 第 51 行）
   設為 `true` 會同時開啟兩者。既有文件 `docs/payment-entry-launch-readiness.md` 的設計即是「booking／divination 信用卡入口測試通過後才設 true」。
   購物車（開運商品）的 NewebPay 信用卡**不受**此 flag 控制（cart 只有 LINE Pay 受 `NEXT_PUBLIC_ENABLE_LINE_PAY` 控制），所以商品金流一直可用、占卜卻顯示未啟用。
5. **兩個 flag 的分工**：
   - `ENABLE_DIVINATION_DB_READINGS`（server-only）：只控制占卜紀錄 DB 持久化與 DB paid gate 路徑，**不控制付款按鈕**。已於 22J-40 確認 production 為 true。
   - `NEXT_PUBLIC_ENABLE_NEWEBPAY`（client-side）：只控制占卜／預約的信用卡付款入口按鈕。
   **production 必須兩個都開**，占卜「付款 → 解讀 → 落庫」整條才會通。

## 三、需要的動作（使用者操作）

Vercel Production 需要新增：

```
NEXT_PUBLIC_ENABLE_NEWEBPAY=true
```

提醒：

- **設定後要 redeploy production 才會生效**。`NEXT_PUBLIC_*` 是 build 時 inline 進前端程式的，必須重新 build／deploy，不是存檔就生效。
- 開啟後請以小額實測占卜付款流程（依 `docs/divination-newebpay-live-test-plan.md` 的既有計畫），本包依規範未做任何實際付款測試。
- 若暫時**不想**同時開放論命預約的線上付款，需另開小包把兩個入口的 flag 拆開（例如新增 `NEXT_PUBLIC_ENABLE_DIVINATION_NEWEBPAY`）；本包未做此變更。

## 四、檢查紀錄

- 無程式修改、無 commit（依規格：只是 env 缺失就不改程式）。
- `git status --short`：僅本文件與前輪已知的 `docs/site-audit-2026-07-09.md` 為未追蹤。
- `git diff --check`：通過（無已追蹤檔案變更）。
