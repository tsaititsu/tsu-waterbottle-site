# ADR 0051：在人工審查前驗證受限模型輸出 Readback

## 狀態

Accepted

## 背景

ADR 0050 已能把 restricted model output 以私有、Gate-scoped、write-once
filesystem artifact 保存，但保存成功不代表日後讀到的 bytes 仍可信。若人工審查流程
直接使用路徑、receipt 或未驗證 JSON，可能讀到遭替換、加料、截斷、權限放寬或
source binding 已漂移的內容。

## 決策

新增 `d1PalaceWritingPreviewRestrictedArtifactReadback.server.ts`，作為人工審查前
唯一的 server-only readback verifier。公開介面只接受：

- Preview Plan 與 Gate Plan。
- Verified safe Evidence。
- Writing Prompt Package 與 Fidelity Prompt Package。
- ADR 0050 的 persisted restricted artifact receipt。

呼叫端不能提供 storage root、路徑、檔名或 review 狀態。Verifier 固定讀取系統
temporary root 下、由 Gate fingerprint 定位的唯一 `restricted-result.json`。

### Readback 驗證

- Storage root 與 Gate 目錄都必須是目前程序使用者擁有的 `0700` regular
  directory，且 realpath 必須留在系統 temporary root 內。
- Gate 目錄必須精確只有 `restricted-result.json` 一個 entry。
- Artifact 使用 `O_RDONLY | O_NOFOLLOW` 開啟，必須是目前使用者擁有的 `0600`
  regular file。
- Payload 必須大於零且不超過 256 KiB；實際讀取 bytes 必須與 stat size 一致。
- JSON 必須重新通過 restricted artifact source-bound parser。
- 實際 bytes 必須是 parser 回傳值的 canonical JSON。
- Artifact fingerprint 與完整 payload SHA-256 必須同時符合 receipt。

成功結果為 deep-frozen verified readback，包含已驗證 restricted artifact，但不回傳
實體路徑或 caller storage 資訊。

## 安全邊界

Readback 不會：

- 把 `humanReviewStatus=NOT_REVIEWED` 改成已核准。
- 解除 `BLOCKED_PENDING_HUMAN_REVIEW`。
- 寫入、刪除、rename 或修復 artifact。
- 執行 Runtime、fetch、OpenAI request 或 retry。
- 接收 caller-selected root。

Missing、duplicate、symlink、權限過寬、超量、非 canonical、receipt drift、Gate
drift、nested model output drift 與額外敏感欄位都只回固定 frozen error，不回顯
模型內容。

## 後果

- 未來人工審查只能使用 verified readback，不得直接讀 filesystem JSON。
- Restricted artifact 已具備 write-once 與 bounded readback 兩個信任邊界。
- 目前測試只使用 synthetic Golden Case，未讀取真實命盤、出生資料或模型輸出。
- 本 ADR 不定義人工 review decision、修訂版 artifact、客戶交付、資料庫保存、
  Production Runtime 或 OpenAI request。
