# AI 命盤老師確認清單

## 文件用途

這是本命人格分析階段唯一的「還要問老師什麼」清單。

後續不得每想到一題就重新翻全部資料，也不得把整理工作交回老師。新增問題前必須先在這份文件確認：

1. 是否已由講義、固定小卡、舊 SOP 或本輪決策回答。
2. 是否只是不同檔案需要合併、改名或修正版本。
3. 是否可以由既有底層規則透過程式或模型推演。
4. 是否真的缺少老師的命理判斷。

只有第 4 類可以進入「真正需要老師確認」。

本文件是架構研究文件，不是正式程式規格，也不代表已授權修改產品程式。

## 固定工作方式

後續提問採以下順序：

1. 一次盤點來源並更新本文件。
2. 把已有答案的項目移到「不再詢問」。
3. 把工程整理工作移到「Codex 自行完成」。
4. 把大限、流年與聊天室問題移到「延後處理」。
5. 每次只從「真正需要老師確認」取一題。
6. 問完立即記錄答案、來源與影響範圍，不再重問。

除非來源檔案有更新、出現新衝突，或老師明確推翻舊決定，否則後續不必為每一題重新搜尋全部素材。

## 已納入的來源

### 專案內 D1 素材

- `content/ai-chart/d1-v1/knowledge/core/`
- `content/ai-chart/d1-v1/knowledge/reasoning/`
- `content/ai-chart/d1-v1/prompt/`
- `content/ai-chart/d1-v1/quality/`
- `content/ai-chart/d1-v1/spec/`
- 目前 D1 Contract、Prompt、Adapter、Preview 與付費報告流程

### 老師本機素材

- `/Users/tsu/Desktop/紫微斗數/01_紫微斗數/02_AI命盤解讀/openai/命盤解讀/SOP重構版_v1.0/知識庫_v1.0/`
- `/Users/tsu/Desktop/紫微斗數/01_紫微斗數/02_AI命盤解讀/openai/命盤解讀/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /`
- `/Users/tsu/Desktop/紫微斗數/01_紫微斗數/03_研究筆記/筆記/紫微星耀解釋/`

### 本輪已確認決策

- `CONTEXT.md`
- `docs/ai-chart/natal-personality-architecture-v2.md`
- `docs/ai-chart/knowledge-source-notes.md`
- `docs/ai-chart/ziwei-source-research.md`
- `docs/ai-chart/twelve-palace-facet-source-audit.md`
- `docs/ai-chart/palace-reasoning-module-contract-v1.md`
- `docs/ai-chart/palace-reasoning-handoff-validation-cases-v1.md`
- `docs/adr/`

永久排除客戶命盤、私人敏感資料、秘密與道法符咒資料。

## 不再詢問

以下項目已有足夠答案；即使舊檔仍標示工作版或待確認，也不能直接重問。

