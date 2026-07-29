# 紫微斗數本命人格推演來源盤點

## 盤點目的

這份文件回答的不是「專案裡有沒有紫微斗數資料」，而是：

1. 老師原本的本命人格推演邏輯分散在哪裡。
2. 舊 SOP、小卡與目前程式是否真的表達了相同邏輯。
3. 哪些內容可以直接沿用，哪些需要重新分層，哪些仍要逐題向老師確認。

本次以老師講義、課程逐字稿、老師已確認的小卡、D1 工作文件及目前程式碼為第一手來源。沒有以網路流派補足規則。

## 一句話結論

老師要的底層邏輯大部分已經存在，但散落在不同年代的講義、SOP、工作小卡與程式 Contract 裡。現在的主要問題不是「沒有資料」，而是：

- 星曜核心、宮位分面、生活例子與客戶文案混在同一張卡。
- 新舊宮位定義同時存在，部分正式檔名裡仍保留已被老師修正的舊內容。
- 本命人格的「命主主動特質」與「別人對命主的回應」沒有明確分欄。
- 現行 Prompt 甚至把「怎麼被別人看見」設成每個結論的必答項目，容易強迫模型補出沒有命理依據的外界回應。
- 目前正式付費報告仍走固定模板；D1 的 N0／K0／P1 只到受控 Preview 與 Contract，尚未接成完整十二宮正式報告。

## 來源優先順序

檔名中的「正式版」或版本號不能單獨決定權威。建議固定採用下列順序：

1. 老師在目前討論中明確修正或新增的決定。
2. 老師講義與課程逐字稿中的直接說明。
3. 標示為老師已確認的核心卡與推理卡。
4. 已確認的 D1 工作規格。
5. 尚待老師確認的工作版、小卡草稿與整理骨架。
6. 舊版單體 SOP、舊報告範例與 CTA 文案。

正式主星字典本身也記錄了「最新老師／聊天室修正優先」的原則，可見「正式定稿」仍不能蓋過後來的老師決定：[十四主星核心字典](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/core/紫微斗數知識庫_v1.2_A_十四主星核心字典_正式定稿版.md)。

## 來源地圖

### 老師講義與課程

- 講義根目錄：[/Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義>)
- 十四星曜十二宮講義：[/Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/教學/14星耀12宮解讀](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/教學/14星耀12宮解讀>)
- 第一屆課程逐字稿：[/Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/紫微教學/紫微斗數第一屆](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/紫微教學/紫微斗數第一屆>)
- AI 命盤解讀工作區：[/Users/tsu/Desktop/紫微斗數/01_紫微斗數/02_AI命盤解讀](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/02_AI命盤解讀>)
- 研究筆記：[/Users/tsu/Desktop/紫微斗數/01_紫微斗數/03_研究筆記](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/03_研究筆記>)

### Repository 內已納管的 D1 素材

- D1 素材總覽：[content/ai-chart/d1-v1/README.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/README.md)
- 素材 Manifest：[content/ai-chart/d1-v1/manifest.json](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/manifest.json)
- 十四主星核心：[A_十四主星與輔煞四化.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/core/A_十四主星與輔煞四化.md)
- 雙星核心：[B1](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/core/B1_雙星組合_紫府武廉殺破狼相.md)、[B2](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/core/B2_雙星組合_機月同梁日巨.md)
- 十二宮分面：[C_十二宮分面與身宮疾厄田宅.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/core/C_十二宮分面與身宮疾厄田宅.md)
- 四化工作規格：[07_四化正式規格_工作版.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/07_四化正式規格_工作版.md)
- 雙主星骨架：[08_固定雙主星整理骨架.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/08_固定雙主星整理骨架.md)
- 煞忌與全盤掃描：[10_D1_全盤掃描與煞忌權重.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/10_D1_全盤掃描與煞忌權重.md)
- 對宮、暗合、三方：[12_D1_對宮暗合三方四正.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/12_D1_對宮暗合三方四正.md)
- 空宮與身宮：[13_D1_空宮借星與身宮.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/13_D1_空宮借星與身宮.md)
- 輔星、煞星、貴人與祿存：[14_D1_輔星煞星貴人星祿存.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/14_D1_輔星煞星貴人星祿存.md)
- 飛化模組：[06_D1_飛化推理模組.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/06_D1_飛化推理模組.md)
- D1 總控：[20_D1_本命人格推理總控流程.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/primary/20_D1_本命人格推理總控流程.md)
- 多呼叫編排：[21_D1_OpenAI多次呼叫編排規格.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/primary/21_D1_OpenAI多次呼叫編排規格.md)

