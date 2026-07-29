# ADR 0043：將 Preview Terminal Ledger 純投影成安全 Evidence

## 狀態

Accepted

## 背景

ADR 0041 已用 Execution Ledger 分開記錄 request attempt、fetch dispatch 與
validated execution；ADR 0042 也讓 final Evidence parser 接受兩種真實的
pre-fetch failure。不過兩份 Contract 之間仍沒有正式轉換邊界。

若未來 Runtime 自行抄寫計數、stage 狀態與 bridge fingerprint，仍可能把
non-terminal 狀態當成 Evidence、漏掉動態 Fidelity bridge，或把 Ledger 控制欄位
與任意錯誤內容帶進可保存摘要。

## 決策

新增純函式
`projectAiChartD1PalaceWritingPreviewEvidence({ previewPlan, executionLedger })`。
它只接受下列五種 terminal Ledger：

1. Writing pre-fetch failure。
2. Writing post-fetch failure。
3. Fidelity Review pre-fetch failure。
4. Fidelity Review post-fetch failure。
5. Writing 與 Fidelity Review 都成功。

投影器不直接信任 Ledger 欄位。它會先用既有 Plan parser 驗證固定計畫，再從
Ledger 的安全欄位重放既有不可變狀態機，只有重建結果的 canonical JSON 與輸入
逐位一致時，才建立 raw Evidence，最後再交回既有 final Evidence parser 驗證與
freeze。

Writing 在 Review 尚未開始時，Ledger 的 Fidelity bridge 必須保持 `null`，因為
實際 Writing Result 尚未衍生第二階段 binding；投影到既有 Evidence v1 時，
`NOT_STARTED` stage 使用 Preview Plan 內的 reference bridge fingerprint。此欄只
表示計畫參考綁定，不表示 Runtime 已建立或使用 Fidelity bridge。

## Fail-Closed 與安全邊界

- READY、REQUEST_ATTEMPTED、FETCH_DISPATCHED 或只完成 Writing 的 non-terminal
  Ledger 一律拒絕。
- 額外欄位、竄改計數、錯誤 stage 順序、錯誤 bridge、usage 算術錯誤或任意
  failure code 一律收斂成同一個 module-owned frozen error。
- `gateFingerprint`、`failurePhase`、`evidenceStatus` 與其他 Ledger 控制欄位不會
  進入 Evidence。
- Evidence 只保存 allowlisted stage 狀態、safe usage、duration、結果 SHA-256
  與固定 failure code。
- 模型文字、Prompt、request body、API Key、Authorization、命盤及出生資料都不
  進入投影結果或錯誤。

## 後果

- Terminal Ledger 現可用單一純函式產生正式、不可變且可重驗的 Evidence。
- attempted、fetch、executed 與 pre/post-fetch 語意不再由未來 Runner 重複實作。
- 技術成功仍固定 `BLOCKED_PENDING_HUMAN_REVIEW`，不會因投影成功直接交付客戶。
- 本 ADR 沒有 Evidence 檔案 writer、restricted result artifact persistence、
  Runtime Adapter、fetch、OpenAI request、retry 或客戶交付。