| 主題 | 目前結論 | 依據 |
|---|---|---|
| 十四主星核心 | A 核心字典已結案，可作星曜底層權威 | `紫微斗數知識庫_v1.2_A_待確認清單_已結案.md` |
| 天府財庫有祿 | 主要條件依序為同宮或對宮祿存、同宮主星化祿；三方四正與暗合之祿不列主要條件 | 同上 |
| A2 單星十二宮 | 168 筆的個別「待老師確認」皆為「無」；可作工作素材與案例庫，不必逐筆重問 | `紫微斗數知識庫_v1.1_A2_十四主星十二宮單星落點_白話修正版_待老師確認.md` |
| 十四主星十二宮生成公式 | 主星核心與宮位分面固定，模型負責可追溯生活推演；A2 作金標、校準與禁區，不限制只能照抄，講義特殊落點才固定成卡 | 本輪決策 |
| A2 結構化示範 | 原文完整保留；168 筆另拆為核心、分面、機制、表現、邊界、規則身分及來源，按當次星宮取用，不整包送模型 | 本輪決策、ADR 0014 |
| A2 原子主張 | 同段不同結論各自保存來源與可信層級，不能整段一起升格；欄位與轉換流程延後到素材工程 | 本輪決策、ADR 0014 |
| 特殊星宮規則優先 | 講義明確特例必須保留，通用公式只能補充不衝突面向；真正互斥才停止並人工確認 | 本輪決策 |
| 一宮一分析單位 | 十二宮逐宮完成，再做全盤整合 | 本輪決策、ADR 0002 |
| 宮位推演分層 | 單宮只是資料來源；一般由本宮主星定核心、對宮主星定表現方式，空宮先經程式借星判定，再做三方四正＋暗合，飛化保持獨立 | 本輪決策、ADR 0013、ADR 0016 |
| 模組交接 | 宮位、飛化、全盤整合與寫作只接收上游已驗證結果；未驗證候選與模型原文不跨模組 | 本輪決策、ADR 0015 |
| 對宮使用邊界 | 預設只取能展現本宮核心的部分；固定對拱、生年四化或煞忌成立時，才加入其他壓力或矛盾 | 本輪決策、ADR 0013 |
| 三方四正影響 | 不改寫本宮結論；另說明相關宮位的祿權科或煞忌如何明確影響本宮決定及狀況 | 本輪決策、ADR 0013 |
| 暗合影響 | 不改寫本宮結論；另保存不易察覺、潛移默化的正負影響來源 | 本輪決策、ADR 0013 |
| 模型與程式分工 | 程式固定命盤事實、選卡與驗證；模型依底層核心做語意推演 | 本輪決策 |
| 本命與事件邊界 | 本命分析人格、價值、長期行為；具體事件與時間留給大限、流年 | 講義、小卡、本輪決策 |
| 多種可能 | 合理可能可以並存，不替客人決定真實經歷 | 本輪決策 |
| Actor 主體 | 父母、兄弟可先寫既存人物；其他關係宮命主優先，對象只作可能性 | 本輪決策 |
| 雙星人物關係 | 人物本身用完整雙星；具體互動可前星看對方、後星看命主；命主整體關係態度仍用完整雙星 | 本輪決策 |
| 抽象權威 | 政府、制度不能人格化成前星；只有具體承辦人才可作互動對象 | 本輪決策 |
| 四化 | 四化跟著被四化星曜與 Actor；祿、權、科、忌的共通底層已確認 | 小卡、舊 SOP、本輪決策 |
| 生年四化引擎位置 | 生年四化跟著星曜放入本宮＋對宮基礎推演，不另設獨立引擎；飛化才獨立 | 本輪決策、ADR 0013 |
| 飛化命盤事實 | 不是把星曜從出發宮搬到落入宮；是出發宮宮干使落入宮原本存在的指定星曜產生祿權科忌 | `06_D1_飛化推理模組.md`、舊 SOP、ADR 0003 |
| 飛化方向 | 出發宮人物／事情是影響來源，落入宮是受影響面向；先建宮位因果與四化動作，最後才由落入宮被飛化星曜說明作用方式 | 正式基準 SOP v1.2、本輪決策、ADR 0003 |
| 飛化對宮與底色 | 直接宮位因果能解通就不拉對宮；落入宮已有同類生年四化時，飛化只能觸發、加重、引動或帶出 | 正式基準 SOP v1.2、ADR 0003 |
| 飛化報告位置 | 每條飛化內部只保存一份權威影響鏈；客戶主文放在落入宮並明確交代來源，出發宮只在需要時簡短提示 | 本輪決策、ADR 0003 |
| 多來源飛化並存 | 同一落入宮的多條飛化同時存在；正負不抵銷、不加總、不選一條覆蓋其他條，客戶版按同一主題分別說明來源 | 本輪決策、ADR 0003 |
| 多來源共同行為 | 多條飛化形成同一可觀察行為時，內部保留所有來源；客戶版只寫一次行為並同時交代各來源 | 本輪決策、ADR 0003 |
| 來源角色可能性 | 出發宮有多個合法但未由客人背景確認的來源時，使用包容描述，不硬選唯一角色，也不按角色重複相同機制 | 本輪決策、ADR 0003 |
| 飛化客戶白話 | 不用「理財規劃受到影響」等抽象宮位分類交付；必須寫出來源經驗、內在感受、反覆行為與可能結果的生活因果鏈 | 本輪決策、ADR 0003 |
| 祿存 | 與化祿相似，是現有助力；有主星時增強其核心，資源保存與安全感是補充修正 | `14_D1_輔星煞星貴人星祿存.md` 等 |
| 四煞 | 每顆煞星保留自己的反應機制並標示 Actor；不強迫每種主體寫滿 | 小卡、本輪決策 |
| 煞忌重點 | 煞忌集中、化忌與陀羅宮位是感受較深的主題，不代表宮位比較重要 | `10_D1_全盤掃描與煞忌權重.md`、本輪決策 |
| 輔星 | 左輔、右弼、天魁、天鉞、文昌、文曲的主要分工已確認 | 小卡、本輪決策 |
| 空宮借星 | 由程式先判定；空宮有擎羊、陀羅、火星、鈴星、文昌或文曲任一顆就不能借，否則只借對宮十四主星與隨星生年四化；只有祿存仍可借，借入主星不視為較弱而是表裡如一 | `13_D1_空宮借星與身宮.md`、`20_D1_本命人格推理總控流程.md`、`21_D1_OpenAI多次呼叫編排規格.md` |
| 身宮 | 只作補充：較在意的生活領域、長大後較顯出的價值；不是主要解盤軸 | 講義、本輪決策 |
| 財帛／田宅金錢分工 | 財帛宮處理看錢、賺錢、花錢、理財與實際用錢；田宅宮處理財庫與存錢方式 | 本輪決策 |
| 田宅財庫邊界 | 本命田宅只分析存錢、累積與保留資產的方式及傾向；不能斷言實際金額、房產、有錢與否或最終結果 | 本輪決策 |
| 紫微田宅財庫 | 紫微會為拿得出手、有價值感的資產目標存錢；可舉好地段、好房子等可能目標，但不能斷言存得到或買得到 | 本輪決策 |
| 田宅財庫生成方式 | 不硬寫十四主星唯一答案；以主星核心 × 財庫分面推演，老師案例作金標，講義特殊規則才固定成卡 | 本輪決策 |
| 可追溯語意延伸 | 模型可推演固定卡片未逐字列出的現代例子，但每個人物、感受、行為與結果都必須由出發宮、落入宮、四化與被飛化星曜共同支持 | 本輪決策、ADR 0003 |
| 飛化星曜專屬性 | 同一來源宮、落入宮與四化，必須因被飛化星曜不同產生不同作用方式；天機忌偏反覆找方法，太陰忌可落在居家、布置、吃喝與生活花費仍覺得不足 | 本輪決策、ADR 0003 |
| 社會脈絡 | 命理核心固定；可依已核准機制推演當地現代例子，但必須保留星曜專屬證據鏈，報告語言另行處理 | 本輪決策 |
| 結論與例子分流 | 內部保存所有不同且成立的結論、機制與例子；客戶報告保留所有不同核心結論，但同一機制只選一至兩個代表例子，其餘留給大限、流年與聊天室 | 本輪決策 |
| 跨引擎共同行為 | 本對宮、三方暗合、飛化等引擎形成同一行為時，內部保留全部證據，客戶版只寫一次；不同與矛盾機制仍分開 | 本輪決策 |
| 客戶文章編排 | 宮位文章依生活主題排列，各引擎結論自然放入相應分面；不建立本對宮、三方或飛化技術章節 | 本輪決策 |
| 宮內說明順序 | 每個生活主題先說本宮原始核心，再說助力與干擾；煞忌不能取代或改寫主星人格結論 | 本輪決策、ADR 0013 |
| 客戶文章 | 直接提供十二宮人格分析，不寫命理教學；星曜可簡短自然說明，飛化只寫自然語言 | 本輪決策 |
| 報告整合 | 保留原始宮位主張，不用第二次全篇重寫；有問題只定點修復 | 本輪決策 |
| 報告速度 | 先實測各階段時間，再決定三分鐘、併發與成本，不先硬定 SLA | 本輪決策 |