## 老師真正要的推演骨架

### 1. 以一個宮位為基本分析單位

老師的目標不是讓模型背一篇「紫微星在某宮」的固定文案，而是讓模型取得：

1. 該星不變的核心。
2. 該宮真正負責的生活面向。
3. 同宮、四化、輔煞、對宮、暗合、三方、飛化等修飾。
4. 依底層因果推成命主的想法、選擇、行為與生活可能。

D1 總控也明訂「主星／雙星＝場景中的主要態度與處理方式；四化／輔煞星＝作用、空缺、反應與修飾」，且應先完成每宮，再做跨宮整合：[20_D1_本命人格推理總控流程.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/primary/20_D1_本命人格推理總控流程.md)。

### 2. 本命盤先說人格可能，不搶著斷事件

全盤掃描卡明確區分：D1 保留人格、價值觀與長期行為的可能範圍；具體事件、時間與人物責任留給 D2 大限／流年：[10_D1_全盤掃描與煞忌權重.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/10_D1_全盤掃描與煞忌權重.md)。

因此本命人格的預設觀察順序應是：

1. 命主本人的核心傾向。
2. 命主怎麼想、怎麼選、怎麼做。
3. 在有明確關係宮位或因果規則時，才補關係對象、別人回應或互動循環。
4. 不把「別人會怎樣」變成每顆星、每個宮位的強制欄位。

### 3. 保留多種成立的可能，不替客人武斷選唯一答案

D1 總控與多呼叫規格都要求先保留所有命理上成立、生活上合理的候選，不把複雜的人格壓成一條「最准答案」：[20_D1_本命人格推理總控流程.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/primary/20_D1_本命人格推理總控流程.md)、[21_D1_OpenAI多次呼叫編排規格.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/primary/21_D1_OpenAI多次呼叫編排規格.md)。

這與老師現在要求的報告方式一致：十二宮逐宮說明，給生活例子讓客人比對，而不是由模型替客人宣判他「一定是哪一種人」。

## 輔星「命主主動」與「別人回應」的來源結論

這是目前最需要重新定義欄位的地方。

### 講義與逐字稿證據

第一屆課程有一個很清楚的連續說法：

- 先說「你就是會熱心幫人」。
- 接著才說「然後你也會有貴人來幫你」。

來源：[2025-09-26 教學文字檔.srt](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/紫微教學/紫微斗數第一屆/2025-09-26 紫微斗數第一屆3:52/教學文字檔.srt>) 第 207、211 行附近。

另一次課程則保留雙向可能：「他要嘛當別人貴人，要嘛是他需要有貴人來幫他」。

來源：[2025-10-24 新增專案.srt](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/紫微教學/紫微斗數第一屆/2025-10-24 紫微斗數第一屆6:52/新增專案.srt>) 第 5315 行附近。

### 小卡證據

目前輔星卡同時保留：

- 命主得到幫助。
- 命主成為別人的貴人。
- 互助可能從命主先幫人開始，也可能由貴人先出現。

來源：[14_D1_輔星煞星貴人星祿存.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/14_D1_輔星煞星貴人星祿存.md) 第 103–114 行。

### 目前可確定的結論

