# ADR 0082：離線驗證耐久授權收據 RPC Adapter Mapping

## 狀態

已決定並完成 offline RPC Adapter Probe；尚未建立或套用 Migration、SQL、
RPC function、Supabase client、Production Adapter、Runtime reader 或正式授權。

## 背景

ADR 0081 已把 durable authorization receipt 固定為 21 個 scalar columns、
兩個外部 Repository methods 與三個內部 RPC operations。但 declaration-only
Contract 還不能證明 Adapter 真的會：

- 把 receipt 精確展開成 21 個固定參數。
- 只執行一次 create write。
- 只在 write outcome unknown 時執行一次雙鍵 reconciliation read。
- 把一般 Runtime read 保持為不同的固定操作。
- 嚴格重建並驗證 RPC 回傳的完整 receipt，而不是相信 provider payload。

## 決策

新增
`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server.ts`，
在 test-only injected RPC seam 實際走過 Production Adapter 預定 mapping。

### 外部 Interface 保持兩個方法

Probe 對 caller 仍只提供：

1. `createOrReadExact`
2. `readExact`

原子 create、unknown-write reconciliation 與 Runtime read 三個 RPC 名稱及參數
都由 module-owned Storage Contract 決定，caller 不能指定或增加第三個公開方法。

### 固定 RPC Port outcome

Injected RPC Port 只接受三種安全 outcome：

- `SUCCESS`：只攜帶待嚴格解析的固定 row。
- `FAILURE`：只攜帶 Storage Contract allowlist condition。
- `UNKNOWN_WRITE_OUTCOME`：只可觸發一次 read-only reconciliation。

Provider message、details、hint、stack、SQL、token、claims、reviewer 或自由文字
都不能進入 outcome 或 error。

### 一次寫入與條件式 reconciliation

`createOrReadExact` 先把已驗證 command 建立成 exact immutable receipt，再映射成
21 個 `p_*` scalar parameters，固定呼叫一次 atomic create RPC。

- `CREATED` 與 `EXISTING_EXACT` 必須回傳逐欄相同且 fingerprint 正確的 receipt。
- 只有 `UNKNOWN_WRITE_OUTCOME` 可再呼叫一次 reconciliation RPC。
- Reconciliation 只帶 command fingerprint 與 replay fingerprint，不能重送
  create，也不能進行第二次 read。
- Reconciliation 只接受 `RECONCILED_EXACT`。

`readExact` 則只帶 command fingerprint 呼叫一次 Runtime read RPC，並重驗目前
Release、Migration、policy、source、Port、transport 與完整 receipt fingerprint。

### Strict response parser

RPC row 必須精確只有 `result_code` 加 21 個 scalar columns。Parser 會：

- 拒絕缺欄、加料、非字串、未知 result code、accessor、symbol 與 cycle。
- 重建 nested authorization command。
- 重算 command fingerprint 與 receipt fingerprint。
- 重驗目前固定 Contract fingerprints、Release／Migration／policy bindings。
- 將結果、receipt、parameters 與 fixed error 全部 freeze。

## 安全邊界

- Probe 只在 canonical test environment 可建立。
- RPC 由 injected fake 提供；沒有 `.rpc()`、Supabase client 或 database
  connection。
- 沒有 Environment／Secret、GitHub API、HTTP、Report mutation、Runtime
  activation、customer delivery 或 OpenAI request。
- `databaseConnections`、`reportMutations` 與 `openAiRequests` 固定為零。
- 本 ADR 不建立 Migration，也不授權任何 Production database 操作。

## 驗證

- Exact create mapping 為 21 個固定、frozen scalar parameters。
- Exact Runtime read 只帶一個 command fingerprint。
- `CREATED`、`EXISTING_EXACT`、`RECONCILED_EXACT`、`READ_EXACT` 狀態可區分。
- Unknown committed write 固定為一次 write 加一次 read，零 retry。
- Unresolved unknown write 在第二次 outcome 後停止。
- Storage failure condition 映射為既有七個固定 Repository errors。
- Malformed／加料／敏感 provider outcome fail closed。
- Caller expansion 與 Production mode 在 RPC invocation 前停止。

## 後果

- Storage／Adapter mapping 已從文字宣告提升為可執行的離線 interface 證據。
- Production Adapter 仍未實作；injected RPC fake 不等於 Supabase 或 PostgreSQL。
- 下一步可開始設計 authorization receipt 專用 Migration 與 Production Adapter
  source，但仍不得套用 database、建立正式權限或啟用 Runtime。