## 已知舊資料衝突及處理

這些不是老師的新問題，而是後續整理時要依最新決策修正的版本差異。

| 舊資料 | 衝突 | 處理方式 |
|---|---|---|
| `07_四化正式規格_工作版.md` | 共通公式把命主寫成唯一 Actor；化祿漏掉好感、緣分與容易靠近 | 依「四化隨星隨主體」與化祿最新定義重整 |
| `0_主控.md` | 強迫每項都寫「怎麼被別人看見」 | 改為本命主動特質優先；他人回應有依據才寫 |
| `1_五步任務卡.md` | 強迫每個分面與事件例子都寫滿，飛化混在同一流程 | 改為有資料才建立內容格；飛化獨立分析 |
| `2_風格與品管.md` | 舊版固定篇幅與單次全篇寫作 | 改為十二宮依內容量浮動，全盤導讀另行生成 |
| `17_D1_十二宮完整含義層級_工作版.md` | 部分宮位分面仍是舊版，例如父母宮過窄、僕役宮仍有「異性別兄弟姐妹」、子女宮仍保留本輪已排除內容 | 依老師最新十二宮決定重建 Registry，不要求老師重講 |
| `15_D1_十二宮人格整合.md` | 命宮被寫成平時也修飾所有宮位 | 改為各宮通常獨立運作；煞忌或正式關係成立時才產生跨宮影響 |
| `12_D1_對宮暗合三方四正.md` | 對宮被寬泛列為背後想法、另一特質、幫助或牽制，未固定最主要的推演責任 | 依最新決策先固定為本宮核心的表現通道；其他作用只有固定規則支持時才加入 |
| `08_固定雙主星整理骨架.md` 第 8 條 | 舊版把人際宮前星／後星角色寫得過度單一 | 依最新「完整雙星＋互動角色切分＋制度權威」三層規則重整 |
| 專案內 A 核心字典 | 仍列天府財庫有祿為唯一待確認 | Desktop 的結案檔已回答，不再詢問 |

## Codex 自行完成，不問老師

以下是資料工程、架構或測試工作，不需要老師替系統整理。