- 「命主幫人」和「命主被幫」都不是憑空推測，來源裡都有。
- 但本命人格報告的主要視角應先回到命主自身的特質與主動行為。
- 「別人因而回應」可以保留，但必須有關係宮位或因果鏈支持，而且使用可能語氣。
- 不能要求每顆輔星都同時生出兩邊，也不能把兩邊混成同一句無法追查的結論。

老師確認左輔的主動核心：

- 命主願意站在對方這邊、表態支持、講義氣及主動幫忙。
- 左輔不只表示口頭聲援，但不能單獨證明命主一定出錢、提供資源或實際代為處理。
- 是否進一步出錢出力，必須再看主星、宮位與其他星曜。
- 別人因命主平常願意幫忙而回頭相助，是第二層可能，不是保證結果。

老師確認右弼的主動核心：

- 右弼偏向以細膩說話、安慰、提醒、圓場與協調來幫助別人。
- 左輔偏站隊、表態及講義氣；右弼偏溝通與情緒照顧，兩者不可合併成同一種模糊助力。
- 命主平常照顧別人情緒，可能形成別人日後回頭相助的第二層關係回應。
- 右弼遇煞忌時，可能替錯誤或不適合的事情圓場、安慰或協調，反而幫錯方向。

老師確認天魁的雙向助力：

- 命主可能遇到檯面上、身分明確且有能力的人，正式提供意見、專業、資源或實際協助。
- 命主也可能利用自己的能力、專業、身分或資源，公開、正式地成為別人的貴人。
- 天魁著重實際能力、專業及資源，不能與左右的表態、安慰、圓場或人情支持混成同一類。
- 兩個方向均為可能，必須依宮位主體分開，不能斷言貴人或幫助已經出現。

老師確認天鉞的雙向助力：

- 命主可能被私下提醒、暗中安排、牽線，或在對方不公開出面的情況下得到能力與資源協助。
- 命主也可能在幕後提醒、安排資源、牽線或替別人處理問題，不一定公開出面。
- 天鉞與天魁都具有實際能力、專業、資源或安排效果；天魁偏檯面上正式出面，天鉞偏檯面下運作。
- 天鉞不能和右弼的安慰、圓場及溝通支持混用，也不能斷言幕後幫助已經發生。

老師確認文昌的本命主動特質：

- 文昌主要描述命主的理性、邏輯、條理、規則、文字說明、資料整理及制度內學習方式。
- 可觀察行為包括問清楚、查資料、列清單、整理文字或按規則處理。
- 文昌本身不強制產生他人回應。
- 只有宮位與因果適合時，才可補充別人可能覺得命主說得清楚、做事有條理或值得信任；不能直接斷言命主已取得制度認可或成就。

老師確認文曲的本命主動特質：

- 文曲主要描述命主的感受、情緒、美感、表達、創作、表演及氣氛感知。
- 可透過說話、文字、打扮、創作或表演呈現，但不能直接斷言已取得相關成就。
- 文曲不強制產生他人回應；狀態不好時，可能因感受與情緒太多而難以說清楚真正想法。
- 昌曲的固定差異是「文昌偏理性、文曲偏感性」，不能合併成模糊的才華標籤。

### 老師後續確認的 Actor 規則

老師已確認父母宮與兄弟宮可以先當成既存人物／關係現象觀察，因為爸爸、媽媽早於命主存在。這種讀法類似先看到一個已存在的狀態，但仍屬本命人格資料，不等於預測具體事件。

以「紫微加左輔在父母宮」為例，可以分開保留：

- `父親／長輩`：父親重視面子，也可能願意幫助別人。
- `命主`：命主面對父親／長輩時，可能較願意主動幫忙。

兩種都有可能，但必須是兩項不同 Actor 的主張，不能混成一句。目前這項例外只確認到父母宮與兄弟宮。

老師再確認其他關係宮位不沿用同一規則：

- 夫妻宮、子女宮與交友宮先描述命主自己的態度與行為。
- 伴侶、孩子／寵物、朋友／同事等另一方，只是命主可能期待、遇到或感受到的「關係對象可能」。
- 另一方不得直接寫成已存在或已確定的客觀現象。
- 命主與另一方仍須分成不同 Actor 的主張。

