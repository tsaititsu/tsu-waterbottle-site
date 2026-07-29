# ADR 0027：建立逐宮內容格，但不做缺乏證據的來源合併

## 狀態

Accepted

## 背景

D1 本命人格流程已經具備十二宮 Axis／Structural／Flying 未合併來源格、四類全盤關係，以及逐項語意審查。全部關係核准後，下一層需要把完整來源整理成逐宮寫作可使用的內容格。

架構規則允許多項主張在「同一宮位、同一主體、同一分面、底層機制相近」時合併成一格。然而現有來源格固定了宮位、分面、來源種類與證據 Ref，還沒有足以由程式可靠證明 Actor 和 Mechanism 等價的欄位。只依文字相似度、同一分面或全盤 relation kind 自動合併，可能把不同原因或互相矛盾的面向混在一起。

## 決策

新增 `d1PalaceContentGridContracts.ts`，只有在 Whole-Chart Semantic Review 全數核准後才能建立內容格。

第一版固定：

- 宮位依 canonical 十二宮順序。
- 分面依 `d1PalaceFacetRegistry.ts` 的順序。
- 只建立實際有來源的分面，不建立空格。
- 每一筆 Axis、Structural 或 Flying 來源恰好進入一個 Content Cell。
- 已核准 relation Ref 附到它引用的每個來源格。
- 保留全部來源及矛盾，不計分、不抵銷、不選贏家。
- 不以文字相似度或 relation kind 自動合併來源。
- coverage 由實際內容格重算，不接受模型自填。
- 完整來源鏈必須可以重新驗證。
- 完成後只開放 Palace Writing Prompt Package 交接；客戶寫作與 OpenAI Runtime 仍阻擋。

## 理由

一來源一格會增加後續 Prompt Package 的輸入項目，但它能確保所有命理來源都可追查，也不會因過早摘要而遺漏不同面向。全盤關係仍提供哪些來源可能重複、拉扯或形成整體方向的已核准上下文；後續寫作層可以在不刪除來源的前提下安排自然表達。

真正的 deterministic 合併必須等來源 Contract 能明確提供可比較的 Actor 與 Mechanism identity，並有金標測試證明合併不會改變語意後，才能另案加入。

## 後果

優點：

- 十二宮、分面及來源 coverage 可由程式完整重算。
- 不會把不同機制、正負面向或矛盾誤合併。
- 全盤關係仍能隨來源格傳入下一層。
- 單一來源缺失、偽造 relation 或 identity 漂移都能定點拒絕。

限制：

- 第一版 Content Cell 不等於客戶最終段落。
- 同一生活表現由多來源支持時，後續 Prompt Package 仍需攜帶多格與 relation context。
- 本決策沒有選定實體 OpenAI 批次、模型政策、延遲或重試方式。

## 下一步

建立 Palace Writing Prompt Package Contract。每宮 Package 只能讀取該宮內容格、已核准 relation context、生活地區與寫作規則；在正式 Runtime 前，仍須完成 source-bound 寫作結果與忠實度審查 Contract。