1. 將老師最新十二宮分面重建為一份版本化 Registry。架構草案位於 `docs/ai-chart/twelve-palace-facet-registry-v1.md`，紫微單星第一輪驗證已完成，63 個核准分面也已轉成 `src/lib/ai-chart/d1PalaceFacetRegistry.ts` 程式 Contract；後續補分面說明卡與 Prompt 投影。
2. 把主星核心、宮位落點、身體、住家與生活例子拆成不同卡片層。
3. 把 `17_D1_十二宮完整含義層級_工作版.md` 納入正式來源包，並套用最新決策。
4. 將四化共通公式改成「星曜核心 × 四化 × 宮位分面 × Actor」。
5. 把化權、化科逐星工作版先視為底層公式的可測推導，不要求老師逐句重寫。
6. 更新雙星角色資料結構，分開完整雙星、具體互動角色與抽象制度。
7. 為 Candidate 增加 Actor、Palace Facet、Mechanism、Evidence Link。
8. 由實際核准內容格計算星曜與規則覆蓋，不讓模型重複手填 `majorStarsConsidered`。
9. 重建 Prompt，使模型不必強迫填滿所有分面、例子或他人回應。
10. 建立紫微星等脫敏金標案例，驗證底層核心能否自然推導十二宮生活表現。紫微單星第一版與紫微命宮兩格 Writing／Fidelity 離線金標已完成；後者已固定來源、客戶文字、Review、Adapter fingerprint、未量測 Benchmark Plan、未授權／不可呼叫的受控 Preview 與安全 Evidence Contract、只到原子 claim readiness 的 pre-request Gate、server-only exclusive claim adapter、同程序單次 Runtime handoff、零 request 的兩階段 mock-only Runtime、受限正文 write-once／readback、離線人工審查 decision／authorization handoff、未持久化的 review record template，以及尚未實作的 Production human-review 三段 port contract，後續再補本對宮、三方暗合與飛化組合案例。
11. 實測逐宮推論、飛化、寫作與審查所需時間，再討論延遲與模型分工。
12. 盤點正式付費報告如何在不影響付款與 Ownership 的前提下接入新引擎；現階段不實作。
13. 補齊 D1 總控文件引用但目前未完整納管的來源依賴，例如 02、11、15、17、19 等工作檔。
14. 等卡片、Registry 與 Contract 完成後，再處理 `runtimeEnabled` 與正式報告接線；這不是命理問答缺口。
15. 把現有「單宮一次呼叫」重整為本對宮、三方暗合、獨立飛化及最終整合的分層 Contract。概念版與第一組脫敏交接案例已完成；本對宮、三方暗合、只建立索引／來源圖的宮位整合，以及獨立飛化結果，已分別轉成 `d1PalaceAxisContracts.ts`、`d1StructuralInfluenceContracts.ts`、`d1PalaceIntegrationContracts.ts`、`d1FlyingInfluenceContracts.ts` 的 TypeScript／Strict JSON Schema／deterministic validator。飛化的 48 條權威 Fact、Palace Result 配對、K0 Knowledge View、Canonical Prompt Package、Result source binding 與十二宮落入索引也已完成；脫敏金標已驗證同一落入宮多條飛化零遺漏、正負並存且不抵銷。十二宮 Axis／Structural／Flying 的未合併來源格、四類全盤關係 source binding、逐關係語意審查、一來源一格的逐宮內容格、Writing Prompt Package、Writing Result、Fidelity Review Prompt Package 及兩個純資料 Adapter 都已完成；Package 會展開實際來源素材並分開生活地區與報告語言，但 OpenAI Runtime 仍保持阻擋。
16. 將空宮借星資格做成 N0 deterministic resolver；模型只接收核心模式與已核准借入來源，不能自行借星。

## 真正需要老師確認

目前阻擋本命人格架構的老師問題：

```text
0
```

人物宮位主體、輔星作用方向、天府財庫有祿、十二宮分面、四化共通規則與輸出方式，都已能由最新老師決策或較新的結案來源處理。

以下兩項是來源明確標示的「尚未正式定稿」，不是目前阻擋問題。先以正式單星核心建立可追查的工作推導並用案例驗證；只有要升格為固定權威卡，或案例真的出現來源無法裁決的歧義時，才詢問老師。

### 觀察題 1｜巨門太陽的一般核心

**缺口**

目前資料只有特定位置與旺落表現：

- 巨門太陽同宮寅位、申位的差異。
- 巨門太陽對拱巳位、亥位的差異。

但缺少一個不先綁定宮位、旺落與煞忌的共同底層，以及同宮與對拱應如何區分。

**需要升格時的白話問題**

> 先不管落在哪個宮位、旺落和煞忌，巨門太陽最基本是怎樣的一種思考與行為方式？同宮與對拱的核心差別是什麼？

**來源**

- `content/ai-chart/d1-v1/knowledge/reasoning/08_固定雙主星整理骨架.md` 第 21、22 組及缺口清單。

### 觀察題 2｜天機巨門無煞時的一般核心

**缺口**

同宮已有「思考邏輯＋博學、學者型、耐得住寂寞」；對拱資料主要記錄遇煞後的人際與爭吵風險，缺少無煞時能跨宮使用的一般人格核心。

**需要升格時的白話問題**

> 先不管宮位和煞忌，天機巨門平常是怎樣思考、說話和做決定？同宮與對拱需要分成哪兩種底層方式？

**來源**

- `content/ai-chart/d1-v1/knowledge/reasoning/08_固定雙主星整理骨架.md` 第 25、26 組及缺口清單。

## 先用案例校準，不先問老師

以下資料標示工作版，但不代表必須逐句請老師重講。先用脫敏命盤案例與結構化輸出測試；只有測試出現兩種都合理、來源不能裁決的差異，才升格為老師問題。

1. 紫微天府、紫微七殺、紫微破軍、紫微天相、紫微貪狼五組工作版。
2. 廉貞破軍與天相對拱的精確生活表現。
3. 巨門太陽的一般人格工作推導。
4. 天機巨門無煞時的一般人格工作推導。
5. 化權十顆星的逐星自然表達。
6. 化科十顆星的逐星自然表達。
7. A2 168 筆白話落點是否都能由星曜核心與宮位分面反推。
8. 每宮需要多少可能表現才兼顧完整、可讀與不硬湊。

## 延後處理

以下不屬於目前本命人格引擎，不能混入現在的提問額度。

