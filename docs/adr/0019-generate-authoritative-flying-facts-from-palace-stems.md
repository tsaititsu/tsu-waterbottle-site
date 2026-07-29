# ADR 0019｜由宮干與固定十干四化表產生權威 Flying Fact

`d1FlyingFactSource.ts` 是「程式算飛化事實」的唯一深模組。它只接受通過 `parseAiChartD1N0` 的 N0，並把下列三項證據合併成權威來源：

1. Snapshot 經 N0 驗證後保留的十二宮宮干。
2. module-owned、版本鎖定且必須逐列等同既有學會版 `MUTAGEN_TABLE` 的十干四化表。
3. N0 中每顆被飛化星曜唯一且原本就存在的落宮 placement。

每一個出發宮依自己的宮干固定產生 `LU`、`QUAN`、`KE`、`JI` 四條事實；十二宮合計正好 48 條。每條事實固定唯一 Fact ID、唯一 Influence ID、來源宮、來源宮干參照、來源宮全部合法 Actor 候選、落入宮、星曜 placement、星曜核心規則、四化動作，以及同一顆星已存在同類生年四化時的背景參照。

事實產生器必須 fail closed：

- 固定十干表與既有學會表任一列不同時拒絕。
- 被飛化星曜不存在或同名落點不唯一時拒絕。
- Client 或模型提供的 Fact Set 與程式重新計算結果不同、缺少、增加或重排時拒絕。
- 不能新增、搬動或借用一顆不存在於原盤落點的星曜。
- 不能讓模型選宮干、四化、星曜、來源 Actor 或事實 ID。

`sourceActorBindingRefs` 是來源宮 Registry 中所有合法主體可能性的 deterministic 聯集，不等同客人已確認的人生經歷。飛化推演仍須保留這些可能性，不得由模型自行縮減成唯一人物。

相同生年四化只保存為 `SAME_TRANSFORMATION` 背景，後續只能用於觸發、放大、引動或帶出；不同四化保持獨立，不得在事實層混合。

Fact Set 本身 `openAiCallable=false`。本 ADR 只解除「權威 Flying Fact source 不存在」的工程缺口；它不接 OpenAI、不修改 P1 Prompt、不解除現有 P1/F1 Runtime gate，也不產生生活化文字。
