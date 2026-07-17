# AI 命盤 D1 推理素材 v1

## 目前狀態

本目錄已完成版本化素材納管與 Server 端完整性驗證，尚未接入網站 Runtime。

- Manifest validator：已建立
- 素材完整性驗證：已建立
- Primary spec 必要素材引用一致性驗證：已建立
- Manifest SHA 版本鎖定：已建立
- Runtime loader：只有 disabled guard，尚未啟用
- OpenAI Responses adapter core：已建立
- 模型 contract：鎖定 `gpt-5.6-sol`
- Structured Output transport：已建立
- `store: false`：強制
- Timeout：已建立
- 固定安全錯誤碼：已建立
- P1 Output Contract：已建立
- P1 Strict JSON Schema：已建立
- P1 runtime parser：已建立
- F1 Output Contract：已建立
- F1 Strict JSON Schema：已建立
- F1 runtime parser：已建立
- N0 deterministic normalizer：已完成
- P1 Structural Input Contract：已完成
- 完整 P1 Model Input：尚未完成
- F1 Input Contract：未建立，狀態為
  `F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE`
- B1／S1／A1／R1／A2／O1 Contract：未建立
- K0：尚未完成
- P1／F1 Prompt builder：尚未完成
- P1 OpenAI call：0
- Orchestrator：未建立
- Runtime 接線：未建立
- Background job：未建立
- Production：未啟用

Manifest 與 23 份素材會在 Server 端驗證原始位元組 SHA-256。
`draft` 與 `reference_only` 素材不能被 Runtime 啟用，目前所有
`runtimeEnabled` 仍為 `false`。

本版本新增 7 份由 `20_D1_本命人格推理總控流程.md` 明確引用的
`reasoning_source_candidate`。納管只確認來源位元組、Manifest 與引用
一致性，不代表素材內容已由老師逐句核准。N0 與 P1 Structural Input
已建立；K0、完整 P1 Model Input 與 Prompt builder 仍未完成，也沒有
產生任何 OpenAI request。

本階段不會讀取或回傳 Prompt 全文給任何 Route。

Responses adapter 尚未被 Route、Report、付款或 Supabase 流程引用。
測試只使用 mock fetch，沒有測試會呼叫 OpenAI；目前也不會讀取或
傳送本目錄的 D1 素材。所有 `runtimeEnabled` 仍為 `false`。

Adapter 使用原生 REST fetch 解析原始 `output` array，不依賴 SDK-only
的頂層 `output_text`。既有 Adapter 只正式處理 P1／F1 Output Contract；
本次另建立的 P1 Structural Input 尚不是完整模型輸入。後續仍須完成 K0、
完整 P1 Model Input 與 Prompt 組裝，才能進行受控 Preview 測試。本階段的
P1 Structural Input 明確標記 `openAiCallable: false`，不得直接送入 Adapter。

## N0 與 P1 Structural Input 邊界

N0 使用 immutable Canonical Snapshot 作為唯一命盤來源，deterministic
建立宮位 ID、合法雙主星 canonical order、十二宮關係、生年四化 placement
索引、空宮借星與全盤煞忌掃描。完整四化必須共同匹配正式排盤引擎
`MUTAGEN_TABLE` 的同一列，才會標記
`snapshot_origin_mutagen_table_validated`；缺項或重複類型只會標記
`snapshot_origin_mutagen_partial`，且現有 assignment 仍須與正式表相容。
這項檢查只驗證 Snapshot 已提供的 origin mutagen，不會從出生日期或年干
重算。Snapshot 的 `lunarDate`、
`fiveElementsClass`、`decadal` 與 `ages` 不會進入 N0。

N0 保留宮干只供未來飛化來源接線，並明確標記
`not_authoritative_flying_transform_source`；本階段不得依宮干新增四化或
推算正式飛化。F1 固定維持
`F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE`。

