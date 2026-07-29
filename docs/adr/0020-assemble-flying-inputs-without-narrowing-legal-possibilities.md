# ADR 0020｜組裝 Flying Input 時不得用單宮既有內容縮減合法可能性

`d1FlyingModelInputContracts.ts` 是 Flying Fact 與十二份宮位結果之間的 deterministic 組裝層。它同時接收 N0、權威 Fact Set 與十二份已驗證 `AiChartD1PalaceReasoningResult`，先重新驗證 Fact Set，再依固定宮位順序建立 48 筆輸入。

每筆輸入固定配對：

1. 一條程式確認的 Flying Fact。
2. Fact 出發宮的已驗證宮位結果。
3. Fact 落入宮的已驗證宮位結果。
4. 落入宮在 Palace Facet Registry 中的全部合法分面。

十二份宮位結果必須完整、順序固定、同屬一張命盤與同一次 run。48 筆 Fact 不得缺少、增加、換位或改配其他宮位結果；Validator 會用原始 N0、Fact Set 與十二份結果重建整組輸入後逐位元比較。

單宮結果只代表該階段實際形成的主張與來源圖，不代表該宮全部合法可能性已用完。因此：

- Fact 的 `sourceActorBindingRefs` 由來源宮 Actor Registry 與 Fact Source 負責，不要求每個候選都已出現在出發宮結果的 `coverage.sourceRefs`。
- Fact 的 `transformedStarRef` 由 N0 與固定十干四化表負責，不要求該星曜已被落入宮結果中的某條主張採用。
- Flying Influence 的 `targetFacetId` 只要屬於落入宮 Registry 即可；它可以是飛化階段才形成的 influence-only 分面，不必先存在於落入宮結果的 `coverage.facetIds`。

這不是放寬命理範圍。Actor、星曜、方向、四化與分面仍分別受權威 Fact、N0 及 Registry 限制；模型仍不能新增人物、搬動星曜、跨宮選錯分面或縮減 Fact 已固定的來源候選。

組裝結果與 Fact Set 都是 `openAiCallable=false`。本 ADR 只建立可驗證的模組交接資料，不接 OpenAI、不生成飛化自然語言、不修改 P1 Prompt，也不解除任何 Runtime gate。
