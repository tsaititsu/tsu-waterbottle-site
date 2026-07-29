# ADR 0028：逐宮 Prompt Package 必須先解析實際來源素材

## 狀態

已採用。

## 背景

D1 本命人格流程已能在全盤關係語意審查後建立十二宮 Content Grid。Content Grid 用不可變 Ref 證明每一格來自哪一筆 Axis claim、Structural influence 或 Flying influence，也保留與該格有關的已核准全盤關係。

但 Ref 本身不是模型可理解的命理內容。如果逐宮寫作只收到 Ref，模型仍需自行查找、猜測或依內建知識補齊底層機制；如果直接把整份十二宮結果交給每次寫作，又會增加輸入、混入其他宮位內容並提高遺漏或越界風險。

## 決策

新增 `d1PalaceWritingPromptPackageContracts.ts` 與固定 Instructions：

- 依 canonical 十二宮順序建立十二個 Package，每宮一個。
- Server 把每個 Content Cell 的唯一 Ref 解回實際 Axis、Structural 或 Flying source material。
- 每宮只投影該宮 Content Grid、實際來源素材及格子已引用的核准 relation。
- 不把其他宮位的 Grid、Palace Result、完整 N0 或未引用 relation 放進單宮輸入。
- `primaryLifeRegion` 與 `reportLanguage` 分開保存；前者只調整社會語境、生活用語與例子，後者只決定輸出語言。
- 使用 canonical JSON、來源 trace、SHA-256、UTF-8 預算及 package fingerprint，使輸入可重算、可比對。
- coverage 由內容格與實際來源重算，不要求模型手填 `majorStarsConsidered`。
- 在 Palace Writing Result Contract 與忠實度審查、Adapter bridge 都完成前，固定 `openAiCallable=false`。

## 原因

這個邊界同時保留兩件事：

1. 模型看到足以轉譯成生活白話的實際底層機制，而不是不透明 ID。
2. 程式仍控制模型能看到哪一宮、哪一格、哪一筆來源與哪一項全盤關係。

生活地區與報告語言分開，才能支援台灣、新加坡、馬來西亞或香港等不同社會脈絡，而不把語言偏好誤當生活背景，也不讓地區刻板印象改寫命理核心。

## 後果

- 每宮 Package 會比 Ref-only 封套大，但仍有固定 UTF-8 預算。
- 同一來源一格的策略會保留較多素材；這是為了避免過早摘要刪除矛盾。
- Prompt Package 已具來源與內容指紋；Result／Review Contract 完成後，狀態由 `blocked_by_output_contract` 進入 `bridge_required`，仍不能直接接 Runtime。
- 實體是否十二宮受控平行、每次耗時與成本，要等 Adapter bridge 完成後以脫敏案例實測。

## 驗證

- 十二宮順序、Package 數量及 identity 固定。
- 每個 Content Cell 的實際來源內容恰好投影一次。
- Axis、Structural、Flying 三類來源都可解析。
- 只帶入該宮格子引用的已核准 relation。
- 修改來源內容、relation 或寫作地區／語言會改變預期 Package，舊 Package 驗證失敗。
- Package、nested arrays、source trace、coverage 與 Strict Schema 都不可變。
- Production module 不存取 `fetch`、OpenAI Adapter、環境變數或客戶輸出 writer。

## 下一步

建立 Palace Writing／Fidelity Review Prompt Package 與 Adapter bridge，使用既有 Result／Review Contract 進行 source-bound 驗證；完成前不發送 OpenAI request。
