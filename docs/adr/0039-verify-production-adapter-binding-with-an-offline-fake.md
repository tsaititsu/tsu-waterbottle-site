# ADR 0039：用離線 Fake 驗證 Production Adapter Binding

## 狀態

Accepted

## 背景

ADR 0038 已固定 Runtime Port 的最小介面：每個階段只取得既有 Adapter
Bridge 建立的 validated request，不取得 API Key、Authorization、model override、
fetch 或 provider endpoint。Port 也已重用 mock-only Runtime 保證
Writing→Fidelity Review 的順序，避免 production adapter 重建 orchestration。

但在真正綁定 `requestAiChartOpenAiStructuredResponse()` 前，仍需要證明：

- Port command 的 request 可以直接交給既有 OpenAI server adapter，不需要重新組裝。
- Writing 與 Fidelity Review 都走同一個 server adapter seam。
- Server adapter 的 safe usage 可以安全轉成 Preview stage outcome。
- Provider exception、缺少 usage 或 malformed result 不會把模型輸出或任意 metadata
  帶入 Probe Result。
- 驗證 adapter 形狀時不會因測試誤用而讀取正式設定或送出 request。

## 決策

新增 `d1PalaceWritingPreviewProductionAdapter.server.ts`，只輸出一個離線
binding probe：

```text
probeAiChartD1PalaceWritingPreviewProductionAdapter(...)
```

它接受 Preview Plan、Golden Case，以及一個型別精確相容於
`requestAiChartOpenAiStructuredResponse()` 的 `requestStructuredResponseFake`。
模組內部重用 ADR 0038 的 Runtime Port，並把每個 `command.request` 原物件直接交給
fake requester；不重建 Instructions、User Input、Schema、parser 或模型政策。

Fake requester 的回傳值只接受 exact `data + usage`。Usage 必須只有四個非負整數欄位，
且符合 `reasoningTokens <= outputTokens` 與
`totalTokens = inputTokens + outputTokens`。缺少 usage、額外欄位、算術不一致或 malformed
result 一律收斂成 `REQUEST_FAILED`，不保留 output。Requester 拋出的任何 exception
也只收斂成固定 request failure；error message、stack、provider body 與模型文字都不會
進入 probe result。

## Probe 安全邊界

- 只允許 `NODE_ENV=test`。
- 傳入真正的 `requestAiChartOpenAiStructuredResponse` 函式會在 invocation 前被拒絕。
- 這個 dependency 是 trusted test fake，不是 Browser 或一般呼叫者可提供的 extension
  point。
- 模組本身沒有 fetch、API Key、Authorization、檔案寫入、retry、fallback 或
  Runtime handoff consumption。
- Repository 沒有 production consumer。
- 即使 fake 模擬兩階段成功，既有 Port Result 仍固定：

```text
runtimeMode=INJECTED_PORT_PROBE_ONLY
runtimeHandoffStatus=NOT_CONNECTED
productionAdapterStatus=NOT_IMPLEMENTED
attemptedRequests=0
executedRequests=0
fetchCount=0
openAiRequests=0
customerDeliveryStatus=BLOCKED_PORT_PROBE_ONLY
```

## 為何不直接呼叫真正 Adapter

真正 server adapter 會讀取 Server config 並具有 fetch 能力。此切片只要驗證 interface
與委派行為，不需要也不應取得那項能力。以相同函式型別的 fake 可驗證 request 形狀、
順序、usage 與錯誤收斂；明確拒絕真實函式則保證這個 probe 不會變成另一條 production
request 入口。

真正 binding 必須等 Runtime handoff、一次性 request 計數、安全 Evidence 與明確執行
授權在同一個 server-owned 深模組內完整接線後，才能另行審查。

## 後果

- Production adapter 的外部 seam 已固定為既有 OpenAI server adapter 函式型別。
- Adapter 不需要知道命理 Prompt 如何建立，也不能自行變更 request。
- 成功但缺少可信 usage 的回應會 fail closed，避免建立不完整 Evidence。
- 測試可完整走過 Writing 與動態 Fidelity request，而 request／fetch／OpenAI 計數仍為零。
- 本切片沒有接 handoff、沒有建立 Evidence、沒有讀取秘密，也沒有發送 OpenAI request。
