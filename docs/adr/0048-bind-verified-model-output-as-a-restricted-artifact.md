# ADR 0048：將已驗證模型輸出綁成受限 Artifact

## 狀態

Accepted

## 背景

ADR 0047 已能在人工審查前讀回並重驗已保存的 safe Evidence，但 safe Evidence
刻意不包含模型文章。後續若只憑 `request-succeeded.json` 建立可讀報告，無法證明
正文就是 Evidence 中兩個結果 fingerprint 所對應的 Writing Result 與 Fidelity
Review；若直接把模型正文放回 safe Evidence，又會破壞原本的敏感資料隔離。

## 決策

新增 `d1PalaceWritingPreviewRestrictedArtifactContracts.server.ts`，以 server-only
純資料 Contract 建立受限結果 artifact。它只接受：

- Preview Plan 與 Gate Plan。
- ADR 0047 產生的 verified safe Evidence。
- 原 Writing Prompt Package 與已通過 source-bound validator 的 Writing Result。
- 由該 Writing Result 建立的 Fidelity Prompt Package 與 Fidelity Review。

這個 Contract 沒有檔案 I/O、storage root、資料庫、Runtime、fetch 或 OpenAI
能力。

### 固定來源綁定

建立 artifact 前必須同時確認：

1. Safe Evidence 是唯一成功終態 `request-succeeded.json`，而且狀態為
   `SUCCEEDED / COMPLETE`。
2. Gate、Plan、Case 與 verified Evidence fingerprint 完全一致。
3. Writing bridge 與 Preview 第一階段 fingerprint 一致。
4. Writing Result 通過原 Prompt Package 的 source-bound validator，其 canonical
   SHA-256 等於 Evidence 第一階段 result fingerprint。
5. Fidelity Prompt Package 必須由實際 Writing Result 建立；動態 Fidelity bridge
   等於 Evidence 第二階段 bridge fingerprint。
6. Fidelity Review 通過 source-bound validator，其 canonical SHA-256 等於
   Evidence 第二階段 result fingerprint。
7. Fidelity Review 必須是 `approved / ready`；任何 repair-required 結果都拒絕。

失敗 Evidence、未知或額外控制欄位、重新計算 Evidence SHA 後的結果指紋漂移，
以及 artifact 內容或政策竄改都 fail closed。

### 資料與交付政策

Artifact 明確標示：

- `dataClassification=RESTRICTED_MODEL_OUTPUT`。
- 包含 validated Writing Result 與 Fidelity Review。
- 不包含 Prompt、request body、秘密、命盤 snapshot 或出生資料。
- `accessPolicy=SERVER_ONLY_EXPLICIT_HUMAN_REVIEW`。
- `humanReviewStatus=NOT_REVIEWED`。
- `customerDeliveryStatus=BLOCKED_PENDING_HUMAN_REVIEW`。
- `persistenceStatus=NOT_PERSISTED`。

Fidelity Review 的技術核准不等同人工品質核准，也不解除客戶交付阻擋。

## 錯誤與安全邊界

- 所有失敗收斂為固定 frozen error，不回傳 caller input、模型正文、路徑或敏感
  marker。
- Artifact、內含結果與 parser 回傳皆遞迴 frozen。
- Parser 會使用同一批權威來源重建 artifact 並比較 canonical JSON，不信任呼叫者
  提供的 SHA 或政策欄位。
- 本層不接受 storage root、persist、overwrite、retry 或任何 I/O 控制。

## 後果

- Safe Evidence 與 restricted model output 保持不同資料分類與不同 artifact。
- 後續受限儲存 adapter 只能接收本 Contract 驗證後的 artifact，不能直接接收
  模型回覆或 caller 自組 JSON。
- 真正 persistence、人工審查狀態轉換、客戶交付、Production Runtime 與 OpenAI
  request 仍需獨立設計及授權。
