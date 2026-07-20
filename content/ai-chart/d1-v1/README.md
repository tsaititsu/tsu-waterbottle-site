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
- P1 Model Input Contract：已完成
- P1 Model Input internal JSON Schema：已完成
- P1 Model Input strict parser：已完成
- P1 Model Input 固定 12 份 builder：已完成
- P1 Prompt Package Contract：已完成
- P1 Prompt Package internal JSON Schema：已完成
- P1 Prompt Package strict parser：已完成
- 固定 12 份 P1 Prompt Packages：已完成
- P1 固定 instructions：已完成
- P1 canonical userInput：已完成
- P1 Output Schema fingerprint binding：已完成
- P1 Adapter Bridge Contract：已完成
- 固定 12 份 P1 Adapter Bridges：已完成
- Structured Request mapping：已完成
- Source-bound P1 Result parser：已完成
- Responses body compatibility：已完成
- Server request：尚未接線
- F1 Input Contract：未建立，狀態為
  `F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE`
- B1／S1／A1／R1／A2／O1 Contract：未建立
- K0 Catalog Contract：已完成（`ai-chart-d1-k0-catalog/v1`）
- K0 P1 Knowledge Bundle Contract：已完成
  （`ai-chart-d1-k0-p1-bundle/v1`）
- K0 Server-only verified compiler：已完成
- P1 deterministic knowledge selection：已完成，固定建立 12 份 bundle
- P1 Prompt Package builder：已完成
- F1 Prompt builder：尚未完成
- P1 OpenAI call：0
- Orchestrator：未建立
- Runtime 接線：未建立
- Background job：未建立
- Production：未啟用

## Canonical AI 命盤測試

Repository 唯一正式的 AI 命盤 assertion test 指令是：

```bash
npm run test:ai-chart
```

Runner 使用 Node `24.16.0` 與 exact devDependency `tsx@4.23.1`。它會在
`src/lib/ai-chart` 下遞迴尋找所有 `*.test.ts`，只接受 regular file、拒絕
symlink，以 Repository-relative path 做 deterministic ASCII 排序並檢查沒有
重複。測試逐檔、循序執行，第一個失敗即停止；Workflow 不維護第二份測試
清單。Runner contract 會先驗證目前應發現 26 個測試檔、環境隔離、排序、
去重、fail-fast、全成功條件、exact Node 與本機 exact `tsx`。Node contract 會
逐字驗證 `process.versions.node === '24.16.0'`，任何 patch 或 minor drift 都會
fail closed。

每個測試 child process 都固定使用 `NODE_ENV=test`，並移除 OpenAI、P1
Preview、Vercel、Supabase、`DATABASE_URL`、`NODE_OPTIONS` 與
`TSX_TSCONFIG_PATH` 等 canonical removed-key list；不會輸出這些變數的值或
衍生資訊。既有 AI 命盤測試只使用 synthetic fixture、mock request 或 mock
fetch，canonical runner 不會發送 OpenAI request，也不會連接 Supabase。

Runner assertion tests 與 TypeScript typecheck 是不同驗證，兩者都必須執行：

```bash
npm run test:ai-chart
npm run typecheck -- --incremental false
```

Manifest 與 23 份素材會在 Server 端驗證原始位元組 SHA-256。
`draft` 與 `reference_only` 素材不能被 Runtime 啟用，目前所有
`runtimeEnabled` 仍為 `false`。

本版本新增 7 份由 `20_D1_本命人格推理總控流程.md` 明確引用的
`reasoning_source_candidate`。納管只確認來源位元組、Manifest 與引用
一致性，不代表素材內容已由老師逐句核准。N0 與 P1 Structural Input
已建立；K0 Catalog 與 deterministic knowledge selection 已完成，完整
P1 Model Input Contract 與固定 12 份 builder 已完成；P1 Prompt Package
Contract 與固定 12 份 builder 也已完成；P1 Adapter Bridge Contract 與
固定 12 份 Runtime Bridges 已完成；Primary Axis source binding、P1 Preview
Request Plan Contract、Preview Authorization Contract、本機單宮 request gate
與 mock request execution 也已完成。Gate 會先驗證所選宮位具有非空且不重複的
effective major stars；`blocked_by_local_star` 與其他不可驗收 target 不會建立可執行
Plan。本版本沒有發送任何 OpenAI network request。

