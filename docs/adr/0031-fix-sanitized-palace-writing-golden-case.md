# ADR 0031：固定脫敏單宮寫作金標，不冒充模型實測

## 狀態

Accepted

## 背景

單宮 Writing Prompt、Writing Result、Fidelity Review Prompt／Result 與兩個純資料 Adapter 已完成，但尚未有一份固定案例能同時回答：

1. 客戶文字是否完整對應內容格與來源。
2. Review 是否能由同一份來源重算。
3. Writing 與 Review 的執行政策是否綁到正確 Adapter fingerprint。
4. 後續實測的品質、token 與耗時應從什麼基準開始比較。

如果直接以真實命盤或模型輸出作第一份基準，會混入個資、命盤資料、執行偶然性與尚未核准的文字。若先填入假 token 或假耗時，又會把人工參考答案誤寫成 Runtime 證據。

## 決策

新增 `d1PalaceWritingGoldenCaseContracts.ts`，固定一份 synthetic 紫微命宮案例：

- 只含 `life.core_personality` 與 `life.values_direction` 兩個內容格。
- 主要生活地區固定為臺灣，報告語言固定為繁體中文。
- 保存老師討論後核准的直接客戶文字，不保存姓名、生日、完整命盤或秘密。
- Writing Result 必須由原 Prompt Package 重驗。
- Fidelity Prompt 與 Review 必須由同一 Writing Package／Result 重算。
- Writing／Fidelity Adapter fingerprint 必須由現行 bridge builder 產生。
- 任一內容、來源或 fingerprint 被改動，整份 Golden Case 即拒絕。

Golden Case 的品質狀態固定為 `approved_reference`。這只代表人工參考答案已核准，不代表模型已執行或品質已通過。

另固定一份兩階段循序 Benchmark Plan：

```text
WRITING
→ FIDELITY_REVIEW
```

它綁定現行模型、reasoning、timeout、token policy 與兩個 Adapter fingerprint，最多兩個請求且不重試。現階段固定：

```text
openAiCallable = false
executionStatus = not_executed
measurementStatus = not_measured
durationMs = null
usage = null
```

離線 evaluator 只驗證 Contract、來源綁定、Review 與交付狀態，不替模型評分，也不產生 Runtime measurement。

## 後果

- 後續受控 Preview 有固定、無個資、可重算的比較基準。
- 人工金標、模型輸出與執行證據三者不會混淆。
- 可在不發送 OpenAI request 的情況下回歸驗證來源與交付邊界。
- 尚未取得真實品質、token 與耗時；不得據此決定三分鐘 SLA、併發或模型切換。
- 本 ADR 不開放 Server Runtime、批次、資料庫保存、正式交付或 OpenAI request。
