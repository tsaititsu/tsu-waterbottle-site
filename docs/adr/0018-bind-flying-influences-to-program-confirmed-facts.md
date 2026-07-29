# ADR 0018｜飛化結果只接受程式確認的事實與已驗證宮位結果

飛化影響 Contract 不負責從宮干計算飛化，也不能單獨把 N0 目前保留的宮干當成權威來源。ADR 0019 已把「經 N0 驗證的 Snapshot 宮干＋module-owned 固定十干四化表＋唯一星曜落點」接成 deterministic Flying Fact source，因此 `AI_CHART_D1_FLYING_FACT_SOURCE_STATUS` 現在是 `FLYING_FACT_SOURCE_AVAILABLE`。這不代表飛化模型或正式 Runtime 已接線；現有 P1/F1 阻擋不能由 Client、模型或單純填入 `validationStatus` 解除。

每條可信 Flying Fact 由程式預先固定：

- 唯一事實 ID 與唯一權威結果 ID。
- 出發宮、宮干事實參照、全部合法來源 Actor 候選。
- 落入宮、落入宮原本存在的被飛化星曜。
- 祿、權、科、忌及 module-owned 固定動作參照。
- 被飛化星曜核心規則、本命同類四化底色與可選對宮補因。

模型結果只能沿這份事實及兩份已驗證 Palace Reasoning Result，建立「來源 Actor → 落入分面 → 宮位直接因果 → 四化動作 → 星曜專屬發生方式 → 生活橋接」。程式重新驗證方向、結果 ID、Actor 候選完整性、落入分面、星曜落點、四化、底色、對宮補因及 coverage；不能讓模型縮減多個合法來源角色、換星、換四化或另建第二份權威結果。

本層保留 `directPalaceCause` 與 `starSpecificMechanism` 為不同欄位，避免先用星曜硬湊宮位因果。生活橋接分成來源經驗、內在影響、反覆行為與可選結果；本命人格只能描述可能性，不能斷定事件已發生。

這一層仍只負責 immutable TypeScript Contract、Strict JSON Schema 與 deterministic source validator。宮干四化事實由 ADR 0019 的獨立深模組產生；本層不包含 OpenAI 呼叫、Prompt、批次排程或正式 Runtime。
