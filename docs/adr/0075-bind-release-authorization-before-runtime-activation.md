# ADR 0075：在 Runtime activation 前綁定精確 Release 授權

## 狀態

Accepted

目前只有 Server-only、test-only 的離線整合。它會消耗 ADR 0074 的
synthetic authorization handoff，但仍固定回傳 Runtime inactive。沒有讀取正式
Environment／Secret、建立 admin client、連線 Supabase、套用 Migration、讀寫
Report／Artifact、建立客戶 route 或發送 OpenAI request。

## 背景

ADR 0073 已把 Migration readiness 綁到受控 exact-file deployment
attestation，ADR 0074 又把 Runtime activation authorization 綁到單一 Release
commit 與該次 Migration readiness fingerprint。兩個邊界原本仍各自獨立：
readiness adapter 只看 blocked static policy，沒有消耗 authorization handoff；
handoff 消耗後也尚未重驗 deployment attestation 的 Release commit。

如果不把兩者接在同一順序，合法但屬於另一個 Release 或另一份 readiness
outcome 的 handoff 仍可能被錯誤帶入 Runtime verifier。

## 決策

### Runtime verifier 必須消耗原始 handoff

`d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server.ts` 的 factory
現在精確要求兩個 dependency：

1. `verifyControlledDeploymentMigrationAttestation`
2. `runtimeActivationAuthorizationHandoff`

第二個 dependency 必須是 ADR 0074 模組建立的原始物件。Copy、clone、JSON
重建、已消耗物件或任意相似物件都由 module-private identity registry 拒絕。

### 固定順序與雙重綁定

離線流程固定為：

1. 驗證 module-owned Migration command。
2. 單次取得並驗證 controlled deployment attestation。
3. 保存 attestation 的 exact `sourceCommitSha`。
4. 建立 canonical Migration readiness response 與 fingerprint。
5. 驗證既有 Runtime activation command。
6. 單次消耗原始 release-scoped authorization handoff。
7. 重驗 handoff 的 Release commit 等於 attested source commit。
8. 重驗 handoff 的 Migration readiness fingerprint、feature、Migration identity
   與 Runtime policy version 全部等於本次 module-owned 值。
9. 仍回傳 `INACTIVE`，讓既有 Production binding readiness 以
   `RUNTIME_NOT_ACTIVE` 在 `getSupabaseAdmin()` 前停止。

Migration attestation 失敗或 Runtime 在 Migration 前被呼叫時，不消耗 handoff。
一旦 handoff 已進入 Release／fingerprint binding 驗證，即使發現 drift 也視為
本次單次能力已使用，不允許用同一授權重試另一個 Release。

### Policy ownership 獨立

為避免 readiness adapter 與 authorization handoff 形成循環 import，固定 blocked
policy 搬到：

`d1PalaceWritingTrustedDeliveryRuntimeActivationPolicy.server.ts`

Policy version、feature、blocked 狀態與 caller／environment override 禁止規則都
維持不變；新模組只提供單一 module-owned source of truth，不新增 activation
入口。

### 固定安全失敗

Adapter 只新增兩個 allowlisted failure code：

- `RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID`
- `RUNTIME_ACTIVATION_AUTHORIZATION_BINDING_INVALID`

錯誤不保存 handoff、commit、provider message、Secret、stack 或任意外部
diagnostic。所有 verifier 仍是 single-use、零 retry。

## 驗證

- 精確 handoff 在既有 Migration → Runtime → admin 順序中被消耗一次。
- 完整綁定後 Runtime 仍 inactive，admin factory 呼叫數為零。
- Release commit 或 Migration readiness fingerprint 漂移固定拒絕，且已開始
  binding 的 handoff 不可重用。
- Copy handoff 固定拒絕，原始 capability 不會被 copy 的失敗消耗。
- Migration attestation exception 與 Runtime sequence error 都在 handoff 前停止。
- Production mode 在 adapter 建立時 fail closed，不消耗 handoff。
- Focused contract、完整 AI Chart tests、Typecheck、Lint、Build 與 diff check
  全部必須通過。

## 後果

- Synthetic authorization 已實際接進 readiness order，但仍不是正式 Production
  授權，也沒有啟用 Runtime。
- Caller boolean、一般環境變數、可複製 JSON、舊 Release handoff 或不同
  readiness fingerprint 都不能越過 Runtime verifier。
- ADR 0076 已只宣告「正式 Runtime activation authorization Adapter」的
  Server-only Port interface、exact Release command、safe decision 與固定
  failure codes；正式來源仍未選擇，且沒有 Adapter implementation。
- 下一步必須先由老師選擇並另行授權正式 Release activation authorization 的
  受控來源；在此之前仍不得讀取 Secret、呼叫正式 Environment、回傳 active、
  建立 admin client、連線 Supabase、建立客戶 route 或交付報告。
