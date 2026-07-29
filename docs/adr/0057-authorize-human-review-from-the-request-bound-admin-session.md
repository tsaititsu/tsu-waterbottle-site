# ADR 0057：由 Request-bound Server session 取得人工審查權限

## 狀態

Accepted

## 背景

ADR 0055 已把正式人工審查拆成 request-bound reviewer authorization、trusted
Server clock 與 write-once storage 三個 port。ADR 0056 又要求正式紀錄先綁定同一
Report、canonical Snapshot 與 restricted Artifact。現有 synthetic authorization
probe 只能驗證資料 Contract，不能證明目前 Request 的操作者已由 Server 驗證。

專案既有 `requireAdminUser(request)` 已從 Bearer token 呼叫 Supabase Auth
`getUser()` 驗證使用者，再以 Server-only `ADMIN_EMAILS` allowlist 確認管理權限。
本階段不新增角色、RLS、資料表或環境變數，也不讓 Client 提供 reviewer identity。

## 決策

新增 `d1PalaceWritingHumanReviewRequestAuthorization.server.ts`，實作 ADR 0055 的
第一個 Production port：

`VERIFY_REQUEST_BOUND_REVIEWER_AUTHORIZATION`

Adapter 必須接收原始 `Request`，沿用 `requireAdminUser(request)` 的 Server 驗證
結果，並只產生以下安全 metadata：

- Supabase Auth 驗證後的 reviewer UUID。
- 唯一固定 permission
  `AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW`。
- 固定 authorization policy 與 session binding 狀態。
- 由 canonical metadata 計算的 authorization fingerprint。

輸出不保存 email、Bearer token、Supabase client、Session、Prompt、模型正文、
出生資料或命盤資料。Reviewer UUID 只供後續正式稽核紀錄綁定，不能由 Request
body 或 Client 欄位指定。

## 單次能力

成功 authorization 會以 module-private `WeakMap` 登記。只有原始物件可以消耗
一次；spread copy、structured clone、JSON clone 或第二次使用都固定拒絕。這個
物件不能跨程序或序列化成正式權限。

測試可以注入 fake `requireAdmin`，但只有 `NODE_ENV=test` 接受；其他環境嘗試
替換正式 adapter 時 fail closed，且不呼叫 injected function。

## 固定失敗分類

只允許：

- `AUTHORIZATION_ADAPTER_UNAVAILABLE`
- `REVIEWER_SESSION_INVALID`
- `REVIEWER_PERMISSION_DENIED`
- `REVIEWER_IDENTITY_INVALID`

底層 provider message、email、token、stack 或任意動態字串都不得進入 error。

## 本切片仍未開放

此 adapter 本身可在 Server production path 驗證 Request，但目前沒有接到 API
route 或正式 review coordinator。它固定：

- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `openAiRequests=0`

本切片不查 Report、不判斷 paid／owner、不計算 Snapshot SHA、不讀 restricted
Artifact、不取得 Server time，也不寫 filesystem、Supabase 或任何正式紀錄。

## 後果

- 人工審查權限不能再由 caller、Client 或 synthetic adapter 宣稱。
- 下一個 production 切片仍必須用 Server 查得的 Report／Snapshot／Artifact
  binding，再與本 authorization 及 trusted Server clock 組成正式紀錄。
- `ADMIN_EMAILS` 是目前專案既有管理員邊界；若未來要把 AI 命盤審查拆成更細角色，
  必須另做權限設計與授權，不在本 ADR 擴張。
- 永久 write-once record storage 與客戶交付仍未實作。
