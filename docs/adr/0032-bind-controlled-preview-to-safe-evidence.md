# ADR 0032：受控 Preview 與安全 Evidence 分離

## 狀態

Accepted

## 背景

單宮 Golden Case 已固定 Writing 與 Fidelity Review 的兩階段 Benchmark Plan，但尚未定義未來受控實測應如何保存：

1. 每一階段實際花費時間。
2. OpenAI 回傳的安全 token usage。
3. 請求是否曾送出、完成或失敗。
4. 技術驗證與人工品質判斷的差別。
5. 模型文章與 Evidence 摘要的資料邊界。

如果只保存一個 `success`，無法知道哪一階段失敗、是否曾送出請求或花了多少 token。如果把模型文章、Prompt 或 request body 直接塞進 Evidence，又會擴大敏感資料與未核准模型內容的保存範圍。

## 決策

新增 `d1PalaceWritingPreviewContracts.ts`，固定兩種純資料 Contract。

### Preview Plan

Plan 必須完整綁定 Golden Case fingerprint 與兩個 Adapter bridge fingerprint，並固定：

```text
WRITING
→ FIDELITY_REVIEW
```

- 循序執行。
- `maxRequests=2`。
- `fetchHardLimit=2`。
- `retry=false`。
- 模型、reasoning、timeout 與 token policy 沿用 Golden Case。
- `authorizationStatus=not_authorized`。
- `runtimeStatus=runtime_not_implemented`。
- `openAiCallable=false`。

Plan 同時聲明：

- Evidence 只能由未來的受信任 Server Runner 產生。
- Evidence 摘要只能保存安全 metadata。
- 供人工審閱的模型結果必須是分開、受限的 artifact。
- 模型輸出不得出現在 Evidence 摘要。

### Evidence Summary

Evidence 只允許保存：

- Golden Case／Plan／Bridge fingerprint。
- 兩階段固定狀態。
- `attemptedRequests`、`executedRequests`、`fetchCount`。
- `retryPerformed=false`。
- 每階段 duration、safe usage 與 result fingerprint。
- 固定、module-owned 的失敗碼。
- 技術驗證與人工審閱狀態。

失敗碼只可為：

- `WRITING_REQUEST_FAILED`
- `WRITING_OUTPUT_INVALID`
- `FIDELITY_REVIEW_REQUEST_FAILED`
- `FIDELITY_REVIEW_OUTPUT_INVALID`

Evidence 不得保存模型原文、provider message、Prompt、instructions、user input、request body、API Key、Authorization、命盤或出生資料。

成功完成兩個技術階段後，來源忠實度、內容格覆蓋與禁止內部 metadata 可標為已通過技術驗證；白話表達、可能性邊界及臺灣語境仍固定為待人工審閱。此時客戶交付仍為 `BLOCKED_PENDING_HUMAN_REVIEW`，不得只因 JSON 與 source binding 合格就自動交付。

Evidence parser 只驗證摘要的安全形狀、固定綁定與狀態一致性。它不讀模型文章，也不單獨證明模型品質。未來 Runtime 必須先執行既有 source-bound validators，再由受信任 Server Runner 產生摘要。

## 後果

- 可先固定受控實測的測量與證據格式，不必發送 OpenAI request。
- 寫作失敗時 Fidelity Review 必須保持 `NOT_STARTED`。
- Fidelity Review 失敗時保留已完成 Writing 的安全量測，但禁止交付。
- `fetchCount` 與 `executedRequests` 分開，避免把已送出但驗證失敗誤算為成功。
- 不能從這份 Contract 得出三分鐘 SLA、模型品質或十二宮併發結論；必須等另行授權的實測。
- 本 ADR 不建立 Runner、Server Runtime、路由、資料庫保存、正式交付或 OpenAI request。
