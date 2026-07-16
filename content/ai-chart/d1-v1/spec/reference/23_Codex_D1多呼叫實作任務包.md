# 23｜Codex：D1 多次 OpenAI 呼叫實作任務包

> 用途：在命理規格完成後，交給 Codex 分小包實作。
>
> 原則：每個小包都能單獨測試、提交與回滾；不得一次重寫整個專案。

---

## 一、Codex 開始前必讀

1. `20_D1_本命人格推理總控流程.md`
2. `21_D1_OpenAI多次呼叫編排規格.md`
3. `22_D1_各呼叫輸入輸出Schema_工作版.md`
4. `02_已確認核心規則.md`
5. `06_D1_飛化推理模組.md`
6. `07_四化正式規格_工作版.md`
7. `08_固定雙主星整理骨架.md`
8. `10`～`19` D1 子模組

重要：20 號是程式端總控，不是要一次塞給模型的 Prompt。

---

## 二、實作前先盤點現有專案

Codex 先回答並記錄：

- 目前命盤輸入資料結構在哪裡。
- 現有 OpenAI client 與呼叫封裝在哪裡。
- 是否已有 Structured Output／Schema validator。
- 中間結果目前存在哪裡。
- 現有命盤分析 route、service、job 或 workflow。
- 現有測試框架。
- 哪些檔案屬其他功能、不可碰。

若專案已有相同能力，優先沿用，不建立第二套平行架構。

---

## 三、建議模組邊界

實際路徑可配合專案，但職責必須分開：

```text
ziwei/d1/
  schemas/
  normalizer/
  structure/
  knowledge/
  prompts/
  calls/
  orchestrator/
  audit/
  render/
  persistence/
  tests/
```

不得把所有 Prompt、Schema、流程與 OpenAI 呼叫塞在同一個 route 檔案。

---

## 四、小包 1｜型別與 Schema

### 任務

- 依 22 號文件建立單一型別來源。
- 產生 TypeScript 型別、runtime validator 與 OpenAI JSON Schema。
- 建立 schema version。

### 驗收

- 所有範例 fixture 可通過 validator。
- 非法宮位、非法四化、缺 candidateId、無效 sourceCandidateIds 可被拒絕。
- Schema 不允許模型輸出額外未知欄位，除非工程上有明確理由。

### 建議 commit

```text
feat: add d1 structured output schemas
```

---

## 五、小包 2｜N0 命盤正規化與結構計算

### 任務

- 建立 `normalizeChart`。
- 計算對宮、暗合、三方四正、四馬地。
- 實作空宮借星資格。
- 驗證生年四化與飛化。
- 統計煞忌。
- 產生穩定 IDs。

### 驗收

至少測試：

- 一般單主星宮。
- 固定雙星前後順序。
- 空宮可借星。
- 空宮有昌曲或煞星不可借星。
- 空宮只有祿存可以借星。
- 非法四化被拒絕。
- 飛化指定星曜不在落入宮時被拒絕。
- 暗合六合映射正確。

### 建議 commit

```text
feat: normalize d1 chart structures
```

---

## 六、小包 3｜K0 知識選取器

### 任務

- 將規則切成有 ID、狀態、適用範圍的片段。
- 建立宮位、星曜、雙星、四化、輔煞、飛化索引。
- 實作 `buildPalaceKnowledgeBundle`。
- 實作 `buildFlyingKnowledgeBundle`。
- 保留來源文件與版本。

### 驗收

- 命宮太陽＋官祿天機案例，只選入相關宮位、太陽、天機、化祿與飛化規則。
- 武曲破軍宮位能讀到固定雙星核心，不只拿武曲與破軍單星關鍵字。
- 不會把所有 02～20 文件送進單次呼叫。
- 規則衝突時，老師最新確認優先。

### 建議 commit

```text
feat: add d1 knowledge bundle selector
```

---

## 七、小包 4｜OpenAI Structured Call 基礎層

### 任務

- 建立共用模型呼叫封裝。
- 支援 promptVersion、schemaVersion、knowledgeBundleId。
- 支援 idempotency key、timeout、retry。
- 驗證 JSON Schema。
- 儲存 call record。
- 不在此層放命理業務邏輯。

### 驗收

- 格式正確時回傳 typed result。
- 格式錯誤可觸發 FORMAT 修補。
- 超時、限流、API 錯誤可依策略重試。
- 兩次仍失敗會標記 incomplete，不吞錯。

### 建議 commit

```text
feat: add reusable structured model call runner
```

---

## 八、小包 5｜P1 十二宮分析 fan-out

### 任務

- 建立 P1 專用 Prompt。
- 對十二宮建立 12 個獨立工作。
- 注入各宮最小 context。
- 支援可配置平行併發。
- 持久化每宮結果。

### 驗收

- 每宮輸出符合 P1 Schema。
- 每宮都有本宮、對宮、暗合、三方覆蓋紀錄。
- 不會在 P1 生成全盤總結。
- 不會把飛化候選混入 P1。
- 陀羅與兩個以上煞忌可被正確標記。
- 同一宮的相反候選可以同時保留。

### 建議 commit

```text
feat: orchestrate per-palace d1 analysis
```

---

## 九、小包 6｜F1 飛化分析 fan-out

### 任務

- 建立 F1 專用 Prompt。
- 每條合法飛化獨立呼叫。
- 等待出發宮與落入宮 P1。
- 建立出發含義 × 落入含義覆蓋矩陣。
- 實作候選合併與排除理由。

### 驗收案例

#### 案例 A

```text
命宮太陽
官祿宮天機
命宮讓官祿宮天機化祿
```

至少保留已確認核心：

