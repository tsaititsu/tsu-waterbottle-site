# ADR 0074：將 Runtime activation authorization 限定於單一 Release

## 狀態

Accepted

目前只有 Server-only、test-only 的離線 authorization handoff contract。沒有
讀取 GitHub Environment、Secret 或環境變數，沒有啟用 Runtime、建立 admin
client、連線 Supabase、套用 Migration、建立 route、交付報告或發送 OpenAI
request。

## 背景

ADR 0073 已證明 Migration readiness 只能來自受控 exact-file runner 的完整
attestation，並把 Runtime policy 固定為：

```text
BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION
```

但「取得使用者明確授權」仍需要可驗證的程式邊界。如果未來只使用一般布林值、
可跨 Release 重用的 token、環境變數或 deployment 成功狀態，舊 Release 的授權
可能被錯套到新程式，或 caller 可能自行聲稱已獲授權。

## 決策

### 授權目標綁定精確 Release

`d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server.ts`
只接受兩個 caller target 欄位：

- 合法 40 字元 lowercase Release commit SHA。
- 已驗證 Migration readiness 的 64 字元 fingerprint。

模組再自行加入固定 feature、Migration version／SHA、Runtime policy version 與
唯一 authorization scope：

```text
ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE
```

Injected authorization boundary 必須逐欄回綁同一組資料。Release drift、
fingerprint drift、未授權、額外 provider payload 或 exception 都使用固定安全
code；不保存 authorizer 身分、訊息、時間、Secret 或任意外部 metadata。

這個 injected outcome 只用來驗證未來系統邊界的形狀，不冒充正式 Production
授權。

### Handoff 權限來自原物件 identity

通過離線 probe 後，模組建立 deep-frozen handoff。公開欄位只供安全診斷；真正
capability 由 module-private `WeakMap` 對原物件 identity 的登記提供。Shallow
copy、structured clone、JSON 重建或另一程序重建都不能取得能力。

原 handoff 最多只能消耗一次；兩個並行 consumer 只有一個成功，第二個取得固定
already-consumed error。消耗後的結果仍固定：

- `runtimeActivationAllowed=false`
- `productionCallable=false`
- `customerDeliveryAllowed=false`
- `databaseConnections=0`
- `reportMutations=0`
- `openAiRequests=0`

因此 synthetic authorization 不等於 Runtime active，也不能建立 admin client。

### Production 與敏感來源保持封鎖

Preparation 只允許在 canonical test environment 執行。Production mode 會在
injected authorization boundary 前拒絕。模組沒有 Supabase client、admin
factory、fetch、Secret、Report writer、route 或 OpenAI dependency，也不允許
caller 傳入 activation boolean。

## 驗證

- Exact Release target 只產生一個 frozen authorization command。
- Invalid SHA、fingerprint、caller activation 欄位在 boundary 前拒絕。
- Denied、Release drift、加料 outcome 與 exception 只回固定安全 code，boundary
  每次最多呼叫一次且不洩漏 provider message。
- Copy／clone handoff 無效；原物件只能消耗一次。
- 兩個並行 consumer 最多一個成功。
- Production mode 在 boundary 前 fail closed，回到 test mode 後可用全新 target
  建立新的 synthetic handoff。
- Source contract 沒有資料庫、transport、Secret、environment override、Runtime
  activation 或 customer-delivery path。

## 後果

- 未來 Runtime activation adapter 只能接受本模組建立的 exact handoff，不能
  接受 caller boolean、可複製 JSON 或舊 Release 的授權。
- 本切片沒有啟用 Runtime，也沒有消耗真實 Production 授權。
- ADR 0075 已把此 exact handoff 綁入既有 blocked Runtime activation adapter
  的離線順序，並以 attested Release commit 與同一次 readiness fingerprint
  雙重重驗；結果仍回傳 inactive。
- ADR 0076 已只宣告正式 authorization Adapter 的 Server-only Port interface，
  並固定 exact command、safe decision、禁止輸出的資料與安全 failure codes；
  正式來源與 implementation 仍不存在。
- 下一步必須先由老師選擇並另行授權正式 Release activation authorization 的
  受控來源；在此之前不得讀取 Secret、改成 active、取得 admin client、連線
  Supabase、建立 route 或交付報告。
