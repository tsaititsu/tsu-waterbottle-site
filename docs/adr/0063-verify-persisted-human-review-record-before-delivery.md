# ADR 0063：交付前讀回驗證已保存的人工審查紀錄

## 狀態

Accepted

## 背景

ADR 0062 已能把 canonical 人工審查紀錄以 Gate-scoped、private、
write-once artifact 保存，並回傳不含實體路徑與身分資料的 receipt。但 receipt
只能證明 writer 當時完成寫入；它不能證明日後讀到的檔案仍是同一份 canonical
record，也不能單獨授予 customer delivery。

若下游只依 receipt 欄位或一般 `JSON.parse` 判斷，內容竄改、權限漂移、symlink、
額外檔案、超量 payload 或 receipt 複製品都有機會繞過原有保存邊界。另一方面，
人工決策即使是 `APPROVED`，仍須由另一個可信交付協調器檢查 Report 狀態後才能
改變客戶可讀狀態。

## 決策

### Receipt 是一次性讀回能力

Writer 成功建立的原始 receipt 會登記在 module-private capability registry。
`d1PalaceWritingHumanReviewRecordReadback.server.ts` 只接受該原始、尚未消耗的
物件。Copy、clone、JSON 重建、wrapper 或第二次使用都固定拒絕。

Receipt 一旦交給 verifier 就被消耗；後續 filesystem、parser 或 fingerprint
驗證失敗也不能用同一能力重試。

### 固定位置與 bounded read

Verifier 只讀 system temporary root 下的固定 namespace：

`ai-chart-d1-palace-writing-human-review-record`

它依 receipt 的 Gate fingerprint 找到唯一目錄，要求：

- Root 與 Gate 是目前程序使用者擁有的 `0700` regular directory。
- Realpath 仍位於可信 temporary root 及固定 namespace 內。
- Gate 內精確只有 `human-review-record.json`。
- Artifact 是目前程序使用者擁有的 `0600` regular file，不是 symlink。
- 使用 `O_RDONLY | O_NOFOLLOW`，payload 大於零且最多 32 KiB。

任何缺檔、多檔、symlink、權限或 ownership 漂移、路徑逸出及容量超限都收斂成
固定 frozen error：

`ai_chart_d1_palace_writing_human_review_record_readback_invalid`

錯誤不保存底層 filesystem message、路徑、record 內容或敏感值。

### 重建並驗證 canonical record

讀回內容必須通過 exact-object record parser，包括：

- 固定版本、任務、permission、decision 與 issue-code 規則。
- UUID、可信 Server timestamp 與全部 SHA-256 欄位。
- Decision 與 customer-delivery blocking status 一致。
- Record fingerprint 由不含自身 fingerprint 的 canonical record 重算相符。

解析後的 frozen record 必須重新序列化成與原 bytes 完全相同的 canonical JSON，
payload SHA、record fingerprint 與 Gate fingerprint 也必須和原始 exact receipt
相同。Envelope fingerprint 由不可偽造且只可消耗一次的原始 writer receipt
繼續綁定，不接受 caller 重新申報。

### Verified 不等於 delivered

成功只建立 deep-frozen verified readback：

- `APPROVED` 前進到
  `VERIFIED_APPROVAL_AWAITING_DELIVERY_COORDINATOR`。
- `REPAIR_REQUIRED` 保持 `VERIFIED_REPAIR_REQUIRED`。
- `REJECTED` 保持 `VERIFIED_REJECTED`。
- 三者的 `customerDeliveryAllowed` 都固定為 `false`。

Readback 不修改 Report、不寫 Supabase、不建立 API route、不接 Production，也不
發送 OpenAI request。

## 後果

- 人工審查紀錄具備 write-once 與 bounded verified readback 兩個分離信任邊界。
- 下游不能只信任可複製 receipt 或未驗證 filesystem JSON。
- 內容被竄改或 storage metadata 漂移時會 fail closed，且不能重用同一能力。
- 下一個最小切片是可信 customer-delivery coordinator Contract；它只能消耗已驗證
  的 approval，並須另行確認同一 Report 的交付狀態，不能由本 ADR 直接放行。
