# TSU Core Systems Convergence Skill Runbook

SOL 模式：極高

Codex 任務等級：Program／雙核心系統完整收斂

目前狀態：`WAITING_FOR_FIRST_SOURCE_SYSTEM`

## 1. 文件目的

本文件記錄未來整合「金流交易系統」與「命理 AI／來源驗證系統」時，Matt Pocock Skills 的使用方式、架構原則、施工順序、驗證門檻與停止條件。

這是一份規劃與交接文件，不代表已開始修改雙核心系統，也不構成 Production、正式資料庫、付款、Secret、合併 main 或正式部署授權。

這項工作應定位為既有系統的「收斂、補強與整合」，不得重新建立第二套平行的付款、退款、訂單、權益或 AI 來源驗證架構。

## 2. 分層開始條件

這項 Program 採兩個不同 Gate，不要求所有獨立施工都等待兩套系統完成。

### 2.1 單系統工作 Gate

金流或命理 AI 任一系統符合下列條件，即可先處理該系統內部的收斂與補強：

1. 該來源系統的 PR 已合併至最新 `main`。
2. 已知該系統的 merge commit、最終檔案範圍、Migration 狀態與測試證據。
3. 必要 checks 已成功，沒有未解決的安全阻擋。
4. 工作內容不依賴另一套尚未完成的系統。
5. 已確認不會覆蓋其他聊天室的未提交成果。
6. 已建立該工作流專用 worktree 與獨立 `codex/*` 分支。

因此，金流先完成時，可以先進行 Payment／Order／Refund／Reconciliation／Audit／Admin Operations；命理 AI 先完成時，也可以先進行 canonical source／validation／privacy／report／Admin Operations。

### 2.2 跨系統收斂 Gate

只有下列條件全部成立，才開始 Entitlement 與完整端到端整合：

1. 金流系統已合併至最新 `main`。
2. 命理 AI／來源驗證系統已合併至最新 `main`。
3. 兩套系統各自的單系統 Release Gate 已通過。
4. 權益消耗、退款後權益、AI 失敗補償等商業規則已確認。
5. 使用者明確告知：「金流與命理 AI 已完成並已合併 main，可以開始跨系統收斂。」

如果某一來源系統只是 Ready、尚未合併，該系統只能先做唯讀盤點；不得建立依賴未合併分支的 release-ready PR。

## 3. Matt Pocock Skills 路由

依 `matt-pocock-router` 原則，每個階段只使用最小且最符合當下目的的 Skill，不一次載入整套流程。

| 階段 | Skill／流程 | 使用目的 | 產出 |
| --- | --- | --- | --- |
| Program 導航 | `$wayfinder` | 建立全局工作地圖、依賴、順序與停止條件 | Workstream 與 PR DAG |
| 領域收斂 | `domain-modeling` | 統一訂單、付款、退款、履約、權益與 AI 驗證語言 | 候選 glossary、invariants |
| 架構設計 | `codebase-design` | 找出深模組、介面、adapter 與跨系統 seam | Target architecture、gap map |
| 商業規則釐清 | `$grill-with-docs` 或 `grilling` | 釐清無法從程式與文件證明的規則 | 明確決策與未決事項 |
| 規格定稿 | `$to-spec` | 將確認過的架構與規則整理成可驗收規格 | Implementation spec |
| 工作拆分 | `$to-tickets` | 將規格拆成可獨立驗證的 tracer-bullet tickets | Tickets、依賴與驗收條件 |
| 實作 | `tdd` | 以 RED → GREEN → REFACTOR 完成每個安全切片 | 測試、最小實作、回歸證據 |
| 疑難診斷 | `diagnosing-bugs` | 處理不明失敗、競態或效能退化 | 根因與可重現證據 |
| 不確定性驗證 | `prototype` | 只用拋棄式實驗驗證高風險假設 | 決策證據，不進正式程式 |
| 固定差異審查 | `code-review` | 對固定 base/head 做安全與架構審查 | Reviewer findings |
| Main 同步衝突 | `resolving-merge-conflicts` | 僅在已授權同步 main 且真的衝突時使用 | 受控解衝突證據 |
| 跨聊天室交接 | `$handoff` | 固定 base/head、worktree、測試與未決事項 | 可恢復的 handoff |
| 依 tickets 施工 | `$implement` | 依已核准 tickets 執行 | 實作進度與驗收紀錄 |

`$wayfinder`、`$grill-with-docs`、`$to-spec`、`$to-tickets`、`$handoff`、`$implement` 是使用者明確呼叫的上游流程。Codex 可以建議何時使用，但不得假裝已自動呼叫。

## 4. 建議的 Skill 使用順序

### 4.1 來源系統尚未完成：現在

