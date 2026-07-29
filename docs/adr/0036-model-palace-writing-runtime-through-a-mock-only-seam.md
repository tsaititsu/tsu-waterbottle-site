# ADR 0036：先用 Mock-only 深模組固定逐宮兩階段 Runtime

## 狀態

Accepted

## 背景

Writing 與 Fidelity Review 已各有純資料 Adapter，Preview Plan、Evidence、Gate、Atomic Claim 及 Pre-request Coordinator 也已完成，但直接接入正式 OpenAI Runtime 仍有三個風險：

1. Writing 失敗後誤啟動 Fidelity Review。
2. 任一階段失敗後自行重試，超出固定 request 上限。
3. 把第一階段模型輸出、Prompt、request body 或 provider error 寫入一般 Evidence。

另外，Fidelity Review 的 Prompt Package 會綁定第一階段實際 Writing Result 的 SHA-256。因此第二階段 Adapter fingerprint 必須在第一階段通過 source-bound parser 後動態建立，不能假設一定等於人工金標文字預先算出的 reference fingerprint。

## 決策

新增 `d1PalaceWritingPreviewMockRuntimeContracts.ts`，以單一 `runAiChartD1PalaceWritingPreviewMockRuntime(...)` 介面封裝：

```text
validate Preview Plan and synthetic Golden Case
→ build Writing bridge
→ execute one injected MOCK_ONLY stage
→ validate Writing output
→ derive Fidelity Prompt Package and bridge from validated Writing Result
→ execute one injected MOCK_ONLY Fidelity stage
→ validate Fidelity output
→ return frozen safe mock evidence
```

外部 Mock executor 只取得：

- `runtimeMode=MOCK_ONLY`
- 固定 sequence
- 固定 stage
- 該階段實際 bridge fingerprint

它不取得 Prompt、request body、API Key、命盤或出生資料。

Preview Plan 的 stage binding 同時明確分為：

- Writing：`EXACT_PLAN_FINGERPRINT`
- Fidelity Review：`DERIVED_FROM_VALIDATED_WRITING_RESULT`

Plan 中第二階段原有 fingerprint 保留為 Golden Case reference；實際執行 Evidence 使用由已驗證 Writing Result 動態建立的 fingerprint。

## 失敗語意

- Writing executor throw／固定 request failure：`WRITING_REQUEST_FAILED`
- Writing source-bound parser 拒絕：`WRITING_OUTPUT_INVALID`
- Fidelity executor throw／固定 request failure：`FIDELITY_REVIEW_REQUEST_FAILED`
- Fidelity source-bound parser 拒絕：`FIDELITY_REVIEW_OUTPUT_INVALID`

Writing 失敗後 Fidelity 固定 `NOT_STARTED`。Fidelity 失敗時保留 Writing 的安全成功 metadata，但整體仍阻擋。所有路徑都不 retry。

## 安全邊界

- 模組沒有 fetch、OpenAI Server Adapter、秘密、平行階段、fallback、檔案寫入或刪除能力。
- Mock 結果固定 `attemptedRequests=0`、`executedRequests=0`、`fetchCount=0`、`openAiRequests=0`。
- 模型模擬輸出只在模組內交給既有 source-bound parser，不出現在回傳 Evidence。
- 回傳只含固定狀態、duration、safe usage、result fingerprint 與 allowlisted error code。
- 成功仍固定 `customerDeliveryStatus=BLOCKED_MOCK_ONLY`，不能冒充真實量測或客戶報告。

## 後果

- 兩階段順序、動態 Fidelity binding、零重試與失敗 Evidence 已能完全離線回歸。
- 未來正式 Runtime 可以沿用這個深模組的行為，但必須另外建立 server-only production adapter、安全診斷與受控授權。
- 本切片沒有發送 OpenAI request，也沒有建立正式 Runtime permit。
