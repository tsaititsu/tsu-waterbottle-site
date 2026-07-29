# ADR 0053：以單次 handoff 驗證人工審查授權邊界

## 狀態

Accepted

## 背景

ADR 0052 已把人工選擇固定為未授權 proposal，但還沒有 reviewer session 與
permission 的安全 adapter 邊界。直接讓 caller 傳入 `reviewerId`、`authorized=true`
或可複製的 authority 欄位，會讓一般 server caller 冒充可信任人工審查者。

目前尚未選定正式登入、權限與審查紀錄儲存實作，因此這一層不能假裝已完成
Production authorization，也不能提前建立正式紀錄或解除客戶交付阻擋。

## 決策

新增
`d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server.ts`，建立只允許
canonical test environment 使用的 injected authorization adapter probe。Probe
只把以下固定 metadata 交給 fake adapter：

- Proposal、Gate、restricted artifact 與完整 payload fingerprints。
- `APPROVED`／`REPAIR_REQUIRED`／`REJECTED` 與固定 issue codes。
- 固定 permission：
  `AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW`。

不交付 restricted artifact 正文、Prompt、命盤、出生資料、reviewer ID、notes、
Secret 或任何 caller 自訂權限字串。Adapter outcome 必須逐欄綁回同一 proposal、
Gate、artifact 及 payload，session 固定為 `VERIFIED`、permission 固定為上述唯一
值；未知欄位、漂移、例外或錯誤權限都收斂成 frozen 固定錯誤。

通過後只建立：

- `OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY`
- `SYNTHETIC_AUTHORIZED_NOT_PRODUCTION`
- `SYNTHETIC_VERIFIED`
- `SYNTHETIC_GRANTED`

這些值明確表示離線測試，不是真實 reviewer authorization。

## 單次能力

Handoff 的能力只存在 module-private `WeakMap`，以原始物件 identity 綁定。
Shallow copy、`structuredClone`、JSON 往返或欄位相同的物件都沒有能力。
合法 handoff 只能消耗一次；兩個並行 consumer 最多一個成功，第二個取得固定
already-consumed error。

消耗成功仍固定：

- `persistenceStatus=NOT_RECORDED`
- `formalReviewRecordAllowed=false`
- `productionCallable=false`
- `customerDeliveryStatus` 沿用 proposal 的阻擋狀態
- `nextRequiredAction=IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_ADAPTER`

## 安全邊界

- 本層沒有 filesystem、資料庫、fetch、OpenAI、Secret、會員 session 或權限查詢。
- Fake adapter 只可在 `NODE_ENV=test` 注入；其他環境在 invocation 前拒絕。
- Handoff 不是正式 review record，也不是 delivery permit。
- 即使 proposal 為 `APPROVED`，仍不能交付客戶。
- 本層沒有讀取真實 restricted artifact 或任何使用者資料。

## 後果

- 未來正式 adapter 的最小輸入、固定權限、binding 與單次消耗語意已可離線回歸。
- 真正登入／session 驗證、正式 permission source、不可覆寫審查紀錄 writer 與
  客戶交付狀態機仍必須分開設計。
- 後續不能把 synthetic probe 的成功結果序列化後當成 Production authority。