1. 使用 `codebase-design` 定義未來需要檢查的 Module、Interface、Adapter 與 Seam。
2. 使用 `domain-modeling` 列出候選領域詞彙與狀態邊界。
3. 只保存 Runbook，不建立最終 `CONTEXT.md`、ADR 或實作 tickets。
4. 哪一套來源系統先合併，就先啟動該系統的獨立工作流。
5. 跨系統 Entitlement 整合仍等待兩套來源系統都合併。

### 4.2 任一來源系統完成：先做單系統收斂

1. 建議使用者明確呼叫 `$wayfinder`。
2. 固定最新 main、該來源 merge commit 與檔案範圍。
3. 唯讀盤點該系統既有 Module、API、資料表、RPC、Migration、adapter、canonical assets 與測試。
4. 使用 `domain-modeling` 比對程式中的實際語言與狀態機。
5. 使用 `codebase-design` 產出 target architecture 與 gap map。
6. 對無法由程式證明的商業規則，建議呼叫 `$grill-with-docs`。
7. 只施工該系統內部能力，不提前建立另一系統的替身或平行架構。

### 4.3 規格與 tickets

1. 商業規則確認後，建議呼叫 `$to-spec`。
2. 規格穩定後，建議呼叫 `$to-tickets`。
3. 每個 ticket 必須是一個可獨立驗證、可回滾、沒有跨聊天室檔案重疊的切片。
4. 每個實作 ticket 使用 `tdd`。

### 4.4 審查與交付

1. 對固定 base/head 使用 `code-review`。
2. Reviewer A 負責付款、資料庫、競態、idempotency 與 transaction。
3. Reviewer B 負責 AI、來源綁定、隱私、應用層與跨系統資料邊界。
4. 若需同步 main，僅在取得對該次同步的授權後進行；發生衝突才使用 `resolving-merge-conflicts`。
5. 跨聊天室或暫停時，建議呼叫 `$handoff` 固定證據。

## 5. Canonical Domain Model

### 5.1 金流與交易

下列狀態必須分開，不得共用一個狀態欄位：

- `OrderState`
- `PaymentState`
- `RefundState`
- `FulfillmentState`
- `EntitlementState`

其他必要領域物件：

- `ProviderEvent`
- `ProviderOperation`
- `ProviderCapability`
- `IdempotencyRecord`
- `OutboxEvent`
- `ReconciliationCase`
- `AuditEvent`

初步 invariant：

1. Provider 通知必須先通過真實簽章／來源驗證與 idempotency。
2. Provider 成功不等於本地交易一定成功；兩者不可能由單一 PostgreSQL transaction 原子涵蓋。
3. 本地付款、訂單、權益與稽核更新應在單一資料庫 transaction 中完成。
4. 郵件與其他外部副作用應透過 outbox。
5. Provider 成功但本地失敗時必須進入 reconciliation，不得假裝已回滾 Provider。
6. Refund 不得塞入 OrderState；部分退款、全額退款與退款失敗由 RefundState／金額欄位表達。
7. Provider adapter 依能力宣告，不強迫不支援的 capture、cancel 或 refund 方法。

### 5.2 命理 AI 與來源驗證

候選領域物件：

- `CanonicalSource`
- `SourceRegistrySnapshot`
- `AnalysisSubject`
- `AnalysisItem`
- `AnalysisPlan`
- `ModelResponseEnvelope`
- `SourceBoundClaim`
- `DerivedCoverage`
- `ValidationResult`
- `ValidatedReport`
- `RetentionRecord`

初步 invariant：

1. 沿用既有 K0／P1／canonical assets 與 source-bound validators，不建立第二套來源 registry。
2. `subjectId` 與分析 slots 由伺服器建立；模型只能針對允許的 handle 輸出結論。
3. 原始 prompt、原始 Provider response 與通過驗證的使用者報告必須分開定義。
4. 原始敏感 response 預設不持久保存；若產品需要保存報告，只保存通過 schema、來源與隱私檢查的 `ValidatedReport`。
5. Derived coverage 必須由可驗證資料推導，不接受模型自行宣稱覆蓋完整。
6. 來源引用必須綁定 canonical registry snapshot，不能接受任意 URL 或自由文字來源。

領域詞彙在來源系統完成前都只是候選項。只有程式、文件與商業規則一致後，才由 `domain-modeling` 更新正式 glossary；不要提前製造另一份互相衝突的詞彙表。

## 6. Target Architecture

### 6.1 Payment System 深模組

- Order Module
- Payment Module
- Refund Module
- Entitlement Module
- Provider Adapter Seam
- Provider Event Inbox Module
- Transaction Coordinator Module
- Outbox Module
- Reconciliation Module
- Audit Module

