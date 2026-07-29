# ADR 0035：在 Request Runtime 前集中協調 Gate 與 Atomic Claim

## 狀態

Accepted

## 背景

ADR 0033 與 ADR 0034 已分別固定純 Gate decision 及 server-only exclusive claim，但呼叫者若要自行串接 observation、Gate 與 claim，仍可能：

1. 用錯順序。
2. 把 `READY_FOR_ATOMIC_CLAIM` 誤讀成 fetch 許可。
3. 在 observation 與 claim 之間遇到競態後自行重試。
4. 將底層 `EEXIST` 當成可再執行的暫時錯誤。

## 決策

新增 `d1PalaceWritingPreviewPreRequestCoordinator.server.ts`，作為這三個步驟的單一 server-only 介面。

固定順序為：

```text
validate Gate Plan and one-shot authorization
→ trusted claim observation
→ pure Gate decision
→ exclusive atomic claim when ready
→ stop before request runtime
```

Coordinator 只回傳兩種不可變安全結果：

- `CLAIMED_STOPPED`：本次成功建立 claim，但必須停在 request runtime 前。
- `BLOCKED_ALREADY_CONSUMED`：claim 原本已存在，或本次並行競爭由另一個 coordinator 先建立。

兩個 coordinator 同時觀察到 `ABSENT` 時，只有 atomic adapter 的 `open("wx", 0600)` 能決定勝者。競態落敗者捕捉固定 already-exists error 後，必須重新取得 trusted observation 並再次經過 Gate；只有確認為 `PRESENT`／`BLOCKED_ALREADY_CONSUMED` 才能收斂成安全阻擋結果。

Gate、授權或 storage 錯誤不轉成成功或一般阻擋，仍保持 fail closed。

## 安全邊界

- Coordinator 不接受 storage root、filesystem adapter、fetch adapter 或 OpenAI client。
- 結果不保存 acknowledgement、Prompt、request body、模型內容、命盤、出生資料或秘密。
- 成功與阻擋結果都固定：
  - `fetchAllowed=false`
  - `openAiCallable=false`
  - `attemptedRequests=0`
  - `fetchCount=0`
  - `openAiRequests=0`
- Coordinator 沒有 retry、fallback、unlink、rename、cleanup 或 request 路徑。

## 後果

- 呼叫者不再需要理解 observation 與 exclusive claim 的競態處理。
- 一般既有 claim 與競態落敗都使用同一個安全阻擋介面。
- 本切片仍不是 request permit，也沒有 Writing 或 Fidelity Review Runtime。
- 下一個工程切片必須先用 mock-only 測試固定受控 Runtime 的循序、Evidence 與失敗狀態；不得直接加入真實 request。
