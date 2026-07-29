# ADR 0041：先記錄真實 Preview 執行狀態，再設計 Evidence 保存

## 狀態

Accepted

## 背景

ADR 0040 已把單次 Runtime handoff 與離線 Adapter probe 綁成固定順序，但所有
request／fetch 計數仍固定為零。未來正式 Runtime 若只在流程結束時組 Evidence，
很容易把「開始 request 嘗試」、「真正 dispatch fetch」與「取得並驗證階段結果」
混在一起。

例如 request setup 在 fetch 前失敗時，真實狀態應為
`attemptedRequests=1`、`fetchCount=0`、`executedRequests=0`，不能因既有 final
Evidence 只接受 fetch 大於零，就偽造為已送出。

## 決策

新增純資料 Contract
`d1PalaceWritingPreviewExecutionLedgerContracts.ts`，用不可變狀態機記錄：

1. `REQUEST_ATTEMPTED` 只增加 `attemptedRequests`。
2. `FETCH_DISPATCHED` 才增加 `fetchCount`。
3. `STAGE_SUCCEEDED` 只有在 safe usage、duration 與 result fingerprint
   全部通過後才增加 `executedRequests`。
4. `STAGE_FAILED` 明確分成 `PRE_FETCH` 與 `POST_FETCH`。
5. Writing 成功後才保存由已驗證 Writing Result 衍生的 Fidelity bridge
   fingerprint；初始帳本不得假裝該 fingerprint 已存在。
6. 任一 failure 或完整成功都成為 terminal，`nextRequiredAction=STOP`，
   `retryPerformed=false`，不能再推進。

帳本只接受四個 allowlisted failure code、四欄 safe token usage、duration 與
SHA-256 fingerprint。額外欄位、竄改計數、錯誤順序、動態錯誤文字或不合法 usage
一律收斂成同一個 module-owned fixed error。

## 安全邊界

這份 Ledger 是可複製的安全資料，不是 Runtime capability，也不是 request permit。
它沒有 Adapter、fetch、API Key、Authorization、Prompt、request body、模型輸出、
檔案操作或 Evidence persistence。

`evidenceStatus` 只會是 `IN_PROGRESS_NOT_PERSISTED` 或
`TERMINAL_NOT_PERSISTED`。本輪沒有建立任何 Evidence 或 restricted artifact。

## 尚未解決的差距

既有 `d1PalaceWritingPreviewContracts.ts` final Evidence parser 只接受已發生 fetch
的終態，尚不能忠實表達 `attempted=1 / fetch=0` 的 pre-fetch failure。下一個
Persistence 切片必須先擴充或另建相容的 Evidence Contract，不能用錯誤計數迎合
舊 parser。

此差距已由 ADR 0042 的 Evidence parser 擴充解決；Ledger 到 Evidence 的純資料
投影與實際 persistence 仍未實作。

## 後果

- attempted、fetch 與 validated execution 不再混為同一件事。
- 第二階段只能在 Writing 成功且取得動態 bridge 後開始。
- 所有 terminal 狀態固定零 retry，無法用事件重啟。
- 未來 Runner 可以由 Ledger 產生安全 Evidence，但本 ADR 不授權或實作 Runner、
  OpenAI request、正式保存或客戶交付。