Provider adapter 的 Interface 應小而穩定，Implementation 吸收各 Provider 的簽章、欄位與能力差異。不得讓 Provider 專屬欄位散落到 Order、Entitlement 或 UI。

### 6.2 Astrology AI 深模組

- Chart Normalization Module
- Canonical Source Registry Module
- Analysis Plan／Input Builder
- Model Transport Adapter
- Source-bound Validation Module
- Coverage Derivation Module
- Validated Report Module
- Privacy／Retention Module

模型 transport、來源驗證與產品報告必須是不同 Module，避免「Provider 回應成功」被誤當成「內容已通過產品安全合約」。

### 6.3 跨系統 Seam

Payment 與 Astrology AI 只透過 `Entitlement` seam 整合：

```text
Verified Provider Event
  → Payment／Order local transaction
  → Entitlement granted
  → Outbox event
  → AI analysis becomes available
```

不得讓 AI 直接依賴付款 Provider callback，也不得讓 Provider adapter 直接寫入 AI 分析資料。

## 7. 必須先確認的商業規則

下列規則若無法由現有程式與文件證明，必須停下來詢問：

1. 權益在付款成功、首次開啟、開始分析或分析完成的哪個時間點消耗。
2. 權益已使用後是否允許全額退款、部分退款或僅人工例外。
3. 部分退款是否撤銷部分權益；若可，映射規則為何。
4. Provider 已成功但本地建立權益失敗時，營運處理 SLA 與自動補償方式。
5. 退款、取消訂單、付款失敗與履約失敗的顯示及狀態對應。
6. AI 驗證失敗時是否重試、退還權益或轉人工處理。
7. ValidatedReport 的保存期間、刪除規則與會員可見範圍。

## 8. 施工 Phase 與 Gate

### Phase 0：來源凍結與唯讀盤點

- 固定最新 main 與兩套來源 merge commits。
- 建立獨立 worktree／branch。
- 盤點實際架構、資料庫、Migration、測試、契約與部署狀態。
- 產出 source map、gap map 與風險清單。

Gate：來源內容與範圍可證明，沒有未保存或來源不明修改。

### Phase 1：Domain 與商業規則收斂

- 使用 `domain-modeling` 對齊領域語言。
- 確認狀態機與 invariants。
- 對未決商業規則進行人工確認。

Gate：不再有會改變資料模型或交易語意的未決問題。

### Phase 2：Target Architecture 與 PR DAG

- 使用 `codebase-design` 定義深模組與 seam。
- 建議呼叫 `$to-spec` 與 `$to-tickets`。
- 決定 Migration、相容期、roll-forward 與 rollback 策略。

Gate：每個 ticket 都有固定範圍、測試、停止條件與依賴。

### Phase 3A：Payment TDD

依序建議：

1. Provider event inbox uniqueness／idempotency。
2. 簽章與 callback fixtures。
3. Order／Payment／Refund／Fulfillment 狀態邊界。
4. 本地 transaction 與 Entitlement。
5. Outbox。
6. Reconciliation。
7. Audit。
8. Admin read model。

### Phase 3B：AI TDD

依序建議：

1. 固定 `subjectId`／analysis slots。
2. canonical registry snapshot。
3. source-bound claim allowlist。
4. schema 與 content validation。
5. derived coverage。
6. privacy／retention。
7. validated report。
8. failure／retry／entitlement policy。

### Phase 3C：跨系統整合

- 只透過 Entitlement 與 outbox 整合。
- 驗證付款成功、本地失敗、重送、退款、權益消耗與 AI 失敗矩陣。
- 不對真實 Provider、OpenAI 或 Production 發請求。

### Phase 4：Migration 與資料庫驗證

- 使用本機 PostgreSQL 17 或核准的離線測試環境。
- 覆蓋 constraint、function identity、RPC、idempotency 與 concurrent mutation。
- Migration 規劃採 roll-forward 與可驗證 rollback strategy，不為了形式要求破壞性的 down migration。

### Phase 5：Release Gate

至少執行：

```bash
npm test
npm run test:ai-chart
npm run typecheck -- --incremental false
npm run lint
npm run build
git diff --check
```

另加：

- Payment／Refund／Order／Entitlement focused tests
- Provider fixture 與 signature tests
- PostgreSQL 17 concurrency／mutation matrix
- AI canonical source／validation／privacy tests
- Cross-system entitlement integration tests
- Runtime isolation regression

禁止用會下載臨時套件的指令取代專案既有工具。

### Phase 6：Reviewer A／B

- Reviewer A：Payment、DB、transaction、idempotency、concurrency、reconciliation。
- Reviewer B：AI、source binding、privacy、retention、application boundary。
- 只修正本任務範圍內的 P0／P1／merge-blocking P2。
- 無關的既有 P2 記為 follow-up，不在本任務擴張處理。

