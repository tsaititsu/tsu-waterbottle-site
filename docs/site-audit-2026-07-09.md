# 網站體檢報告與補強規劃（2026-07-09）

檢查範圍：線上網站 tsu-waterbottle.com ＋ 專案原始碼。
結論：金流核心（NewebPay 驗簽、付款閘門、env 管理）做得紮實，但有 2 個安全性漏洞需立即處理，SEO 基礎建設幾乎空白。

---

## 一、安全性（🔴 立即處理）

### 1. 後台沒有管理員權限檢查（最嚴重）
- `/admin` 頁面只在前端檢查「是否登入」，任何登入會員都能進入後台頁面。
- `/api/admin/booking-slots`（含 batch、bulk-close、[id]）的 `requireAuthenticatedUser` 只驗證 token 有效，**沒有驗證是否為管理員** → 任何登入會員都可直接呼叫 API 開關、刪改論命預約時段。
- 修法：建立 server-side 管理員驗證（建議用 email allowlist 環境變數，或 Supabase `app_metadata.role`），套用到所有 `/api/admin/*` 路由，並加 `middleware.ts` 保護 `/admin/*` 頁面。

### 2. Email API 完全未驗證
- `/api/email/send-booking-confirmation`、`/api/email/send-booking-cancellation` 不需登入，收件人 email 直接來自 request body → 任何人可用你的網域＋Resend 額度寄垃圾信，會燒錢並毀掉網域信譽。
- 修法：這兩支改為 server 內部函式呼叫（從 booking 流程直接 import `sendBookingEmails`），刪除公開 route；若必須保留 route，加 internal secret header 驗證。

### 3. 安全性 headers 全無
- `next.config.ts` 是空的：沒有 CSP、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`。
- 修法：在 `next.config.ts` 加 `headers()` 設定。金流網站建議至少擋 clickjacking（`frame-ancestors 'none'`）。

### 4. 建議一併確認
- 逐一盤點 `/api/bookings/*`、`/api/calendar/*`、`/api/account/*` 的授權邏輯（是否只能存取自己的資料）。
- `供應鏈`：Supabase RLS 是否對所有資料表啟用。

已確認沒問題的部分：NewebPay notify 有驗 TradeSha、`.env` 正確 gitignore、`/dev/*` 測試頁在 production 回 404、占卜/命盤 API 有付款閘門。

---

## 二、SEO（🟠 高優先，直接影響獲客）

| 項目 | 現況 | 修法 |
|---|---|---|
| 各頁 metadata | 全站共用同一組 title/description，只設在 root layout | 每個主要頁面（ai-chart、ai-divination、booking、courses、spiritual-products…）加獨立 `metadata`，title 含目標關鍵字（紫微斗數、命盤分析、線上占卜…） |
| sitemap.xml | 404 | 加 `src/app/sitemap.ts` |
| robots.txt | 404 | 加 `src/app/robots.ts`，並排除 `/admin`、`/account`、`/payment`、`/api` |
| og:image | 未設定 | 台灣用戶主要透過 LINE 分享，沒有預覽圖很傷。做 1200×630 og-image，各服務頁可做專屬圖 |
| favicon | 用大 PNG logo 充當 | 產生 favicon.ico、apple-touch-icon（180×180）、192/512 PNG |
| 結構化資料 JSON-LD | 無 | 加 `LocalBusiness`（含統編地址）、各服務 `Service`/`Product`、課程 `Course`、常見問題 `FAQPage` |
| Search Console | 待確認 | 註冊、提交 sitemap、監控收錄 |
| 內容頁 | 無部落格/文章區 | 命理類流量大宗在長尾關鍵字（例：紫微斗數 命宮、化忌是什麼）。中期建議加 `/blog`，把既有文章搬進來養自然流量 |

---

## 三、效能（🟡 中優先）

1. `public/cards` 共 77MB，單張牌卡 PNG 約 3MB；`public/products` 17MB。有 next/image 撐著，但源檔太大仍拖慢首次最佳化與部署。→ 批次轉 WebP、長邊縮到 1200px 內，預估可縮到 5MB 以下（我可以直接幫你跑）。
2. 首頁 logo 以 `w=3840` 載入 → 指定合理 `sizes`。
3. 專案根目錄的 79MB `水瓶先生有名字-01.tif` 已 gitignore，但建議移出專案資料夾，避免誤 commit 與備份肥大。

---

## 四、品質與維運（🟡 中優先）

1. **自訂錯誤頁**：無 `not-found.tsx` / `error.tsx` → 目前 404 是 Next 預設英文頁，無品牌、無導流。加上品牌化 404/500 頁。
2. **測試無法執行**：已有 `*.test.ts`（node:test 風格）但 `package.json` 沒有 `test` script、無 CI。→ 加 `"test": "node --test"`（或改 vitest），並加 GitHub Actions 跑 lint + tsc + test + build。
3. **無流量分析**：沒有任何 analytics。→ 加 GA4 或 Vercel Analytics，金流轉換漏斗（進站→登入→付款）才有數據可看。
4. **無錯誤監控**：有金流的網站建議加 Sentry（或至少 Vercel log 告警），付款 notify 失敗要能即時知道。

---

## 五、轉換優化建議（🟢 低優先，有餘裕再做）

- 課程頁「即將開課」→ 加「開課通知我」名單（email 或導 LINE 官方帳號），先累積名單。
- 客戶回饋區塊配合 JSON-LD `Review`/`AggregateRating`（注意 Google 對自家見證的規範）。
- 占卜 NT$50 是很好的入門磚，可在命盤分析、論命頁面互相導流（目前首頁有，內頁可加強）。

---

## 建議執行順序

| 階段 | 內容 | 預估工時 |
|---|---|---|
| 第 1 步（本週） | 安全性：admin 角色驗證＋middleware、關閉/鎖定 email API、security headers | 0.5–1 天 |
| 第 2 步 | SEO 基礎：各頁 metadata、sitemap、robots、og-image、favicon、404 頁 | 1 天 |
| 第 3 步 | 圖片壓縮、analytics、Search Console 提交 | 0.5 天 |
| 第 4 步 | JSON-LD、CI、Sentry、API 授權總盤點 | 1–2 天 |
| 中期 | 部落格內容區、開課通知名單 | 持續 |
