# ADR 0034：以 Server-only Exclusive Create 建立 Preview Claim

## 狀態

Accepted

## 背景

ADR 0033 已固定「授權通過後仍不能 fetch，必須先取得原子 claim」；但純資料 Gate 無法自行證明檔案不存在，也無法解決兩個執行者同時看見 `ABSENT` 的競態。

真正的 claim adapter 必須同時做到：

1. 同一 Gate fingerprint 只有一個執行者成功。
2. 既有 claim 永遠不被覆寫或刪除。
3. 呼叫者不能換 storage root 繞過 claim。
4. symlink、寬鬆權限或異常檔案一律 fail closed。
5. claim 成功後仍不能直接 fetch。

## 決策

新增 `d1PalaceWritingPreviewAtomicClaim.server.ts`，第一行固定載入 `server-only`。

### 固定儲存位置

Adapter 不接受呼叫者提供 storage root。它只使用系統 canonical temporary root 下的固定目錄：

```text
ai-chart-d1-palace-writing-preview-claims/
  <gateFingerprint>/
    request-started.json
```

- storage root 與 fingerprint 目錄必須是目前程序使用者擁有的 regular directory。
- 目錄權限固定為 `0700`。
- symlink、其他檔案類型或寬鬆權限一律拒絕。
- Gate 與一次性授權必須在任何檔案寫入前完成 source-bound 驗證。

### 原子建立

`request-started.json` 只能透過：

```text
open(path, "wx", 0600)
```

建立。`wx` 的 `O_EXCL` 語意是唯一競爭裁決點；不採用「先檢查不存在，再一般寫入」的 TOCTOU 流程。

若檔案已存在：

- regular private file：固定回傳 `ai_chart_d1_palace_writing_preview_claim_already_exists`。
- symlink、目錄、非 `0600` 或非目前使用者擁有：固定回傳 `ai_chart_d1_palace_writing_preview_claim_storage_invalid`。

Adapter 沒有 overwrite、rename、unlink 或 cleanup 路徑。建立後若寫入或 sync 失敗，檔案仍保留並阻擋後續執行；不能為了重試而刪除。

### Sentinel 內容

Sentinel 只保存固定安全欄位：

- Contract／task。
- Gate fingerprint。
- trusted adapter authority。
- claim artifact 名稱。
- `status=CLAIMED`。
- `authorizationConsumed=true`。
- `fetchAllowed=false`。
- `openAiCallable=false`。
- request／fetch／OpenAI 計數全部為零。
- `nextRequiredAction=STOP_BEFORE_REQUEST_RUNTIME`。

不保存授權 acknowledgement、API Key、Authorization header、Prompt、instructions、request body、模型輸出、命盤或出生資料。

### Observation

只讀 observation 不建立 storage root 或 claim。安全檔案不存在時回傳 `ABSENT`；private regular claim 存在時回傳 `PRESENT`。Observation 不讀模型內容，也不授予 fetch 能力。

## 後果

- 真實並行測試證明兩個 claimant 精確一個成功、另一個固定 fail closed。
- 第二次 claim 不會改變 sentinel SHA-256。
- 呼叫者傳入多餘的 storage root 參數不會改變固定儲存位置。
- 本 adapter 沒有 fetch、OpenAI request、retry、fallback、環境秘密或刪除路徑。
- 本切片仍不是 Runner，也沒有任何 request 執行許可。
- 下一個工程切片可建立 server-only pre-request coordinator，把 observe、純 Gate decision 與 atomic claim 串成一份安全診斷；該切片仍須停在 claim 後，不能加入 fetch。
