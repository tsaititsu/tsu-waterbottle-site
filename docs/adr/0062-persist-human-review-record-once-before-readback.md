# ADR 0062：在 verified readback 前單次保存人工審查紀錄

## 狀態

Accepted

## 背景

ADR 0061 已用可信 Server clock 建立 canonical、frozen、一次性的人工審查紀錄
封套。封套固定 `human-review-record.json`、Gate scope、payload SHA、私有權限與
exclusive-create 政策，但仍是 `NOT_PERSISTED`。

若 writer 接受 caller-selected root、路徑或 overwrite option，合法紀錄仍可能被寫到
不受控位置或被後一次結果取代。只依 `exists` 再一般寫入也會留下競態，使同一 Gate
產生兩份互相衝突的人工決策。Receipt 若帶實體路徑、Report ID 或 reviewer ID，還會
把 storage 與身分資料擴散到不需要知道的下游。

## 決策

### 只消耗原始 record envelope

新增 `d1PalaceWritingHumanReviewRecordWriter.server.ts`。公開 seam 只接受 ADR 0061
模組親自建立、尚未消耗的原始 envelope。Copy、clone、JSON 往返、wrapper、相同欄位
偽造物或第二次使用都不能取得能力。

Writer 不接受 storage root、路徑、檔名、權限、overwrite、retry 或 persist flag。
一旦原始 envelope 被 writer 消耗，後續 storage failure 也不能用同一能力重試。

### 固定私有 write-once storage

Writer 只在 system temporary root 下的固定 namespace：

`ai-chart-d1-palace-writing-human-review-record`

保存紀錄。Root 與 Gate directory 必須是目前程序使用者擁有的 `0700` regular
directory，不接受 symlink。Gate fingerprint 是唯一子目錄名稱，並以單次 `mkdir`
作為 claim；既有 Gate 一律視為已保存，不覆寫、不刪除、不重試。

Artifact 固定為 `human-review-record.json`，以 `open("wx", 0600)` 建立，內容是
envelope 內 review record 的 canonical JSON UTF-8 bytes。寫入前重算完整 payload
SHA-256，寫入後同步並重驗 `0600` regular file。

固定安全錯誤只有：

- `ai_chart_d1_palace_writing_human_review_record_already_persisted`
- `ai_chart_d1_palace_writing_human_review_record_storage_invalid`
- 上一層 exact-envelope capability 的固定 unavailable error。

錯誤不保存底層 filesystem message、路徑、身分資料或 record 內容。

### 回傳 path-free receipt

成功只回傳 frozen receipt，包含：

- Gate fingerprint。
- Record、payload 與 envelope fingerprints。
- 固定 artifact 名稱與 storage policy。
- `storageWrites=1`、`openAiRequests=0`。
- `PERSISTED_AWAITING_VERIFIED_READBACK`。
- `PERSISTED_NOT_VERIFIED`。
- 客戶交付仍阻擋。

Receipt 不含實體路徑、Report ID、reviewer ID、決策內容、時間、模型正文、Prompt、
出生資料、命盤、token 或 Session。

## 本切片仍未開放

這一層只完成 server-only private write-once seam 與隔離測試資料驗證。它尚未建立：

- bounded readback verifier。
- Supabase durable review ledger。
- API route 或後台審查 UI。
- customer-delivery release。
- OpenAI request。

保存成功不等於紀錄已完成 readback 驗證，也不表示報告可以交付。下一個最小切片是
以 receipt 綁回固定位置，重驗唯一檔案、private metadata、canonical bytes 及全部
fingerprints。

## 後果

- 同一 Gate 在並行與重複呼叫下最多只保存一份人工審查紀錄。
- Caller 無法換 storage root、檔名或覆寫政策。
- Receipt 可供下一層驗證，但不洩漏 path 或不必要身分資料。
- Writer failure 會保持 fail closed，不會刪除 partial claim 後重試。
