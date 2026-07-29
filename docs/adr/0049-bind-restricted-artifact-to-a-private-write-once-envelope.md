# ADR 0049：將受限模型輸出綁成私有 Write-Once 封套

## 狀態

Accepted

## 背景

ADR 0048 已把 verified safe Evidence、validated Writing Result 與 approved Fidelity
Review 綁成一份 `RESTRICTED_MODEL_OUTPUT` artifact，但該 artifact 明確仍是
`NOT_PERSISTED`。若未來 storage adapter 直接接收 caller 提供的檔名、路徑、權限
或任意模型 JSON，可能發生覆寫、與 safe Evidence 混存、權限過寬，或保存未重新
驗證的結果。

## 決策

新增
`d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server.ts`，提供
server-only 的純資料 persistence envelope。公開 builder 只接受：

- Preview Plan 與 Gate Plan。
- ADR 0047 的 verified safe Evidence。
- Writing Prompt Package 與 Fidelity Prompt Package。
- ADR 0048 的 restricted artifact。

呼叫端不能指定 storage root、檔名、權限、overwrite、retry 或立即 persist。
Builder 會先使用 ADR 0048 的 parser 與同一批權威來源重建 artifact，再建立
不可變封套。

### 固定保存政策

- Artifact 名稱固定為 `restricted-result.json`。
- `restrictedArtifactFingerprint` 綁定 artifact 內部 fingerprint。
- `artifactPayloadSha256` 是完整 artifact canonical JSON 的 SHA-256，供未來 writer
  驗證實際 bytes。
- Storage scope 固定為 Gate fingerprint。
- Serialization 固定為 canonical JSON UTF-8。
- Directory／file mode 固定為 `0700`／`0600`。
- Create mode 固定為 exclusive create。
- Overwrite 與 retry 固定禁止。
- Safe Evidence 固定
  `SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED`，不複製到受限 artifact。

封套仍標記：

- `persistenceStatus=NOT_PERSISTED`。
- `accessPolicy=SERVER_ONLY_EXPLICIT_HUMAN_REVIEW`。
- `humanReviewStatus=NOT_REVIEWED`。
- `customerDeliveryStatus=BLOCKED_PENDING_HUMAN_REVIEW`。

## 驗證與安全邊界

- Parser 以權威來源重新解析 nested restricted artifact，重建整份 envelope 後比較
  canonical JSON。
- 檔名、payload SHA、權限、overwrite 或 Evidence 分離政策遭改寫時全部拒絕。
- Nested 模型結果或 artifact fingerprint 遭竄改時沿用 ADR 0048 fail closed。
- 額外 storage root、persist 或敏感 marker 不會進入 error。
- 模組不匯入 filesystem，不執行 I/O、Runtime、fetch、OpenAI、刪除或 retry。

## 後果

- 未來 restricted storage adapter 只能接收這份驗證後封套，不能自行決定 payload
  或保存政策。
- 模型正文與 safe Evidence 保持不同檔案、不同資料分類。
- 本 ADR 不建立實體檔案、資料庫 row、人工 review 狀態轉換或客戶交付能力。
- 下一個實際 writer 切片涉及受限模型內容持久化；開始前仍須保持 server-only、
  private、write-once，並另行確認保存位置與生命週期。
