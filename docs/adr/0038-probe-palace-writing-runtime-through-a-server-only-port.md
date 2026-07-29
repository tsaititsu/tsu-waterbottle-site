# ADR 0038：先以 Server-only Port Probe 固定 Runtime Adapter 邊界

## 狀態

Accepted

## 背景

ADR 0036 已用 mock-only Runtime 固定 Writing→Fidelity Review 的順序、動態 Review binding、source-bound parser、零重試與安全 Evidence。ADR 0037 再以同程序 capability 保證未來 Runtime 只能消耗受信任 Coordinator 產生的 exact handoff。

但正式 Runtime Adapter 若直接散落在 orchestration 內，仍可能：

- 讓不同階段自行重建 request，造成 descriptor、Prompt、Schema 與 parser 漂移。
- 在 Writing 尚未通過 source-bound parser 前就建立 Fidelity Review request。
- 把 API Key、Authorization、model override 或 transport 設定混入階段 command。
- 由 production transport exception 帶出 provider message 或未驗證輸出。
- 為了接線而複製 ADR 0036 已固定的兩階段流程。

## 決策

新增 `d1PalaceWritingPreviewRuntimePort.server.ts`，只提供一個 probe 介面：

```text
probeAiChartD1PalaceWritingPreviewRuntimePort(...)
```

它重用既有 mock-only Runtime 作為兩階段 orchestration，並在 mock stage command 外加一層 server-only port command。Port command 只包含：

```text
runtimeMode
sequence
stage
bridgeFingerprint
ValidatedAiChartOpenAiStructuredRequest
```

Writing command 直接使用既有 Writing Adapter Bridge 的 validated request。只有 port 回傳 Writing output 且同一個 production parser 驗證成功後，probe 才保存程序內的 validated Writing Result，動態建立 Fidelity Prompt Package、Fidelity Adapter Bridge 與第二個 validated request。

Port outcome 沿用封閉的 `SUCCEEDED`／`REQUEST_FAILED` 結構。Provider exception 只會收斂成固定 request failure；malformed outcome 則 fail closed。Probe 回傳既有兩階段安全 stage metadata，但不保存 request、Prompt、模型輸出或 provider message。

## Port 信任邊界

- Port 是 server-owned internal seam，不是 Browser API，也不能接受 Client 任意注入。
- Validated request 會包含該階段必要的 Instructions、User Input、Strict Schema、parser 與固定模型政策，但不包含 API Key、Authorization、model、fetch 或 provider endpoint。
- 真正 transport credential 只能由日後另行審查的 production adapter 在 port 邊界內取得，不能放入 command 或 result。
- Adapter 不能自行決定階段順序、重建 Prompt、變更 Schema、替換 parser 或提前建立 Fidelity Review。
- 本 probe 的 injected adapter 只供離線 contract test；`NODE_ENV` 不是 `test` 時會在 adapter invocation 前 fail closed，Repository 目前也沒有 production consumer。

## 停止狀態

Probe 成功仍固定回傳：

```text
runtimeMode=INJECTED_PORT_PROBE_ONLY
requestProjectionStatus=VALIDATED_NOT_PERSISTED
runtimeHandoffStatus=NOT_CONNECTED
productionAdapterStatus=NOT_IMPLEMENTED
attemptedRequests=0
executedRequests=0
fetchCount=0
openAiRequests=0
customerDeliveryStatus=BLOCKED_PORT_PROBE_ONLY
```

這不是 Runtime permit，不會讀 API Key、消耗 handoff、建立 Evidence 或發送 OpenAI request。

## 後果

- 兩階段 orchestration 不因建立 port 而複製；mock-only Runtime 仍是順序與失敗語意的單一來源。
- Production Adapter 未來只能接收 bridge 已建立且驗證過的 request，不能另造 request body。
- Writing output 必須先通過既有 source-bound parser，Fidelity request 才可能存在。
- Port command、probe result、stage metadata 與 error 均為 immutable safe contract。
- 下一個工程切片才可建立 production adapter wrapper，並用完全離線 fake transport 驗證它只呼叫既有 `requestAiChartOpenAiStructuredResponse()`；在 handoff 綁定、正式執行授權與安全 Evidence 完整接線前，仍不得讀取真實 Key 或發 request。
