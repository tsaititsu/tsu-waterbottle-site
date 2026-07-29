# ADR 0037：以同程序 Capability 保護 Runtime Handoff

## 狀態

Accepted

## 背景

Pre-request Coordinator 已能驗證 Gate／一次性授權，並在成功建立 persistent Atomic Claim 後停下。兩階段 Mock Runtime 也已固定 Writing→Fidelity Review 的順序、source-bound parser、動態 Review binding、零重試與安全 Evidence。

但如果下一層只接受一份可序列化資料，例如：

```text
atomicClaimStatus=claimed
authorizationConsumed=true
fetchAllowed=true
```

一般呼叫者就能複製欄位或自行重建物件，繞過「本次真的由受信任 Coordinator 建立 claim」的來源限制。單純增加更多 fingerprint 也只能驗證內容一致，不能證明這個物件是由正確程序路徑產生。

## 決策

新增 `d1PalaceWritingPreviewRuntimeHandoff.server.ts`，提供兩個小介面：

```text
prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(...)
consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(...)
```

Preparation 內部先走既有 Pre-request Coordinator。只有結果為 `CLAIMED_STOPPED` 時，才建立 frozen handoff，並把該物件本身登記在 module-private `WeakMap`。既有 claim 只回傳 `BLOCKED_ALREADY_CONSUMED` 與 `handoff=null`。

Consumption 只接受 `WeakMap` 中同一個物件 identity。欄位完全相同的普通物件、shallow copy、`structuredClone`、JSON 往返或另一程序自行重建都不是同一個 key，因此固定回傳 invalid error。合法物件消耗時會同步從 active registry 移除並加入 module-private consumed `WeakSet`；第二個同步或並行 consumer 固定得到 already-consumed error。

## 安全邊界

- Atomic Claim 是跨程序、跨重啟的一次性事實來源。
- In-process handoff 只防止同一程序內的欄位仿造與重複 consumer，不能取代 Atomic Claim。
- 程序終止時 handoff 不可恢復；persistent claim 保持存在，因此 fail closed，不會因重啟自動重跑。
- Handoff 不得序列化後交給背景程序、queue 或另一個 process。
- 公開欄位只提供 safe diagnostics，不授予權限。
- 模組不含 fetch、OpenAI Adapter、秘密、Prompt、request body、retry、fallback、檔案寫入或刪除能力。
- Preparation／consumption／error 物件全部 frozen。

## 停止狀態

成功 consumption 仍只回傳：

```text
status=CONSUMED_STOPPED
runtimeAdapterStatus=not_implemented
nextRequiredAction=STOP_BEFORE_PRODUCTION_RUNTIME_ADAPTER
fetchAllowed=false
openAiCallable=false
attemptedRequests=0
fetchCount=0
openAiRequests=0
```

這不是 request permit，也不會發送 OpenAI request。

## 後果

- 後續 production Runtime Adapter 不能接受呼叫者自行建構的「已授權」資料；必須在同一 Server 程序內消耗這個 exact handoff。
- Copy／clone 防偽、單次消耗、並行 consumer、既有 claim、無效授權與 unsafe storage 均可離線回歸。
- 下一個工程切片只能建立 production Runtime Adapter 的安全 port 與 mock adapter，驗證 request 前的資料最小化及失敗語意；在另行取得執行授權前仍不得接真實 transport 或發 request。
