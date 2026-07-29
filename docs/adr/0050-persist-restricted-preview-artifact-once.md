# ADR 0050：以 Server-Only Writer 單次保存受限模型輸出

## 狀態

Accepted

## 背景

ADR 0049 已把 validated Writing Result、approved Fidelity Review 與 verified safe
Evidence 綁成固定的私有 write-once persistence envelope，但仍未實際保存。若 writer
信任 caller 提供的路徑、權限或 payload，或允許同一 Gate 重試與覆寫，就可能把受限
模型正文寫到非私有位置、取代既有結果，或讓兩個並行終態同時落地。

## 決策

新增 `d1PalaceWritingPreviewRestrictedArtifactWriter.server.ts`。Writer 在任何
filesystem I/O 前，先用 ADR 0049 的 parser 與原始 Preview Plan、Gate Plan、
verified safe Evidence 及兩階段 Prompt Packages 重驗整份 envelope。

固定保存政策如下：

- Storage root 固定在系統 temporary root 下的
  `ai-chart-d1-palace-writing-preview-restricted-artifact`，caller 不能指定。
- 每個 Gate fingerprint 對應一個私有目錄；建立目錄即取得該 Gate 的唯一寫入權。
- Artifact 名稱固定為 `restricted-result.json`。
- 寫入 bytes 固定為 restricted artifact 的 canonical JSON UTF-8，並綁定 envelope
  的完整 payload SHA-256。
- Root 與 Gate 目錄必須是目前程序使用者擁有的 `0700` regular directory。
- Artifact 必須以 `open("wx", 0600)` exclusive create，完成後重驗 regular file、
  ownership 與權限。
- 既有 Gate、並行競爭、symlink、寬鬆權限、額外 storage root 或遭竄改的 envelope
  全部 fail closed。
- Writer 不提供 overwrite、delete、rename 或 retry 路徑。

成功 receipt 只回傳固定 metadata 與 fingerprints，不回傳實體路徑或 restricted
artifact 內容。Receipt 仍固定：

- `dataClassification=RESTRICTED_MODEL_OUTPUT`。
- `accessPolicy=SERVER_ONLY_EXPLICIT_HUMAN_REVIEW`。
- `humanReviewStatus=NOT_REVIEWED`。
- `customerDeliveryStatus=BLOCKED_PENDING_HUMAN_REVIEW`。
- Safe Evidence 仍是已另行驗證、未複製進本 artifact。

## 驗證與安全邊界

- Synthetic Golden Case 驗證 canonical bytes、payload SHA、`0700`／`0600` 與
  path-free frozen receipt。
- 兩個同 Gate 並行 writer 只有一個成功；後續重複呼叫不會改變既有 bytes。
- Tampered nested output、錯誤 payload SHA、caller-selected root、symlink 與
  permissive root 均在不洩漏 synthetic sensitive marker 的情況下拒絕。
- Source contract 確認模組為 server-only，沒有 fetch、OpenAI、Secret、刪除、
  rename 或 caller-selected storage root。

## 後果

- Restricted model output 已有第一個實際、私有、write-once 的 filesystem seam，
  與 safe Evidence 保持不同 storage root 與資料分類。
- 目前測試只建立並清除 synthetic artifact；未保存真實命盤、出生資料或模型輸出。
- 本 ADR 不提供 readback、人工審查狀態轉換、客戶交付、資料庫保存、Production
  Runtime 或 OpenAI request。
- 下一個最小切片是 server-only bounded readback verifier；它仍不得自行把
  `NOT_REVIEWED` 改為已核准或解除客戶交付阻擋。
