# ADR 0078：以 GitHub Actions OIDC 傳遞 Environment 人工核准

## 狀態

Accepted

目前只有 Server-only、declaration-only 的 transport contract。沒有建立
Workflow、Environment、required reviewer、OIDC token request、HTTP endpoint、
JWT verifier、replay store、authorization Adapter、durable activation record
或 Production Runtime。

## 背景

ADR 0077 已選定專用 GitHub Environment required-reviewer 人工核准，但
Environment 核准發生在 GitHub，網站 Runtime 不能因為 caller 傳入布林值、
複製 GitHub JSON 或環境變數就相信核准已發生。

GitHub 官方文件說明：

- 使用 required reviewers 的 Environment job 會等待人工核准，核准後才開始
  執行並取得 Environment 能力：
  <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments>
- GitHub Actions OIDC token 是短效簽章 JWT，可帶 issuer、audience、subject、
  token ID、有效期間、Repository、Repository ID、ref、commit SHA、
  Environment、Workflow 與 run identity：
  <https://docs.github.com/en/actions/reference/security/oidc>

因此可以讓「通過受保護 Environment 後才開始的固定 Workflow」取得短效 OIDC
token，再把 exact authorization command 送到未來 Server verifier；不需要新增
一個長期共享 Secret。

## 決策

新增：

`d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server.ts`

Transport 固定為：

```text
GitHub protected Environment job
→ short-lived GitHub Actions OIDC token
→ one strict attestation envelope
→ future Server verifier
→ existing authorization Port
```

### OIDC 只證明可信任執行來源

未來 Server 必須驗證：

- GitHub OIDC signature。
- 固定 issuer：
  `https://token.actions.githubusercontent.com`。
- 固定 audience：
  `urn:tsu-waterbottle-site:ai-chart-runtime-activation`。
- `exp`、`iat`、`nbf` 與 `jti`。
- Repository name、Repository ID 與 owner ID。
- 專用 `ai-chart-production-runtime` Environment。
- `refs/heads/main`。
- exact Release commit SHA。
- 固定 Workflow identity 與 Workflow source SHA。
- protected Environment source contract。

GitHub 現在同時存在 name-based 與包含 immutable Repository ID 的 subject
格式，所以不能把舊的 name-only `sub` 字串硬編碼成唯一真相。Contract 要求
驗證 `sub` 與 Environment context，同時使用獨立的 `repository_id`／owner ID
等固定 claim 完成來源綁定。

OIDC token 不用來保存 reviewer 身分，也不輸出 provider claims、approval proof
或 provider message。Raw token 只能放在未來 request 的 Authorization Bearer
header，不能放進 JSON、log、database、error 或回傳值。

### Exact command 綁定

Attestation envelope 只能包含：

- GitHub Environment source contract version／fingerprint。
- Authorization Port contract version／fingerprint。
- ADR 0076 定義的 exact authorization command。
- 該 command 的 canonical fingerprint。

Server 仍須逐欄驗證 Release commit、Migration version／SHA、Migration readiness
fingerprint、Runtime policy version 及 authorization scope。OIDC 身分不能取代
command 驗證，command 也不能取代 OIDC 簽章與來源驗證。

### 原子防重播

未來 replay key 必須至少綁定：

```text
jti
repository_id
run_id
run_attempt
sha
authorizationCommandFingerprint
```

Server 必須依 ADR 0079，以 durable、atomic、exact-once 的單一操作建立 replay
claim 與固定 authorization receipt；既有資料只能在兩個唯一鍵及所有 receipt
欄位逐項相同時回傳 exact existing。不能先查 replay key 尚未使用再寫入，也
不能以記憶體 Set、可重試 HTTP 或「最後一次成功」狀態代替。

同一 token、Workflow run、Release 或 command 的重送都不能再次建立權限。
Transport 不自動 retry；結果不確定時必須停止並查 durable receipt，不能盲目
重送。

## 安全邊界

- Environment 必須啟用 prevent self-review。
- 必須禁止 administrator bypass。
- Deployment branch policy 只能是 main。
- OIDC transport 不要求 long-lived shared Secret 或 Environment Secret。
- Request body 不允許自由文字、reviewer、proof、token、provider payload 或
  Runtime boolean。
- Transport output 仍只能進入 ADR 0076 的小 Port，不能直接修改 Runtime policy。
- Source metadata、transport Contract 或其 fingerprint 本身都沒有授權效力。

## 驗證

- Token claims、attestation envelope fields、verification checks 與 replay key
  inputs 都是 fixed、deep-frozen allowlist。
- Contract fingerprint 由 canonical metadata deterministic 產生。
- Contract 綁定 ADR 0076 Port 與 ADR 0077 source contract fingerprints。
- Source tests 驗證 self-review、administrator bypass 與 main-only protection。
- Transport source 不讀 Environment／Secret、不請求 token、不呼叫 GitHub API、
  不提供 endpoint、不連線資料庫、不啟用 Runtime、不交付 Report，也不發送
  OpenAI request。

## 後果

- 未來正式傳遞不再需要長期共享 Secret，且不能由任意 GitHub Workflow 冒充。
- OIDC token 本身是短效來源證明，不是 durable Runtime activation state。
- ADR 0079 已完成 durable atomic authorization receipt 的最小資料、雙唯一鍵、
  replay／reconciliation 語意及 Runtime read seam declaration；ADR 0080 的
  offline atomic receipt adapter probe 已驗證這些公開行為。Probe 不具 durable
  storage 權威；下一步只能先設計 storage schema 與 production adapter，不得
  實作 transport endpoint 或把 Runtime policy 改為 active。
- 建立／修改 GitHub Environment、OIDC 設定、Workflow、權限、正式 database
  schema、Secret、合併或部署仍須依當次任務取得相應明確授權。
- Runtime、GitHub API、Environment／Secret read、database connection、Report
  mutation、customer delivery 與 OpenAI request 仍全部為零。
