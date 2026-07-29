# ADR 0033：單宮寫作 Preview 必須先取得原子 Claim

## 狀態

Accepted

## 背景

受控 Preview 已固定最多兩個循序請求、零重試及安全 Evidence 格式，但純資料 Plan 本身不能解決以下問題：

1. 同一份人工授權被兩個行程同時使用。
2. 診斷通過後、實際 request 前發生競態。
3. 舊的 `request-started.json` 已存在時仍再次執行。
4. 只靠呼叫者傳入布林值或字串宣稱「尚未使用」。

如果在真正 fetch 前沒有先以 exclusive create 取得一次性 claim，兩個 Runner 都可能先看到「不存在」，再各送出一次付費 request。

## 決策

新增 `d1PalaceWritingPreviewGateContracts.ts`，只建立純資料的 Gate Plan、一次性授權 parser、claim observation parser 與 pre-request decision。

### Gate Plan

Gate 綁定 Preview Plan、Golden Case 與 Gate fingerprint，固定：

```text
WRITING
→ FIDELITY_REVIEW
```

- `maxRequests=2`。
- `fetchHardLimit=2`。
- `retry=false`。
- 僅限 Server 與本機開發環境。
- 必須在 fetch 前建立 `request-started.json` 原子 claim。
- 授權在 claim 成功建立時才視為消耗。
- claim 建立後禁止 re-entry。
- `fetchAllowed=false`。
- `openAiCallable=false`。

### 一次性授權

授權必須是完整、exact、fingerprint-bound 的資料物件，並綁定：

- 固定 fixture 與 case fingerprint。
- Preview Plan fingerprint。
- Gate fingerprint。
- 最多兩次 request／fetch。
- 零重試。
- 固定 acknowledgement。

布林值、過期 fingerprint、額外欄位、API Key、owner 或其他呼叫者自填資料一律拒絕。解析授權只表示「格式與綁定有效」，不表示授權已消耗，也不授予 fetch 能力。

### Claim Observation 與決策

只有兩個 observation state：

- `ABSENT`：回傳 `READY_FOR_ATOMIC_CLAIM`，下一步只能嘗試 exclusive create；仍不可 fetch。
- `PRESENT`：回傳 `BLOCKED_ALREADY_CONSUMED`，必須停止。

`authority=TRUSTED_ATOMIC_STORAGE_ADAPTER` 只是固定資料契約，不是信任根。呼叫者可以偽造同名字串，因此真正的安全性必須由未來 module-private、server-only 的 atomic storage adapter 提供，且 production consumer 只能接收該 adapter 的結果。純 Contract 不宣稱能驗證檔案系統或呼叫來源。

## 後果

- 「診斷完成」與「可以送 request」明確分開。
- 同一授權只有成功建立原子 claim 的單一執行者可在未來進入 request 階段。
- 既有 claim 一律 fail closed，不會提供重試或第二次 request。
- Gate decision 永遠維持 `attemptedRequests=0`、`fetchCount=0`、`openAiRequests=0`。
- 本 ADR 不建立 claim、不讀寫檔案、不讀環境變數、不接 Server Runtime，也不發送 OpenAI request。
- 下一個工程切片只能建立受信任的 server-only atomic claim adapter，先用競態與第二位 claimant 測試證明 exclusive create；仍不得在同一切片加入 fetch。
