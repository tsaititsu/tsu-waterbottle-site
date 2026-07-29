# ADR 0021｜飛化模型輸入必須帶入鎖定知識而非不透明 Rule ID

`d1FlyingModelInputContracts.ts` 已能把 48 條權威 Flying Fact 與正確的出發宮、落入宮結果配對，但 Fact 內的 `transformedStarCoreRuleRef` 只是識別碼。若直接交給模型，模型看不到星曜與四化底層內容；若讓模型自行按 ID 找卡或補寫內容，又會失去來源完整性。

因此新增 `d1FlyingKnowledgeContracts.ts` 作為深模組，對每條 Flying Model Input 從鎖定 K0 Catalog deterministic 選出：

1. 被飛化星曜固定核心。
2. 祿、權、科、忌共通動作。
3. 該星曜承受本次四化的專屬規則。
4. 出發宮與落入宮的完整固定含義。
5. Fact 已確認的全部合法來源 Actor。
6. 落入宮 Registry 的完整合法分面。
7. 宮位因果、星曜方式與生活橋接的 module-owned 公式順序。

Knowledge View 只保留 K0 的內容、SHA、來源檔案及權威等級，不複製模型控制參數，也不產生自然語言結論。48 份 View 必須保持 Model Input 原順序，並以 `validateAiChartD1FlyingKnowledgeViewSetAgainstSources(...)` 從 Model Input 與 Catalog 完整重算；缺少專屬四化卡、星名與核心規則錯綁、內容遭竄改或任何一份 View 缺失時均 fail closed。

本模組固定 `openAiCallable=false`。它只把「程式知道要用哪張卡」變成「下游實際拿得到該卡內容」，不接 OpenAI、不組 Prompt、不修改 P1 Prompt、不產生飛化結論，也不解除任何 Runtime gate。
