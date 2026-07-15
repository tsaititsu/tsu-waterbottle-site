# 手機版體驗檢查報告（2026-07-10）

檢查方式：程式碼層面 RWD 稽核（Tailwind 斷點、固定尺寸、觸控目標、字級、圖片、對話框）。
限制：Chrome 擴充未連接，無法實機截圖；各項標註信心程度，建議上線前用 iPhone Safari＋**LINE 內建瀏覽器**實走一次（客群主要從 LINE 官方帳號進站，LINE in-app browser 是實際上最重要的「手機瀏覽器」）。

---

## 一、問題清單（依嚴重度）

### 🔴 1. LINE 浮動按鈕預設位置壓住底部導覽列（信心：高）

`FloatingLineButton` 預設位置 `y = innerHeight − 56 − 20`（距視窗底 20px），但手機版有固定底部導覽列 `MobileBottomNav`（高約 60px、z-40）；按鈕 z-50 在其上 → **每個新訪客的 LINE 按鈕都蓋在「我的」分頁上**，要自己拖走才能點到。
修法：手機預設位置改為 `y = innerHeight − 56 − 20 − 導覽列高(約72px)`，或 md 以下加偏移。

### 🔴 2. 命盤文字在手機縮到 10px（信心：高）

`globals.css` 的命盤字級用 `clamp(10px, 1.5vw, 18px)`（`.zce-star__name`、`.zce-palace__name`、`.zce-palace__branch`、`.zce-info-row dd`）。390px 寬手機上 1.5vw ≈ 5.9px → **全部落在 10px 下限**。付費的命盤分析結果在手機上主星、宮位、地支都是 10px，幾乎必須雙指放大。
修法：`@media (max-width: 768px)` 內把下限提高到 12–13px（手機版 `zce-grid` 已有 `min-height: 560px`，容納得下），或改以格寬（cqw）計算。

### 🟠 3. 取消預約用 window.prompt / window.confirm（信心：高）

`account/bookings` 取消流程連跳兩個原生對話框（prompt 輸入原因＋confirm 確認）；`ChartBirthForm` 刪除命盤也用 confirm。手機上原生對話框樣式差、輸入體驗差，且 **LINE 內建瀏覽器對 window.prompt 支援不穩定**，可能直接回傳 null 導致取消流程中斷。
修法：改用站內既有 modal 模式（可仿 `PaymentConfirmModal`），文字輸入用一般 textarea。

### 🟠 4. 無 iPhone 安全區（safe-area）處理（信心：高）

全站找不到 `env(safe-area-inset-*)`；viewport meta 也沒有 `viewport-fit=cover`。有 Home indicator 的 iPhone 上，底部導覽列貼齊螢幕底，與系統手勢區重疊易誤觸。
修法：`MobileBottomNav` 加 `padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))`，layout viewport 設 `viewport-fit=cover`；LINE 浮動按鈕的 clamp 範圍同步考慮。

### 🟠 5. 紫微命盤分析表單 input 14px → iOS 聚焦自動放大（信心：中高）

`original-chart.css` 的 `.input-year`、`.input-md` 等 `font-size: 14px`。iOS Safari 對 <16px 的輸入框聚焦時會強制放大頁面，離開也不會縮回，填生日流程會整頁跳動。
修法：這些 input 至少 16px。（`BookingForm` 的 input 沒設小字級、繼承 16px，無此問題 ✓）

### 🟡 6. 首頁 hero logo 以 w=3840 載入（信心：高）

首頁與 footer 的品牌 logo `next/image` 沒給 `sizes`，手機也抓 3840px 寬的最佳化圖，浪費行動流量、拖慢 LCP。
修法：補 `sizes`（如 `(max-width: 768px) 90vw, 620px`）。
（牌卡 `back.png` 源檔雖 2.5MB，但已用 next/image＋`sizes="112px/140px"`，實際傳輸已最佳化，此項 OK ✓）

### 🟡 7. LINE 內建瀏覽器的付款動線（信心：中，一般性建議）

NewebPay 刷卡／3DS 在 in-app browser 中體驗與成功率普遍較差（3DS 簡訊跳轉、回跳 session 遺失風險）。
建議：付款按鈕處偵測 LINE in-app（UA 含 `Line/`），顯示「建議點右下角『以外部瀏覽器開啟』後再付款」提示；或至少在客服 SOP 記錄此情境。

### 🟡 8. 占卜解讀結果依賴 sessionStorage（手機情境加重，信心：高）

手機用戶更常「付款跳轉回來→切去 LINE 回訊息→系統回收分頁」，sessionStorage 一沒就看不到已付費解讀（22J-38/39 已盤點，「我的占卜紀錄」22J-42 可解）。手機情境下這從資料問題升級成常見體驗事故，建議提高優先權。

## 二、做得好的部分（不用動）

- 專門的手機底部導覽列（首頁/命盤/占卜/課程/我的），`main` 有 `pb-20` 預留空間不被遮擋。
- Header 漢堡選單、點擊導航即收合；選單項 `py-3` 觸控高度足夠。
- 卡片式版面天生適合窄螢幕；`section-shell` 手機左右留 28px。
- 手動選牌改為橫向滑動 15 張、卡片 64×96px 觸控目標合格；洗牌動畫有 `sr-only` 說明。
- 登入／付款 modal 都是 `w-full max-w-[430~440px]` ＋外層 `px-4`，小螢幕不會爆版。
- 主要按鈕普遍 `py-3`（≥44px 觸控高度）；hero CTA 手機直排。
- `BookingForm` 有整組 `min-w-0 / max-w-full` 防爆版處理。
- 圖片普遍用 next/image，牌卡類有正確 `sizes`。

## 三、建議修正順序

| 優先 | 項目 | 工時估 |
|---|---|---|
| P0 | LINE 按鈕預設位置避開底部導覽列（#1） | 0.5h |
| P0 | 命盤手機字級下限提高（#2） | 0.5–1h |
| P1 | safe-area 處理（#4） | 0.5h |
| P1 | ai-chart 表單 input 16px（#5） | 0.5h |
| P1 | prompt/confirm 改站內 modal（#3） | 2–3h |
| P2 | logo sizes（#6）、LINE in-app 付款提示（#7） | 1h |
| P2→P0 資料面 | 我的占卜紀錄頁（#8，即 22J-42） | 另包 |

## 四、驗證建議

修正後用實機檢查三條路徑：iPhone Safari 與 LINE 內建瀏覽器各走「首頁→占卜→付款前一步」「命盤分析填表→結果」「會員中心→取消預約」，並確認瀏海機型底部導覽列不與手勢區打架。
