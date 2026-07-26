# LINE Pay Online API v3／v4 與 Timeout 契約研究

研究日期：2026-07-26

研究範圍：本專案既有 `request`、`confirm`、`status`、`paymentDetails` 四個 operation

資料來源：僅使用 LINE Pay Developers 官方文件；未呼叫 LINE Pay API，未使用任何 Channel ID 或 Secret

## 結論摘要

1. Online API v3 與 v4 的四個既有 operation，在 HTTP method、資源路徑結構、HMAC 認證方式與官方 Read timeout 下限上相同；主要差異是路徑中的版本號由 `/v3` 改為 `/v4`。
2. 官方要求的最低 Read timeout 為：
   - `request`：至少 10 秒。
   - `confirm`：至少 40 秒。
   - `status`：至少 20 秒。
   - `paymentDetails`：至少 20 秒。
3. 研究時專案的 Gateway 與網站 timeout 預設均為 5 秒，上限均為 30 秒。這不符合 `confirm` 至少 40 秒的官方契約；P1 必須先改成 operation-specific timeout，讓單一 30 秒設定上限不能再壓低實際 operation deadline。
4. 官方把 Online API v4 定位為台灣 EPI 變更的版本，主要增加清算／撥款單位 `paymentProvider`，並為預先授權付款新增 `options.regPayRequest`。
5. LINE Pay 官方同時明確表示：若商家不需要在交易當下取得清算／撥款單位，仍可繼續使用既有 API。因此，單憑「一般 TWD 線上單次付款」不能推導出 v4 是強制升級。
6. 本專案目前未使用預先授權付款，也未消費 `paymentProvider`。最小風險的 P1 應先保留 v3、修正 timeout 契約；v4 應作為獨立、原子化的版本升級，待確認商務／EPI需求後再執行，不能只把部分 path 改成 `/v4`。

## 四個 operation 的官方契約

| 專案 operation | v3 method／path | v4 method／path | Request body／query | 官方 Read timeout 下限 |
| --- | --- | --- | --- | ---: |
| `request` | `POST /v3/payments/request` | `POST /v4/payments/request` | JSON body | 10 秒 |
| `confirm` | `POST /v3/payments/{transactionId}/confirm` | `POST /v4/payments/{transactionId}/confirm` | JSON body：`amount`、`currency` | 40 秒 |
| `status` | `GET /v3/payments/requests/{transactionId}/check` | `GET /v4/payments/requests/{transactionId}/check` | 無 body、無 query | 20 秒 |
| `paymentDetails` | `GET /v3/payments` | `GET /v4/payments` | `transactionId[]` 或 `orderId[]` query，至少提供一類 | 20 秒 |

官方端點文件：

