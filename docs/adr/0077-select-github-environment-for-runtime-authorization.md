# ADR 0077：選擇專用 GitHub Environment 作為 Runtime activation 授權來源

## 狀態

Accepted

目前只有 Server-only、declaration-only 的 source selection contract。沒有建立或
修改 GitHub Environment、required reviewer、Workflow、Secret、deployment、
authorization Adapter、Runtime activation state 或 Production 資料。

## 背景

ADR 0076 已先把正式 Runtime activation authorization 收斂成一個小 Port：
module-owned exact Release command 進入，只有逐欄回綁的 `AUTHORIZED`／
`DENIED` safe decision 可以離開。Port 不允許 caller boolean、一般環境變數、
可重用 token、authorizer 身分、approval proof、provider payload 或自由文字。

剩下的決策是正式授權要從哪個受控來源取得。老師已選擇：

```text
GitHub Environment 人工核准
＋ exact Release commit
＋ exact Migration readiness fingerprint
```

這個選擇只決定信任來源，不代表已建立 Environment，也不代表 GitHub 的核准
文字、匯出的 JSON 或任一 caller 宣稱本身可以啟用網站 Runtime。

## 決策

### 使用專用 Environment

新增：

`d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server.ts`

來源固定為：

```text
repository  = tsaititsu/tsu-waterbottle-site
environment = ai-chart-production-runtime
branch      = main
ref         = refs/heads/main
protection  = required reviewer manual approval
prevent self-review = required
administrator bypass = disabled
deployment branch policy = main only
```

使用專用 Environment，而不是共用一般 Preview、Vercel Production 或 Supabase
Migration Environment，可以讓「啟用 AI Chart trusted-delivery Runtime」維持
獨立人工核准邊界。這份 Contract 不建立 Environment，也不要求或讀取
Environment Secret。

### 一次核准只綁一份 exact command

未來 Adapter 必須在自身可信任實作內完整驗證：

1. Repository 完全相同。
2. Protected Environment 完全相同。
3. Branch 與 ref 都是 `main`。
4. Required reviewer 的人工核准存在。
5. Prevent self-review 已啟用。
6. Administrator bypass 已停用。
7. Deployment branch policy 只允許 main。
8. Release commit SHA 完全相同。
9. Migration version／SHA 完全相同。
10. Migration readiness fingerprint 完全相同。
11. Runtime activation policy version 完全相同。
12. ADR 0076 Port contract fingerprint 完全相同。

同一次核准不得跨 Release、跨 Migration readiness 或跨 authorization command
重用；不能改成 auto approval、caller-declared approval、環境變數布林值或未受
保護 branch。

### Source declaration 沒有 Runtime 權力

Contract 固定標示：

```text
serializedMetadataAuthority = NONE_DECLARATION_ONLY
authorizationStatus         = SOURCE_SELECTED_NOT_VERIFIED
portAdapterStatus           = NOT_IMPLEMENTED
workflowImplementationStatus = NOT_IMPLEMENTED
approvalAttestationTransportStatus = NOT_IMPLEMENTED
durableRuntimeActivationStatus = NOT_IMPLEMENTED
```

所以這份 frozen JSON 即使被複製、保存或重新建立，也不能證明人工核准，更不能
產生 handoff 或啟用 Runtime。Authorizer 身分、approval proof、Workflow run、
deployment、provider payload、Secret 與訊息也不進入這份 source metadata。

GitHub 是外部系統，正式實作仍必須沿用 ADR 0076 的 Port；不能讓 GitHub
Workflow、route 或 caller 繞過該 Port 直接修改 Runtime policy。

## 驗證

- Source contract、required binding checks 與 nested arrays 全部 deep-frozen。
- Contract fingerprint 由 canonical metadata deterministic 產生。
- Contract 綁定既有 Port contract version、fingerprint、port name 與
  authorization scope。
- Source declaration 不包含 reviewer、proof、provider payload、Secret 或自由
  文字欄位。
- Source module 不讀 Environment／Secret、不呼叫 GitHub API、不連線資料庫、
  不建立 handoff、不啟用 Runtime、不交付 Report，也不發送 OpenAI request。
- Focused authorization contract 與完整離線驗證都必須通過。

## 後果

- 正式授權來源已選定，不再允許改用 caller boolean、一般環境變數、共用
  deployment 成功狀態或可複製 JSON。
- GitHub Environment 尚未建立或修改；required reviewer、Workflow 與 Adapter
  也尚未實作。
- ADR 0078 已選擇 GitHub Actions OIDC 作為可信任 attestation transport：
  protected Environment job 只能用短效 signed token 把 exact command 送入既有
  Port，不建立長期共享 Secret。Transport 仍只有 declaration-only Contract；
  endpoint、JWT verifier、atomic replay store 與 durable activation state 都尚未
  實作。
- ADR 0079 已把 durable atomic authorization receipt、reconciliation 與
  Runtime read seam 固定成 declaration-only Contract；ADR 0080 的 offline
  atomic receipt adapter probe 也已驗證並行建立、exact replay、conflict、
  unknown-write reconciliation 與 read drift。Probe 的記憶體 index 不是 durable
  storage，仍不能把 source selection、OIDC token 或 Contract fingerprint 當成
  持久化 authorization。
- 建立或修改 GitHub Environment、權限、Secret、Production workflow、正式
  Migration、合併或部署仍須依當次任務取得相應明確授權。
- Runtime policy 保持
  `BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION`；admin client、Supabase、
  Report mutation、customer delivery 與 OpenAI request 都維持零。
