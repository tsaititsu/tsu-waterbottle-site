# 測試與交付規範

## 1. 靜態檢查

先查看 package.json，只執行實際存在的指令。

可能包含：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

規則：

- 不存在的指令不可執行。
- 未執行的測試不可寫成已通過。
- 指令失敗時要修正或明確回報。
- 不可刪除測試來讓流程通過。
- 不可關閉 TypeScript 或 Lint 規則來掩蓋問題。

### Canonical offline tests

Repository 的完整本機離線 unit／static suite 統一使用：

```bash
npm test
```

此入口只從 Git tracked files 發現允許目錄內的 TypeScript／TSX tests，並以
Repository-relative POSIX path、UTF-8 byte order、duplicate 與 empty-suite
fail-closed 規則逐檔循序執行。非 TypeScript contract 必須進入 runner 內的
明確 offline allowlist；focused scripts 仍保留，但不會由 canonical runner
再次呼叫而重複執行相同 TypeScript tests。

`npm test` 不包含：

- lint
- typecheck
- build
- audit
- Docker 或 PostgreSQL integration
- Migration、fixed psql runner 或 deployment validation
- Preview／Production smoke
- OAuth、OpenAI、Supabase 或付款服務的 live request

正式修改仍應分別執行：

```bash
npm test
npm run lint
npm run typecheck -- --incremental false
npm run build
```

可使用下列唯讀模式檢查 deterministic execution manifest；它不會執行 tests：

```bash
node scripts/test/run-tests.mjs --list
```

### AI 命盤 canonical tests

AI 命盤 assertion tests 的唯一正式指令是：

```bash
npm run test:ai-chart
```

此指令固定使用 Node `24.16.0` 與 exact `tsx@4.23.1`，由
`scripts/ai-chart/run-tests.mjs` 遞迴發現 `src/lib/ai-chart/**/*.test.ts`。
Runner 逐字驗證 `process.versions.node === '24.16.0'`；patch 或 minor 版本漂移
都會 fail closed。
Runner 只接受 regular file、拒絕 symlink，以 Repository-relative path 做
deterministic 排序與去重，逐檔循序執行並 fail fast。Runner contract 目前固定
驗證 Repository 應發現 26 個測試檔；新增或移除測試時必須明確更新 contract，
不得在 Workflow 另建人工檔案清單。

每個測試 child process 固定使用 `NODE_ENV=test`，並移除以下環境變數：

- `OPENAI_API_KEY`
- `OPENAI_AI_CHART_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_ORG_ID`
- `OPENAI_PROJECT_ID`
- `AI_CHART_D1_P1_PREVIEW_ENABLED`
- `AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID`
- `AI_CHART_D1_P1_PREVIEW_PLAN_FINGERPRINT`
- `AI_CHART_D1_P1_PREVIEW_CONFIRM`
- `VERCEL`
- `VERCEL_ENV`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `NODE_OPTIONS`
- `TSX_TSCONFIG_PATH`

Implementation 與 contract 共用上述單一 canonical removed-key list；contract
會為每個 key 注入 synthetic value，並以真實 child probe 驗證全部移除、
`NODE_ENV=test`、無關安全變數保留，且原始 environment 不被修改。測試只可
使用 synthetic fixture、mock request 或 mock fetch，不得發送 OpenAI request、
連接 Supabase 或使用真實客戶資料。Runner 不輸出被移除環境變數的值、長度、
hash、prefix、suffix 或 masked value。

Assertion tests 與 TypeScript typecheck 是不同檢查，交付前必須分別執行：

```bash
npm run test:ai-chart
npm run typecheck -- --incremental false
```

### AI 命盤 Local Preview timeout contract

`AI_CHART_D1_P1_PREVIEW_TIMEOUT_MS` 只可由 Preview Gate contract tests 透過
synthetic environment dependency 注入，不得在測試程序設定真實 Preview
環境，也不得提供 `OPENAI_API_KEY`。測試必須覆蓋預設 `120000`、唯一 override
`300000`、Plan／Bridge／request timeout 一致、fingerprint 與 Authorization
binding、Production／CI／Vercel fail closed、`maxRequests=1`，以及無 retry、
fallback 或第二次 request。Plan build 與 mock execution 的 global fetch sentinel
必須維持 `0`；任何測試都不得發送 OpenAI request。