P1 Structural Input 使用獨立版本
`ai-chart-d1-p1-structural-input/v1`，固定建立十二份一宮一呼叫的結構輸入，
只含 target、opposite、hidden combination、另外兩個 trines 與 target
scan。它不含完整 N0、素材全文、Prompt 或 flying transformations；
`knowledgeStatus` 固定為 `k0_required`、`promptStatus` 固定為
`prompt_builder_required`，且 `openAiCallable` 固定為 `false`。
N0 與 P1 parser 會依宮位、來源 collection 與 source index 重建 placement
ID 並做 exact equality；N0 的 palaces、relationships、palace scans 及 P1 的
call ID 對應均固定依宮位 index 0～11 排列。P1 internal JSON Schema 的主星、
輔星、source index 與 scan count 邊界與 runtime parser 保持一致；該 Schema
仍只供內部 Contract 描述與測試，不會送入 OpenAI Adapter。

## P1／F1 輸出 Contract 邊界

P1 與 F1 的輸出 Contract、Strict JSON Schema 與 runtime parser
使用獨立版本 `ai-chart-d1-p1-f1/v1`。Structured Outputs 中所有
nullable 欄位仍是 required，並以 `string | null` 表示。

Parser 會拒絕未知欄位、重複 ID 與錯誤候選引用。F1 parser 目前只驗證
輸出內的 matrix pair、狀態組合與 candidate reference；完整的出發宮
MeaningItem × 落入宮 MeaningItem 覆蓋率，留待未來 F1 Input Contract
與 Audit 層對照驗證。

`22_D1_各呼叫輸入輸出Schema_工作版.md` 仍只是 draft/reference，
本階段沒有把它宣稱為正式 Runtime Schema，也沒有修改其內容。

本階段沒有讀取或傳送正式素材全文，沒有 Prompt 組裝、OpenAI 呼叫、
Route、Report 或付款接線；所有 `runtimeEnabled` 仍為 `false`。

## 功能邊界

第一版只做 D1 本命人格推理。

不包含：

- D2 大限
- 流年
- 具體年份事件
- 紫微牌卡占卜

## 模型決策

未來 AI 命盤模型：

- `gpt-5.6-sol`
- 環境變數：`OPENAI_AI_CHART_MODEL`

此設定與紫微牌卡的 `OPENAI_DIVINATION_MODEL` 完全分離。

來源文件原有的 GPT-5.5 文字保留原文，不代表 Runtime 模型設定。

## 規格優先級

1. `spec/primary/20_D1_本命人格推理總控流程.md`
2. `spec/primary/21_D1_OpenAI多次呼叫編排規格.md`
3. `prompt/0_主控.md`
4. `prompt/1_五步任務卡.md`
5. `quality/2_風格與品管.md`

`22_D1_各呼叫輸入輸出Schema_工作版.md` 仍是工作版，
不得直接視為正式 Runtime Schema。

`23_Codex_D1多呼叫實作任務包.md` 只供工程實作參考。

`3_網站API管線設計.md` 保留背景 job、前端進度、
品管與產品交付設計，不作為唯一編排規格。

## 明確排除

本版本未納入：

- A2 v1.0／v1.1 待老師確認資料
- 歷史 SOP
- 舊正式基準版
- 其他工作版或待確認知識
- 真實會員、出生或付款資料

## Runtime 啟用

本 PR 中所有素材均為：

`runtimeEnabled: false`

後續完成 Structured Outputs、Prompt 組裝測試與金標回歸後，
才能另外啟用。

## 素材更新流程

未來若要更新任一素材，必須：

1. 另開人工審查 PR。
2. 更新素材。
3. 更新 manifest 內對應的素材 SHA-256。
4. 更新程式鎖定的 manifest SHA-256。
5. 重跑完整性驗證與金標回歸。

Vercel Serverless 是否包含素材檔案，需在未來 Runtime 接入 PR
透過 Preview 實際驗證；本 PR 不宣稱已完成部署打包接入。
