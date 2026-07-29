# ADR 0079：Runtime 授權必須保存為耐久原子收據

## 狀態

已決定；Server-only declaration Contract、ADR 0080 的 test-only offline
Adapter Probe，以及 ADR 0081 的 declaration-only Storage／Adapter Mapping
Contract 已完成，尚未建立 Migration、正式 repository adapter、Runtime read
adapter 或正式授權。

## 背景

ADR 0078 已把 GitHub Environment 人工核准的傳遞方式固定為 GitHub Actions
OIDC。OIDC token 只能證明「這一次請求來自符合條件的短效 GitHub
執行身分」，不能直接當成長期 Runtime 狀態，也不能只用記憶體 Set 防止重送。

如果 Server 先查 replay key 不存在再寫入，兩個並行請求可能同時通過檢查，
然後分別建立權限。HTTP timeout 也可能發生在資料其實已寫入之後；此時盲目
重送會把「不知道有沒有成功」誤當成「一定失敗」，破壞一次性授權。

## 決策

### 一個小 Repository Interface

建立
`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server.ts`，
只宣告兩個 repository 操作：

1. `createOrReadExact`：OIDC verifier 通過後，以一個原子操作建立收據；若已
   存在，只能回傳逐欄完全相同的既有收據。
2. `readExact`：Runtime 只以目前預期的 exact command 與三份 Contract
   fingerprint 讀取及重驗收據。

Contract 沒有實作任何 storage、Supabase、HTTP endpoint 或 Runtime。

### 收據只保存必要綁定

正式 receipt shape 只允許：

- 固定 receipt contract version／task。
- `authorizationStatus=AUTHORIZED`。
- GitHub Environment source contract version／fingerprint。
- authorization Port contract version／fingerprint。
- OIDC transport contract version／fingerprint。
- module-owned exact authorization command。
- authorization command fingerprint。
- replay key fingerprint。
- receipt fingerprint。

不保存 `jti`、Repository／Workflow 原始 claims、raw token、Authorization
header、reviewer、approval proof、provider payload／message、Secret 或自由文字。
Replay key 只能由已驗證的固定 inputs canonical SHA-256 得到。

### 兩個唯一鍵

Durable storage 必須同時保證：

1. `replayKeyFingerprint` unique：同一 OIDC attestation 不能重送。
2. `authorizationCommandFingerprint` unique：同一 exact Release／Migration／
   policy command 只能有一份授權收據。

這兩個約束必須和 insert／exact-existing 驗證位於同一 transaction 或等價的
單一原子操作，不能用先讀後寫代替。

### Exact replay 與 reconciliation

只允許以下結果：

- 兩個 key 都不存在：原子建立 exact receipt。
- 兩個 key 指向同一份且所有欄位相同：回傳既有 receipt。
- 只有一個 key 存在：conflict，fail closed。
- 兩個 key 指向不同 receipt：conflict，fail closed。
- 既有 receipt 任一 binding 不同：conflict，fail closed。
- write outcome 不確定：以兩個 key 唯讀 reconciliation，不盲目 retry。

收據是 append-only immutable record，不允許 UPDATE 或 DELETE。

### Runtime read seam

收據存在仍不表示任何版本都可以啟用。Runtime 每次讀取必須重新確認：

- receipt shape 與 receipt fingerprint。
- `authorizationStatus=AUTHORIZED`。
- authorization scope 與 feature。
- exact Release commit。
- Migration version／SHA／readiness fingerprint。
- Runtime activation policy version。
- source／Port／transport contract fingerprints。
- authorization command fingerprint。
- 目前 Release 與 policy 仍和收據完全相同。

Release 或 policy drift 一律 fail closed，不修改舊 receipt。舊 receipt 只是
歷史授權紀錄，不能跨 Release 或跨 policy 重用。

## 安全邊界

- 序列化的 Contract metadata 沒有授權效力。
- receipt repository 必須由 Server-owned adapter 實作，Client 或一般 caller
  不得自行提供 receipt。
- 不允許自動 retry；未知結果只能 reconciliation。
- 不保存 provider 原始身分、訊息或 approval proof。
- 本 ADR 不建立資料庫、Migration、GitHub Workflow、Environment、Secret、
  endpoint、Runtime activation 或 customer delivery。

## 驗證

- Contract 的 create fields、receipt fields、unique keys、reconciliation
  cases、read fields、Runtime checks 與 failure codes 都是 fixed deep-frozen
  allowlist。
- Contract fingerprint 由 canonical metadata deterministic 產生。
- Contract 綁定 ADR 0076、0077、0078 三層 fingerprint。
- Source contract test 確認 module 沒有 Environment／Secret、GitHub API、
  HTTP、database、Runtime、Report mutation 或 OpenAI action。
- ADR 0080 的 public-interface probe 已驗證 concurrent create 只建立一次、
  exact replay、兩個唯一鍵的單鍵／交叉衝突、unknown-write reconciliation
  與 Runtime read drift。

## 後果

- OIDC transport 的 replay 檢查由「先確認未使用」改成「durable atomic claim
  或 exact existing」，避免 TOCTOU。
- Runtime 取得的是可持久驗證的 exact Release 授權，而不是短效 token 或
  caller boolean。
- Offline atomic receipt adapter probe 已完成，但 module-private test indexes
  不等於 durable storage。ADR 0081 已把 private normalized table、三個內部
  RPC 與兩個外部方法的 mapping 固定；ADR 0082 已完成 offline RPC Probe
  驗證。這仍不能視為 Migration、database Schema 或 Runtime 已接通。
- GitHub Environment、OIDC、Workflow、Secret、正式 database、合併與部署仍須
  依當次任務取得明確授權。
