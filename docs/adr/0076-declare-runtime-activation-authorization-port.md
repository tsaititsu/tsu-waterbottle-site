# ADR 0076：先宣告 Runtime activation authorization Port，不選擇正式來源

## 狀態

Accepted

目前只有 Server-only、declaration-only 的 Port contract。沒有讀取正式
Environment／Secret、呼叫 authorization provider、建立 authorization handoff、
啟用 Runtime、建立 admin client、連線 Supabase、套用 Migration、讀寫
Report／Artifact、建立客戶 route 或發送 OpenAI request。

## 背景

ADR 0074 已用 test-only injected verifier 建立 release-scoped authorization
handoff；ADR 0075 又把原始 handoff 與 controlled deployment attestation 的
Release commit、Migration readiness fingerprint、feature、Migration identity
及 Runtime policy version 綁在同一順序。

既有 injected verifier 是測試 Adapter，未來正式 Adapter 則需要另一個可信任
實作。這代表 seam 已經真實存在，但如果現在直接選擇 GitHub Environment、
Secret、一般環境變數或 caller boolean，會把「Port 的固定責任」與「正式授權
來源」混在一起，也可能在沒有本任務明確授權時提早建立 Production 能力。

## 決策

### Port 只有一個小 Interface

新增：

`d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server.ts`

Port 只有一個責任：

```text
VERIFY_EXPLICIT_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION
```

Interface 是一份 module-owned exact command 與一份 safe decision。Command 固定
包含：

- Contract version 與 task。
- 唯一 authorization scope。
- feature。
- exact Release commit SHA。
- Migration version／SHA。
- Migration readiness fingerprint。
- Runtime activation policy version。

Caller 不能加入 activation boolean、另一個 permission、可重用 token、任意
Environment override 或自由文字。

### Outcome 只允許安全決策

Outcome 只允許 exact binding 欄位與：

```text
AUTHORIZED
DENIED
```

未來 Adapter 可以在自身 Implementation 內驗證操作者或 approval proof，但
Interface 不回傳 authorizer ID、email、proof、provider message、Secret、stack
或其他自由文字。Handoff 模組仍必須把 Adapter 回應視為 untrusted `unknown`，
逐欄重驗後才能建立單次 capability；TypeScript 型別不能取代 Runtime validation。

### 正式來源尚未選擇

Contract 明確標示：

```text
authorizationSource =
  CONTROLLED_PRODUCTION_RELEASE_AUTHORIZATION_NOT_SELECTED
implementationStatus =
  PORT_DECLARED_NOT_IMPLEMENTED
```

所以本切片不讀 `process.env`，也不決定 GitHub Environment、Secret、資料庫、
route 或任何第三方服務。正式來源必須在另一個任務中先說明授權如何產生、如何
綁定 exact Release、如何防重用與如何回復，再取得當次明確同意。

ADR 0077 已完成後續來源選擇：使用專用 GitHub Environment 的 required
reviewer 人工核准，並綁定 exact Release commit、Migration identity／readiness
fingerprint、Runtime policy 與本 Port fingerprint。ADR 0076 本身仍保持來源
無關；正式 GitHub Adapter 與可信任 attestation transport 尚未實作。

### 固定安全失敗

未來 Adapter 只能使用五個 module-owned failure code：

- `AUTHORIZATION_SOURCE_UNAVAILABLE`
- `AUTHORIZATION_CHECK_FAILED`
- `AUTHORIZATION_RESPONSE_INVALID`
- `AUTHORIZATION_NOT_GRANTED`
- `AUTHORIZATION_BINDING_MISMATCH`

錯誤不保存 provider payload、訊息、身分、proof、Secret 或 stack，也不允許
automatic retry。

## 驗證

- Port contract、欄位清單、decision values 與 failure codes 全部 deep-frozen。
- Contract fingerprint 由 canonical metadata deterministic 產生。
- Interface 只接受一份 exact command，回應仍以 `unknown` 進入下一層驗證。
- Source contract 不包含 Environment、Secret、database、transport、Runtime
  activation、customer delivery 或 OpenAI implementation。
- `adapterInvocations`、`environmentReads`、`secretReads`、database connection、
  Report mutation 與 OpenAI request 全部為零。
- Focused authorization／readiness contract 與完整離線驗證都必須通過。

## 後果

- 未來正式 Adapter 與現有 test Adapter 必須滿足同一個小 Interface，來源驗證
  複雜度不能散落到 readiness caller。
- 宣告 Port 不等於選定授權來源、不等於建立 handoff，也不等於 Runtime active。
- ADR 0077 已選擇專用 GitHub Environment 作為來源，但只完成 declaration-only
  Contract。下一步必須先設計可信任 approval attestation transport；不能自行
  建立 Environment／Workflow／Secret、實作 Production Adapter 或把序列化
  metadata 當成授權。
- 在該決策完成前，Runtime policy 保持
  `BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION`，admin client、Supabase、
  Report delivery 與 OpenAI request 都維持零。
