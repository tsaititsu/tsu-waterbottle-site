# ADR 0030：以兩個純資料 Adapter 分開綁定單宮寫作與忠實度審查

## 狀態

Accepted

## 背景

單宮 Writing Prompt Package、Writing Result Contract 與 Fidelity Review Contract 已經能固定來源、內容格覆蓋及審查結果，但仍缺少兩個明確交接點：

1. 寫作輸入要如何綁到 Writing Result Strict JSON Schema。
2. 寫作完成後，審查模型要如何同時看到原始 source-bound 輸入與待審文章，並把輸出綁回 Fidelity Review Strict JSON Schema。

如果直接讓 Runtime 自行拼 request，Schema、parser、token policy 或來源版本可能漂移。如果第二輪只收到客戶文章，則無法判斷是否漏掉、扭曲或新增了原始命理。

## 決策

新增兩個不同職責的純資料 Adapter：

- Writing Adapter 只接受已驗證的單宮 Writing Prompt Package，固定 Instructions、User Input、Writing Result Schema、source-bound `parseResult`、reasoning、timeout 與 token budget。
- Fidelity Review Adapter 只接受已驗證的 Fidelity Prompt Package，並把同一份原始 Writing Prompt Package 與 Writing Result 固定在 source-bound `parseResult` closure。

另新增 Fidelity Review Prompt Package：

- 輸入同時保存原始單宮寫作 Prompt Input 與已驗證 Writing Result。
- 綁定原 Prompt Package fingerprint 與 Writing Result SHA-256。
- 每格只做 `APPROVED`／`REPAIR_REQUIRED` 判定。
- 不回傳自由文字理由、替代文案或整篇重寫。
- Package、source trace、budget、descriptor 與 nested values 全部不可變。

兩個 Adapter 都只建立通過既有 OpenAI Contract validator 的純資料 request。Descriptor 固定：

```text
requestStatus = ready
runtimeStatus = runtime_wiring_required
openAiCallable = false
```

這表示資料已可驗證地交給未來 Runtime，不代表本切片已連接 Server、fetch、背景工作、資料庫或正式 OpenAI 呼叫。

## 理由

- 寫作與忠實度審查是不同職責，不能共用一份 Instructions 或偷偷由第二輪重寫文章。
- Review 必須看原始來源與實際成品，才能判斷忠實度；只看成品等於沒有證據。
- Schema、parser、來源雜湊及模型政策放在純資料 Adapter 中，可在沒有網路與 API Key 的情況下完整測試。
- Runtime gate 保持關閉，可先完成脫敏品質與時間測試，再決定併發、持久化及正式接線。

## 後果

- 單宮寫作已有完整的 Prompt Package → Adapter → Strict Result Contract 邏輯鏈。
- 單宮審查已有 Writing Sources＋Result → Fidelity Prompt Package → Adapter → Strict Review Contract 邏輯鏈。
- 寫作結果仍須通過 Fidelity Review 才能交付。
- 本切片沒有生成客戶報告，也沒有發送 OpenAI request。

## 驗證

- Writing Adapter 必須拒絕換 Package fingerprint、缺格、換格或換 facet 的輸出。
- Fidelity Prompt Package 必須可由原 Prompt Package 與 Writing Result完整重算。
- Fidelity Adapter 必須拒絕換 Result SHA、換 Content Cell 或來源身分的 Review。
- 固定 Instructions、User Input、Schema 與 descriptor fingerprints 必須 deterministic。
- 新模組不得包含 fetch、Server runtime、環境變數或秘密讀取。

## 下一步

以脫敏單宮案例測量 Writing 與 Fidelity Review 的品質、token 與耗時，再決定受控 Runtime、失敗分流、定點修補與十二宮併發；在另行完成接線前不得發送正式 OpenAI request。
