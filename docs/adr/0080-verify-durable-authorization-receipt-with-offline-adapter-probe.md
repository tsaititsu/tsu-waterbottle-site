# ADR 0080：以離線 Adapter Probe 驗證耐久授權收據語意

## 狀態

已決定並完成 test-only offline probe；ADR 0081 也已完成 declaration-only
Storage／Adapter Mapping Contract。尚未建立 Migration、正式 repository
adapter、Runtime read adapter、GitHub endpoint 或正式授權。

## 背景

ADR 0079 已固定 durable authorization receipt 的雙唯一鍵、原子建立、
exact-existing、未知寫入結果 reconciliation 與 Runtime exact read seam。
但是 declaration-only Contract 只能描述規則，還不能證明兩個並行 caller
不會各自建立收據，也不能證明 conflict、write outcome unknown 或 Release
drift 真的會 fail closed。

在建立正式資料庫 Schema 前，需要先以公開 Repository Interface 驗證行為。
此驗證不能連線資料庫、讀取 Secret、請求 GitHub、啟用 Runtime 或交付客戶。

## 決策

新增
`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server.ts`，
作為只在 canonical test environment 可建立的離線 Adapter Probe。

Probe 只公開 ADR 0079 已宣告的兩個方法：

1. `createOrReadExact`
2. `readExact`

內部以兩個 module-private index 模擬未來 storage 的：

- `replayKeyFingerprint` unique。
- `authorizationCommandFingerprint` unique。

Index 不是正式持久化實作，也沒有對 caller 公開。測試只觀察公開方法的
receipt、fixed status 與 fixed safe error。

### 原子建立與 exact replay

`createOrReadExact` 先重驗 strict command、目前 source／Port／transport
Contract fingerprints、module-owned authorization command 與 canonical command
fingerprint。進入同步 critical section 後：

- 兩個 key 都不存在：建立一份 deep-frozen receipt，兩個 index 同時指向它。
- 兩個 key 指向同一份 exact receipt：回傳
  `EXISTING_EXACT_STOPPED`。
- 只有一個 key 存在、兩個 key 指向不同 receipt，或 existing receipt
  任一 binding 不同：回
  `AUTHORIZATION_RECEIPT_CONFLICT`。

並行測試以兩個同時 caller 驗證只有一個 `CREATED_STOPPED`，另一個只能取得
同一 receipt 的 `EXISTING_EXACT_STOPPED`。

### 未知寫入結果

Probe 提供一個 module-owned test fault：只在第一次 commit 完成後模擬回應
遺失，回
`AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED`。Probe 不自動重試；caller
只能使用 `readExact` 讀回已存在的 exact receipt。

這個 fault 只模擬 boundary，不接受 provider message、任意 error、重試次數
或 caller-selected receipt。

### Runtime exact read

`readExact` 以 authorization command fingerprint 找 receipt，再重驗：

- receipt canonical fingerprint。
- exact authorization command。
- 目前 source／Port／transport fingerprints。
- Release commit、Migration identity／readiness fingerprint 與 policy。

沒有目前 Release 的 exact receipt 回
`AUTHORIZATION_RECEIPT_NOT_FOUND`；目前 Contract binding 漂移回
`AUTHORIZATION_RECEIPT_BINDING_MISMATCH`。兩者都不修改歷史 receipt。

## 安全邊界

- Probe 只能在 `NODE_ENV=test` 建立。
- 結果固定
  `runtimeActivationAllowed=false`、
  `customerDeliveryAllowed=false`、
  `productionCallable=false`。
- 不連線資料庫，不呼叫 GitHub／Supabase／OpenAI，不讀 Secret，不寫 Report。
- Receipt 與 error 不保存 raw OIDC claims、token、reviewer、approval proof、
  provider payload／message或自由文字。
- Caller 加料、accessor、版本漂移、fingerprint 漂移及非法 SHA 都 fail
  closed。
- 沒有 update／delete／blind retry Interface。

## 驗證

- Fresh create 與 exact read。
- 同 command 的並行 create 只建立一次。
- Exact replay 回同一 receipt。
- replay-key-only、command-key-only 及 cross-key conflict。
- source／transport Contract binding drift。
- Commit 後 response unknown 的顯式 read reconciliation。
- 新 Release 找不到舊 receipt。
- Caller expansion 不會觸發 accessor。
- Probe、receipt、result 與 fixed error 都 immutable。
- Database connection、Report mutation 與 OpenAI request 都是零。

## 後果

- ADR 0079 的介面語意已由離線公開行為驗證，不再只是一份文字宣告。
- 這不代表 storage durable，也不代表正式 atomic transaction 已完成；兩個
  module-private index 不能取代資料庫 unique constraints。
- ADR 0081 已固定 durable receipt storage Schema 與 production adapter
  mapping，ADR 0082 也已用 offline RPC Probe 驗證 mapping、strict response
  parser、一次 write、條件式 reconciliation 與 Runtime read；仍未套用正式
  資料庫、建立 GitHub Environment／Workflow／Secret或啟用 Runtime。
- 建立或修改正式 Migration、Production database、權限、Secret、合併或部署
  仍須依當次任務取得相應明確授權。