### Phase 7：受控同步 main

- 重新鎖定最新 main。
- 只有取得該次同步授權後，才以非破壞性 merge commit 同步。
- 發生衝突立即停止；不得自行 reset、rebase、stash 或略過衝突。
- 同步後重跑完整 Release Gate 與 Reviewer A／B。

### Phase 8：PR 與等待部署

- 精確 Stage 任務檔案。
- 中文 commit 與 PR。
- 僅使用 `codex-safe-push`。
- 建立 Draft PR，更新審計說明與 Preview metadata。
- Checks 完成後才評估 Ready。
- 停在 Ready／人工合併前；不得自動合併或部署。

## 9. PR 策略

因金流與 AI 來源系統可能在不同時間完成，未來不得再重建一組平行的 PR-A／PR-B。

優先策略：

1. 金流先合併時，可從最新 main 建立 Payment hardening／Admin Operations PR。
2. 命理 AI 先合併時，可從最新 main 建立 AI hardening／Admin Operations PR。
3. 每個 PR 只能修改已完成來源系統內部的能力，不得依賴未合併分支。
4. 兩套系統都合併後，再從最新 main 建立 Entitlement integration branch。
5. 以小而明確的整合 PR 完成跨系統補強。

若唯讀 gap analysis 證明差距過大且完全獨立，最多先拆成：

- Payment hardening PR
- AI hardening PR

兩者都合併 main 後，再建立 Entitlement integration PR。不得把 stacked PR 當成可直接對 main 發布的完整成果。

## 10. Evidence 與 Handoff 紀錄

每個 Phase 必須記錄：

- 固定 main SHA
- branch 與 worktree
- source merge commits
- head SHA
- changed files
- Migration 路徑、identity 與 SHA-256
- 測試指令、結果與數量
- PostgreSQL 版本與 matrix
- Provider／OpenAI 真實 requests 數量
- Production connection／mutation 狀態
- Reviewer findings
- 暫時資源與 cleanup
- PR URL、Draft／Ready、checks、Preview commit
- 未決問題與停止原因

只在有意義的 Phase Gate 回報，不必每個微小指令都產生報告；遇到 blocker 必須立即回報，不得等到最終才揭露。

## 11. 永久與任務停止條件

遇到下列任一情況停止：

- 來源系統尚未合併或固定 SHA 改變。
- worktree／branch 與其他聊天室共用。
- 出現來源不明的已追蹤修改。
- 必須讀取 Secret、`.env` 或敏感個資才能繼續。
- 需要連線或修改 Production。
- 需要執行正式付款、退款或 Provider 真實呼叫。
- 需要修改登入、角色、RLS 或管理員權限，但未取得當次授權。
- 出現真正 uncaught mutation、錯誤 safety assertion 或 cleanup failure。
- 商業規則未確認且會影響資料模型、交易或權益。
- 需要合併 main 或正式部署，但尚未取得當次明確授權。

## 12. 目前 Admin 基線

截至 2026-08-05 的 `origin/main` `e3c907d6cfd68b80671b2b8991b35ed0532348e0`：

- Admin Foundation 與後端管理員 Session 守門已存在。
- 已啟用唯讀模組：預約紀錄、商品訂單、會員名錄、歷史匯款回報。
- 已存在預約時段工具。
- `AI 命盤營運中心` 與 `占卜營運中心` 都只是 `unavailable` 狀態項目，沒有 href、操作按鈕或完整管理 API。
- `/api/admin/divination-one-dollar-test` 只提供經管理員授權後的一元測試模式狀態，不等於占卜營運後台。

因此，目前不能宣稱占卜系統後台或 AI 命盤營運後台已建立完成。未來應在各自來源系統合併後，依實際資料模型建立最小、後端重新授權、預設唯讀的營運頁面；不得先建立假資料或無後端權限檢查的空殼操作。

## 13. 下一步

目前保持：

```text
TSU_CORE_SYSTEMS_CONVERGENCE_WAITING_FOR_FIRST_SOURCE_SYSTEM
```

金流先完成並合併後，使用者可直接說：

```text
金流系統已完成並已合併 main，可以先開始 Payment 單系統收斂；命理 AI 尚未完成，不做跨系統整合。
```

命理 AI 先完成並合併後，也可用相同方式啟動 AI 單系統收斂。

兩套來源系統都完成並合併後，使用者可直接說：

```text
金流與命理 AI 已完成並已合併 main，可以開始 TSU_CORE_SYSTEMS_CONVERGENCE_V1 跨系統收斂。
```

若某套系統只是 Ready、尚未合併，請明確說明；該系統下一輪只會先做唯讀盤點，不會開始實作。
