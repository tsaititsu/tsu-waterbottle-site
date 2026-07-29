# ADR 0044：先將 Preview Evidence 綁成 Write-Once 保存封套

## 狀態

Accepted

## 背景

ADR 0043 已能由 terminal Execution Ledger 產生正式、安全且不可變的 Evidence，
但尚未固定未來 Server storage adapter 應保存哪一份 payload、使用哪個檔名，以及
如何把保存位置綁回已建立的一次性 Gate claim。

若 writer 直接接收呼叫者提供的 Evidence、檔名或 storage root，可能保存不屬於
該 claim 的摘要、選錯成功／失敗檔名，或放寬成可覆寫與可重試。

## 決策

新增純函式
`buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(...)`。
輸入必須同時包含：

1. canonical Preview Plan。
2. 與該 Plan 完整綁定的 canonical Gate Plan。
3. Gate fingerprint 與 Gate Plan 相同的 terminal Execution Ledger。

函式先使用 ADR 0043 的 projector 建立 final Evidence，再產生不可變保存封套：

- 成功 Evidence 固定使用 `request-succeeded.json`。
- 失敗 Evidence 固定使用 `request-failed.json`。
- `evidenceFingerprint` 是 final Evidence canonical JSON 的 SHA-256。
- storage scope 固定為 `GATE_FINGERPRINT`。
- serialization 固定為 `CANONICAL_JSON_UTF8`。
- directory／file mode 固定為 `0700`／`0600`。
- create mode 固定為 `EXCLUSIVE_CREATE`。
- overwrite 與 retry 均固定禁止。
- restricted result artifact 固定 `SEPARATE_NOT_INCLUDED`。
- 狀態保持 `NOT_PERSISTED`，下一步只能交給未來 trusted server adapter。

## Fail-Closed 與安全邊界

- Gate Plan 與 Preview Plan 不一致時拒絕。
- Ledger 即使本身是合法 terminal，只要 gate fingerprint 不屬於該 Gate Plan，也
  必須拒絕。
- Non-terminal Ledger、額外欄位、caller-selected storage root、計數／stage
  竄改及敏感欄位一律收斂成同一個 module-owned frozen error。
- 封套只內含 final Evidence；不包含模型文章、Prompt、request body、秘密、命盤
  或出生資料。
- 成功 Evidence 仍是 `BLOCKED_PENDING_HUMAN_REVIEW`，不能直接交付客戶。

## 後果

- 未來 writer 不必自行選檔名、重算狀態或接受呼叫者提供保存政策。
- Evidence payload、Gate claim 與內容 SHA 現有同一個可重驗交接物件。
- 本 ADR 沒有檔案系統、Evidence writer、restricted artifact writer、Runtime、
  fetch、OpenAI request、retry 或客戶交付。
- 下一個切片才能建立 server-only、固定 storage root、exclusive-create 的
  Evidence writer；它仍不得保存 restricted model output。