> 命主把制定規則、掌握方向的個性帶到工作上，主動研究方法、調整流程，因此較容易在工作方向或生活重心上得到新機會。

#### 案例 B

```text
田宅宮武曲
田宅宮讓僕役宮巨門化忌
```

不得只輸出一個例子；要展開家庭相處、家世背景、財庫、合夥等來源含義，連接朋友、同事、異性別兄弟姐妹與合作對象等落入含義，並合併真正同義候選。

### 其他驗收

- 不新增落入宮不存在的星曜。
- 不把人物宮位反向斷成對方已發生事件。
- 覆蓋矩陣無缺格。
- 具體事件均標記 D2 邊界。

### 建議 commit

```text
feat: orchestrate per-transformation d1 analysis
```

---

## 十、小包 7｜B1 身宮與 S1 跨宮整合

### 任務

- 建立 B1 身宮呼叫。
- 建立 S1 整合呼叫。
- 以 candidate IDs 建立可追蹤綜合結論。
- 區分跨宮穩定、單一領域高強度與跨領域差異。

### 驗收

- 命宮不被身宮取代。
- 命身同宮規則正確。
- S1 每個 synthesis 都有來源 IDs。
- 不把單一宮位低強度候選升格為全人格核心。
- 相反特質分領域保留，不為了流暢刪除。
- D1 不輸出具體年份或事件結果。

### 建議 commit

```text
feat: synthesize d1 personality model
```

---

## 十一、小包 8｜A1 審核與 R1 局部修補

### 任務

- 建立完整性與規則審核 Prompt。
- 實作 requiredRepairs。
- 依 targetCallType 重跑局部工作。
- 實作 JSON path 變更限制。
- 修補後執行 A2。

### 驗收

人工製造以下錯誤並確認可抓出：

- 漏掉一宮。
- 雙星主輔順序顛倒。
- 非法四化。
- 飛化方向接反。
- 飛化只有一條候選。
- 化忌直接寫成失敗。
- 將工作推導標成老師確認。
- S1 引用不存在 candidateId。
- 本命直接斷定某年破財、離婚或生病。

R1 只改指定 JSON paths，其他欄位保持不變。

### 建議 commit

```text
feat: audit and repair d1 inference results
```

---

## 十二、小包 9｜O1 輸出適配器

### 任務

- 建立完整、精簡、工作、感情、金錢、教學、CTA 模式。
- 每段保留 sourceSynthesisIds。
- CTA 模式讀取 18 號規格。

### 驗收

- O1 不會新增 S1 中沒有的命理結論。
- 不會把可能改成必然。
- 精簡版只減字，不改推理。
- 不同輸出模式使用同一份審核通過的 D1 結果。

### 建議 commit

```text
feat: render audited d1 outputs
```

---

## 十三、小包 10｜持久化、續跑與觀測

### 任務

- 儲存每個 call record 與中間 JSON。
- 記錄 prompt/schema/knowledge/model 版本。
- 支援從失敗節點續跑。
- 支援依規則變更找出受影響結果。
- 加入 structured logs 與基本成本／耗時統計。

### 驗收

- P1 第 7 宮失敗時，不需要重跑前 6 宮。
- 單條飛化修正時，不需要重跑其他飛化。
- 可查出某個 S1 結論引用哪些候選與規則。
- 不在 logs 中暴露不必要的敏感資料。

### 建議 commit

```text
feat: persist and resume d1 workflows
```

---

## 十四、小包 11｜測試命盤與回歸測試

### 必備測試層

1. 純函式單元測試：結構映射、借星、四化合法性、ID。
2. Schema contract 測試。
3. Prompt fixture 測試：固定輸入搭配人工核准輸出。
4. Orchestrator 整合測試：mock OpenAI。
5. 少量真實模型 smoke test。
6. 老師確認案例回歸測試。

### 回歸案例至少包含

- 命宮太陽飛官祿天機祿。
- 田宅武曲飛僕役巨門忌，多候選覆蓋。
- 空宮有文昌／文曲不能借星。
- 空宮只有祿存可以借星。
- 陀羅單顆仍需明確處理。
- 太陽太陰對拱的變動、奔波。
- 武曲貪狼同宮與對拱不可混用。
- 天同不存在化忌。
- 文昌科與文曲忌同宮的理性感性拉扯。

### 建議 commit

```text
test: add d1 inference regression suite
```

---

## 十五、Codex 每個小包的回報格式

每次完成後回報：

```text
小包編號：
修改檔案：
主要設計：
測試命令：
測試結果：
已知限制：
是否更動其他功能：否／是（說明）
commit：
deployment（如有）：
```

不得只回覆「已完成」。

---

## 十六、Codex 禁止事項

- 不得把所有 D1 規則做成一份巨大 Prompt。
- 不得讓 route 同時負責正規化、Prompt、Schema、呼叫、整合與輸出。
- 不得臨時拼湊固定雙星核心。
- 不得以其他流派資料補空缺。
- 不得刪除所有中間結果，只保存最後文章。
- 不得遇到單點失敗就重跑整張命盤。
- 不得在未測試下直接部署正式站。
- 不得順手重構不相關功能。

---

## 十七、整體完成定義

Codex 實作完成必須同時達成：

- 多呼叫而非單呼叫巨型 SOP。
- 12 宮與每條飛化可獨立執行、重試與追蹤。
- 所有中間輸出符合 Schema。
- 候選池保留所有合理可能並去除同義重複。
- 整合結論可追溯到候選與規則。
- 審核能抓出命理與資料結構錯誤。
- 局部修補不改動其他結果。
- Output 不新增推理。
- 回歸測試涵蓋老師已確認案例。
