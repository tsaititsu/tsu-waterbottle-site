# ADR 0042：Preview Evidence 接受真實的 Pre-Fetch 失敗

## 狀態

Accepted

## 背景

ADR 0041 的 Execution Ledger 已能分開記錄 request attempt、fetch dispatch 與
validated execution，但既有 Preview Evidence v1 仍把 failed Writing 固定成
`fetchCount=1`、failed Fidelity 固定成 `fetchCount=2`。

這會讓 future Evidence producer 面臨錯誤選擇：拒絕保存真正的 pre-fetch failure，
或把未發生的 fetch 寫成已發生。

## 決策

保留既有 Evidence v1 欄位與四個固定 failure code，只擴充兩個合法終態：

```text
Writing pre-fetch failure
attemptedRequests=1
fetchCount=0
executedRequests=0
errorCode=WRITING_REQUEST_FAILED
usage=null

Fidelity Review pre-fetch failure
attemptedRequests=2
fetchCount=1
executedRequests=1
errorCode=FIDELITY_REVIEW_REQUEST_FAILED
usage=null
```

不新增 `failurePhase`、provider message 或自由文字。Pre-fetch 語意由 stage、
allowlisted request failure code、safe usage `null` 與精確計數共同決定。

既有 post-fetch failure 保持相容：

- failed Writing 的 `fetchCount=1` 仍可使用既有 Writing request／output failure。
- failed Fidelity Review 的 `fetchCount=2` 仍可使用既有 Fidelity
  request／output failure。

## Fail-Closed 規則

- Pre-fetch 計數不能搭配 `*_OUTPUT_INVALID`。
- Pre-fetch stage 不能保存 token usage。
- Writing 與 Fidelity 的 failure code 不能互換。
- Successful Evidence 仍精確要求 `attempted=2 / fetch=2 / executed=2`。
- Evidence 仍只能保存 safe metadata，不能保存模型文章、Prompt、request body、
  命盤、出生資料或秘密。

## 後果

- Evidence parser 可以忠實接受 ADR 0041 的兩種 pre-fetch terminal ledger。
- 不需偽造 fetch，也不放寬成功或 post-fetch 終態。
- 本 ADR 沒有建立 Evidence writer、檔案 persistence、Runtime Adapter、fetch 或
  OpenAI request；Ledger 到 Evidence 的純資料投影仍是下一個獨立切片。
