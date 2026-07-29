# ADR 0081：宣告耐久授權收據 Storage 與 Adapter Mapping

## 狀態

已決定並完成 declaration-only Contract；ADR 0082 已完成 offline RPC Adapter
Probe。尚未建立 Migration、SQL、RPC、Supabase client、Production Adapter、
Runtime reader 或正式授權。

## 背景

ADR 0079 固定了外部 Repository 的 `createOrReadExact` 與 `readExact`，ADR
0080 再以 test-only in-memory Probe 驗證雙唯一鍵、並行建立、exact replay、
未知寫入結果及 Runtime read 的公開行為。

但 Map 不能證明正式資料庫會以什麼欄位、權限與原子邊界保存收據。若直接把
完整 authorization command 放入 JSONB，資料庫難以對每個 authority binding
做固定型別與 equality 約束；若只做一個 create RPC，又會把「未知寫入後的
雙鍵核對」和「Runtime 平常讀取目前授權」混成同一個不清楚的操作。

## 決策

新增
`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server.ts`，
只宣告未來 Storage Schema 與 Production Adapter 的固定 mapping，不包含可
執行 SQL 或資料庫程式。

### 一個 private、normalized、append-only table

未來資料表固定規劃為：

- schema：`ai_chart_private`
- table：`runtime_activation_authorization_receipts`
- encoding：21 個 non-null scalar columns，禁止 JSONB

21 欄只把既有 receipt 與 nested authorization command 正規化展開：

- receipt contract／task／authorized status
- source、authorization Port、OIDC transport 的 version／fingerprint
- authorization command contract／task／scope／feature
- Release commit
- Migration version／SHA／readiness fingerprint
- Runtime policy version
- authorization command fingerprint
- replay key fingerprint
- receipt fingerprint

不新增由資料庫時間、流水號或 caller metadata 形成的授權來源。Command
fingerprint 規劃為 primary key，replay fingerprint 另有 unique constraint。
所有 contract value、SHA 格式及 receipt fingerprint 都必須由 Schema／RPC
與 Server parser 雙重重驗。

### 外部兩方法，內部三個 Storage operations

外部 Repository Interface 保持：

1. `createOrReadExact`
2. `readExact`

Production Adapter 內部則規劃三個 service-role-only RPC：

1. `create_or_read_ai_chart_runtime_authorization_receipt`
   - 在一個 transaction 內鎖定兩個 unique keys。
   - 兩鍵皆無才 insert。
   - 兩鍵共同指向逐欄完全相同 receipt 才回 existing。
   - 單鍵、分岔或 binding conflict 都 fail closed。
2. `reconcile_ai_chart_runtime_authorization_receipt`
   - 只在第一個 RPC 的 transport outcome 不確定時使用。
   - 以同一 create command 已持有的兩個 fingerprints 唯讀核對。
   - 最多一次，不再次 write，也不重送 create。
3. `read_ai_chart_runtime_authorization_receipt`
   - 供 Repository `readExact` 使用。
   - 以 command fingerprint 找目前 receipt，再由 Adapter 重驗 exact command、
     current Release／Migration／policy 與三層 Contract bindings。

因此 reconciliation 是 `createOrReadExact` 內部的 conditional read，不是第三個
公開 Repository 方法，也不是 retry。Runtime 平常的 `readExact` 不需要知道
OIDC replay inputs。

### 權限與回傳邊界

未來 Storage 必須：

- 位於不對 Data API 公開的 private schema。
- 啟用並強制 RLS。
- table 對 public、anon、authenticated、service_role 都沒有直接權限。
- 由 non-login owner 持有 SECURITY DEFINER functions。
- functions 使用空 search path 及完整 schema-qualified relation。
- RPC execute 只給 service_role。
- 沒有 UPDATE／DELETE RPC。

RPC 只回傳固定 result code 加 21 個 scalar receipt 欄位。Provider
message、details、hint、stack 或原始資料庫 response 都不能穿過 Adapter。

## 安全邊界

- 本 Contract 的序列化 metadata 沒有授權效力。
- 不保存 raw authorization command JSON、OIDC claims、token、replay inputs、
  reviewer、authorizer identity、approval proof、provider message 或自由文字。
- 一次 `createOrReadExact` 最多一個 write RPC；只有 write outcome unknown
  才能再做一次 read-only reconciliation。
- 一次 `readExact` 最多一個 read RPC。
- caller 不能選 schema、table、RPC、retry 或 storage root。
- 本 ADR 不建立 Migration、不修改 Supabase、不讀 Environment／Secret、不連
  database、不啟用 Runtime、不修改 Report，也不發 OpenAI request。

## 驗證

- Storage Contract 固定 21 個欄位、兩個 unique constraints、三個 internal
  operations、四個 success result codes及 failure mappings。
- External Repository 仍只有兩個 methods。
- Security controls、method mappings、failure mappings 與 Contract 全部
  deep-frozen。
- Contract fingerprint 由 canonical metadata deterministic 產生。
- Source-contract test 確認 module 沒有 SQL、Supabase client、RPC invocation、
  Environment、Secret、HTTP、Runtime、Report mutation 或 OpenAI action。

## 後果

- 未來 Migration 不必重新決定欄位、RPC 責任與權限邊界。
- JSONB 與 provider-specific payload 不會滲入 authorization storage。
- 未知寫入結果可以在 Adapter 內以兩鍵安全核對，不擴張上層介面。
- ADR 0082 已以 offline RPC Probe 驗證 command mapping、strict response
  parser、一次 write、條件式 reconciliation 及 Runtime read。
- 這仍不是正式 Storage 或 Production Adapter；下一步只能先設計專用
  Migration 與 Adapter source，未取得相應授權前不得套用 database 或接通
  Runtime。
