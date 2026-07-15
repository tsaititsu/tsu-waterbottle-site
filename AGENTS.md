# 工作守則：tsu-waterbottle-site

## 1. 規範優先順序

1. 使用者在目前任務中的明確指示。
2. 本檔案。
3. 目前工作目錄附近更具體的 AGENTS.md。
4. docs/ 內對應的專項規範。
5. 專案既有程式風格與測試。

若規範互相衝突，停止修改並在結果中指出衝突，不可自行猜測。

## 2. 開始任務前

每次開始工作必須先：

- 執行 `git status`。
- 確認目前不是 main。
- 檢查工作區是否有不明修改。
- 閱讀與本次任務有關的規範。
- 先了解現有架構，不可直接重寫。

新任務使用：

`codex-start-task <任務名稱>`

分支必須是：

`codex/<任務名稱>`

若工作區已有不明修改，停止工作，不得覆蓋、stash、reset 或刪除。

## 3. 任務範圍

- 一次只處理一項明確任務。
- 不得順手修改無關程式。
- 不得因小問題重構整個專案。
- 不得自行更換框架、套件管理器、資料庫或部署平台。
- 發現其他問題時，只能記錄在 PR，不可擴大本次範圍。

## 安心模式與風險分級

Codex 必須先判斷風險，再決定交付方式；無法判斷時一律提高一級，不可自行當成低風險。

### 低風險：可由 GitHub auto-merge

符合以下全部條件才是低風險：

- 不涉及登入、權限、會員個資、付款、點數、訂單或 Webhook。
- 不涉及 Supabase Schema、Migration、RLS、正式資料或環境變數。
- 不新增套件、不更換框架、不大幅重構。
- Build、相關測試與 Repository 必要 checks 全部通過。
- PR 已附白話摘要、風險與回復方式。

低風險 PR 可交由 Repository 已設定的 GitHub auto-merge，在所有必要條件通過後自動合併。Codex 不得直接執行 `gh pr merge`；若 Repository 尚未設定 auto-merge，只能回報未設定，不可繞過。

### UI 風險：先讓使用者看 Preview

畫面、操作流程或手機版變更，即使不碰敏感資料，也必須先提供：

- Preview 網址。
- 手機版與桌面版驗收結果或截圖。
- 白話操作步驟與預期畫面。
- 無法完成的視覺檢查。

使用者確認畫面後，且其他低風險條件皆符合，才可交由 auto-merge。

### 高風險：禁止 auto-merge

登入、權限、管理員、個資、付款、點數、訂單、Webhook、Supabase Migration／RLS、正式資料、環境變數、刪除資料、新增外部服務或重大套件變更，一律視為高風險。

高風險任務必須停止自動合併，提供白話報告，列出「改了什麼、影響誰、最壞情況、測試結果、如何恢復、需要使用者確認什麼」，等待使用者明確決定。

## 4. 專項規範

修改前端、React、Next.js：

- 閱讀前端目錄內的 AGENTS.md。
- 閱讀 `docs/UI_RULES.md`。

修改 Supabase、SQL、Migration、RLS：

- 閱讀 `supabase/AGENTS.md`。
- 閱讀 `docs/SECURITY_RULES.md`。

修改登入、會員、管理員、付款、扣點、訂單、Webhook：

- 閱讀 `docs/SECURITY_RULES.md`。
- 視為高風險任務。

準備完成與交付：

- 閱讀 `docs/TEST_RELEASE_RULES.md`。

大型任務：

- 先依 `docs/TASK_PLAN_TEMPLATE.md` 建立計畫。

## 5. 禁區（最高規則）

- 不讀取、不修改、不輸出 `.env*` 內容；不在任何地方寫入真實金鑰。
- 不直接使用 `git push`（一律走受控腳本）；不得直接使用 git push 推送 main；只有在使用者明確要求部署，且通過受控部署檢查時，才能使用 codex-safe-release。不強推。
- 不直接執行 `gh pr merge`，不自行關閉 PR；只有符合安心模式低風險條件時，才可交由 Repository 已設定的 GitHub auto-merge 處理。
- 不直接操作正式 Supabase 資料；不執行正式付款。
- 不使用 `git reset --hard`、`git clean`、`rm -rf`。
- 不使用 `--yolo` 或 danger-full-access。

涉及登入、會員、個資、付款、點數、訂單、Webhook、環境變數或資料庫的完整規定，一律以 `docs/SECURITY_RULES.md` 為唯一出處，不在本檔重複。

## 受控正式部署例外

只有使用者在目前任務中明確要求「部署」時，Codex 才能執行正式發布。

正式發布必須同時符合：

- 目前分支是 main。
- 使用者指定要部署的完整 commit hash。
- HEAD 與指定 commit 完全一致。
- 沒有已追蹤檔案異動。
- 沒有 staged 檔案。
- Build 與本次直接相關測試已通過。
- origin/main 可以 fast-forward 到目前 HEAD。
- 不包含 SQL、環境變數、正式付款或資料庫寫入操作。

部署時只能使用：

`codex-safe-release <完整 commit hash>`

仍禁止直接使用 `git push`、force push、刪除 main 或 Vercel CLI `--prod`。

未追蹤文件可以存在，但必須列出且不得 stage。

## 6. 程式品質

- 優先修正根本原因，不用臨時遮掩錯誤。
- 不可為了通過型別檢查而大量使用 `any`、`@ts-ignore` 或關閉規則。
- 不可吞掉錯誤後假裝成功。
- 優先沿用現有元件、函式與設計系統。
- 新增套件前必須說明用途、必要性、風險與替代方案。
- 不可自行大幅升級套件版本。

## 7. 完成標準

依專案實際存在的指令執行：

- lint
- typecheck
- test
- build

不得聲稱執行過不存在或未執行的測試。

完成後必須：

1. 檢查 `git diff`。
2. 確認沒有金鑰、測試個資或無關檔案。
3. 使用中文提交訊息。
4. 使用 `codex-safe-push` 推送。
5. 建立 PR。
6. 標示風險等級。
7. 低風險依安心模式交由已設定的 auto-merge；UI 先等使用者確認 Preview；高風險不得 auto-merge。

## 8. PR 內容

PR 必須使用中文，至少包含：

- 改了什麼
- 為什麼修改
- 測試結果
- 可能風險
- 回復方式
- 請老師在 Preview 檢查哪一頁、哪個操作
- 風險等級：低風險／UI 風險／高風險
- 是否符合 auto-merge 條件

若無法取得 Preview 網址，要明確說明，不可假裝已檢查。