K0 compiler 只在 Server 端讀取內部固定的九份白名單素材，呼叫端不能傳入
路徑或自訂 allowlist；逐檔驗證 Manifest、
Repository-relative path、regular-file／non-symlink、SHA-256 與 strict UTF-8。
它不會讀取 Prompt，也不會把原始完整素材回傳給任何 Route。

P1 Adapter Bridge 只引用 Responses adapter core，不引用 Server request；
只有 Server-only Preview Gate 會重建固定 12 份 authenticated Bridges，再選取
一個宮位並呼叫既有 Server request。Gate 預設關閉，只允許本機
development，且每次只允許一宮一請求；沒有 retry、Route、正式 Runtime 或
持久化。CI、Vercel 與 Production 一律拒絕。Gate 不直接讀 API key、不直接
使用 fetch，也不自行建立 Responses body。測試只使用 mock request，沒有
測試會呼叫 OpenAI。Gate 會在自己的 trust boundary 驗證 response wrapper 與
usage，並再次使用 authenticated Bridge parser 驗證 raw result data；mock 無法
繞過 source binding。目前也不會傳送本目錄的 D1 素材。所有
`runtimeEnabled` 仍為 `false`。

Adapter 使用原生 REST fetch 解析原始 `output` array，不依賴 SDK-only
的頂層 `output_text`。既有 Adapter 只正式處理 P1／F1 Output Contract；
本次另建立的 P1 Structural Input 尚不是完整模型輸入。P1 Model Input 仍固定
標記 `promptStatus=prompt_builder_required`、`promptVersion=null` 與
`openAiCallable=false`。P1 Prompt Package 另行標記 `promptStatus=ready`、
`adapterStatus=adapter_bridge_required` 與 `openAiCallable=false`；必須通過
Adapter Bridge 的 authenticated rebuild，才能建立記憶體內 Structured Request。
P1 Structural Input、Model Input 與 Prompt Package 都不得直接送入既有
Adapter。下一階段才會在另一個明確授權任務中執行一次 one-shot local
Preview；Preview runner 尚未建立，Live OpenAI Preview request 維持 0，
Route／Runtime 維持 0，Production 維持停用。

P1 Result 的 Primary Axis 現在會依 target palace 的 canonical／borrowed
狀態驗證有效主星集合、authenticated double-star core 與 target-role Rule
completeness；對宮、暗合與三方專屬 Rule 不得冒充本宮主軸來源。Primary Axis
statement 與 double-star core 也會拒絕完整的 authenticated identity、fingerprint、
Rule trace 與 structural metadata。F1 仍固定維持
`F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE`。

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

## K0 Catalog 與 P1 Knowledge Bundle 邊界

K0 Catalog 使用固定 `catalog:d1:k0:p1:v1` ID、來源 Manifest SHA 與
canonical metadata fingerprint。Catalog 只編譯九份明確白名單素材；宮位
meaning、十四主星、合法雙星 inventory、生年四化 assignment inventory、
十一顆 modeled supporting stars 與必要結構規則都使用封閉 source locator。
輔星與四化專屬規則會保留來源區段的完整 bullet block、原始順序與固定
數量；十四主星只納入來源註冊表明確核准的 D1 老師補充片段。缺少已確認
的雙星、老師補充或結構規則時，只記錄 coverage、warning 與 missing reason，
不生成 working inference。目前對宮空宮沒有來源規則，Structure coverage
明確維持 14/15；遇到該狀態時 bundle 會標記 `partial`。

