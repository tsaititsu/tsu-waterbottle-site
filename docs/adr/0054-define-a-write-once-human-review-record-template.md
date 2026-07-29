# ADR 0054：固定人工審查紀錄的 write-once 離線模板

## 狀態

Accepted

## 背景

ADR 0053 已用 exact-object identity handoff 固定 reviewer authorization adapter
的離線交接，但該 handoff 明確不是 Production authorization，也不能建立正式審查
紀錄。在真正登入、permission source、reviewer identity 與 Server clock 尚未接入
前，仍需要先固定未來紀錄的 source binding、檔名及不可覆寫政策，避免各 writer
自行發明格式。

若直接把 synthetic handoff 寫成「已審查」紀錄，會把離線測試冒充真人授權；
若讓 caller 選檔名、路徑、時間或 reviewer ID，也會破壞來源可信度與稽核性。

## 決策

新增
`d1PalaceWritingPreviewHumanReviewRecordPersistenceProbe.server.ts`。公開 seam
只接受 ADR 0053 模組親自建立、尚未消耗的原始 handoff。Probe 先以既有
module-private capability consumer 消耗 handoff，再建立 frozen persistence
template。

Template 固定保存：

- Gate、restricted artifact、payload 與 proposal fingerprints。
- `APPROVED`／`REPAIR_REQUIRED`／`REJECTED` 與固定 issue codes。
- `recordArtifactName=human-review-record.json`。
- `storageScope=GATE_FINGERPRINT`。
- `serialization=CANONICAL_JSON_UTF8`。
- `createMode=EXCLUSIVE_CREATE`。
- `directoryMode=0700`、`fileMode=0600`。
- `overwriteAllowed=false`、`retryAllowed=false`。
- 完整 template fingerprint。

Caller 不能提供 storage root、檔名、write flag、reviewer ID、notes、時間或正式
authority。Copy、clone、包裝物件或已消耗 handoff 都固定拒絕；並行 probe 最多
一個成功。

## 正式紀錄阻擋

因為來源仍是 synthetic handoff，template 固定：

- `sourceAuthorizationMode=OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY`
- `authorizationBindingStatus=PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_REQUIRED`
- `reviewerIdentityBindingStatus=PRODUCTION_REVIEWER_IDENTITY_REQUIRED`
- `recordedAtBindingStatus=PRODUCTION_SERVER_CLOCK_REQUIRED`
- `recordStatus=TEMPLATE_NOT_FORMAL_RECORD`
- `persistenceStatus=NOT_PERSISTED`
- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `productionCallable=false`

Customer delivery status 沿用原 proposal 的阻擋狀態。Template 不是 record、
receipt、storage capability 或 delivery permit。

## 安全邊界

- Probe 只可在 canonical test environment 執行；Production 在 handoff 消耗前拒絕。
- 模組沒有 filesystem、資料庫、fetch、OpenAI、Secret、會員資料或模型正文。
- 不產生 `reviewerId`、`recordedAt` 或自由文字 notes。
- 不建立、覆寫、刪除或重試任何檔案。
- 本層仍未讀取真實使用者、命盤或 restricted artifact 正文。

## 後果

- 未來正式 writer 的固定 artifact shape 與 write-once policy 已可離線回歸。
- 真正 production authorization adapter 必須另外提供可信 reviewer identity 與
  Server timestamp，且不能把本 template 當成已授權紀錄。
- 下一步若繼續，只能設計 production adapter／writer 的介面與失敗邊界；在真實
  auth 技術與使用者授權完成前，不能建立成功的正式紀錄路徑。
