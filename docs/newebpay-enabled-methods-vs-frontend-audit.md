# NewebPay Enabled Methods vs Frontend Audit

本文件盤點使用者提供的藍新後台支付方式狀態、目前程式實際送出的 NewebPay MPG 參數，以及各產品前端是否有付款入口。  
本輪只做文件盤點，不改程式邏輯、不新增前端按鈕、不呼叫藍新 API、不刷卡、不讀 `.env.local`、不讀 production env、不輸出任何 key、不執行 SQL、不 push、不 deploy。

重要判斷：

- 後台啟用不等於程式有送參數。
- 後台啟用不等於前端有顯示入口。
- 後台啟用不等於可以直接正式上線。
- 本文件沒有登入藍新後台，後台狀態只依使用者提供截圖文字整理。

## 一、藍新後台截圖顯示狀態

| 支付方式 | 後台狀態 | 對應 MPG 參數 | 備註 |
| --- | --- | --- | --- |
| 信用卡一次付清 | 啟用 | `CREDIT` | 目前網站主線，程式會送 `CREDIT=1`。 |
| Apple Pay 幕前支付 | 啟用 | `APPLEPAY` | 後台看似啟用，但目前程式未送 `APPLEPAY=1`，前端也未放入口。 |
| Apple Pay 幕後支付 | 尚未驗證 | 需另查 / 不確定 | 不可前端放出。 |
| GOOGLE PAY | 啟用 | `ANDROIDPAY` | 後台看似啟用，但目前程式未送 `ANDROIDPAY=1`。 |
| SAMSUNG PAY | 啟用 | `SAMSUNGPAY` | 後台看似啟用，但目前程式未送 `SAMSUNGPAY=1`。 |
| 信用卡分期付款 | 啟用 | `InstFlag` | 目前只允許課程付款送 `InstFlag=3,6`；非課程維持 `InstFlag=0`。 |
| 信用卡紅利折抵 | 未啟用 | `CreditRed` | 目前程式未送。 |
| 銀聯卡 | 啟用 | `UNIONPAY` | 後台看似啟用，但目前程式未送 `UNIONPAY=1`。 |
| 國外卡 | 啟用 | 不確定 | 目前程式未找到獨立國外卡欄位；不可自行亂加參數。 |
| 玉山 wallet | 未啟用 | 可能為 `ESUNWALLET` | 目前程式未送。 |
| 台灣 Pay | 關閉 | `TAIWANPAY` | 目前程式未送，不可開入口。 |
| 信用卡定期定額 | 未啟用 | 不適用目前 MPG 單筆刷卡流程 | 本專案目前只做單筆刷卡與課程分期，不做定期定額。 |
| WebATM | 未啟用 | `WEBATM` | 目前程式未送，不可開入口。 |
| ATM 轉帳 | 啟用 | `VACC` | 後台看似啟用，但目前程式未送 `VACC=1`，前端未放 NewebPay ATM 入口。 |
| 智慧 ATM2.0 | 未啟用 | 不確定 | 目前程式未送。 |
| 超商代碼繳費 | 未啟用 | `CVS` | 目前程式未送，不可開入口。 |
| 條碼繳費 | 未啟用 | `BARCODE` | 目前程式未送，不可開入口。 |
| LINE Pay | 申請中 | `LINEPAY` | 目前程式未送 `LINEPAY=1`，不可前端放出。 |
| AFTEE 先享後付 | 未啟用 | `AFTEE` | 目前程式未送。 |
| TWQR | 啟用服務，尚未確認是否已啟用 | `TWQR` | 需人工確認後台狀態；目前程式未送。 |
| 支付寶 | 啟用服務，尚未確認是否已啟用 | 不確定 | 目前程式未找到對應 active MPG 參數；不可直接上線。 |
| 微信支付 | 啟用服務，尚未確認是否已啟用 | 不確定 | 目前程式未找到對應 active MPG 參數；不可直接上線。 |

## 二、程式實際 NewebPay payload 是否有送

本次檢查範圍：

- `src/lib/newebpay`
- `src/lib/payments`
- `src/app/api/payments`
- `src/app/api/product-orders`
- `src/app/api/courses`
- 各產品前端入口相關檔案

### 目前有送的參數

| MPG 參數 | 目前是否有送 | 位置 / 條件 |
| --- | --- | --- |
| `CREDIT=1` | 有 | 共用 `createNewebPayMpgPaymentData()` 在 `paymentMode="credit"` 時送出；課程 helper 固定送出。 |
| `InstFlag=3,6` | 有，只限課程 | `/api/payments/newebpay/course/start` 傳入 `instFlag: "3,6"`，課程 TradeInfo 會送 `InstFlag=3,6`。 |
| `InstFlag=0` | 有，非課程 | 共用 NewebPay payment helper 預設送 `InstFlag=0`；booking / divination / ai-chart / product order / smoke test 皆由測試覆蓋。 |

