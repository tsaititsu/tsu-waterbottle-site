# ADR 0029：單宮文章必須逐內容格綁定並通過忠實度審查

## 狀態

已採用。

## 背景

單宮 Prompt Package 已把每個 Content Cell 的實際 Axis、Structural 或 Flying 來源素材及核准 relation 交給寫作模型。但模型回傳白話文章時，仍可能漏掉某格、改變分面或主體、把可能性寫成必然，甚至為了讓文字自然而加入沒有來源的命理。

若只接收一整篇自由文字，程式無法知道漏掉哪一格，也無法在不破壞其他已核准內容的情況下定點修復。若讓第二個模型直接重寫整篇，又可能刪掉原本正確的結論。

## 決策

新增 `d1PalaceWritingResultContracts.ts`：

- 一次單宮寫作仍處理該宮全部 Content Cell，但輸出必須逐格回傳。
- 每格只包含固定 `contentCellRef`、`facetId` 與 `customerText`。
- 程式重驗 chart、run、call、宮位、Prompt Package fingerprint、格數、順序與 facet binding。
- 不讓模型另外自填 `majorStarsConsidered`、來源清單或覆蓋摘要。
- Result 完成後仍固定阻擋客戶交付，直到忠實度審查通過。

新增 `d1PalaceWritingFidelityReviewContracts.ts`：

- 每個 Content Cell 只能得到 `APPROVED` 或 `REPAIR_REQUIRED`。
- 問題只能使用 module-owned 固定 allowlist；不接受自由文字理由、模型原文、錯誤訊息或改寫後文章。
- `APPROVED` 必須沒有問題碼且修補範圍為 `NONE`。
- `REPAIR_REQUIRED` 必須至少有一個固定問題碼，且修補範圍只能是 `CONTENT_CELL_ONLY`。
- Review 必須完整覆蓋同一 Writing Result 的所有格，並綁定 Prompt Package fingerprint 與 Writing Result SHA-256。
- 任一格失敗只阻擋該宮交付並定點修復該格；其他已通過格保持不動。

## 原因

逐格輸出讓覆蓋變成程式可驗證的事實，不必相信模型自我申報。固定問題碼避免審查結果帶入新的命理或敏感文字。禁止審查器改寫，則可保留第一輪正確內容並把失敗範圍縮到單一格。

## 後果

- 客戶文章在組合前保留內部 Content Cell 邊界；客戶最終不會看到內部 ID。
- 寫作 Result 的結構通過，只證明格數與來源身分正確；語意是否忠實仍由後續 Fidelity Review 判定。
- Review 全數通過才代表該宮可交付，不代表十二宮、全盤導讀或完整報告已完成。
- Prompt Package 現在標示 `writingOutputContractStatus=available`，但 Adapter bridge 尚未建立，因此 `openAiCallable=false`。
- 本 ADR 不新增 OpenAI request、模型政策、資料庫保存、批次或重試行為。

## 驗證

- 缺格、重複格、換序、換 facet、換 Package fingerprint 或換 identity 都會失敗。
- Strict Result Schema 不含模型自填覆蓋欄位。
- Review 的 decision、問題碼與修補範圍必須一致。
- Review 缺格、換 Writing Result SHA 或加入改寫文字都會失敗。
- Result、Review、nested arrays 與 nested entries 都不可變。
- Production modules 不存取 OpenAI Runtime、環境變數、資料庫或輸出 writer。

## 下一步

單宮 Writing 與 Fidelity Review 的純資料 Prompt Package／Adapter bridge 已由 ADR 0030 完成。下一步以脫敏案例量測寫作與審查品質、token 及耗時，再設計受控 Runtime；完成前不發送 OpenAI request。