老師進一步確認父母宮與兄弟宮的單主星推演順序：

1. 星曜先描述父親、母親等既存人物本身。
2. 再由該人物特質推導命主可能形成的主觀感受與相處方式。
3. 第二層屬於關係影響，不代表命主也直接擁有同一顆星的個性。

例如單星紫微在父母宮：爸爸可能重視面子、尊重與身分；命主可能因而覺得相處需要講禮數、顧及爸爸面子或彼此帶有距離。不能把第二層改寫成「所以命主也是紫微、也一定愛面子」。

老師接著確認父母宮雙主星不是單純切成「前星爸爸、後星命主」，而有三種用途：

1. 爸爸本身的人格／現象使用完整雙星組合。
2. 只有拆解爸爸與命主的雙方對待角色時，才以前星代表爸爸、後星代表命主。
3. 命主面對長輩、主管階層、上位者或政府機關時，仍以完整雙星組合解讀其態度。

例如紫微天府在父母宮：爸爸是紫微天府的整體狀態；雙方互動中紫微偏爸爸、天府偏命主；命主面對權威階層的整體態度仍由紫微天府共同構成。

老師確認這套前後角色切分可提升為命主與具體互動對象相處時的通則：

- 完整雙星組合描述命主面對該類關係的整體態度。
- 需要拆雙方對待時，前星代表對方，後星代表命主。
- 父母宮、兄弟宮另因爸爸／媽媽是既存人物，可以再用完整雙星直接描述該人物本身。
- 互動對象不只限真人；寵物也可以用前星看寵物的互動側、後星看命主，完整雙星則描述命主養寵物與相處的整體方式。

例如紫微天府在兄弟宮：媽媽本身是紫微天府的完整狀態；命主面對同性別兄弟姊妹或新朋友的態度也由紫微天府共同構成；若拆雙方相處，紫微偏對方、天府偏命主。

老師確認抽象制度是這條規則的邊界：

- 政府機關、規章或抽象權威本身不當成前星人物。
- 命主面對制度時，使用完整雙星分析其態度。
- 只有具體官員、承辦人或其他代表人出現時，才可以前星看對方、後星看命主。

## 主星卡應如何拆

老師已確認主星核心只保存不隨宮位改變的底層：

- 定位／化氣。
- 核心需要與價值。
- 正常與失衡表現。
- 煞忌、助力條件。
- 不可過度簡化的禁用說法。

下列內容不應再混在主星核心卡：

- 十二宮落點。
- 身體對應。
- 居家／環境對應。
- 客戶版生活例子。
- 飛化推論。
- 特定社會脈絡的翻譯。

目前正式主星 Markdown／JSON 仍把部分「客戶白話、身體對應、家裡對應」放在同一份來源中；但 K0 執行時只挑選部分欄位，顯示程式已開始做分層，只是資料來源尚未完全拆乾淨：[d1K0Catalog.server.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/d1K0Catalog.server.ts) 第 72–92 行。

## 十二宮資料的現況

十二宮講義本來就是把星曜核心翻譯到不同生活面向，這支持「星核心 × 宮位分面 → 生活表現」的架構。例如紫微星的「化氣為尊」可以在：

- 命宮變成尊重、面子、形象與人生方向。
- 父母宮變成對父親／長輩尊重與面子的感受。
- 財帛宮變成金錢使用、品牌、體面與規模。
- 子女宮變成對孩子、寵物、所有物與享受的標準。
- 福德宮變成精神享受、品味、社會價值與意志方式。

來源：[紫微星十二宮講義 PDF](</Users/tsu/Desktop/紫微斗數/01_紫微斗數/01_教學講義/教學/14星耀12宮解讀/紫微星.pdf>)。

但是目前程式內的宮位 Registry 仍是較舊版本：[d1K0Registry.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/d1K0Registry.ts) 第 228–258 行。與老師最近決定的差異包括：