### 目前未送的參數

| MPG 參數 | 目前是否有送 | 盤點結果 |
| --- | --- | --- |
| `APPLEPAY=1` | 否 | active payload builder 未送；只在測試的「不得出現」清單中檢查。 |
| `ANDROIDPAY=1` | 否 | active payload builder 未送。 |
| `SAMSUNGPAY=1` | 否 | active payload builder 未送。 |
| `UNIONPAY=1` | 否 | active payload builder 未送。 |
| `VACC=1` | 否 | active payload builder 未送。 |
| `WEBATM=1` | 否 | active payload builder 未送。 |
| `CVS=1` | 否 | active payload builder 未送。 |
| `BARCODE=1` | 否 | active payload builder 未送。 |
| `LINEPAY=1` | 否 | `paymentMode=linepay` 會被 create handler 擋下，程式不送 NewebPay MPG `LINEPAY=1`。 |
| `TAIWANPAY=1` | 否 | active payload builder 未送。 |
| `TWQR=1` | 否 | active payload builder 未送。 |
| `AFTEE=1` | 否 | active payload builder 未送。 |
| `CreditRed` | 否 | active payload builder 未送。 |
| `CVSCOM` | 否 | active payload builder 未送。 |

### 程式分界

- `provider=newebpay`：目前只用 NewebPay MPG 信用卡與課程限定分期。
- `provider=line_pay`：官方 LINE Pay 保存流程，和 NewebPay MPG `LINEPAY=1` 不同。
- Notify / query parser 可以讀 `PaymentType` / `PaymentMethod`，測試中有 LINEPAY 解析案例；這不代表目前有送 `LINEPAY=1`。

## 三、前端是否有顯示付款入口

### 1. Booking

- 有付款方式選單。
- 有顯示郵局匯款。
- 有顯示信用卡線上付款選項。
- 信用卡線上付款受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制。
- flag off 時信用卡選項 disabled，提示「信用卡線上付款測試中，請先使用郵局匯款」。
- 文案明確寫「藍新金流信用卡一次付清頁」。
- 未顯示 Apple Pay / Google Pay / Samsung Pay / ATM / LINE Pay / 分期。

### 2. Courses

- 有課程購買按鈕，會呼叫 `/api/payments/newebpay/course/start`。
- 後端課程付款會送 `CREDIT=1` 與 `InstFlag=3,6`。
- 課程購買會導到 `/payment/newebpay/redirect?paymentId=...`。
- 前端購買按鈕目前顯示「立即購買」與價格，未在按鈕附近明確列出「信用卡 3 / 6 期分期」文案。
- 未顯示 Apple Pay / Google Pay / Samsung Pay / ATM / LINE Pay 等其他支付工具。
- 因課程分期只在後端送出，建議另包確認課程付款前端是否需要明確文案，避免使用者誤會全站都能分期。

### 3. Divination

- persisted reading 需要付款時，會顯示「信用卡線上付款 NT$50」。
- 入口受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制。
- flag off 時按鈕 disabled，顯示「線上付款尚未啟用」。
- 未顯示 LINE Pay。
- 未顯示分期。
- 未顯示 Apple Pay / Google Pay / Samsung Pay / ATM。

### 4. AI Chart

- 正式 NewebPay 付款入口由 `NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY` 控制。
- `.env.example` 預設關閉。
- flag off 時走 legacy mock `ActionButton` flow，不應視為正式 NewebPay 入口。
- 若 flag on，會建立 AI Chart report payment 並送 NewebPay 信用卡；目前建議正式入口維持關閉。
- 未顯示 LINE Pay / 分期 / ATM / Apple Pay / Google Pay / Samsung Pay。

### 5. Product order / Cart

- cart 目前顯示匯款結帳入口。
- cart 目前顯示的是官方 LINE Pay flow，受 `NEXT_PUBLIC_ENABLE_LINE_PAY` 控制，屬 `provider=line_pay`，不是 NewebPay MPG `LINEPAY=1`。
- cart 正式 NewebPay 信用卡 checkout 尚未接前端。
- cart 沒有顯示 NewebPay ATM。
- cart 沒有顯示 Apple Pay / Google Pay / Samsung Pay。
- 商品後端已有 product order NewebPay payment / Notify paid sync 骨架，但前端尚未放 NewebPay 信用卡入口。

## 四、結論分類

### A. 後台已啟用，程式已送，前端已放