- `request`：[v3](https://developers-pay.line.me/zh/online-api-v3/request-payment)、[v4](https://developers-pay.line.me/zh/online-api-v4/request-payment)
- `confirm`：[v3](https://developers-pay.line.me/zh/online-api-v3/confirm-payment)、[v4](https://developers-pay.line.me/zh/online-api-v4/confirm-payment)
- `status`：[v3](https://developers-pay.line.me/zh/online-api-v3/check-payment-request-status)、[v4](https://developers-pay.line.me/zh/online-api-v4/check-payment-request-status)
- `paymentDetails`：[v3](https://developers-pay.line.me/zh/online-api-v3/retrieve-payment-details)、[v4](https://developers-pay.line.me/zh/online-api-v4/retrieve-payment-details)

### `request`

- 成功時取得後續流程使用的 `transactionId` 與付款導向 URL。
- v3 與 v4 都是 `POST`，且都是把 request body 的實際序列化字串放入簽章訊息。
- v4 另在付款請求的 `options` 中增加預先授權付款設定 `regPayRequest`；本專案目前的一般單次付款不使用這項能力。

### `confirm`

- 顧客完成 LINE Pay 認證後，商家呼叫此 API 進行付款授權。
- `transactionId` 位於 path，`amount` 與 `currency` 位於 JSON body。
- v4 的成功回應可在 `info.paymentProvider` 提供清算／撥款單位。
- 40 秒是官方下限，不是建議上限；任何小於 40 秒的 Gateway upstream timeout 都不符合官方契約。

### `status`

- 主要用於沒有提供 redirect URL 的付款流程，定期查詢顧客是否完成 LINE Pay 認證。
- 官方建議查詢間隔至少 1 秒。
- 重要的 `returnCode` 語意：
  - `0000`：尚未完成 LINE Pay 認證。
  - `0110`：已完成認證，可以進行 `confirm`。
  - `0121`：顧客取消或等待認證逾時。
  - `0122`：付款失敗。
  - `0123`：付款完成。
- v4 change log 未列出這個 operation 的 EPI response schema 差異。

### `paymentDetails`

- 查詢已授權或已請款付款的詳細資訊。
- 至少要提供 `transactionId` 或 `orderId`；官方介面也允許一個或多個值。
- v4 的每筆付款資訊可包含 `paymentProvider`。
- LINE Pay transaction ID 是 19 位整數。JavaScript 不能安全地用一般 `number` 保存全部 19 位值；官方建議無法處理 64-bit long 時轉成字串。本專案應繼續維持 `transactionId` 字串處理。

Transaction ID 來源：[Online API v4 總覽](https://developers-pay.line.me/zh/online-api-v4/)

## v3／v4 共用 HMAC 契約

Online API v3 與 v4 使用同一組認證 headers：

- `X-LINE-ChannelId`
- `X-LINE-Authorization`
- `X-LINE-Authorization-Nonce`
- `Content-Type: application/json`

`X-LINE-Authorization` 是以 Channel Secret 作為 HMAC-SHA256 key，對固定訊息計算 MAC 後再 Base64 編碼。

官方定義的訊息：

```text
GET:
CHANNEL_SECRET + API_PATH + QUERY_STRING + NONCE

POST:
CHANNEL_SECRET + API_PATH + EXACT_REQUEST_BODY + NONCE
```

四個 operation 對應為：

```text
request:
CHANNEL_SECRET + /v{3|4}/payments/request + EXACT_JSON_BODY + NONCE

confirm:
CHANNEL_SECRET + /v{3|4}/payments/{transactionId}/confirm + EXACT_JSON_BODY + NONCE

status:
CHANNEL_SECRET + /v{3|4}/payments/requests/{transactionId}/check + "" + NONCE

paymentDetails:
CHANNEL_SECRET + /v{3|4}/payments + EXACT_QUERY_STRING + NONCE
```

實作約束：

- 簽章使用的 POST body 必須與實際送出的 bytes 完全相同，不能簽完後再次 stringify 成不同字串。
- GET 的 query 參數順序與 percent-encoding 必須在簽章與實際 URL 間保持完全相同。
- API 版本是 `apiPath` 的一部分；切換 v3／v4 時一定會改變簽章內容。
- v3／v4 使用同一種 HMAC 規則，但不能拿 v3 path 產生的簽章送往 v4 path。
- Channel Secret 是 HMAC key，同時依官方公式出現在待簽訊息開頭；不得省略其中任何一處。

來源：[LINE Pay Online API 提前準備](https://developers-pay.line.me/zh/online/prerequisites)

## v4 的必要性判斷

### 官方已確認的事實

LINE Pay 在 2025 年 11 月的 change log 中，把 v4 說明為台灣 EPI 相關變更：

- `confirm`、`capture`、`paymentDetails`、預先授權付款回應增加 `info.paymentProvider`。
- `request` 增加 `options.regPayRequest`。
- `paymentProvider` 可區分第三方支付公司 `TSP` 與電子支付機構 `EPI`。
- Sandbox 的 Online 交易流程不能模擬 EPI；`paymentProvider` 會固定回傳 `TSP`。
- 若商家不需要在交易當下取得清算／撥款單位，官方允許繼續使用既有 API。

來源：[LINE Pay API change log](https://developers-pay.line.me/zh/api-change-log)

### 對本專案的判定

目前可由公開官方文件支持的判定是：

- **v4 不是所有 TWD 一般線上單次付款的無條件強制升級。**
- **需要 EPI 相關 response 資訊時，應使用 v4。**
- 本專案目前不使用 `regPayRequest`，也未把 `paymentProvider` 納入付款完成證據或 reconciliation 契約，因此既有 v3 流程仍屬官方允許延續的範圍。
- 公開文件無法證明特定合作商店帳號、合約或正式上線審查是否另有 v4 要求；正式啟用前仍需以該 Merchant Center 帳號或 LINE Pay 對口的要求為準。

## P1 實作建議

### 1. 本 PR 先保留 v3

timeout 修正與 API 版本升級是兩個不同風險：

- timeout 修正是既有 v3 契約的必要合規修正。
- v4 會改變所有 path、官方簽章輸入、Gateway operation target 與 response schema。

因此 P1 應保留現有 v3 operation target，不在同一個修改中靜默切換到 v4。

### 2. 建立 operation-specific timeout 契約

至少鎖定以下下限：

```text
request          >= 10_000 ms
status           >= 20_000 ms
paymentDetails   >= 20_000 ms
confirm          >= 40_000 ms
```

另外，網站到 Gateway 的 deadline 必須大於 Gateway 到 LINE Pay 的 deadline，保留 Gateway 完成 response parsing 與回傳受控錯誤的時間。這是本專案的架構需求，不是 LINE Pay 文件提供的固定數字；實作時應用明確常數與測試鎖定 margin。

不應：

- 用單一 30 秒上限套用所有 operation。
- 因 timeout 自動重送 `request` 或 `confirm`。
- Gateway timeout 後自動 fallback 到 direct。
- 把逾時直接當成 LINE Pay 未收到請求或付款必然失敗。

### 3. v4 升級應另立原子化工作包

若後續確認需要 v4，至少要在同一個版本升級 PR 中同步處理：

1. 網站四個 operation 的固定 path。
2. LINE Pay HMAC 簽章測試向量。
3. Gateway operation 白名單與固定 upstream target。
4. direct／gateway transport parity。
5. `paymentProvider` response schema、parser、audit／reconciliation 保存策略。
6. v3 response 與 v4 response 的相容性測試。
7. Sandbox 的 `paymentProvider="TSP"` 限制與無法模擬 EPI 的驗收說明。
8. 不允許 v3 request 搭配 v4 confirm，或任何跨版本混用。

## P1 實作決策

P1 採用固定、可測試的 deadline：

| operation | direct／Gateway upstream | 網站到 Gateway |
| --- | ---: | ---: |
| `request` | 15 秒 | 35 秒 |
| `confirm` | 45 秒 | 50 秒 |
| `status` | 25 秒 | 35 秒 |
| `paymentDetails` | 25 秒 | 35 秒 |

- direct 與 Gateway upstream 在官方最低 read timeout 上增加固定 5 秒服務緩衝。
- 既有 `LINE_PAY_UPSTREAM_TIMEOUT_MS` 維持 100–30000 ms 的相容設定範圍，但只可拉長 operation deadline，不能壓低表列值。
- 由於 Gateway 設定上限為 30 秒，各 operation 的最大 upstream deadline 是 30／45／30／30 秒；網站到 Gateway 的固定下限再增加 5 秒，確保外層 deadline 大於內層。
- 既有 `LINE_PAY_GATEWAY_TIMEOUT_MS` 同樣只作可拉長的設定下限，不能壓低 operation 固定值。
- timeout 後一律 fail closed；不自動 retry、不自動 fallback，也不因 fetch adapter 在 abort 後遲到回傳成功而改判成功。

## P1 驗收條件

- 四個 operation 的 method、path 與 timeout policy 有單一 module-owned 契約。
- `confirm` 可設定且實際允許至少 40 秒的 Gateway upstream deadline。
- 網站到 Gateway 的 deadline 保證大於該 operation 的 upstream deadline。
- direct 與 gateway 都使用相同 operation policy。
- v3 LINE Pay HMAC、payload、query canonicalization 與 transaction ID 字串處理不變。
- timeout 不會觸發自動 retry 或 direct fallback。
- 測試覆蓋四個 operation 的最低值、非法低值、邊界值與 timeout 分類。
- 本工作包不使用 LINE Pay Key、不呼叫 LINE Pay API、不啟用 Runtime，也不執行任何 Production 操作。