- 夫妻宮仍含「工作在外」，目前本命人格報告已決定先只做感情。
- 子女宮仍含性生活、家門外與財庫；目前已先排除性生活與家門外，改保留孩子／寵物、所有物、吃喝玩樂與旅遊。
- 交友宮仍有泛稱「平輩關係」；老師已明確說沒有「異性別同輩」這個固定分面。
- 官祿宮混入同事相處、感情對象與感情內心；目前應專注工作本身、工作價值與職涯方向。
- 田宅宮仍有風水；目前先不做風水，保留居家及附近環境。
- 福德宮仍有來財、老年與花錢；目前已重新定為精神享受、社會價值、福分運氣、潛意識、品味與意志方式。
- 父母宮缺少對長輩的對待；身體遺傳的保養提醒應集中到疾厄宮說明。

因此目前最可靠的宮位分面不是程式 Registry，也不是任何一份舊 SOP，而是正在建立的架構決策文件：[natal-personality-architecture-v2.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/docs/ai-chart/natal-personality-architecture-v2.md)。

## 其他推演模組的可用程度

### 雙主星

雙星 B1／B2 與固定骨架已存在，而且資料有保存前後順序。老師目前新增的關係宮位原則是：

- 涉及他人關係時，前星可先看關係對象，後星看命主。
- 兩顆星共同組成完整的關係人格，不應只留其中一顆。

這個原則需要在雙星 Contract 中成為明確欄位，而不是只留在自然語言 Prompt。

### 煞忌

煞忌不是用來判斷哪一宮「比較重要」，而是標出命主感受深、容易卡住、反覆困擾或影響其他宮位運作的地方。每顆煞星仍要在本宮解釋自己的機制。

全盤掃描卡已保存：

- 所有合理可能先保留。
- 每顆煞星反應不消失。
- 單顆與多顆煞忌的強度不同。
- 陀羅即使單顆仍以反覆、糾結、可能選錯為主。

來源：[10_D1_全盤掃描與煞忌權重.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/10_D1_全盤掃描與煞忌權重.md)。

老師確認四煞也必須依作用主體分開，不是無主體的負面濾鏡：

- 可描述父親、母親或其他適用關係人物本身的反應方式。
- 可描述命主自己的態度與行為。
- 可由兩邊的反應機制推導雙方關係可能受到的影響。
- 三種主體都可能成立，但不強迫全部寫滿，也不能混成同一句。

例如擎羊在父母宮，可分別保存爸爸遇衝突時較直接強硬、命主感覺彼此容易硬碰硬，以及命主面對長輩或具體權威人物時較直接不退讓。

### 生年四化

老師確認四化必須跟著被四化的星曜與當下分析主體：

1. 先確定星曜在描述誰。
2. 再讓四化修飾該星曜核心在這個人物身上的作用。
3. 另一個人的感受要另外建立關係影響主張。
4. 不可把四化單獨抽出後任意換到命主或其他人物。

老師補充確認化祿的共通作用除了多出機會、資源與好處，也包含好感、緣分增加，以及關係較容易靠近。化祿作用在父母宮的父親／長輩關係時，通常可保留「與爸爸或長輩較有緣」及「容易有爸爸或長輩帶來的好處」。

這項判斷在舊資料中有直接依據：

- `content/ai-chart/d1-v1/knowledge/core/A_十四主星與輔煞四化.md` 將化祿寫成「多出來、增加、緣分變多、好處變多」。
- `紫微斗數命盤解讀SOP_v0.8_逐步飛化完整規則版.md` 第 680 行明寫「父母宮化祿：爸爸、長輩緣分增加，容易有爸爸或長輩帶來的好處」。
- `紫微斗數命盤解讀SOP_正式基準版_v1.2_第四步宮位因果與對宮補因版.md` 將化祿整理為「增加、好感、緣分、資源、容易靠近」，並說明長輩緣分增加可直接由父母宮解讀。

