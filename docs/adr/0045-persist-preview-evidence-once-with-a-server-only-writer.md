# ADR 0045：以 Server-only Writer 單次保存 Preview Evidence

## 狀態

Accepted

## 背景

ADR 0044 已把 terminal Execution Ledger 投影出的安全 Evidence 綁成不可變保存
封套，但封套仍是 `NOT_PERSISTED`。實際 writer 若接受 caller-selected root、只對
成功或失敗檔名個別做 exclusive create，或不重新驗證 Plan／Gate／Evidence，
仍可能出現路徑逃逸、同一 Gate 同時留下成功與失敗 Evidence，或把竄改內容寫入
磁碟。

## 決策

新增 `d1PalaceWritingPreviewEvidenceWriter.server.ts`，第一行固定載入
`server-only`。公開 writer 只接受 Preview Plan、Gate Plan 與 ADR 0044 的
Persistence Envelope；不接受 storage root、檔名、權限或覆寫政策。

### 寫入前重驗

Persistence Contract 新增 parser，在任何檔案操作前重新驗證：

- Preview Plan 與 Gate Plan 的完整 binding。
- Envelope exact fields 與固定 module-owned policy。
- Evidence 仍能通過既有 source-bound Evidence parser。
- 成功／失敗狀態與固定 artifact name 一致。
- Evidence canonical JSON 的 SHA-256 與 envelope 完全一致。
- 額外欄位、敏感欄位及 caller-selected storage root 一律拒絕。

### 固定儲存與唯一終態

Writer 只使用系統 temporary root 下的固定私有位置：

```text
ai-chart-d1-palace-writing-preview-evidence/
  <gateFingerprint>/
    request-succeeded.json | request-failed.json
```

- Storage root 與 Gate 目錄必須是目前程序使用者擁有的 `0700` regular
  directory。
- Evidence 檔必須是 `0600` regular file。
- Gate 目錄本身以非 recursive `mkdir` 作為單一終態 claim；同一 Gate 的成功與
  失敗 writer 即使並行，也只有一個能取得目錄。
- Artifact 再以 `open(path, "wx", 0600)` 建立，內容精確等於 Evidence
  canonical JSON。
- 既有合法 Gate 目錄固定回報 already persisted；symlink、寬鬆權限或異常類型
  固定回報 storage invalid。
- Writer 沒有 overwrite、rename、unlink、cleanup 或 retry 路徑。建立 Gate
  目錄後即使寫入失敗，也保留該狀態阻擋重跑。

## 安全邊界

- 回傳值只包含 Gate fingerprint、固定檔名、Evidence fingerprint 與固定保存
  狀態，不揭露實體路徑。
- Writer 只保存 safe Evidence，不保存模型文章、Prompt、request body、秘密、
  命盤或出生資料。
- Restricted result artifact 仍是 `NOT_PERSISTED`，必須由未來另一個受控且另行
  授權的儲存邊界處理。
- 本模組沒有 Runtime、fetch、OpenAI request、retry 或客戶交付能力。

## 後果

- Safe Evidence 已有實際 server-only、Gate-scoped、write-once 的保存信任根。
- 成功與失敗不能利用不同檔名繞過同一 Gate 的唯一終態。
- 測試只在 Repository 內建立隔離暫存根並於測試結束清除，不碰真實 Evidence。
- 下一個切片可建立 terminal Ledger → Envelope → Writer 的單一 server-only
  persistence coordinator；它仍不得保存 restricted model output 或接 OpenAI。
