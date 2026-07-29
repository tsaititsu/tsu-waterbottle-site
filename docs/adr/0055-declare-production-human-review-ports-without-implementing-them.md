# ADR 0055：先宣告正式人工審核 Ports，不實作正式能力

## 狀態

Accepted

## 背景

ADR 0054 已固定 `human-review-record.json` 的 write-once 離線模板，但模板來源
仍是 synthetic authorization handoff，缺少真實登入、reviewer identity、Server
clock 與正式 storage adapter。若下一步直接讓 caller 提供 `reviewerId`、
`recordedAt`、`authorized=true` 或 storage path，就會把一般輸入冒充 Server
authority；若只做一個模糊 writer 介面，也容易漏掉授權、時間或 exclusive create
其中一層。

本階段尚未選定正式登入與紀錄儲存實作，因此只能固定 ports 及失敗邊界，不能
建立成功的正式紀錄路徑。

## 決策

新增
`d1PalaceWritingPreviewHumanReviewProductionPortContracts.server.ts`。公開 seam
只接受 ADR 0054 模組親自建立、尚未交接的 exact template。Template 以
module-private object identity 單次交接；copy、clone、wrapper 或欄位相同的重建
物件沒有能力。

Contract 固定三個依序執行的 Production port：

1. `VERIFY_REQUEST_BOUND_REVIEWER_AUTHORIZATION`
   - 只接收 source-bound decision metadata。
   - 必須從 request-bound Server session 取得並驗證 reviewer identity。
   - Permission 固定為
     `AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW`。
2. `READ_TRUSTED_SERVER_CLOCK`
   - 不接受 caller timestamp。
   - 未來只能回傳受信任的 RFC 3339 UTC Server timestamp。
3. `EXCLUSIVE_CREATE_HUMAN_REVIEW_RECORD`
   - 只接受 module-owned canonical record。
   - 依 Gate fingerprint scope、固定檔名、`0700`／`0600` 與 exclusive create
     寫入。

Contract 同時固定十個 allowlisted failure code：

- `AUTHORIZATION_ADAPTER_UNAVAILABLE`
- `REVIEWER_SESSION_INVALID`
- `REVIEWER_PERMISSION_DENIED`
- `REVIEWER_IDENTITY_INVALID`
- `SERVER_CLOCK_UNAVAILABLE`
- `SERVER_TIMESTAMP_INVALID`
- `RECORD_STORAGE_ADAPTER_UNAVAILABLE`
- `RECORD_ALREADY_EXISTS`
- `RECORD_WRITE_FAILED`
- `SOURCE_BINDING_MISMATCH`

失敗碼不能來自 adapter error message、reviewer input、storage response 或其他
動態字串。

## 尚未開放的能力

本 Contract 只可在 canonical test environment 建立，且固定：

- `sourceAuthorizationMode=OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY`
- `sourceAcceptedForProduction=false`
- `implementationStatus=PORTS_DECLARED_NOT_IMPLEMENTED`
- `recordStatus=FORMAL_RECORD_NOT_CREATED`
- `persistenceStatus=NOT_PERSISTED`
- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `productionCallable=false`
- `adapterInvocations=0`
- `storageWrites=0`
- `openAiRequests=0`

它不呼叫任何 adapter，不讀 session，不建立 reviewer ID 或時間，不寫 filesystem
或資料庫，也不產生 delivery permit。

## 安全邊界

- Caller 不能注入 authorization function、clock、writer、path、filename、
  reviewer identity、timestamp、notes 或 permission。
- Contract 只保存固定 decision metadata 與 fingerprints，不保存 restricted
  artifact、Prompt、模型文字、命盤、出生資料、Secret 或 session。
- Non-test environment 在消耗 template 前 fail closed。
- 所有輸出及 nested arrays／port descriptors 都 frozen。
- 同一 template 只能建立一份 port contract。

## 後果

- 正式人工審核的 request-bound authorization、Server time 與 write-once storage
  責任已分開，可在選定實際技術後逐 port 實作及測試。
- 任何一個 port 缺失都不能建立正式紀錄或解除客戶交付阻擋。
- 下一步若繼續，應先選定現有網站可沿用的 Server session／permission seam 與
  正式紀錄儲存位置，再另行建立 request-bound adapter；不能把本 Contract 當成
  Production implementation。
