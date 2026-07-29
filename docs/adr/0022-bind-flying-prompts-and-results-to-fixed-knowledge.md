# 0022：Flying Prompt 與 Result 必須綁定固定知識

飛化 Fact、Model Input 與 Knowledge View 已能由程式重算，但若模型請求只是臨時拼接文字，仍可能漏掉來源 Actor、宮位分面或四化規則；若輸出只回傳自然語言，也無法確認模型是否偷換星曜核心或只使用共通四化。

因此新增 `d1FlyingPromptPackageContracts.ts`，把 48 條 Flying Model Input 各自封裝成一個邏輯 Prompt Package。每個封套只包含已驗證的 Model Input、對應 Knowledge View、固定 Instructions、Strict Output Schema 身分、完整來源索引、UTF-8 預算及內容指紋。`openAiCallable=false` 與 `adapter_bridge_required` 保持不變；本層不決定未來要用 48 次 HTTP 呼叫，或按相同落入宮安全批次。

固定 Instructions 要求模型依序使用：

```text
出發宮
→ 落入宮分面
→ 被飛化星曜核心
→ 共通四化＋該星專屬四化
→ 來源經驗／內在感受／反覆行為／可能結果
```

模型必須保留 Fact 提供的全部來源 Actor 候選，只能從 Registry 分面選一項，不能宣稱未驗證事件已發生，也不能用飛化改寫既有兩宮結果。

Result 新增共通四化與星曜專屬四化的固定 Rule Ref，並由 `d1FlyingResultBindings.ts` 綁回同一份 Knowledge View。模型即使同時偽造自己宣稱的 coverage，只要任一規則、Fact、方向、Actor 或分面不一致，程式就拒收。

這項決策讓模型保有自然語言與生活化推演空間，但底層公式、卡片身分與來源完整性不再由模型自行聲明。