Catalog parser 不以 fingerprint 代替內容驗證。它會先依固定 Registry、
正式 `MUTAGEN_TABLE` 與 Catalog 內容重算宮位 meanings、主星、老師補充、
雙星、四化、輔星、結構規則、coverage、warnings 與 readiness；語意 invariant
全部成立後，最後才核對 fingerprint。即使呼叫端同步重算 fingerprint，缺少、
增加、重排或偽造 Registry 內容仍會 fail closed。

每份已驗證的 P1 Structural Input 只會產生一份最小 knowledge bundle。
固定 selection 依五個 palace roles、實際主星／借星／輔星／生年四化、
空宮狀態與 target 四馬地選取規則；去重後依 priority descending 與 ruleId
ASCII ascending 排列。每條 selected rule 都有 deterministic selection trace，
必要專屬規則缺失時 bundle 標記 `partial`。Bundle 不含完整 N0、完整 P1、
完整 Catalog、Prompt、出生個資或 OpenAI request；`promptStatus` 固定為
`prompt_builder_required`，`openAiCallable` 固定為 `false`。

建立十二份 bundle 前，所有 P1 inputs 必須同時通過 parser，並具有同一個
`chartId` 與 `runId`、唯一 `callId`、固定 target index／palace order；十二個
bundle IDs 也必須唯一。Bundle parser 會逐 index 驗證 rule／trace 對應與
reason-kind 相容性，並要求五個 palace roles 各自完整包含 Catalog 的 meanings。
Missing requirements、knowledge status 與唯一固定 warning 亦由實際內容重算，
不接受呼叫端自報狀態。

## P1 Model Input Contract 邊界

P1 Model Input 使用獨立版本 `ai-chart-d1-p1-model-input/v1`，只接受一份已驗證
K0 Catalog、固定 12 份 P1 Structural Inputs 與一一對應的 12 份 K0 P1
Knowledge Bundles。建立任何一份 Model Input 前，整批會先驗證固定宮位順序、
chart／run／call／bundle identity、Catalog metadata 與 Contract references。
只要任一 bundle 為 `partial`，整批以固定 `not_ready` 錯誤阻擋，不回傳 11 份
成功結果或空 knowledge context。Catalog 全域可以維持 `partial`；只要當次
12 份 bundles 全部為 `ready`，即可建立 12 份 Model Inputs。

`structuralContext` 是來源 P1 Structural Input 五個必要結構欄位的 exact deep
copy，保留 Structural `partial` 狀態與 warnings，不重新計算或改寫星曜、借星、
關係或 scan。Path-aware PII guard 只允許這些固定 Structural Palace 星曜陣列的
`name` 欄位；值仍由既有十四主星與 modeled supporting star 封閉 enum 驗證。
其他任何路徑的 `name` 及個資、Report、付款、來源檔、Prompt／OpenAI request
keys 都會 fail closed。星曜欄位沒有改成 `starName` projection。

`knowledgeContext` 只保留 selected rule 的推理必要 projection、exact meanings
與 exact selection trace，不含來源檔路徑、完整 Catalog、完整 Bundle wrapper 或
missing requirements。Parser 會把 trace 的 palace role、placement、星曜、四化、
雙星、空宮與四馬地重新綁定至 Structural Context；語意與 source binding 全部
通過後才核對 deterministic `inputFingerprint`。Model Input 的唯一 production
consumer 是 P1 Prompt Package builder；Prompt Package builder 的唯一 production
consumer 是 P1 Adapter Bridge，Bridge production consumer 0、OpenAI network
request 0、Route／Runtime 0，F1 仍固定為
`F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE`。

## P1 Prompt Package Contract 邊界

P1 Prompt Package 使用獨立版本 `ai-chart-d1-p1-prompt-package/v1` 與固定
Prompt 版本 `ai-chart-d1-p1-prompt/v1`。固定 12 份 builder 會先由既有
Catalog、Structural Inputs 與 K0 Bundles 重建 expected Model Inputs，再逐份
驗證 caller 提供的 Model Input；任一不一致、重排或 partial 狀態都會整批
拒絕，不會回傳 ready subset。

