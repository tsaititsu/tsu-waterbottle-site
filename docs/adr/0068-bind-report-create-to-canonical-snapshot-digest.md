# ADR 0068：Report 建立時由 Server 綁定 canonical Snapshot digest

## 狀態

Accepted

目前只有應用程式型別、repository payload 與 mock contract；對應 Migration 尚未套用
Supabase 或 Production。

## 背景

ADR 0067 的可信交付 RPC 會以持久化的
`ai_chart_reports.chart_snapshot_sha256` 核對人工審查、Restricted Artifact 與
待交付 Report 是否來自完全相同的命盤 Snapshot。若 Report 建立時沒有同步保存這個
digest，之後即使人工審查完成，可信交付仍必須 fail closed。

這個欄位不能由 Client 傳入，否則 Client 可以讓儲存的命盤與聲稱的 digest 分離。
它也不能對未清理的輸入物件計算，因為實際寫入的 canonical Snapshot 可能已移除不
屬於正式 Contract 的額外欄位。

## 決策

### 只對實際保存的 Snapshot 計算 digest

`buildPendingAiChartReportPayload()` 先用既有
`copyCanonicalAiChartSnapshot()` 建立實際要寫入的 Snapshot，再對該 copy 的
canonical JSON 計算 SHA-256，並同時寫入：

- `chart_snapshot`
- `chart_snapshot_sha256`

兩個值由同一個 Server repository payload 一次產生，呼叫者不能另外傳 digest。

### N0 與 Report create 共用相同 digest 函式

`createAiChartD1CanonicalSha256()` 固定執行：

1. 既有 safe-graph 驗證。
2. 物件 key canonical ordering。
3. canonical JSON UTF-8 bytes。
4. SHA-256 lowercase hex。

N0 的 `sourceSnapshotSha256` 與 Report create payload 都使用這個 module-owned
函式，不建立第二套排序或雜湊規則。

### Client digest 一律視為未知欄位

Report create API 的 request allowlist 不增加 digest 欄位。測試明確確認
`chartSnapshotSha256` 與 `chart_snapshot_sha256` 都會在 insert 前被拒絕。

## 驗證

- Repository payload digest 與既有 N0 `sourceSnapshotSha256` 完全相同。
- Supabase insert mock 收到同一組 canonical Snapshot 與 digest。
- 帶額外未授權欄位的 Snapshot 會先清理；digest 對應清理後實際保存內容。
- Client digest 欄位在 Report create route 被拒絕且不會 insert。
- N0 既有 canonical Snapshot digest 測試維持通過。
- 本切片沒有連線 Supabase、套用 Migration、讀寫真實 Report 或發送 OpenAI
  request。

## 後果

- 新建立 Report 已具備未來可信交付所需的 Snapshot 持久化 binding。
- Public create input 沒有新增 digest 權限，owner、paid 與付款流程也未改變。
- 正式 rollout 必須先套用 ADR 0067 的 Migration，再部署包含本 ADR 寫入欄位的
  應用程式；順序相反會使 insert 因欄位不存在而失敗。
- 舊 Report 的 digest 仍可能為 null，可信交付必須繼續 fail closed。
- 下一個最小切片可建立 Server-only trusted-delivery repository Adapter mock
  contract，將已驗證交付 command 精確映射到單一 RPC；在 Migration 獲得正式授權
  並套用前，不得連線 Production 或建立客戶可呼叫 route。
