# ADR 0060：把審查權限、同源證明與人工決策組成正式 command

## 狀態

Accepted

## 背景

ADR 0057 已能從目前 Request 的 Server-verified admin session 取得 reviewer UUID
與固定審查權限；ADR 0059 已能證明 paid Report Snapshot 與 Restricted Artifact
來自同一份 canonical Snapshot。既有 human-review decision proposal 也已固定
`APPROVED`、`REPAIR_REQUIRED`、`REJECTED` 與 allowlisted issue codes。

這三項能力若只以可複製 metadata 分開傳遞，後續 writer 仍可能把某個 reviewer、
某份 Report／Artifact 與另一份 decision proposal 錯誤組合。尤其 proposal 的
Gate、Artifact fingerprint 與 payload SHA 必須同時綁回同一份 source binding，
不能只驗其中一項。

## 決策

### Source binding 補齊 payload 身分

Report／Artifact source binding 在消耗原始 Restricted Artifact 時，另外以
canonical JSON 計算並保存：

`restrictedArtifactPayloadSha256`

此值與 Restricted Artifact fingerprint、Gate fingerprint、Snapshot SHA 一起
受 source-binding fingerprint 保護。Caller 不能提供或改寫。

### 建立 Server-only review command

新增 `d1PalaceWritingHumanReviewCommand.server.ts`。公開 seam 只接受：

1. 原始、尚未消耗的 request-bound reviewer authorization capability。
2. 原始、尚未消耗的 Report／Artifact source-binding capability。
3. 通過既有 Contract 的 human-review decision proposal。

程式先完整驗證 proposal 固定欄位、決策、issue codes、狀態與 fingerprint，再要求
下列三項逐位相同：

- Gate fingerprint。
- Restricted Artifact fingerprint。
- Artifact payload SHA-256。

比對失敗時在消耗兩項能力前停止。比對通過後才單次消耗 reviewer authorization
與 source binding，建立 frozen review command。

Command 只保存正式紀錄後續需要的安全 metadata：

- Report UUID 與 reviewer UUID。
- 固定 reviewer permission。
- 決策與 allowlisted issue codes。
- Report／Artifact Snapshot SHA。
- Gate、Artifact、payload、proposal、authorization 與 source-binding
  fingerprints。
- 固定 delivery 阻擋狀態及 command fingerprint。

它不保存 email、Bearer token、完整 Snapshot、Restricted Artifact 正文、模型
輸出、Prompt、出生資料、review notes、時間或 storage path。

## 單次能力

Review command 使用 module-private exact-object identity，只能由後續同程序
consumer 消耗一次。Copy、clone、JSON 往返、欄位相同的偽造物件或第二次使用都
拒絕。

固定失敗分類只有：

- `DECISION_PROPOSAL_INVALID`
- `DECISION_SOURCE_BINDING_MISMATCH`
- `REQUEST_AUTHORIZATION_UNAVAILABLE`
- `SOURCE_BINDING_UNAVAILABLE`
- `REVIEW_COMMAND_UNAVAILABLE`

錯誤不包含 provider message、動態 ID、模型正文或敏感內容。

## 本切片仍未開放

Command 狀態固定為：

`AUTHORIZED_SOURCE_BOUND_AWAITING_SERVER_CLOCK_AND_WRITE_ONCE_RECORD`

且固定：

- `trustedServerClockRequired=true`
- `writeOnceRecordWriterRequired=true`
- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `openAiRequests=0`

本切片不接 API route、不讀 Server clock、不寫 filesystem 或 Supabase、不建立正式
人工審查紀錄，也不解除客戶交付。即使 decision 是 `APPROVED`，報告仍保持
`BLOCKED_PENDING_TRUSTED_REVIEW_RECORD`。

## 後果

- Reviewer、Report、Snapshot、Artifact 與 decision 不再由後續 caller 自由拼裝。
- Decision source drift 會在消耗合法能力前停止，避免不必要地燒掉一次性能力。
- 下一個最小切片只需處理 trusted Server clock 與 module-owned canonical
  write-once record；它仍須遵守正式資料寫入與部署授權邊界。