## 2. 功能測試

說明：

- 測試了哪些流程。
- 使用哪些測試資料。
- 正常情況是否成功。
- 失敗情況是否正確處理。
- 是否測試重複送出。
- 是否測試未登入與權限不足。
- 哪些部分無法自動測試。

## 3. 高風險測試

付款、點數、訂單、登入、管理員、RLS、Migration 至少測試：

- 正常使用者
- 未登入
- 權限不足
- 其他會員
- 管理員
- 重複請求
- 網路或服務失敗
- 資料庫失敗
- 回復方式

不得使用正式付款或正式資料。

## 4. Preview 驗收

Vercel Preview 至少確認：

- 網站可開啟。
- 目標頁面可使用。
- 手機版正常。
- Console 沒有新增錯誤。
- API 沒有 500 錯誤。
- 寫入的是測試資料庫。
- 未使用正式付款。
- 其他相關頁面未被破壞。

Codex無法實際開啟 Preview 時，要清楚標示「未完成視覺驗收」，交由老師檢查。

UI 修改必須另外提供白話驗收卡：

```text
請開啟：哪一個 Preview 頁面
請操作：按哪個按鈕、輸入什麼或滑到哪裡
預期看到：正確畫面與結果
手機版：已確認／未確認
桌面版：已確認／未確認
已知限制：
```

## 5. Git 檢查

提交前執行：

```bash
git status
git diff
git diff --cached
```

確認：

- 只有本任務相關檔案。
- 沒有 `.env`。
- 沒有真實資料。
- 沒有建置產物或不必要檔案。
- 沒有大範圍格式化無關程式。
- 沒有意外刪除檔案。

## 6. PR 格式

```text
## 任務分類
- SOL 模式：中／高／極高
- Codex 任務等級：中／高／極高
- PR 合併風險：低風險／UI 風險／高風險

## 改了什麼
-

## 白話摘要
- 使用者會看到什麼不同：
- 會影響誰：

## 為什麼修改
-

## 測試結果
- lint：
- typecheck：
- test：
- build：
- 手動測試：

## 可能風險
- PR 合併風險：低風險／UI 風險／高風險
- 是否碰到登入或權限：否／是
- 是否碰到資料庫或正式資料：否／是
- 是否碰到付款、點數或訂單：否／是
- 是否碰到環境變數：否／是
- 最壞情況：

## 回復方式
-

## 合併方式
- auto-merge：可以／不可以／Repository 尚未設定
- 等待使用者確認：是／否

## 請老師檢查
- Preview 頁面：
- 操作步驟：
- 預期結果：
```

## 7. 安心模式合併規則

### 低風險

只有同時符合以下條件，才可交由 GitHub 已設定的 auto-merge：

- 不涉及登入、權限、個資、付款、點數、訂單、Webhook、資料庫、環境變數或新增套件。
- Build、相關測試與 Repository 必要 checks 全部通過。
- PR 已附白話摘要、風險與回復方式。
- 沒有秘密、真實個資或無關修改。

GitHub auto-merge 必須由 Repository 事先啟用。Codex 不直接執行 `gh pr merge`；若尚未啟用，只能回報，不可改用直接合併。

### UI 風險

- 必須先提供 Preview 與白話驗收卡。
- 使用者以畫面確認通過後，且其他低風險條件皆符合，才可交由 auto-merge。

### 高風險

- 禁止 auto-merge。
- 必須提供白話風險報告與回復方式。
- 等待使用者明確確認後，再依專案核准流程交付。

## 8. 完成定義

只有符合以下條件才可標記完成：

- 修改範圍正確。
- 程式檢查通過，或已誠實說明不能通過的原因。
- 相關功能已測試。
- 沒有金鑰與真實個資。
- 已提交工作分支。
- 已使用 `codex-safe-push` 推送。
- 已建立 PR。
- 已標示 PR 合併風險與合併方式。
- 任務指令、完成報告與 PR 已標示 SOL 模式及 Codex 任務等級。
- 低風險 PR 僅交由已設定的 auto-merge；UI 已完成人工畫面確認；高風險未自動合併。
