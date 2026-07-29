# ADR 0046：以單一 Server-only Coordinator 保存終態 Preview Evidence

## 狀態

Accepted

## 背景

ADR 0043 至 0045 已分別建立 terminal Execution Ledger 到 safe Evidence 的純資料
投影、write-once Persistence Envelope，以及實際保存 Evidence 的 server-only
writer。但呼叫端若必須自行組裝 Envelope，仍會知道不必要的中間資料，並可能跳過
固定順序或誤把 writer 當成可以接受任意物件的儲存 API。

## 決策

新增
`d1PalaceWritingPreviewEvidencePersistenceCoordinator.server.ts`，把正式保存 seam
收斂成一個 server-only 函式：

```text
terminal Execution Ledger
  → build Persistence Envelope
  → trusted write-once Evidence writer
  → safe persisted receipt
```

公開輸入只包含 Preview Plan、Gate Plan 與 Execution Ledger。呼叫端不能提供
Evidence、Envelope、artifact name、storage root、權限、overwrite 或 retry
政策。

Coordinator 固定先呼叫既有純資料 builder。只有 terminal Ledger、Plan／Gate
binding、exact fields、safe Evidence 與 canonical SHA 全部通過，才會進入既有
writer。Writer 仍會在 I/O 前再次驗證 Envelope，並用 Gate directory claim 與
exclusive create 保存唯一終態。

## 錯誤與安全邊界

- Non-terminal Ledger、Gate drift、額外欄位、敏感欄位與 caller-selected storage
  root 在建立 Evidence root 前 fail closed。
- 同一 Gate 重複呼叫沿用 writer 的 already-persisted 錯誤；不覆寫、不清除、不
  retry。
- Coordinator 不重新包裝或擴充既有安全錯誤，也不保存錯誤輸入。
- 回傳值沿用 writer 的 frozen receipt，不含實體路徑或中間 Evidence／Envelope。
- Restricted model output 仍固定 `NOT_PERSISTED`；技術成功仍是
  `BLOCKED_PENDING_HUMAN_REVIEW`。
- 本模組沒有 Runtime、fetch、OpenAI、秘密、模型輸出、命盤或出生資料能力。

## 後果

- 呼叫端只需要交付唯一權威的 terminal Ledger，不必知道 Evidence 保存格式與
  路徑。
- Evidence 的投影、封套與檔案 I/O 仍由三個既有深模組各自負責，Coordinator
  只固定正確順序。
- 成功與失敗均可由同一入口安全保存，而且重複呼叫不會產生第二份終態。
- Production Runtime、restricted result artifact、人工審查與客戶交付仍未
  開放。