- 信用卡一次付清：
  - 後台狀態：啟用。
  - 程式狀態：會送 `CREDIT=1`。
  - 前端狀態：booking / divination 有信用卡入口但受 `NEXT_PUBLIC_ENABLE_NEWEBPAY` 控制；courses 有購買入口並導 NewebPay；AI Chart 入口由專屬 flag 控制且目前建議關閉。

### B. 後台已啟用，但程式未送，前端未放

- Apple Pay 幕前支付：後台啟用，程式未送 `APPLEPAY=1`，前端未放。
- Google Pay：後台啟用，程式未送 `ANDROIDPAY=1`，前端未放。
- Samsung Pay：後台啟用，程式未送 `SAMSUNGPAY=1`，前端未放。
- 銀聯卡：後台啟用，程式未送 `UNIONPAY=1`，前端未放。
- ATM 轉帳：後台啟用，程式未送 `VACC=1`，前端未放 NewebPay ATM。
- 國外卡：後台啟用，但目前程式未找到獨立參數，不可自行亂加。
- TWQR / 支付寶 / 微信支付：使用者截圖顯示「啟用服務」但是否已啟用仍需人工確認；目前程式未送、前端未放。

### C. 後台已啟用，但程式有送、前端未明確放

- 課程信用卡分期：
  - 後台狀態：信用卡分期付款啟用。
  - 程式狀態：課程付款送 `InstFlag=3,6`。
  - 前端狀態：課程購買按鈕未明確寫「3 / 6 期分期」，需另包確認文案。

### D. 後台未啟用 / 申請中，不可前端放出

- Apple Pay 幕後支付：尚未驗證。
- 信用卡紅利折抵：未啟用。
- 玉山 wallet：未啟用。
- 台灣 Pay：關閉。
- 信用卡定期定額：未啟用，且不是本專案目前的分期付款。
- WebATM：未啟用。
- 智慧 ATM2.0：未啟用。
- 超商代碼繳費：未啟用。
- 條碼繳費：未啟用。
- LINE Pay：申請中，不可送 `LINEPAY=1`，不可前端放出。
- AFTEE 先享後付：未啟用。

## 五、目前上線建議

- 信用卡一次付清：可作為目前 NewebPay 主線，但仍需逐產品完成正式低金額測試與 Notify / Return 驗證。
- 課程分期：只限課程付款，維持 `InstFlag=3,6`；前端文案是否需要補「3 / 6 期」需另包確認。
- 非課程付款：維持 `InstFlag=0`，不可顯示分期。
- Apple Pay / Google Pay / Samsung Pay：後台看似啟用，但程式未送參數，需另開小包評估，不可直接上線。
- ATM 轉帳：後台啟用，但程式未送 `VACC=1`，需另開小包評估。
- LINE Pay：申請中，不可上線；目前也不可送 NewebPay MPG `LINEPAY=1`。
- WebATM / 超商代碼 / 條碼：未啟用，不可上線。
- TWQR / 支付寶 / 微信支付：狀態需人工確認，且目前程式未送參數，不可直接上線。
- 商品 cart：若要開 NewebPay，下一步應先補 NewebPay 信用卡 checkout 入口，不碰其他支付工具。

## 六、禁止事項

- 不要因後台啟用就直接前端顯示。
- 不要直接送 `APPLEPAY=1` / `ANDROIDPAY=1` / `SAMSUNGPAY=1`。
- 不要直接送 `VACC=1`。
- 不要直接送 `LINEPAY=1`。
- 不要直接送 `UNIONPAY=1`、`TWQR=1`、`AFTEE=1` 或其他未評估參數。
- 不要讓非課程付款出現 `InstFlag=3,6`。
- 不要混用官方 `provider=line_pay` 與 NewebPay `provider=newebpay`。
- 不要把官方 LINE Pay cart flow 當成 NewebPay MPG LINE Pay。
- 不要輸出 HashKey / HashIV / MerchantID。
- 不要呼叫藍新 API。
- 不要刷卡。
- 不要讀 `.env.local`。
- 不要讀 production env。
- 不要 deploy。

## 七、下一步建議

- 22J-23：Apple Pay / Google Pay / Samsung Pay 可行性評估。
- 22J-24：ATM 轉帳 `VACC` 可行性評估。
- 22J-25：課程付款前端分期文案確認。
- 22J-26：商品 cart NewebPay 信用卡 checkout 補入口。

## 八、本文件限制

- 本文件沒有登入藍新後台。
- 本文件沒有呼叫藍新 API。
- 本文件沒有刷卡。
- 本文件沒有讀 `.env.local`。
- 本文件沒有讀 production env。
- 本文件沒有輸出任何 key。
- 本文件沒有執行 SQL。