### D2 大限與流年

- 地空、地劫主要在大限與流年依事件啟用；正式架構只採同宮與對宮的完整作用，不採夾與三合拱半力。核心是使原本事件結果減弱、取消或無法留下，D2 規格需把原始事件判斷放在空劫作用之前。
- 貪狼與火星／鈴星形成「大發」的完整時空條件。
- 天相官非、七殺暴力、交通與健康等具體事件成立條件。
- 本命人格如何與每個十年大限人格疊加。
- 流年如何觸發選擇、事件與結果。
- 事件發生年份、嚴重度與結果。

### AI 聊天室

- 如何依客人問題動態調取前後大限與流年。
- 如何引用已完成報告又不讓聊天模型改寫底層命理。
- 客人回饋如何作為對話背景，而不是反向污染固定規則。

### 產品與營運

- 三分鐘是否為可達成的正常生成時間。
- 哪些階段可換成更快或較便宜的模型。
- 通知、排隊、恢復與逾時介面。
- 報告與後續聊天的定價。

## Matt Pocock Skills 使用方式

依 `matt-pocock-router`，本階段只使用最小必要技能：

| 階段 | Skill | 用途 |
|---|---|---|
| 來源盤點 | `research` | 一次查完講義、小卡、舊 SOP、程式與既有決策，記錄來源 |
| 概念整理 | `domain-modeling` | 統一 Actor、宮位分面、底層核心、可能表現等領域語言 |
| 老師校準 | `$grill-with-docs` | 只從本文件取一個真正缺口，邊確認邊更新文件 |
| 引擎架構 | `codebase-design` | 在規則確定後設計卡片、候選、驗證與多階段邊界 |
| 小型模型實驗 | `prototype` | 用脫敏案例測品質、時間與輸出結構，不直接改正式流程 |
| 正式實作 | `tdd` | 先以金標與 Contract 測試固定規則，再接程式 |
| PR 審查 | `code-review` | 檢查實作是否忠於本文件、沒有擴大命理規則 |

`$to-spec`、`$to-tickets` 與 `$implement` 要等架構及真正缺口確認完成後，再由使用者明確啟動。

## 下一步

目前不需要再問老師祿存、十二宮分面、Actor、四化共通規則或報告形式。

下一步應由 Codex 先完成：