每份 Package 只包含固定 instructions、authenticated Model Input 的 canonical
JSON `userInput`、既有 P1 Output Schema 的 deterministic fingerprint、來源 trace
與 UTF-8 byte budget。它不包含 model、reasoning、timeout、token、Responses API
body 或完整 Schema object。Instructions 不從 Markdown 載入，舊
`prompt/0_主控.md` 未用於 P1 Runtime Prompt；舊五步、B1／B2 與飛化流程也未
進入 P1。

Package parser 會重新驗證上游來源、重建 expected Package，再做 exact equality
與 fingerprint 檢查。`userInput` 只允許 authenticated Model Input 的 canonical
serialization，不能插入 caller instructions 或額外個資。Package 固定為
`promptStatus=ready`、`adapterStatus=adapter_bridge_required`、
`openAiCallable=false`。Package 只能由 Adapter Bridge 重新驗證來源後使用；
目前 OpenAI network request 0、Runtime 接線 0，F1 仍為
`F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE`。

## P1 Adapter Bridge Contract 邊界

P1 Adapter Bridge 使用純 JSON Descriptor
`ai-chart-d1-p1-adapter-bridge/v1` 與記憶體內 Runtime Bridge 兩層結構。
Descriptor 不包含 function、raw instructions、raw userInput、Schema object、
model、API URL、header、request body 或 response；其 canonical SHA-256
`bridgeFingerprint` 只涵蓋固定 Descriptor 欄位。Runtime Bridge 才包含既有
Adapter core 驗證並凍結的 Structured Request 與 source-bound `parseResult`
function，function 不會序列化或進入 Descriptor。

固定 12 份 builder 會由 Catalog、Structural Inputs、K0 Bundles 與 Model Inputs
重新建立 expected Prompt Packages，再逐份 exact 驗證 caller supplied Packages。
任一份重排、變造、來源不一致或 not-ready 都會整批 fail closed，不回傳 11 份
ready subset。每份 request 固定使用 authenticated Package 的 instructions 與
userInput、正式 P1 Output Schema，以及既有 Adapter core 的 reasoning、timeout
與 max output token defaults；Bridge production code 不重建 Responses API body。

Source-bound Result parser 先使用正式 P1 parser，再驗證 call／chart／palace
identity、status 與空宮借星。Candidate collection 依 direct／opposite／hidden／
trine 各自綁定可用宮位、星曜與必要 structure basis；combined／strengths／
imbalance 才能使用五宮 union。每個 Candidate 的 `ruleStatus` 必須等於
`usedRuleIds` 中最低權威的 authenticated Rule status，禁止向上提升權威。

Coverage 只接受 target meanings、target 主星／借星／輔星、target 生年四化、
target global scan 實際煞忌 signal 與 target 實際貴人星。`complete` 必須完整覆蓋
全部 authenticated source set；`partial`／`incomplete` 只能使用其子集合，且每個
缺漏來源都必須在 omitted items 保留 exact trace。Parser 也持續驗證 P1 structure
boundary、上游 warning traceability 與 audit metadata isolation。Descriptor 固定
`requestStatus=ready`、`runtimeStatus=runtime_wiring_required`、
`openAiCallable=false`。Bridge 不 import `openAiResponses.server`、不讀取 API key、
不執行 fetch；Server request、Preview 模型呼叫、Route、Runtime、Orchestrator、
Result persistence 與 F1 都尚未接線。Prompt instructions／SHA 與 Output
Schema／SHA 均未修改。

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

本階段只由 Server-only K0 compiler 讀取並驗證九份白名單素材；沒有傳送
正式素材全文，沒有 OpenAI network 呼叫、Route、Report 或付款接線；
所有 `runtimeEnabled` 仍為 `false`。

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
