# ADR 0047：人工審查前只讀驗證已保存 Preview Evidence

## 狀態

Accepted

## 背景

ADR 0045 與 0046 已讓 terminal Execution Ledger 經單一 server-only 入口保存成
Gate-scoped、write-once 的 safe Evidence。但保存 receipt 只證明 writer 當時完成
寫入；後續流程若直接信任磁碟內容，仍可能讀到缺檔、雙終態、權限漂移、symlink、
超量資料、非 canonical JSON 或事後遭修改的 Evidence。

## 決策

新增 `d1PalaceWritingPreviewEvidenceReadback.server.ts`，提供人工審查前唯一的
safe Evidence readback seam。公開輸入只包含：

- Preview Plan。
- Gate Plan。
- Writer 回傳的 frozen persisted receipt。

呼叫端不能提供 storage root、實體路徑、檔名、大小上限或 restricted artifact。

### 固定只讀驗證

Readback Adapter 固定執行：

1. 重驗 Preview Plan、Gate Plan 與 writer receipt 的 exact fields 及 Gate binding。
2. 只解析系統 temporary root 下的固定 Evidence root。
3. Root 與 Gate 目錄必須是目前程序使用者擁有的 `0700` regular directory，且
   realpath 仍在固定 root 內。
4. Gate 目錄必須只有 receipt 指定的一個成功或失敗 artifact。
5. Artifact 以 `O_RDONLY | O_NOFOLLOW` 開啟，必須是目前程序使用者擁有的
   `0600` regular file。
6. 檔案大小固定不超過 128 KiB，讀取後 byte count 必須與 stat 一致。
7. JSON 必須通過既有 source-bound Evidence parser，原始 bytes 必須精確等於
   canonical JSON，SHA-256、狀態與固定檔名必須和 receipt 一致。

## 錯誤與安全邊界

- 缺檔、雙檔、未知檔案、symlink、權限或 ownership 漂移、過大內容、JSON／Schema
  錯誤、canonical 或 SHA 不符，全部收斂為固定 frozen readback error。
- 錯誤不包含路徑、檔案內容、caller input 或模型文字。
- 成功只回傳 frozen 的 safe Evidence、Gate／artifact／SHA binding 及
  `VERIFIED` 狀態；不回傳實體路徑。
- Restricted result artifact 固定為 `NOT_READ`，本層不讀模型文章。
- 本模組沒有寫入、刪除、retry、Runtime、fetch、OpenAI、秘密、命盤或出生資料
  權限。

## 後果

- 後續人工審查協調器不能只信任舊 receipt，必須先取得本層的 verified Evidence。
- 技術成功仍維持 `BLOCKED_PENDING_HUMAN_REVIEW`；readback 不會把報告自動改成
  可交付。
- Restricted result artifact 的安全儲存與人工審查仍需另外設計與授權。
