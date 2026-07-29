# ADR 0052：將人工審查決策先建模成未授權提案

## 狀態

Accepted

## 背景

ADR 0051 已能安全讀回並重驗 restricted model output，但 readback 成功只證明
artifact 完整，不代表內容已由可信任的人員審查。若純資料 builder 可直接產生
「已核准、可交付」狀態，任何 server caller 都可能偽造 reviewer 身分或跳過實際
權限驗證。

## 決策

新增 `d1PalaceWritingPreviewHumanReviewDecisionContracts.server.ts`，先把人工選擇
建模為 server-only、source-bound、不可變的 decision proposal，而不是已授權紀錄。
Builder 必須重新驗證：

- Preview Plan、Gate Plan 與 verified safe Evidence。
- Writing／Fidelity Prompt Packages。
- ADR 0051 的 verified restricted artifact readback。
- Artifact fingerprint、完整 payload SHA 與原始 source binding。

支援三種提案：

- `APPROVED`：不得有 issue code。
- `REPAIR_REQUIRED`：至少一個固定 issue code。
- `REJECTED`：至少一個固定 issue code。

固定 issue codes 為：

- `LANGUAGE_CLARITY_INSUFFICIENT`
- `POSSIBILITY_BOUNDARY_OVERSTATED`
- `SOCIAL_CONTEXT_MISMATCH`
- `SOURCE_FAITHFULNESS_CONCERN`
- `INTERNAL_METADATA_EXPOSED`
- `UNSAFE_OR_UNSUPPORTED_CONTENT`

輸入順序不具語意；輸出依 module-owned 順序 canonicalize，重複或未知代碼拒絕。
不接受自由文字 notes、reviewer ID、caller 提供的 identity／authority 或模型正文
副本。

## 授權與交付邊界

所有提案固定：

- `decisionStatus=PROPOSED_NOT_AUTHORIZED`
- `decisionAuthority=TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED`
- `reviewerIdentityStatus=NOT_VERIFIED`
- `persistenceStatus=NOT_RECORDED`

三種決策都仍阻擋交付：

- `APPROVED` → `BLOCKED_PENDING_TRUSTED_REVIEW_RECORD`
- `REPAIR_REQUIRED` → `BLOCKED_REPAIR_REQUIRED`
- `REJECTED` → `BLOCKED_REJECTED`

即使提案為 `APPROVED`，也不能在本層變成客戶可讀。下一步必須由未來 trusted
human-review adapter 驗證 reviewer session、權限與 artifact binding，再單次記錄
決策。

## 安全邊界

- Proposal 只含 Gate、artifact fingerprints、固定 decision metadata 與 proposal
  fingerprint，不複製 restricted artifact。
- 錯誤固定且 frozen，不回顯自由文字或敏感額外欄位。
- 模組沒有 filesystem、資料庫、Runtime、fetch、OpenAI、權限查詢、寫入或交付能力。
- 本 ADR 不建立 reviewer、session、authorization、persistence 或 delivery release。

## 後果

- 人工審查的語意與安全授權被明確拆成兩層，純資料決策不能冒充已驗證的人員操作。
- 後續可信任 adapter 只能接收本 proposal 與 verified readback，不應再接受自由格式
  decision payload。
- 目前仍只使用 synthetic Golden Case，沒有讀取真實模型輸出或使用者資料。