1. 本命人格高階模組、交接結果、驗證順序與十二宮分面 Registry 已完成第一版一致性整理。
2. 紫微單星十二宮脫敏驗證案例已完成；底層核心足以在最新 Registry 範圍內產生可追溯生活表現，目前沒有老師阻擋問題。
3. 把現有來源整理成正式卡片分層；A2 欄位及批次轉換流程留到素材工程處理。
4. 本宮核心、對宮表達、空宮借星、本命四化、三方暗合及獨立飛化的第一組脫敏模組交接案例已完成，現有底層規則可完整支援。
5. 十二宮 Registry、本對宮 Contract、Actor Binding、固定角色規則來源 Registry、三方四正＋暗合 Structural Influence Contract、deterministic 宮位整合 Contract、獨立 Flying Fact／Flying Influence Contract，以及 48 條權威 Flying Fact 產生器，都已轉成 TypeScript 型別、Strict JSON Schema 及 validator tests。宮位整合只索引原始 Axis claim 與結構影響鏈；Flying Fact source 已由固定四化表與原盤星曜落點 deterministic 產生；48 條 Fact、Model Input、Knowledge View、Prompt Package、source-bound Result、十二宮完整落入索引、未合併來源格、四類全盤關係來源綁定、語意審查、逐宮內容格、單宮 Writing Prompt／Result、Fidelity Review Prompt／Result、兩個純資料 Adapter、紫微命宮兩格 synthetic Golden Case／Benchmark Plan、受控 Preview／安全 Evidence、pre-request Gate／一次性授權／claim observation Contract、trusted server-only atomic claim adapter、只到 claim 後停止的 pre-request coordinator、不可仿造且單次消耗的同程序 Runtime handoff、零 request 的兩階段 mock-only Runtime、真實計數 execution ledger、terminal Ledger 到 final Evidence 的安全純投影、write-once Evidence persistence envelope、server-only safe Evidence writer、terminal Ledger 的單一 server-only persistence coordinator、保存後的 bounded readback verifier、成功 Evidence 綁定 validated Writing／Fidelity 結果的 restricted artifact 純資料 Contract、restricted artifact 的私有 write-once persistence envelope、server-only restricted artifact writer、restricted artifact bounded readback verifier、human-review decision proposal Contract、synthetic authorization handoff、review record template 與尚未實作的 Production human-review 三段 port contract 都已完成。Fidelity bridge 已改由第一階段實際通過驗證的 Writing Result 動態建立；safe Evidence 已能由唯一入口單次保存並在人工審查前重驗完整性，模型正文也能以受限資料分類綁定回兩階段結果 SHA，並以固定檔名、完整 payload SHA、私有權限與禁止覆寫政策保存 synthetic artifact，再於 readback 重驗 storage、canonical bytes、fingerprints 與來源綁定；人工選擇也只能先形成未授權提案，port contract 也只宣告 request-bound authorization、Server clock 與 write-once storage 責任，不會直接放行。它仍未取得可信任 reviewer 的登入／權限驗證且不可交付。在另行完成 production Runtime Adapter、trusted human-review adapter 與正式授權前仍不發 request，也不需老師重講公式。
   最新邊界補充：正式 Report／Snapshot／Artifact 的 synthetic 單次綁定 Contract 也已完成。它只證明未來 trusted Report lookup／human-review adapter 必須由 Server 驗證 Report UUID、paid、owner、canonical Snapshot SHA 與 Artifact source match；目前沒有正式查詢、持久化或交付能力。
   最新授權邊界補充：request-bound reviewer authorization 已沿用既有 Server admin auth seam 實作；它只從 Supabase Auth 驗證後的 Request session 取得 reviewer UUID，並固定唯一審查 permission，不保存 email 或 token。此 capability 尚未接 route、Report lookup、Server clock 或正式 writer，仍不可建立正式紀錄或交付報告。
   最新 Report 邊界補充：Server Report subject read seam 已接到既有 Supabase repository，會驗證 Report UUID、owner、paid 及 canonical Snapshot，再只輸出 Report UUID 與 Snapshot SHA。N0 現為 canonical Snapshot digest 的唯一來源；相同 digest 已沿 Content Grid、Writing Prompt Package／source trace 傳到 Restricted Artifact，且納入 package／artifact fingerprint。新的 Server-only source binding 會單次消耗原始 Report subject 與原始 Artifact，只有兩端 SHA 完全相等時才建立 `SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH` capability；copy、clone、第二次消耗或 source drift 都拒絕。這仍不會建立正式 review record 或交付報告。
   最新人工審查 command 邊界補充：既有 request-bound reviewer authorization、精確 source-binding capability 與 decision proposal 已能組成一次性的 Server-only command。程式會鎖定 Gate、Artifact fingerprint、payload SHA、Report、reviewer、decision 與固定 issue codes，狀態只到 `AUTHORIZED_SOURCE_BOUND_AWAITING_SERVER_CLOCK_AND_WRITE_ONCE_RECORD`；沒有 timestamp、正式 record 或交付權。
   最新人工審查紀錄封套補充：module-owned Server clock 已能在 command 消耗前產生並驗證 UTC 時間；正式 command 會再形成 canonical、frozen、一次性的 `human-review-record.json` 封套，綁定完整來源與授權 fingerprints、payload SHA、Gate scope、exclusive create 與私有權限。Production caller 不能注入時間；時鐘失敗不會消耗 command。封套目前固定為 `CANONICAL_RECORD_READY_NOT_PERSISTED`，尚未寫 filesystem／Supabase，也不解除客戶交付。
   最新人工審查紀錄 writer 補充：Server-only writer 已能只消耗原始 envelope，在固定 private temporary storage 以 Gate directory claim 與 `open("wx")` 單次保存 canonical `human-review-record.json`。同 Gate 並行／重複寫入、copy、caller-selected root、symlink 與權限漂移都拒絕；receipt 不含 path、Report／reviewer ID 或正文。保存狀態仍只有 `PERSISTED_AWAITING_VERIFIED_READBACK`，尚未成為 verified durable record，也不解除客戶交付。
   最新人工審查紀錄 readback 補充：Server-only verifier 已能單次消耗原始 writer receipt，從固定 Gate 位置以 32 KiB 上限讀回唯一 canonical record，重驗 private metadata、realpath、symlink、Strict shape、payload SHA、record／Gate／envelope receipt binding。Copy／clone、重複讀回、內容竄改、多餘檔案、權限漂移與超量都 fail closed；核准只到等待 delivery coordinator，修正與拒絕仍保持阻擋。
   最新客戶交付協調邊界補充：只消耗 exact verified approval 的 customer-delivery coordinator Contract 已完成。它以離線 injected probe 重驗同一 Report／Snapshot、有效 owner、paid、pending 與正文尚未發布；修正／拒絕、copy、重複使用、state drift、owner 缺失、未付款、終止狀態與已有正文都拒絕。成功只建立一次性 `READY_STOPPED` handoff，仍不寫 Report、不接 Supabase、不建立 route、不放行客戶。
   最新可信交付 Adapter Contract 補充：只消耗 exact coordination capability 的單次 Contract 已完成。它以 Report／Snapshot／Gate／review record／coordination bindings 推導固定 idempotency key，並把責任順序鎖成 durable review ledger → 原子 Report delivery claim → verified restricted artifact 正文發布。Exact replay 以外的衝突都拒絕；現有 read-then-write `report_content` gate 明確不足。本層所有 port 仍為 `NOT_IMPLEMENTED`，零 ledger write、Report mutation 與 OpenAI request。
   最新可信交付離線 Probe 補充：test-only injected fake 已實際驗證三個 Port 的固定順序、前段 receipt binding、全新成功、三段 exact replay、兩種 partial-failure reconciliation、idempotency conflict、impossible replay conflict 與單次 capability。Port exception、加料 outcome、copy、非 test environment 或重複使用都在安全邊界 fail closed；Probe 不自動 retry，且實際 ledger write、Report mutation、Artifact read 與 OpenAI request 都是零。
   最新持久化 Draft Migration 補充：既有 Report／付款／read gate 唯讀盤點已完成，並新增 Repository-only `20260728120000_ai_chart_report_trusted_delivery_contracts.sql`、source-contract tests 與隔離 PostgreSQL 17 integration tests。草案新增 Report `chart_snapshot_sha256`、不可變 review ledger、不可變 delivery receipt 及只授權 `service_role` 的單一 atomic delivery RPC；RPC 先驗證 review canonical JSON 的實際 SHA 與精確 23 欄內容、持久化 Snapshot SHA、Artifact／Gate／record bindings、owner／paid／pending／content absent 與正文 SHA，再於同一 transaction 發布 Report 並建立 receipt，完全相同的既有結果才可 exact replay。Local synthetic database 已驗證首次發布、replay、Snapshot／payload／idempotency／ledger conflicts、後段 rollback、immutability、RLS 與直接權限拒絕。Migration 尚未套用 Supabase／Production，沒有正式 Adapter／route／worker、沒有真實 Artifact／Report 寫入，也尚未修改客戶 read gate。
   最新 Report create digest 補充：Server repository 現在會先建立實際保存的 canonical Snapshot copy，再以與 N0 相同的 canonical JSON SHA-256 規則同步寫入 `chart_snapshot_sha256`；public create input 沒有 digest 欄位，API 也明確拒絕 Client 傳入 camelCase 或 snake_case digest。Repository mock 已驗證 insert 的 Snapshot 與 digest 一致，含額外未授權欄位的輸入則先清理再計算。這仍未套用 Migration、連線 Supabase／Production 或寫入真實 Report；正式 rollout 順序必須先 Migration、後應用程式寫入。
   最新 trusted-delivery repository 映射補充：Server-only 離線 Adapter 現已重新驗證 canonical approved review record、完整 restricted artifact SHA／fingerprint、Writing／Fidelity 與 Report／Snapshot／Gate bindings；owner 只由 injected Server lookup 取得，正文只由已審核 Writing sections 依序產生。它把資料精確映射成 Migration 的固定 17 欄 atomic RPC command，owner lookup／RPC fake 各一次、零 retry，並驗證首次 publish、exact replay、單次 capability、caller owner／artifact drift 拒絕及安全錯誤分類。此 Adapter 只允許 test mode，沒有連線 Supabase、套用 Migration、寫入 Report／Artifact、建立 route 或發 OpenAI request，客戶交付仍為 false。
   最新 Supabase RPC source contract 補充：test-only Server repository 現已固定 `.rpc('deliver_ai_chart_report_after_review', exact17FieldCommand)` 精確一次、零 retry。Command 的 frozen exact shape、UUID、SHA、review record 與 report content 會在 call 前重驗；成功只接受單列五欄 data。空列、多列、加料 row、transport exception 與未知 PostgREST error 都使用固定安全錯誤，只有 Migration 固定 failure message allowlist 可供上一層分類，details／hint／status／任意 provider message 不會保存。此層仍未建立 Supabase client、連線資料庫、套用 Migration、建立 route 或交付客戶，Production factory fail closed。
   最新 Supabase admin client bundle 補充：test-only Server factory 現已精確取得一次 injected admin client，並把 `ai_chart_reports` 的最小 `id,user_id` owner lookup 與單一 atomic RPC invoker 綁成兩欄 frozen repository bundle。Owner query 使用 `.retry(false)` 明確關閉 PostgREST GET transport retry且只執行一次；provider error、not found、加料 row、Report ID drift、transport exception 或偽造 owner command 都在 RPC 前停止且不洩漏 provider／owner。成功後 RPC 才以同一 client 執行一次。Production 在 client creation 前 fail closed，仍沒有環境變數讀取、Supabase connection、Migration、route 或交付。
   最新 Production binding readiness 補充：test-only Server contract 現已把 Migration readiness → Runtime activation → existing `getSupabaseAdmin` binding 固定成唯一順序。Migration version、path、tracked SHA 與 RPC 都是 module-owned；activation 必須回綁 readiness fingerprint。Migration 未就緒時 activation／client 都是零次，Runtime 未啟用時 client 是零次；既有 admin module 只有 type-only import，Production 在第一段前 fail closed。
   最新 Production readiness sources 補充：test-only Server Adapter 現已把 Migration readiness 限定為 `APPROVED_PSQL_EXACT_FILE_RUNNER` 的單次 exact attestation，固定驗證 commit SHA、Migration identity、source validation、preflight、apply、postflight、Schema 與 service-role-only grant；exception、not-verified、加料 response、畸形 commit 或重用都固定拒絕且不洩漏 provider 診斷。Runtime activation policy 是 module-owned static blocked，不接受 caller／environment override；完整 attestation 通過仍會以 `RUNTIME_NOT_ACTIVE` 在 admin binding 前停止。
   最新 Runtime activation authorization 補充：test-only Server handoff 現已把授權 target 綁到精確 Release commit、Migration readiness fingerprint、module-owned Migration／policy identity 與唯一 scope。Injected boundary denied、Release drift、加料 outcome 或 exception 都固定拒絕；通過後的能力只存在於原物件 identity，copy／clone 無效且最多消耗一次。成功消耗仍固定 `runtimeActivationAllowed=false`，沒有正式授權、Runtime、admin client、Supabase、route、Report mutation 或 OpenAI request。
   最新 Runtime authorization binding 補充：既有 Production readiness Adapter 現已精確要求原始 handoff。Controlled deployment attestation 先固定 Release commit 與 canonical Migration readiness fingerprint，Runtime verifier 才能單次消耗 handoff並重驗 Release、fingerprint、feature、Migration／policy identity；copy、重用與 drift 都固定拒絕。完整綁定仍回傳 inactive，admin factory、Supabase、Report mutation 與 OpenAI request 都是零。
   最新 Runtime authorization Port 補充：Server-only declaration 現已把未來正式 Adapter 固定成一個 exact Release command → safe decision 的小 Interface。Command 只含 module-owned Release／Migration／policy bindings；outcome 只可回綁相同資料並回傳 `AUTHORIZED`／`DENIED`。Authorizer 身分、proof、provider message、自由文字、caller boolean、可重用 token 與 environment override 都禁止，五個 failure code 固定。正式 source 仍未選擇，Port 仍未實作，Environment／Secret read、Adapter invocation、Runtime、admin client、Supabase、Report mutation 與 OpenAI request 都是零。
   最新 Runtime authorization source 補充：老師已選擇專用 `ai-chart-production-runtime` GitHub Environment required-reviewer 人工核准，並要求綁定 main、exact Release commit、Migration identity／readiness fingerprint、Runtime policy 與既有 Port fingerprint。新 Server-only Contract 只記錄 source selection 與 required checks，序列化 metadata 沒有授權效力，Environment／Workflow／reviewer／Secret／Adapter／attestation transport／durable activation state 均未建立或實作，GitHub API、Runtime、admin client、Supabase、Report mutation 與 OpenAI request 仍為零。
   最新 Runtime authorization transport 補充：Environment Contract 已補 prevent self-review、禁止 administrator bypass 與 main-only；新的 Server-only OIDC Contract 把可信任傳遞固定為短效 signed GitHub identity、strict exact command 與 durable atomic replay guard。未來 Server 必須驗證 OIDC 簽章、時間、Repository／Environment／main／Release／Workflow claims，並逐項重驗 Migration／readiness／policy／Port bindings；raw token、reviewer、proof、provider payload、自由文字與 long-lived Secret 都禁止保存或輸出。這仍沒有 Workflow、token request、endpoint、verifier、replay store、Runtime、Supabase 或 OpenAI request。
   最新 durable authorization receipt 補充：新的 Server-only Contract 已固定最小 immutable receipt shape、`replayKeyFingerprint` 與 `authorizationCommandFingerprint` 雙唯一鍵、單一 atomic create-or-exact-existing、六種 reconciliation case 及 Runtime exact read seam。單鍵存在、兩鍵分岔、binding drift 與不確定寫入都 fail closed 或唯讀 reconciliation，沒有 blind retry；receipt 不保存 raw claims、token、reviewer、proof、provider payload／message或自由文字，Runtime 還要重驗目前 Release、Migration readiness、policy 與三層 Contract fingerprint。這仍沒有 storage Schema、repository adapter、Runtime reader、database connection、Report mutation 或 OpenAI request。
   最新 durable authorization receipt 離線 Probe 補充：test-only public Repository seam 已驗證 concurrent create 只有一個 fresh winner、exact replay、command／replay／cross-key conflict、commit 後 unknown-write 的顯式 read reconciliation，以及 Release／Contract drift fail closed。Probe 不自動 retry、不觸發 accessor、不保存 raw claims、token、reviewer、proof 或 provider 文字，Runtime／客戶交付／database／Report mutation／OpenAI request 都是零；其 module-private indexes 不是正式 durable storage。
   最新 durable authorization receipt Storage／Adapter Mapping 補充：declaration-only Contract 已固定 `ai_chart_private` 的 21 欄 normalized append-only table、command／replay 雙唯一鍵、private／forced-RLS／service-role-only 權限，以及對外兩方法映射到內部原子 create、unknown-write 雙鍵 reconciliation、Runtime read 三個 RPC。Reconciliation 只是 transport outcome unknown 後的一次唯讀核對，不是 write retry；不保存 JSON、raw claims、token、reviewer、provider 文字或自由文字。
   最新 durable authorization receipt RPC Adapter Probe 補充：test-only injected RPC Port 已驗證 21 欄 create mapping、單欄 Runtime read、一次 write、只在 unknown outcome 後的一次雙鍵 reconciliation、四個 success codes、七個 fixed failure mappings、strict response reconstruction 與 current binding revalidation。Probe 沒有 `.rpc()`、Supabase client、database connection、Runtime、Report mutation 或 OpenAI request。
   下一個步驟由 Codex 先設計 authorization receipt 專用 Migration 與 Production Adapter source；不得在未取得當次對應授權時建立／修改 GitHub Environment、OIDC 設定、Secret、Production Workflow或套用 database Migration。
6. 只有實作案例真的碰到兩個觀察題，且現有來源無法裁決，才向老師提問。
