# ADR 0056：先把 Server 查得的正式 Report 綁到審查 Artifact

## 狀態

Accepted

## 背景

ADR 0055 已宣告正式人工審核需要 request-bound authorization、Server clock 與
write-once storage 三個 port，但現有審查鏈只綁定 Gate、restricted artifact、
payload 與 proposal fingerprints，尚未綁定網站正式 `ai_chart_reports` 的
`reportId`。若直接建立正式審查紀錄，caller 可能把一份合法 artifact 掛到另一份
Report，無法證明審查結果屬於哪一份已付款報告。

正式 Report create／read 流程已有 Server 驗證的 Report UUID 與 owner 邊界，但
本階段不修改登入、權限、Supabase Schema 或 Production 資料，因此不能假裝已完成
正式查詢。

## 決策

新增
`d1PalaceWritingPreviewReportArtifactBindingContracts.server.ts`，在 Production
human-review ports 之後加入離線 Report subject adapter probe。

Probe 只把以下既有安全 metadata 交給 injected fake adapter：

- Gate fingerprint。
- Restricted artifact fingerprint。
- Artifact payload SHA-256。
- Proposal fingerprint。

它不把 caller 提供的 `reportId`、owner、付款狀態、命盤 Snapshot、模型正文或
Prompt 送進 adapter command。Report UUID、已付款、owner 綁定、Snapshot SHA 與
source binding 必須由 adapter outcome 一次完整回傳；任何缺漏、額外欄位、狀態
不符或 fingerprint 漂移都 fail closed。

通過後的 binding 固定保存：

- Server adapter 選出的 Report UUID。
- Report canonical Snapshot SHA-256。
- 原 Production Port Contract fingerprint。
- Gate、restricted artifact、payload 與 proposal fingerprints。
- 原人工決策、固定 issue codes、唯一 reviewer permission 與 delivery 阻擋狀態。

Binding 不保存 owner user ID、email、出生資料、命盤 Snapshot、report content、
restricted artifact 正文、Prompt、reviewer 或自由文字。

## 單次能力

ADR 0055 的 Production Port Contract 現在以 module-private `WeakMap` 登記。
只有原始、未消耗物件可進入本 probe；copy、clone、JSON 往返或第二次使用都拒絕。
產生的 Report binding 也使用相同 exact-object identity 與單次 consumer，避免
序列化 metadata 被誤當正式權限。

## 尚未開放的能力

本 probe 只可在 canonical test environment 執行，並固定：

- `SYNTHETIC_FOUND`
- `SYNTHETIC_PAID_NOT_PRODUCTION`
- `SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION`
- `SYNTHETIC_MATCHED_NOT_PRODUCTION`
- `persistenceStatus=NOT_PERSISTED`
- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `productionCallable=false`
- `openAiRequests=0`

它不查詢 Supabase、不讀 Request、不驗證真人 reviewer、不寫資料庫或 filesystem，
也不解除報告交付 gate。

## 後果

- 正式審查紀錄必須先證明「Report、Snapshot 與 Artifact 是同一來源」，不能只靠
  Gate fingerprint。
- 未來 Production adapter 必須由 Server 查詢 Report、確認已付款與 owner 綁定，
  以 canonical Snapshot 計算 SHA，再逐項比對 Artifact source。
- 下一步仍須另行取得登入／權限與資料庫變更授權，才能實作真正
  request-bound Report lookup adapter 與永久 write-once record storage。