目前 `content/ai-chart/d1-v1/knowledge/reasoning/07_四化正式規格_工作版.md` 的化祿共通公式只寫機會、資源或好處，漏掉好感、緣分與容易靠近；而且把命主固定成唯一主體。正式改造時應補回這些來源已支持的含義，並依老師後來確認的「隨星、隨主體」規則處理。

資料上至少要分開：

- 父親／長輩人物本身的化祿星曜狀態。
- 命主與父親／長輩之間較有緣、較容易靠近的關係效果。
- 父親／長輩可能帶來資源、機會或好處的利益效果。

不能只寫「父母宮化祿所以有緣」，仍要由被化祿星曜的核心交代這份緣分或好處如何形成；也不能把「容易」寫成父親必然照顧命主。

老師確認化科的共通作用是使被化科星曜的核心較容易被看見、被注意，並牽動名聲、形象、曝光、修飾或被說明清楚。這與既有核心卡把化科定義為「被看見、曝光、名聲、形象、被注意」一致，但正式推演仍要套入星曜與主體。

紫微化科在父母宮時，至少可以分開保存：

- 爸爸可能因身分、體面、領導樣貌或代表性而被看見。
- 爸爸也可能很愛面子，因為紫微本來重尊重、體面與身分，化科又把名聲、形象及別人的眼光凸顯出來。
- 命主可能因此覺得爸爸重名聲、重體面或很在意外界評價。

「爸爸很愛面子」不是化科單獨產生，而是紫微核心與化科彰顯共同形成；不能把它泛化成所有化科的固定含義，也不能把爸爸的紫微化科轉寫成命主自己的特質。

老師確認化忌的共通作用是：主體在被化忌星曜的核心上感到空缺、不滿足、放不下或壓力集中，因而可能持續追求、反覆在意，程度較重時形成執著、卡住或困擾。這與正式基準版 v1.2 所列的「內心需求、空缺、放不下、壓力聚焦、反覆在意」一致。

化忌同樣必須隨星隨主體。若落在父母宮並描述父親，缺口、期待與反覆追求先屬於父親；命主可能感受到的壓力、距離或相處困擾要另建關係影響主張。化忌不是無主體的「壞事」，也不能直接預言某個具體事件一定發生。

老師進一步確認：只要底層邏輯建立正確，模型應能自行推演組合，不需要人工預先寫完所有星曜×四化×宮位答案。正式知識層只需固定：

- 星曜核心。
- 四化共通作用。
- 宮位分面。
- 作用主體。
- 允許與禁止的推演邊界。

模型負責把上述元件組成自然語言、性格表現與生活可能；程式負責驗證使用的命盤事實與固定來源，並保留每項結論的來源鏈。模型產出的生活例子不能反過來成為新的固定命理規則。

紫微化權在父母宮時，爸爸是紫微化權的狀態：紫微本來重視面子、尊重與主導，化權使爸爸更能掌握權力及別人的尊重，因此可能更重面子、控制欲較強，也可能因能實際掌握這些要求而顯得能力不差。命主可能因此覺得爸爸控制欲強、要求尊重或有能力，但這不代表命主也有紫微化權。

老師確認化權的共通作用是讓主體更能掌握、執行、控制或承擔該星曜原本的核心，因此可以形成相關領域的能力；但能力內容由星曜決定。紫微化權偏掌握權威、主導與尊重，天機化權偏掌握思考、方法、規畫與分析，不能把所有化權都寫成同一種領導能力或空泛的「有能力」。

### 對宮、暗合與三方四正

既有卡已明確區分：

- 本宮定主軸。
- 對宮優先修飾。
- 暗合補背後原因。
- 另外兩個三方宮補能力、資源、壓力與矛盾。
- 一般有主星或空宮不符合借星資格時，不可把對宮主星直接當成本宮主星；符合固定空宮借星資格時依下一節例外處理。

來源：[12_D1_對宮暗合三方四正.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/12_D1_對宮暗合三方四正.md)。

