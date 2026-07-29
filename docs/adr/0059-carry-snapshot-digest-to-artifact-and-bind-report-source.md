# ADR 0059：把 Snapshot digest 傳到 Artifact，再精確綁定 Report 來源

## 狀態

Accepted

## 背景

ADR 0058 已讓 Server 從已付款 Report 讀取並驗證 canonical Snapshot，但當時
restricted Artifact 尚未攜帶同一份 Snapshot 的 digest。因此 Report subject
只能標示 `PENDING_ARTIFACT_SNAPSHOT_PROOF`，不能把「Report 合法」誤認為
「Artifact 確實來自該 Report」。

若每一層各自重算或由 caller 傳入 Snapshot SHA，來源定義可能漂移，也可能讓
未受信任輸入冒充正式來源。這個 digest 必須由最靠近 canonical Snapshot 的
module 擁有，後續只能在已驗證資料鏈中承接。

## 決策

### N0 是唯一 digest 來源

`normalizeAiChartD1N0()` 先以既有 Strict Contract 驗證完整 Snapshot，再使用
共用 canonical JSON 規則序列化原始 Snapshot，計算 SHA-256：

`sourceSnapshotSha256`

Object key 依固定順序排列，array 順序保留，因此只改 JSON key 插入順序不會改變
digest；真正 Snapshot 內容改變時 digest 必須改變。Caller 不能提供或覆寫此值。

### 只沿已驗證來源鏈傳遞

相同 digest 依序進入：

1. N0
2. Palace Content Grid
3. Palace Writing Prompt Package 與 source trace
4. Restricted Preview Artifact

Content Grid 必須先完成 N0、Axis、Structural、Flying 與 Semantic Review 的既有
source-chain 驗證；Writing Prompt Package 必須驗證每個 package、source trace
與十二宮 package set 的 digest 完全相同；Restricted Artifact 只能從已驗證
Writing Prompt Package 取得 digest。

Digest 會納入 Writing Prompt Package 與 Restricted Artifact 的既有 fingerprint，
使來源值被改寫時無法沿用舊 fingerprint。下游不保存完整 Snapshot。

### Report 與 Artifact 只做精確、一次性比對

新增 Server-only source binding。它必須同時消耗：

- 原始、單次的 paid Report subject capability。
- 原始、由正式 Restricted Artifact builder 註冊的單次 Artifact capability。

程式只接受：

`reportSnapshotSha256 === artifact.sourceSnapshotSha256`

成功後建立新的 frozen capability，狀態固定為：

`SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH`

Binding 同時以原始 Restricted Artifact 的 canonical JSON 計算 payload SHA-256，
供下一層把 decision proposal 綁回完全相同的 Artifact 內容。

copy、clone、JSON 往返、第二次消耗或 digest 不相同都 fail closed。Report subject
本身仍維持 pending；只有另行產生的 source-binding capability 能證明精確相符。

## 固定失敗分類

只允許：

- `REPORT_SUBJECT_UNAVAILABLE`
- `ARTIFACT_SOURCE_UNAVAILABLE`
- `ARTIFACT_SNAPSHOT_MISMATCH`

錯誤不保存 owner、完整 Snapshot、Report 正文、模型正文、Prompt、出生資料、
provider message 或任意動態值。

## 本切片仍未開放

本切片只完成來源完整性證明，固定：

- `formalReviewRecordAllowed=false`
- `customerDeliveryAllowed=false`
- `openAiRequests=0`

它不接 API route、不寫 Supabase、不修改 Report、不建立正式人工審查紀錄，也不
解除客戶交付。下一個最小切片才可評估如何讓 request authorization 與這個
source-binding capability 共同進入正式 review command／record adapter。

## 後果

- Report 與 Artifact 不再只靠 `chartId` 或互不相干的 fingerprint 宣稱同源。
- Snapshot digest 只有一個 module-owned 起點，caller 無法選擇或覆寫。
- 十二宮寫作鏈若混入不同 Snapshot，會在 package set 或最終 source binding
  fail closed。
- 來源相符只是建立正式審查紀錄的必要條件，不等於內容已通過人工審查，更不等於
  可交付客戶。
