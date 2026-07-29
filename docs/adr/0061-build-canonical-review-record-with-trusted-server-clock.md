# ADR 0061：以可信 Server 時間建立 canonical 人工審查紀錄封套

## 狀態

Accepted

## 背景

ADR 0060 已把 request-bound reviewer authorization、Report／Artifact 同源證明與
人工 decision proposal 組成一次性的 Server-only command。該 command 已鎖定
Report、reviewer、decision、Snapshot、Artifact 與完整來源 fingerprints，但沒有
可信時間，也不能自行決定正式紀錄的 serialization、檔名或寫入政策。

若時間由 Client 或 route caller 傳入，正式審查順序便可被偽造。若 writer 自行從
command 拼裝 payload，不同 writer 也可能產生不同紀錄。若時鐘尚未驗證就先消耗
command，暫時性的 clock failure 還會浪費合法的一次性能力。

## 決策

### 使用 module-owned Server clock

新增 `d1PalaceWritingHumanReviewRecordEnvelope.server.ts`。公開 builder 預設直接
使用 Server process 的 `new Date()`，不接受 caller timestamp。只有
`NODE_ENV=test` 能以 dependency injection 提供固定 `now()`，用來建立 deterministic
Contract tests；Production 環境若嘗試替換 clock 會 fail closed。

Clock outcome 必須是真正、有效的 `Date`，並由程式轉成 RFC 3339 UTC 字串。固定失敗
分類只有：

- `SERVER_CLOCK_UNAVAILABLE`
- `SERVER_TIMESTAMP_INVALID`

Clock 會在消耗 review command 前完成驗證。Clock throw、非 `Date` 或 invalid date
都不會消耗合法 command。

### 建立 canonical review record

Clock 通過後才消耗原始、未使用的 review command，建立 frozen record。Record 只保存：

- Report UUID、reviewer UUID 與固定 permission。
- Decision 與 allowlisted issue codes。
- Trusted Server timestamp 及其 authority。
- Report／Artifact Snapshot SHA。
- Gate、Artifact、payload、proposal、authorization、source binding 與 command
  fingerprints。
- 固定 source／authorization／delivery 狀態。
- Canonical record fingerprint。

Record 不保存 email、Bearer token、Session、完整 Snapshot、Restricted Artifact
正文、模型輸出、Prompt、出生資料、review notes、任意 provider message 或 storage
path。

### 建立 write-once persistence envelope

Record 再形成 frozen canonical envelope，固定：

- 檔名 `human-review-record.json`。
- Gate fingerprint storage scope。
- canonical JSON UTF-8 與完整 payload SHA-256。
- `EXCLUSIVE_CREATE`。
- `0700` 目錄、`0600` 檔案。
- 禁止 overwrite 與 retry。
- 未來只能交給 trusted Server human-review record storage adapter。

Envelope 使用 module-private exact-object identity，只能被未來 writer 消耗一次。
Copy、clone、JSON 往返、欄位相同的偽造物件或第二次消耗都固定拒絕。

## 本切片仍未開放

Envelope 狀態固定為：

`CANONICAL_RECORD_READY_NOT_PERSISTED`

且固定：

- `persistenceStatus=NOT_PERSISTED`
- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `storageWrites=0`
- `openAiRequests=0`

本切片沒有 filesystem 或 Supabase writer、沒有 API route、沒有正式資料寫入、沒有
OpenAI request，也不解除客戶交付。即使 decision 是 `APPROVED`，尚未由 trusted
writer 成功 exclusive-create 前仍不能視為正式人工審查紀錄。

## 後果

- Reviewer、Report、Snapshot、Artifact、decision 與 Server time 現在有單一
  canonical record payload。
- Caller 不能偽造時間、路徑、檔名、overwrite 或 retry 政策。
- Clock failure 不會浪費合法 review command。
- 下一個最小切片只需設計 trusted write-once writer 與安全 receipt；實際正式寫入
  仍受資料寫入與部署授權邊界限制。