老師後來補充「正常情況各宮放手運作，某宮有煞忌時才較容易影響其他宮位」，這應成為跨宮權重規則，避免模型把所有三方四正都寫成強因果。

### 空宮與身宮

空宮借星條件、不可借星條件、祿存例外與雙主星一起借入，已具備可程式化規則。身宮也已明確定義為補充在意領域與長大後更明顯的追求，不取代命宮、也不是每次解盤的主角。

來源：[13_D1_空宮借星與身宮.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/knowledge/reasoning/13_D1_空宮借星與身宮.md)。

### 四化與飛化

四化與飛化來源已存在，但老師已決定飛化要獨立呼叫、綜合判斷，再以自然語言融入客戶報告。客戶版單宮星曜說明不應同時塞入複雜飛化教學。

這與多呼叫規格中的 F1 專責飛化方向一致：[21_D1_OpenAI多次呼叫編排規格.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/primary/21_D1_OpenAI多次呼叫編排規格.md)。

## 舊單體 SOP 與小卡化的真正關係

舊 SOP 保存了大量珍貴的覆蓋順序、禁用語、Final Guard、Review 與生活化要求，但把太多任務塞進一個 Prompt：

- 查命盤事實。
- 查星曜與宮位。
- 推導候選。
- 寫客戶文。
- 自我審查。
- 重寫。

後來拆成小卡是正確方向，目的不是讓模型逐張卡各寫一篇，而是：

1. 程式先選出這一宮真正需要的卡。
2. 各卡先產生可追查的結構化主張。
3. 程式檢查有沒有遺漏、重複、越界。
4. 再讓模型一次寫成這一宮的客戶文章。

這也就是老師說的「一個一個對，再重新整合」，能減少模型東漏西漏。

## 提問前的知識核對

老師指出，架構討論不應重複詢問小卡已有的內容。後續每一題都必須先核對講義、逐字稿、核心卡、推理小卡、舊 SOP 與本輪最新決策，再分成：

1. 已有一致答案，可直接整理。
2. 不同來源互相衝突，需要老師裁決。
3. 來源沒有說明，才提出新問題。

只有第二、三類需要詢問老師。不能只看目前程式 Contract 或單一工作卡，就把資料庫早已有答案的問題重新交回老師。

### 祿存核對結果

祿存的基本規則已在小卡中明確存在，不需重新詢問：

- `14_D1_輔星煞星貴人星祿存.md`：祿存與化祿相似，是存在的助力；有主星時幫助主星核心產生更多效果；獨坐時才表示該宮位較有不安全感。
- `A_十四主星與輔煞四化.md`：祿存輔助並加強主星特質，使主星較容易因自身特質得到好處；同時帶出資源保留、安全感、累積與不敢亂投入。
- `13_D1_空宮借星與身宮.md`：空宮只有祿存時仍可借對宮主星，先由借入主星決定處理方式，再由祿存增加效果。

綜合後，祿存與化祿的共通主軸是增加助力與好處；祿存另有資源保存與安全感修正。它不能取代主星，也不能只被解成保守或不安全感。有主星時，祿存沿用主星、宮位與 Actor，不另創造一個人物主體。

## 目前程式 Contract 的實際缺口

### 1. Candidate 沒有 Actor 與宮位分面

目前 `AiChartD1Candidate` 有 statement、lifeExamples、palaceIds、starBasis、structureBasis、usedRuleIds 等欄位，但沒有：

- `subject`：這句在說命主、父親、伴侶、孩子、朋友，還是雙方互動。
- `palaceFacet`：這句到底落在哪個宮位面向。
- `mechanism`：底層星曜核心如何轉成這個結論。
- 每個生活例子對應哪條 mechanism。

來源：[d1CommonContracts.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/d1CommonContracts.ts) 第 83–96 行；工作版 Schema 也有同樣缺口：[22_D1_各呼叫輸入輸出Schema_工作版.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/spec/drafts/22_D1_各呼叫輸入輸出Schema_工作版.md) 第 208–246 行。

