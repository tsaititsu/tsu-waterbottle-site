# ADR 0040：把 Runtime Handoff 單次綁定到離線 Adapter Probe

## 狀態

Accepted

## 背景

ADR 0037 已用不可仿造的同程序物件 identity 保護 Runtime handoff，ADR 0039
則證明既有 validated request 可以直接交給 OpenAI server adapter 型別的離線
fake。兩者仍是分離的介面：

- handoff 可以被消耗，但消耗後固定停止。
- adapter probe 可以走完 Writing→Fidelity Review，但沒有 handoff。

若未來呼叫者自行安排兩者順序，可能在 Plan、Golden Case 或 requester 尚未驗證前
先消耗 handoff；也可能先呼叫 adapter，再補做一次性檢查。這會把重要的安全順序
分散到 caller。

## 決策

新增 `d1PalaceWritingPreviewRuntimeBinding.server.ts`，只輸出一個 server-only
離線 binding probe：

```text
probeAiChartD1PalaceWritingPreviewRuntimeBinding(...)
```

這個深模組依固定順序完成：

1. 確認只在 canonical test environment。
2. 驗證 Preview Plan、Golden Case 與公開 handoff 欄位互相一致。
3. 確認 requester 是型別相容的離線 fake，而不是真正 OpenAI server requester。
4. 以原始物件 identity 同步消耗 handoff。
5. 才把同一份已驗證 Plan／Case 交給 ADR 0039 的離線 Adapter probe。

錯誤 Plan、錯誤 Case、非 test 環境、真正 requester 或欄位不合法會在 handoff
消耗前失敗，因此原始 handoff 仍可用正確輸入完成一次 probe。欄位相同的 copy
仍無法通過 module-private identity 檢查。

一旦原始 handoff 成功消耗，離線 requester 即使回傳 request failure 或拋出 exception，
本次 handoff 也永久失效，不允許用另一個 fake 重跑。兩個並行 binding 最多只有一個
能消耗 handoff；失敗者取得既有固定 already-consumed error。

## 離線結果邊界

成功或安全失敗的 Binding Result 只保存既有 stage metadata，並固定：

```text
runtimeMode=HANDOFF_BOUND_OFFLINE_ADAPTER_PROBE_ONLY
runtimeHandoffStatus=CONSUMED_FOR_OFFLINE_ADAPTER_PROBE
productionAdapterStatus=NOT_IMPLEMENTED
attemptedRequests=0
executedRequests=0
fetchCount=0
openAiRequests=0
customerDeliveryStatus=BLOCKED_OFFLINE_BINDING_ONLY
```

模組沒有 fetch、API Key、Authorization、檔案寫入、retry、fallback 或 Production
consumer，也不建立 Evidence 或 restricted result artifact。真正
`requestAiChartOpenAiStructuredResponse()` 只用於函式 identity 拒絕，不會被呼叫。

## 後果

- Handoff 驗證、單次消耗與 Adapter 委派順序集中在一個介面。
- Caller 不能把一次性檢查移到 Adapter 執行之後。
- Preflight 錯誤不會浪費合法 handoff；開始執行後的失敗不能重試。
- Copy、clone 與並行重入仍無法取得第二次執行機會。
- 目前只完成 offline fake binding；Production adapter、正式 Evidence 與 OpenAI
  request 仍未實作或開放。
