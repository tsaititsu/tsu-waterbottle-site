# 安全熱修：後台 admin 權限 + 預約寄信 API（2026-07-09）

小包編號：22J-36（P0 安全熱修）
範圍：admin booking slots API、/admin 頁面、/api/email/send-booking-*。
本包**沒有 SQL、沒有 DB schema 變更**，不影響金流、NewebPay、OpenAI、占卜與價格。

---

## 一、修正內容

### 1. Admin 權限（原漏洞：任何登入會員都能操作後台 API）

修正後規則：**必須登入，且登入帳號的 email 在 server-only 環境變數 `ADMIN_EMAILS` 內**。

- 新增 `src/lib/auth/admin.ts`：
  - `parseAdminEmails()`：解析逗號分隔 allowlist，每項 trim + lowercase，非 email 項目忽略。
  - `isAdminEmail()`：比對大小寫不敏感；**`ADMIN_EMAILS` 未設定或為空時一律 fail closed（拒絕）**。
  - `requireAdminUser()`：API 守門。未登入 → 401；已登入但非 admin → 403。
- 套用範圍：
  - `POST/GET /api/admin/booking-slots`
  - `POST /api/admin/booking-slots/batch`
  - `PATCH /api/admin/booking-slots/bulk-close`
  - `PATCH /api/admin/booking-slots/[id]`
  - 新增 `GET /api/admin/session`（供前端確認管理權限）
- `/admin` 頁面：新增 `src/app/admin/layout.tsx` 守門，涵蓋所有 `/admin/*` 頁面。
  - 未登入 → 導回首頁。
  - 已登入但非 admin → 顯示「沒有管理權限」，**不渲染任何後台操作 UI**。
  - 前端不會出現 `ADMIN_EMAILS` 或任何 env 細節。

注意：以 LINE 登入且帳號沒有 email 的使用者無法成為 admin，管理者請用有 email 的帳號（如 Google）登入後台。

### 2. 寄信 API（原漏洞：未驗證、收件人由 request body 指定，可被濫用寄垃圾信）

修正後規則（兩支 route 共用 `src/lib/email/bookingEmailRequestHandler.ts`）：

- **只接受 `bookingId`**（取消信可另帶純文字 `cancellationReason`，trim 後截斷至 300 字）。
- request body 的 `to` / `cc` / `bcc` / `subject` / `html` / `customerEmail` 等欄位**完全忽略**。
- 收件人推導：
  - 客人信 → 資料庫 booking record 的 `customer_email`。
  - 老師通知信 → server env `ADMIN_NOTIFY_EMAIL`（於 `sendBookingEmails.ts` 內讀取，不變）。
- 權限：必須登入。只有「該筆 booking 的本人（user_id 相同，或登入 email 與 booking customer email 相同）」或「`ADMIN_EMAILS` 內的 admin」可觸發；其他人 403。
- `bookingId` 缺少 → 400；查不到 booking → 404；未登入 → 401。
- 已寄過的信不重寄（依 booking 的 email sent 旗標，寄成功後也會回寫旗標）。
- 資料庫未設定（無法安全推導收件人）→ 503 fail closed，不寄信。
- 信件內容一律由 server-side 固定 template 產生；錯誤回應只回固定文案，不含 key / env / stack。
- 前端呼叫點（`booking/success`、`account/bookings`）改為只傳 `bookingId`（含登入 token）。

---

## 二、部署需求（重要）

1. 到 **Vercel → Project → Settings → Environment Variables（Production）** 新增：
   - `ADMIN_EMAILS`＝管理者登入用 email（逗號分隔可多個）。
   - 格式範例：`ADMIN_EMAILS=admin@example.com,owner@example.com`（請勿把真實 email 寫進 repo / 文件）。
2. 本機開發同樣需在 `.env.local` 自行加上 `ADMIN_EMAILS`。
3. **設定 env 後需要 redeploy 才會生效。**
4. 未設定 `ADMIN_EMAILS` 時的行為：後台 API 與 `/admin` 頁面一律拒絕存取（fail closed），前台一般功能不受影響。

---

## 三、測試

- `node_modules/.bin/jiti src/lib/auth/admin.test.ts`（16 項）
- `node_modules/.bin/jiti src/lib/email/bookingEmailRequestHandler.test.ts`（27 項）

涵蓋：401 / 403 / fail closed / 大小寫與空白比對 / `to` 欄位注入無效 / bookingId 驗證 / 非本人不可重寄 / admin 可重寄 / 已寄過不重寄 / 錯誤回應不含 key、env、stack。寄信函式在測試中全部用注入的 mock，不會真的呼叫 Resend。

---

## 四、後續建議（本包未做）

- 正式 RBAC：`profiles.role` 或 Supabase `app_metadata.role`，取代 env allowlist（需 DB 變更，另開包）。
- `/api/bookings/confirm-payment` 目前使用寫死的 mock 收件資料，收件人不可被外部指定，但建議之後改為由 booking record 推導或移除。
- `/api/bookings/read`、`/api/bookings/update`、`/api/calendar/*` 的授權盤點（見 `docs/site-audit-2026-07-09.md`）。