所以目前程式可以驗證「有提到某顆星」，卻還不能可靠驗證「這句真的在正確的宮位面向、以正確人物為主體，沿正確核心推出來」。

### 2. Prompt 強迫每個候選都寫外界觀感

目前主控與程式 Prompt 都要求每個候選說明：

- 怎麼想。
- 怎麼做。
- 怎麼被別人看見。

來源：[0_主控.md](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/prompt/0_主控.md) 第 44 行、[d1P1PromptInstructions.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/d1P1PromptInstructions.ts) 第 65 行。

這會造成兩個問題：

1. 非關係宮位也被迫生成「別人怎麼看」。
2. 模型容易把「命主主動幫人」和「別人來幫命主」混成同一個無法追查的敘述。

### 3. Manifest 尚未啟用正式 Runtime

23 份 D1 素材的 `runtimeEnabled` 都是 `false`，Loader 也明確拒絕 `true`；代表這批知識仍是納管與驗證狀態，不是已接上正式報告的完整知識流。

來源：[manifest.json](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/content/ai-chart/d1-v1/manifest.json)、[d1Assets.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/d1Assets.ts)。

### 4. 正式付費報告沒有走 D1

付費完成後的 `completePaidAiChartReport()` 目前呼叫的是固定 `generateAiChartReportContent()`；後者輸出「AI 版初步分析報告」的固定八段模板，沒有執行十二宮 D1 推演。

來源：[reportCompletion.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/reportCompletion.ts) 第 24–75 行、[reportGenerator.ts](/Users/tsu/.codex/visualizations/2026/07/14/019f5fc9-922b-79e1-aa69-94bf4aa97c77/tsu-waterbottle-ai-chart-architecture-domain-model-v2/src/lib/ai-chart/reportGenerator.ts) 第 70–124 行。

D1 P1 的 Adapter、Prompt、Structured Output、source-bound validation 與 Preview Gate 已存在，但尚未成為付費正式報告管線。

## 可直接沿用

1. 老師講義中的十四主星底層核心。
2. 本命人格與具體事件分層。
3. 一宮一分析單位、先本宮再跨宮。
4. 所有合理可能先保留。
5. 空宮借星與身宮條件。
6. 煞忌局部機制與全盤掃描。
7. 飛化獨立專責分析。
8. 多次模型呼叫、最小必要 Context、Structured Output。
9. 程式驗證固定命盤事實，模型只做語意推論。

## 需要重整，但不是刪掉

1. 主星核心卡與宮位落點／身體／居家／客戶例子分開。
2. 十二宮分面以老師最新決定重建版本，不直接沿用舊 Registry。
3. Candidate 增加 Actor、Palace Facet、Mechanism 與 Evidence Link。
4. 把「別人怎麼看」從必答欄位改成有條件的關係回應。
5. 輔星拆成：
   - 命主自身特質／主動行為。
   - 關係對象特質。
   - 別人回應。
   - 互助因果鏈。
6. 生活例子必須由底層機制推出，不能直接用範例當命理規則。
7. 舊 SOP 的覆蓋檢查與禁用規則保留，但不再整份塞進一次呼叫。

## 不應直接當正式規則

1. 只因檔名標示「正式」就覆蓋老師後來修正的內容。
2. CTA、短文或客戶範例中的簡化說法。
3. 尚待老師確認的小卡推論。
4. 舊宮位 Registry 中已被老師明確排除的分面。
5. 模型自己填寫、但不能由實際候選推導的 coverage 自述。
6. 模型通識或其他流派的紫微斗數知識。

## 後續提問入口

後續不再由研究筆記臨時產生問題。來源盤點完成後，所有問題統一進入：

- `docs/ai-chart/teacher-confirmation-backlog.md`

該文件分開記錄「已有答案」「Codex 自行完成」「案例校準」「真正需要老師確認」及「延後處理」。每次只從真正缺口取一題，不為每題重新搜尋全部素材。
