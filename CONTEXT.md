# AI 命盤分析

這份詞彙表用來統一 WATERBOTTLE AI 命盤分析的領域語言。現階段只處理本命盤的個性分析；大限、流年與 AI 聊天室是後續層次。

## 命理依據

**命理權威素材**：
老師講義與經老師核准的固定卡片，是星曜、宮位、四化、煞忌、身宮與飛化規則的唯一權威來源。
_避免：讓模型自行發明命理規則、把一般網路知識當命理依據_

**權威規則更正**：
老師確認現有規則錯誤時，直接以新結論取代舊定義，並同步所有會進入 Runtime 的正式來源。舊版只可作為比較或稽核證據，不得留在模型可見知識中與新規則並存。
_避免：另加覆蓋層、讓新舊規則衝突、只用提示詞遮蔽錯誤的權威來源_

**命盤事實**：
由程式依出生輸入排出並固定保存的客觀命盤資料，例如星曜落宮、四化、煞忌與身宮。
_避免：模型推算結果、模型補齊的命盤資料_

**固定規則卡**：
從命理權威素材整理出的單一、可引用規則；包含規則適用條件、核心含義與限制。
_避免：生活例子、客戶文章、模型自由推論_

**提問前素材核對**：
每次向老師確認新規則前，先查老師講義、正式小卡、舊 SOP 與已記錄決策，整理已有結論、來源矛盾及真正缺口；只詢問來源沒有說清楚或彼此衝突的部分。
_避免：重問小卡已有答案、只看單一檔案、把舊版直接當最新決策、未整理證據就要求老師替系統找答案_

**老師確認清單**：
集中保存已排除的重複問題、Codex 應自行完成的整理工作、真正缺少老師判斷的問題與延後處理項目；後續提問只能從這份清單取用。
_避免：每一題重新搜尋全部素材、把工作版標籤直接視為新問題、未更新既有答案就重問老師_

**主星核心卡**：
只保存某顆主星不隨宮位改變的本質，例如人物定位、化氣、核心詞彙、正常與失衡狀態、煞忌使用條件、所需支持及禁止過度簡化的解讀。
_避免：身體部位、住家特徵、買名牌、品種貓或其他特定宮位結果_

**宮位落點卡**：
保存某一星曜核心進入特定宮位或分面後，講義已明確確認的固定轉換與限制。
_避免：把宮位結果塞回主星核心、把模型自由舉例升格成固定規則_

**天相疾厄對應修正**：
老師確認天相在疾厄宮的講義對應包含腎、內分泌、淋巴與循環，不包含頸部；這項更正已同步至既有主星字典與講義回填的疾厄身體弱項規則，完整正式固定卡仍待後續獨立整理。
_避免：把頸部繼續留在 Runtime 可見素材、把健康對應塞進天相主星核心_

**疾厄四宮身體弱項掃描**：
本命人格報告的身體較弱與保養提醒，只掃描命宮、遷移宮、疾厄宮、父母宮內實際存在的全部主星，再依講義回填的十四主星身體對應合併去重；結果只在疾厄宮說明，其他三宮不各自輸出健康內容。這一層只取四宮本身，不沿著四宮各自的對宮、三方或暗合再取第二層星曜。
_避免：只看疾厄宮、雙星漏掉一顆、父母宮直接寫健康、把關係宮的第二層星曜加入身體弱項、使用疾病診斷語氣_

**疾厄主星身體方向規則**：
由程式持有的十四主星固定對應；每個方向都來自講義與正式固定卡，模型不能修改、新增或以自然語言反推新規則。太陽與太陰的眼睛方向需符合午、未地支條件；太陰與破軍的婦科生殖方向只在女性條件成立時加入。
_避免：模型自選器官、把巨門支氣管改成肺部、把天相加入頸部、忽略地支或生理條件_

**身體方向掃描結果**：
四宮實際主星經固定規則轉換後的不可變結果；同一方向可合併去重，但每個來源宮位、星曜 placement、固定 rule ID 與條件仍須完整保留，供後續稽核。
_避免：去重時刪掉來源軌跡、掃描 borrowedMajorStars、把三方或暗合的一般主星特質改寫成健康影響_

**健康提醒卡選擇**：
程式依身體方向掃描結果選擇已審查的固定提醒卡；多個方向對應同一張卡時只輸出一次，卡片原文、就醫門檻與急症提醒不得交給模型改寫。
_避免：模型自行選卡、為了文章流暢改寫醫療語意、同一張卡重複輸出、未知方向靜默忽略_

**輔星補充主張**：
每顆輔星在單一宮位內產生的獨立補充；本命盤預設先描述命主主動展現的特質或行為，只有固定規則或清楚因果支持時，才另加他人回應或環境助力，最後再與主星整合。
_避免：只把輔星寫成外界憑空給予的好處、強迫每顆輔星都產生他人回應、讓輔星取代主星方向_

**地空地劫觀察星**：
地空、地劫在本命人格層先保留落點並作可追溯觀察，主要在大限與流年依事件脈絡啟用。兩顆都不是空宮借星阻擋星，也暫不納入本命煞忌集中度計分。
_避免：從本命盤完全刪除、未有事件脈絡就斷言結果、誤列成空宮借星阻擋星或本命煞忌重點分數_

**空劫結果消散**：
地空、地劫使受作用宮位原本可能形成的結果減弱、取消或無法留下；過程與跡象仍可能出現，因此結果消散可能是不利，也可能使原本不利事件減輕或不成立。
_避免：一律翻成壞事、把財帛宮的一無所有擴大成整個人生一無所有、未先判斷原始事件就直接套用空劫_

**空劫作用關係**：
正式架構只保留同宮與對宮，兩者都是完整作用；不採用夾與三合拱的半力規則。
_避免：自行恢復夾拱半力、把一般十二宮連動冒充空劫的正式作用關係_

**未建模小星重複**：
同一宮位可能由不同星系產生同名小星；只要來源索引與 placement ID 不同，就保留每一筆底層紀錄，不得因名稱重複而拒絕整張命盤。未建模小星仍不進入目前的 P1 推演。
_避免：用星名去重刪除合法落點、讓未建模小星重複阻擋 N0、把保留底層紀錄誤解成需要全部主動解讀_

**左輔主動支持**：
左輔表示命主願意站在對方這邊、表態支持、講義氣與主動幫忙；是否進一步出錢、提供資源或實際處理事情，須由主星、宮位及其他星曜共同判斷。
_避免：把左輔縮成只有口頭聲援、單憑左輔斷定命主一定出錢出力、保證別人回頭幫忙_

**右弼協調支持**：
右弼表示命主較會透過細膩說話、安慰、提醒、圓場及協調來幫助別人；它與左輔的站隊、表態及講義氣不同。遇煞忌時，也可能替不適合的事情圓場或幫錯方向。
_避免：把右弼與左輔寫成同一種幫忙、保證別人回頭相助、漏掉遇煞忌時的錯向支持_

**天魁正式助力**：
天魁表示檯面上、身分明確且具有能力、專業或資源的正式實質幫助；命主可能遇到這類貴人，也可能自己公開、正式地成為別人的貴人。
_避免：與左右的表態或情緒支持混用、只寫命主被幫、把可能助力寫成已發生事實_

**天鉞幕後助力**：
天鉞表示檯面下、具有實際能力、專業或資源的幕後幫助；命主可能被私下提醒、牽線、安排或協助，也可能自己在幕後如此幫助別人。
_避免：與右弼的安慰圓場混用、只寫命主被幫、因未公開出面而忽略實際效果_

**文昌理性處理**：
文昌表示命主在適用宮位中的理性、邏輯、條理、規則、文字說明、資料整理與制度內學習方式；可落成問清楚、查資料、列清單或按規則處理等行為。
_避免：強迫產生他人回應、把制度內能力寫成已取得成就、脫離宮位直接列能力清單_

**文曲感性表達**：
文曲表示命主在適用宮位中的感受、情緒、美感、表達、創作、表演與氣氛感知；狀態不好時，可能因感受及情緒太多而難以說清楚真正想法。
_避免：強迫產生他人回應、把創作傾向寫成已取得成就、把感性簡化成情緒化_

**昌曲理性感性軸**：
文昌偏理性處理，文曲偏感性感受與表達；兩者可共同存在，但不可互相代換或合併成模糊的「有才華」。
_避免：只寫好聽能力標籤、漏掉兩者不同的處理機制_

**本命主動特質**：
D1 本命人格分析的預設觀察方向，描述命主本身具備什麼特質、通常怎麼想及會主動怎麼做。
_避免：把別人的反應、命主已得到的結果或具體事件當成本命主要結論_

**關係回應**：
命主主動特質與行為可能引起的他人回應；只有固定規則或清楚生活因果支持時才作為次要延伸。
_避免：每項主張強迫補一個他人反應、寫成他人一定如此_

**底層核心**：
某一星曜或規則不因社會與時代改變的命理機制，例如紫微的「尊重、面子、主導與格局感」。
_避免：把買名牌等特定生活行為直接當成固定規則_

## 宮位分析

**宮位分面**：
一個宮位內可被分開分析的生活面向，例如財帛宮的金錢觀、賺錢方式、花錢方式與理財方式。
_避免：把整個宮位壓成一個人格標籤_

**宮位分面 Registry**：
D1 本命人格允許使用的十二宮分面、主體與責任邊界的版本化集合；它定義可以分析什麼，不代表每張命盤都要把所有分面寫滿。
_避免：直接從舊 SOP 任選宮位含義、把 Registry 當固定作文版型、跨宮硬補內容_

**宮位主體**：
一段宮位分析所描述的人或關係位置，例如命主、父親／長輩、伴侶或同輩。
_避免：沒有說清楚在描述誰_

**角色綁定 Registry**：
D1 每個宮位分面可使用的主體與互動對象之版本化集合；主體只分命主、具體／可能的他人及雙方互動，並另外固定哪些關係對象能出現在該分面。
_避免：讓模型自行新增人物、把父親特質寫成命主、把伴侶可能套到寵物或其他不相干分面、把同一主張混入兩個主體_

**角色規則來源**：
角色綁定所引用的固定規則類型，例如命主優先、既存人物、關係對象可能、雙星互動切分及制度不可人格化；它們只說明誰可以成為主體，不取代星曜或宮位命理。
_避免：由模型文字生成角色規則、把角色來源當成星曜證據、沒有規則來源就新增人物主體_

**既存關係現象**：
本命盤的父母宮與兄弟宮可以先描述早於命主存在的父親、母親或家庭關係狀態，再另外描述命主自己的感受、特質與互動方式；兩種可能必須標示不同宮位主體。
_避免：把兩個主體混成一句、把既存狀態誤寫成未來必然事件、未經確認套用到所有關係宮位_

**關係對象可能**：
夫妻宮、子女宮與交友宮中，依命主本命盤推導出的伴侶、孩子／寵物、朋友／同事等對象特質可能；它反映命主容易期待、遇到或感受到的關係樣貌，不代表該人物已存在或一定如此。
_避免：寫成客觀既有事實、取代命主自己的態度與行為、與既存關係現象混用_

**既存人物關係影響鏈**：
父母宮或兄弟宮先以星曜描述父親、母親等既存人物本身，再由該人物特質推導命主可能形成的主觀感受與相處方式；第二段是關係影響，不代表命主也擁有對方的星曜特質。
_避免：把父親愛面子寫成命主也愛面子、只寫關係結果卻沒有前段人物機制、把可能相處方式寫成已發生事實_

**雙星關係三層解讀**：
雙主星落入父母宮等人際宮位時，分別保存「關係人物的完整雙星狀態」「雙方互動中前星代表他人、後星代表命主」「命主面對該類關係或權威時的完整雙星態度」三種用途。
_避免：把關係人物只縮成前星、把命主整體只縮成後星、把三種用途混成同一句_

**雙星互動角色切分**：
分析命主與具體互動對象的相處時，雙主星都可以另外以前星表示對方、後星表示命主；對方可以是真人，也可以是寵物。同時仍保留完整雙星組合對命主整體關係態度的解讀。
_避免：只保留前後角色而漏掉完整雙星、把前星固定成某一種人物、排除寵物、套用到尚未確認的抽象機構_

**制度權威情境**：
命主面對政府機關、制度或抽象權威時，使用完整雙星組合分析命主的態度；機關本身不當成前星。只有出現具體官員、承辦人或其他互動者時，才可使用前星對方、後星命主的角色切分。
抽象制度不是獨立人物主體；此分面仍以命主為主體，具體官員互動才另建雙方互動主張。
_避免：把抽象機關人格化、將制度本身寫成前星人物或獨立 Actor、漏掉具體人際互動時的角色切分_

**四煞主體主張**：
擎羊、陀羅、火星與鈴星在本命分析中必須標明作用主體，可分別描述關係人物、命主自身，或雙方關係受到的影響；四煞不是沒有主體的模糊負面修飾。
_避免：把不同主體混成一句、只貼負面標籤、不解釋該煞星的具體反應機制、強迫三種主體全部寫滿_

**四化隨星隨主體**：
生年四化必須依附被四化的星曜，並修飾該項主張正在描述的主體；先確定星曜在說誰，再套用四化作用，不能把四化獨立抽出後任意換到另一個人身上。生年四化跟著星曜放入本宮＋對宮基礎推演，不另設獨立推演引擎。
_避免：把父親的紫微化權寫成命主也有化權、只列四化標籤、不保留星曜核心與關係影響鏈、把生年四化拆成失去星曜與主體的獨立結論_

**化祿核心增益**：
化祿使被化祿星曜的原有核心，在目前宮位與主體上多出機會、資源、好處、好感、緣分或較容易靠近的條件；實際以哪一種方式增加，必須由星曜核心、宮位分面與作用主體共同決定。
_避免：只寫有福或有緣、脫離星曜核心、保證一定得到金錢或具體利益、把不同主體混成一句_

**父母宮化祿緣分**：
化祿作用在父母宮的父親／長輩關係時，通常可保留「與爸爸或長輩較有緣、較容易靠近」以及「可能得到爸爸或長輩帶來的好處」；仍須分開父親人物狀態、命主的關係感受與實際利益，並說明是哪顆化祿星曜透過何種核心形成。
_避免：只因化祿就保證父親一定照顧命主、忽略被化祿星曜、把爸爸的特質直接寫成命主特質_

**化科核心彰顯**：
化科使被化科星曜的原有核心較容易被看見、被注意，並牽動名聲、形象、曝光、修飾或被說明清楚；具體被看見的是什麼，必須由星曜核心、宮位與作用主體決定。
_避免：把所有化科都寫成有名、保證正面名聲、脫離星曜核心、把人物形象與命主感受混成一句_

**紫微化科人物鏈**：
紫微本來重視尊重、體面與身分；化科再凸顯名聲、形象及他人眼光，因此該人物除了可能因身分或代表性被看見，也可能更愛面子、更在意外界怎麼看自己。落在父母宮描述爸爸時，這些先屬於爸爸，命主對爸爸的感受另建關係主張。
_避免：把愛面子當成所有化科的固定含義、只寫形象被看見而漏掉人物本身對面子的重視、把爸爸的紫微化科直接寫成命主特質_

**化忌核心缺口**：
化忌使主體在被化忌星曜的原有核心上感到空缺、不滿足、放不下或壓力集中，因此可能持續追求、反覆在意，嚴重時形成執著、卡住或困擾；具體追求與困擾內容由星曜核心、宮位與主體決定。
_避免：把化忌直接等同壞事、脫離星曜核心、把一個人的缺口寫到另一個人身上、將可能困擾斷言成具體事件_

**底層規則組合推演**：
固定知識只需提供星曜核心、四化作用、宮位分面、作用主體及必要邊界；模型依這些已驗證底層元件推演自然表達與生活可能，不預先人工枚舉所有星曜×四化×宮位組合。
_避免：把每一種組合寫死成龐大範例庫、讓模型自行改寫底層命理、缺少來源追蹤、把模型推演結果反過來當固定規則_

**祿存增益修正**：
祿存與化祿相似，是已存在的助力；有主星時跟著該主星及當下主體，幫助主星核心產生更多效果與好處。資源保留、安全感與累積是補充修正，不可取代增益主軸，也不可讓祿存取代主星。
_避免：把祿存只解成保守或缺乏安全感、把祿存寫成主導整宮、脫離同宮主星自行發明好處、忽略獨坐時的不安全感規則_

**化權核心掌握**：
化權使主體更能掌握、執行、控制或承擔被化權星曜的原有核心，因此可以推導為相關領域的能力；具體是哪一種能力，必須由該星曜核心決定。
_避免：把所有化權都寫成同一種領導能力、只寫控制欲、脫離星曜核心泛稱有能力_

**紫微化權人物鏈**：
紫微重視面子、尊重與主導；化權使該人物更能掌握權力及別人的尊重，因此可能更重面子、控制欲較強，也可能因能實際掌握這些要求而顯得有能力。
_避免：把這條星化組合直接泛化成所有化權都同樣有能力、把人物特質與命主感受混成一句_

**宮位主張**：
模型依命盤事實與固定規則卡產生、且通過驗證的一項結構化結論；每項主張只對應一個宮位分面。
_避免：宮位文章、全宮摘要_

**空宮借星資格**：
程式在模型推演前判定目標宮是否為空宮，以及是否能借入對宮主星。空宮只要本宮有擎羊、陀羅、火星、鈴星、文昌或文曲任一顆，就不能借星；只有祿存不會阻止借星。資格結果屬不可變命盤事實，模型不能自行改判。
_避免：讓模型自己猜能不能借、以模糊的「煞星很多」取代六顆精確阻擋星、把祿存誤列成阻擋條件_

**借入主星**：
空宮通過借星資格後，只借對宮十四主星及實際跟著這些主星的生年四化；不借文昌、文曲、四煞、左輔、右弼、天魁、天鉞、祿存或其他小星。借入主星正式成為目標宮的核心來源，並以表裡如一理解，不視為較弱、隱藏或次要；本宮原有輔煞仍以本宮在地修飾另外分析。
_避免：把對宮所有星曜整包搬入、把借星寫成隱性人格、同時把同一借入主星重複算成本宮核心與對宮表達、漏掉隨借入主星而來的生年四化_

**本宮主軸與對宮表現通道**：
第一個結構引擎在一般有主星時，以本宮主星決定能力、個性與價值核心，再把對宮主星與本宮主星合併推演，說明本宮核心主要透過什麼方式展現、互相補充、牽制或形成並存傾向。對宮只提供星曜運作，不提供其宮名與生活分面；產生客戶文字前，必須把對宮星曜含義重新綁定到本宮分面。客戶文字不得寫出對宮宮名，也不得引用、暗示或搬入對宮原有宮位分面；只有三方與暗合為了交代影響鏈，才可交代來源宮位及其生活領域。符合資格的空宮改以借入主星作為本宮核心，形成表裡如一，不再把同一組星重複當成另一條對宮證據；不能借星的空宮則以宮位分面與本宮原有星曜建立主張，對宮不得冒充成本宮主星。分析相反方向的宮位時，仍必須重新判定該目標宮的主軸與表現方式。
太陽與太陰對拱時，除同時保留太陽的主動、公開、承擔與太陰的細膩、照顧、累積，兩者往返也帶有變動與調整的含義。若兩側都產生客戶分析，每一側都必須在自己的宮位分面內保留變動與調整，不能只在其中一宮寫一次。固定對拱規則、生年四化或煞忌成立時，才可另外加入壓力、矛盾或其他特質。
_避免：只看本宮就產生完整表現、在兄弟宮點名對宮的僕役宮、在父母宮搬入對宮的健康面向、把兩宮完整人格文章直接相加、只在太陽太陰對拱其中一側寫變動、未通過空宮借星資格就把對宮主星冒充成本宮主星、把借入主星再算一次對宮證據_

**直接一層關係邊界**：
分析一個目標宮位時，只能使用它直接對應的本宮、對宮、兩個三方宮與暗合宮；來源宮位自己的對宮、三方或暗合屬第二層關係，不得再傳回目標宮位。每個宮位輪到自己成為目標時，再重新建立自己的直接一層關係。
_避免：福德宮因使用夫妻宮三方，又把夫妻宮對宮的太陰帶入；關係遞迴擴散成整張盤任意取星_

**關係來源分面綁定**：
三方或暗合影響鏈中的來源生活領域，只能直接選用來源宮位 Registry 已提供的正式分面；星曜特質用來說明該分面如何運作，推導結果用來說明它如何影響目標宮位，兩者都不能反過來改名或新增來源分面。對宮不是來源生活分面：模型輸入不得包含對宮的宮位分面規則或分面資料，只保留對宮星曜與結構規則，並重新綁定至本宮分面。若三者無法形成完整影響鏈，就省略該關係，不為了寫滿全部關係而補造來源領域。
_避免：把子女宮自行改寫成創作、專案或籠統的行動領域；把田宅宮分面搬到子女宮、把子女宮分面搬到田宅宮，或用「財帛相關」解釋福德宮；只列來源宮與星曜，卻沒有說明對目標宮位的實際影響；每次看到錯誤再疊一條宮位特例_

**本對宮軸結果**：
以單一目標宮位為方向，保存本宮核心、對宮表達通道、生年四化修飾及兩者證據鏈的已驗證結果；反向分析時必須另建方向相反的結果，不能重用成同一份人格結論。
_避免：兩宮文章相加、雙向共用同一結果、把未驗證模型文字交給下一層_

**三方暗合結構推演**：
接收已驗證的本對宮結果，另外建立其餘三方宮位與暗合如何影響本宮決定及狀況的來源鏈；不重新推演一次對宮，也不改寫本宮結論。三方四正的影響較明確，暗合則偏向不易察覺、潛移默化的影響。
_避免：把影響寫成新的本宮人格、重複計算對宮、用跨宮影響取消本宮結論、把暗合寫成明顯直接原因_

**結構影響鏈**：
三方四正或暗合對本宮合法分面形成的有向影響，保存來源宮、正式關係、實際正負觸發、助力或干擾機制、可見程度，以及可選的既有本對宮主張連結。即使該分面暫時沒有 Axis claim，也只能新增影響，不能冒充或產生新的本宮核心。正負來源同時存在時分成獨立影響鏈，不抵銷、不混寫。
_避免：沒有正式關係就跨宮、只靠來源宮主星建立影響、只寫吉凶分數、把正負觸發揉成一條、改寫或刪除本對宮軸結果、把暗合當直接原因、讓地空地劫進入 D1 結構影響_

**完整宮位推演結果**：
一個目標宮位的本對宮軸結果及全部結構影響鏈的不可替代集合；它保留原始主張與每條影響來源，摘要只能作索引。
_避免：用綜合摘要取代原始主張、正負相抵、把不同機制壓成一條、允許未驗證候選混入_

**可能表現**：
底層核心在現實生活中可能出現的性格、思考、行為或事件例子；它是供客人比對的可能性，不是對客人人生的斷言。
_避免：必然事件、替客人決定實際經歷_

**結論完整、例子精簡**：
內部候選池保存所有彼此不同且通過驗證的核心結論、作用機制與生活例子。客戶報告不能刪除不同核心結論或不同作用機制，但同一個核心機制只挑選一至兩個最容易理解、最符合主要生活地區的代表例子；省略的是同義或重複例子，不是命理結論。未顯示的合法例子仍保留，供後續大限、流年與聊天室使用。
_避免：把候選池全部塞進報告、為縮短文章刪除不同結論、把例子數量當成結論覆蓋、讓未刊登例子從內部資料消失_

**機制連結**：
簡短說明一個可能表現為何能由底層核心推導而來的可檢查關係。
_避免：模型隱藏思考過程、冗長命理教學_

**生活推演鏈**：
每項生活表現必須保留「星曜底層核心 → 宮位分面 → 現實表現」的可檢查因果，例如紫微愛面子，落入子女宮寵物分面，推演為偏好能彰顯身價的品種貓。
_避免：只列例子、把核心換成模糊好聽的詞、把例子反寫成星曜核心_

**宮位索引**：
保存單一宮位所有已核准主張與其來源的完整集合，供後續整合與寫作使用。
_避免：以摘要取代原始主張_

**宮位 deterministic 整合**：
程式只把已驗證 Axis claim 與三方暗合影響逐一放入合法生活分面，建立來源圖及 coverage；它不再呼叫模型、不複製文章，也不把正負影響抵銷。只有結構影響而沒有原始 Axis claim 的分面仍可保留，但不能冒充本宮核心。
_避免：第二次綜合推論、用摘要替代來源、把只有影響的分面升格成原始人格、合併正負為吉凶分數_

**已驗證推演結果**：
推演模組完成命盤事實、來源、覆蓋、語意與可能性邊界檢查後，才可交給下一模組的結構化結果。未驗證候選與模型原始回應不得成為飛化、全盤整合或客戶寫作的輸入。
_避免：下游直接讀模型原文、部分通過就繼續、用後段寫作掩蓋前段命理錯誤_

**寫作內容格**：
程式依已核准宮位主張預先建立的客戶文章寫作單位；模型只負責把指定內容格寫成白話，內容格與來源的關係由程式保存。
_避免：文章寫完後再讓模型手填 majorStarsConsidered、由模型自行聲稱使用過哪些規則_

**未合併寫作來源格**：
在全盤關係尚未完成前，程式先把十二宮 Axis claim、三方暗合 Structural influence 與 Flying influence 依落入宮及合法生活分面逐一建立來源格。每格只綁一筆來源，不做語意合併、不抵銷矛盾，也不建立沒有內容的空格。這是交給全盤關係整合的完整索引，不是最終寫作內容格；在全盤關係補齊並完成同義判定前，客戶寫作與 OpenAI 都保持阻擋。
_避免：過早把相似句合併、用摘要取代來源、在沒有全盤關係時直接寫文章、把來源格誤當客戶段落_

**全盤關係結果**：
在十二宮未合併來源格之上，只新增整體方向、跨宮重複模式、跨宮內在拉扯與深刻感受主題的來源綁定。每項關係都保留原始來源格 Ref；程式只驗證命宮來源、跨宮數量、全盤掃描訊號及星曜證據鏈，語意是否真的相同、拉扯或深刻仍須另行審查。這一層不刪除來源、不計分、不選贏家，也不是客戶文章。
_避免：把關係結果當成全盤摘要、只憑相似文字合併、用煞忌替宮位排名、讓模型自填不存在的來源、未完成語意審查就進入寫作_

**全盤關係語意審查交接**：
逐項檢查全盤關係是否真的符合該關係種類、來源語境、共同機制、可能性及 D1 邊界。審查只回傳 relation Ref、核准或定點修復決定，以及固定問題碼；不得回傳自由文字理由或改寫後關係。全部核准才可交給內容格；任一需修復時保留其他核准項目，但整體內容格交接維持阻擋。
_避免：審查層自己創造新命理、用一段評語取代固定問題、只修一項卻重跑全部、帶著未核准關係進入內容格、把內容格可建立誤認成客戶文章已可交付_

**逐宮寫作內容格交接**：
全部全盤關係核准後，程式依固定十二宮順序與各宮 Registry 分面順序建立內容格。第一版每筆未合併來源各占一格，不建立沒有來源的空分面、不刪除矛盾，也不憑文字相似度自動合併；與某筆來源有關的已核准全盤關係會附在同一格。這一層只代表下一步可建立逐宮寫作 Prompt Package，尚未產生客戶文字，也不能呼叫 OpenAI。
_避免：在缺少主體與機制等價證據時過早合併、把關係本身當成新來源、為了版型硬生空格、把 Prompt Package 可建立誤認成報告已完成_

**逐宮寫作 Prompt Package**：
Server 依固定十二宮順序，為每宮建立一個 canonical 寫作封套。封套不只帶內容格 Ref，還會把每格真正對應的 Axis claim、Structural influence 或 Flying influence 展開為可寫作素材，並只帶入該宮內容格已引用且已核准的全盤關係。主要生活地區與報告語言分開保存：前者只調整社會脈絡、生活用語及代表例子，後者只決定輸出語言；兩者都不能改變命理核心。封套具固定 Instructions、來源 trace、內容雜湊、UTF-8 預算與指紋；純資料 Adapter 會再把它綁到正式寫作 Output Contract，但在 Runtime 尚未接線前仍不可發送 OpenAI request。
_避免：只給模型不透明 Ref、把十二宮整盤全部塞進單宮寫作、讓地區刻板印象改寫命理、把語言與生活地區混成同一欄、把 request descriptor 已可驗證誤認成 Runtime 已開放_

**重點宮位**：
因本命化忌、陀羅或煞忌集中而可能讓命主感受較深的宮位；不代表它比其他宮位重要。
_避免：宮位重要性排名、吉凶恐嚇_

## 跨宮與報告

**飛化結論**：
飛化階段依固定規則產生的有向跨宮影響鏈：「出發宮人物／事情 → 落入宮受影響面向 → 四化基本動作 → 落入宮被飛化星曜的發生方式 → 生活連接」。飛化不是新增或搬動星曜，而是出發宮宮干使落入宮原本存在的指定星曜產生祿、權、科或忌。先建立宮位因果，最後才用被飛化星曜說明作用方式。對客人只呈現自然語言，不呈現技術路徑。
_避免：把飛化塞進單宮星曜的基本解釋、只說兩宮相連卻不說影響方向、把星曜從出發宮搬到落入宮、先用星曜硬湊宮位因果、在出發宮與落入宮各生成一份互相矛盾的答案、用飛化改寫兩宮原始結論_

工程上每條程式確認的飛化事實會先固定唯一權威結果 ID、全部合法來源 Actor、出發宮干事實、落入宮原有星曜、四化動作、星曜核心、本命同類四化底色及可選對宮補因。`d1FlyingFactSource.ts` 會把經 N0 驗證的十二宮宮干、module-owned 固定十干四化表與唯一星曜落點合併成 48 條不可變 Fact；宮干欄位本身仍不能單獨當正式飛化來源。模型不能換方向、換星、縮減來源角色或替同一事實另建第二份結果。

`d1FlyingModelInputContracts.ts` 再把這 48 條 Fact 逐條配對到正確的出發宮結果與落入宮結果，並提供落入宮 Registry 的完整合法分面。單宮結果沒有使用某位 Actor、某顆被飛化星曜或某個合法分面，不代表飛化階段不能使用；這些權威邊界分別由 Fact Source、N0 與 Registry 決定，不能用前一階段的文字覆蓋範圍錯誤縮減。

`d1FlyingKnowledgeContracts.ts` 再依每條 Model Input 從鎖定 K0 Catalog 選出被飛化星曜核心、共通四化規則、星曜專屬四化規則、出發宮與落入宮含義、完整來源 Actor，以及固定飛化公式。這些內容是程式可重算的 source-bound Knowledge View，不讓模型只拿到不透明 Rule ID，也不讓模型自選或改寫底層卡片；它仍是 `openAiCallable=false` 的內部交接層。

`d1FlyingPromptPackageContracts.ts` 再把每條 Model Input 與唯一 Knowledge View 封裝成 48 個邏輯 Prompt Package，固定 Instructions、Strict Result Schema 身分、來源索引、內容雜湊與 UTF-8 預算。這 48 個是不可遺漏的邏輯結果，不代表未來一定要發送 48 次 HTTP request；實體批次要等品質與時間測試後再決定。`d1FlyingResultBindings.ts` 會把模型結果的星曜核心、共通四化及星曜專屬四化 Rule Ref 綁回同一 Knowledge View，模型不能靠自填 coverage 換卡。

`d1FlyingPalaceIntegrationContracts.ts` 接著把完整 48 條 source-bound Result 依落入宮放進十二個固定宮位槽位。它會重新驗證每條 Result 的 Fact 與 Knowledge 來源，拒絕缺少、重複、額外或換卡的結果；沒有飛化落入的宮位仍保留空槽。這一層只建立不可變索引，不產生摘要、分數或客戶文字。

`d1PalaceWritingSourceContracts.ts` 再把十二份已驗證 Palace Result 與 Flying Palace Integration 組成十二宮未合併寫作來源格。Axis、Structural 與 Flying 每筆來源各占一格，並保留宮位、分面、來源種類與唯一 Ref；程式會檢查 chart、run、palace result 及 Flying target binding 一致。這一層明確標示 `semanticMerging=NOT_PERFORMED`、`wholeChartRelations=REQUIRED_BEFORE_WRITING`、`customerWriting=BLOCKED` 及 `openAiCallable=false`，直到全盤關係完成前都不能拿來直接產生客戶文章。

`d1WholeChartRelationContracts.ts` 接收上述來源格、十二份 Palace Result 與 N0 全盤掃描，保存四類不可變關係。整體方向必須引用命宮 Axis；重複模式與內在拉扯必須跨至少兩個宮位；深刻感受必須引用該宮相關 N0 訊號，且 Palace Result 的 Axis 證據鏈真的包含該訊號的星曜 placement。coverage 全由實際 Ref 重算。這一層只完成來源綁定，固定 `semanticReviewStatus=required`、`customerWritingStatus=blocked`，不代表語意已由程式判定，也未接 OpenAI Runtime。

`d1WholeChartSemanticReviewContracts.ts` 再把每一項關係綁到一個 `APPROVED` 或 `REPAIR_REQUIRED` 判定。問題只能使用 module-owned 固定代碼，且整體方向、重複模式、內在拉扯與深刻感受的專屬問題不能互相錯掛。程式會重驗完整 Whole-Chart source binding、固定一對一關係順序並由實際決定重算 coverage。只有全數核准時 `contentGridHandoffStatus=ready`；客戶寫作仍固定 `blocked`，要等內容格建立與文章忠實度審查。

`d1PalaceContentGridContracts.ts` 只在上述審查全數核准後建立十二宮內容格。宮位依 canonical 十二宮順序，分面依 `d1PalaceFacetRegistry.ts` 的順序，而且只建立實際有來源的分面。第一版採 `ONE_SOURCE_PER_CELL`，每筆 Axis／Structural／Flying 來源恰好進入一格，已核准 relation Ref 則附到所有被引用來源格；程式會重驗完整來源鏈並由格子重算 coverage。由於目前來源資料不足以 deterministic 證明不同來源具有相同主體與相同機制，本層明確不做語意合併，以保留矛盾和全部來源。`writingPackageHandoffStatus=ready` 只表示可建立下一層 Prompt Package；`customerWritingStatus=blocked` 與 `openAiCallable=false` 仍不變。

`d1PalaceWritingPromptPackageContracts.ts` 再把內容格的每一筆 Ref 解回實際 Axis claim、Structural influence 或 Flying influence，依固定順序建立十二個單宮 canonical Prompt Package。每宮只收到自己的內容格、實際來源素材及內容格引用的已核准 relation，不會收到其他宮位報告或整份 N0。固定 Instructions 將主要生活地區限制在社會語境與生活例子，報告語言則獨立決定輸出語言；Package 同時保存來源 trace、SHA-256、UTF-8 預算及指紋。Package 自身仍固定 `adapterStatus=bridge_required` 與 `openAiCallable=false`，只能由 `d1PalaceWritingAdapterBridgeContracts.ts` 驗證後綁到單宮 Result Strict Schema；該 bridge 仍標示 `runtimeStatus=runtime_wiring_required`，不會自行發 request。

`d1PalaceWritingResultContracts.ts` 只接受逐內容格的客戶文字。每格必須依原 Prompt Package 的固定順序回傳相同 Content Cell 與分面；程式會重驗 chart、run、call、宮位、Package fingerprint、內容格數量、順序與 facet binding。覆蓋由 Package 與實際 sections 直接比較，不讓模型另外手填 `majorStarsConsidered`。Result 完成時仍固定 `fidelityReviewStatus=required`、`customerDeliveryStatus=blocked`。

`d1PalaceWritingFidelityPromptPackageContracts.ts` 以同一份原 Writing Prompt Package 與已驗證 Writing Result 建立不可變審查封套。Review 模型會同時看到 source-bound 原始輸入與客戶文字，封套並保存原 Package fingerprint、Writing Result SHA-256、固定 review policy、來源 trace、UTF-8 預算與指紋；它不能只看成品自行猜測忠實度。

`d1PalaceWritingFidelityReviewContracts.ts` 再把每一格綁到 `APPROVED` 或 `REPAIR_REQUIRED`。審查只能使用 module-owned 固定問題碼，不能回傳自由文字理由或改寫後文章；任一格不合格時只給 `CONTENT_CELL_ONLY` 修補範圍，其他已核准格保持不動。`d1PalaceWritingAdapterBridgeContracts.ts` 另以第二個純資料 Adapter 將 Fidelity Prompt Package 綁到這份 Strict Schema 與 source-bound parser。只有所有格都通過且 Review 與 Package fingerprint、Writing Result SHA-256 完全一致時，該宮 `customerDeliveryStatus` 才能成為 `ready`。兩個 Adapter 都尚未接 Server、批次、資料庫或報告交付 Runtime。

`d1PalaceWritingGoldenCaseContracts.ts` 固定第一份脫敏單宮寫作金標：臺灣繁體中文的紫微命宮兩個內容格、老師討論後核准的客戶文字、完整 Writing／Fidelity source binding，以及兩階段 Adapter fingerprint。這份資料只標示 `approved_reference`，用來驗證來源覆蓋、白話邊界與交付狀態；它沒有姓名、生日、完整命盤或客戶資料，也不代表模型已實際生成。Benchmark Plan 固定 Writing 後接 Fidelity Review、最多兩個請求且不重試，但目前 `openAiCallable=false`、`executionStatus=not_executed`、token 與耗時均為 `not_measured`。

`d1PalaceWritingPreviewContracts.ts` 再把這份 Golden Case 綁成不可呼叫的受控 Preview 計畫與安全 Evidence 摘要。Plan 固定兩階段、最多兩次 fetch、零重試、未授權且 Runtime 未實作；Evidence 只能由未來受信任 Server Runner 在既有 validators 通過後產生，只保存階段狀態、duration、safe usage、結果雜湊與固定失敗碼。模型文章必須放在另行授權的受限 artifact，不能進 Evidence 摘要；即使技術驗證成功，白話、可能性邊界與臺灣語境仍須人工審閱，客戶交付保持阻擋。
_避免：把 Evidence parser 當品質裁判、把 JSON 合格直接等同可交付、在摘要保存模型原文或 Prompt、把 fetch 次數誤算成成功執行、尚未授權就建立 Runtime 或送出請求_

`d1PalaceWritingPreviewGateContracts.ts` 再固定 pre-request Gate Plan、exact 一次性授權與原子 claim observation。授權有效且 observation 為 `ABSENT` 時只會得到 `READY_FOR_ATOMIC_CLAIM`，下一步只能 exclusive create `request-started.json`，仍不能 fetch；若 observation 為 `PRESENT` 則一律視為已消耗並停止。Contract 內的 trusted authority 字串不是信任根，未來必須由 module-private、server-only 的 atomic storage adapter 實際保證 observation 與 exclusive create；目前沒有檔案操作、Server Runtime 或 OpenAI request。
_避免：把 READY_FOR_ATOMIC_CLAIM 誤讀成可呼叫 OpenAI、用呼叫者自填布林值取代原子 claim、先 fetch 再寫 request-started、把 authority 字串當成可信身分、claim 已存在仍重跑_

`d1PalaceWritingPreviewAtomicClaim.server.ts` 已實作上述信任根。它不接受呼叫者選 storage root，只在系統暫存區的固定私有目錄下，以 Gate fingerprint 分區並用 `open("wx", 0600)` exclusive create sentinel；目錄必須是目前程序使用者擁有的 `0700` regular directory。兩個並行 claimant 只有一個成功，既有、partial 或異常 claim 都阻擋後續執行；adapter 沒有覆寫、刪除、fetch、retry 或 OpenAI request 路徑。成功 claim 仍固定 `fetchAllowed=false`，下一步必須停止等待另一個受控 Runtime 切片。
_避免：讓呼叫者換目錄重用授權、先 exists 再一般寫入、刪除失敗 sentinel 後重試、接受 symlink 或寬鬆權限、把 CLAIMED 當成已送出 request_

`d1PalaceWritingPreviewPreRequestCoordinator.server.ts` 現在把 Gate Plan／一次性授權驗證、trusted observation、純 Gate decision 與 exclusive claim 串成單一 server-only 介面。一般路徑只會得到 `CLAIMED_STOPPED` 或 `BLOCKED_ALREADY_CONSUMED`；兩個 coordinator 同時看到 `ABSENT` 時，底層 `O_EXCL` 仍只讓一個建立 claim，競態落敗者必須重新觀察並收斂成同一個阻擋結果。Gate 或 storage 錯誤保持 fail closed。兩種結果都固定零 request／fetch，且沒有 fetch、OpenAI Adapter、retry、fallback 或刪除路徑。

`d1PalaceWritingPreviewRuntimeHandoff.server.ts` 再把成功的 coordinator 結果綁成同程序、單次消耗的 Runtime handoff。真正能力保存在 module-private `WeakMap`，不是公開欄位；只有模組親自建立的同一物件能被消耗，欄位相同的物件、shallow copy、`structuredClone`、JSON 往返或跨程序重建都會固定拒絕。合法物件被消耗後立刻失效，兩個並行 consumer 只會有一個成功；另一個得到固定 already-consumed error。即使 handoff 成功消耗，仍停在 `RUNTIME_ADAPTER_NOT_IMPLEMENTED` 前，request／fetch／OpenAI 計數全部為零。
_避免：把可複製欄位當成執行權、序列化 handoff 給另一程序、讓同一 handoff 被兩個 consumer 使用、用記憶體 capability 取代跨程序 Atomic Claim、把 CONSUMED_STOPPED 誤讀成可 fetch_

`d1PalaceWritingPreviewMockRuntimeContracts.ts` 已用單一 mock-only 介面固定 Writing→Fidelity Review 的循序、四個 allowlisted failure code、零重試與安全模擬 Evidence。Writing 先通過既有 source-bound parser，Fidelity Prompt Package 與 bridge 才能依實際 Writing Result 動態建立；因此 Preview Plan 現在明確區分 Writing 的 exact fingerprint 與 Fidelity 的 derived fingerprint。Mock executor 只取得 stage／sequence／fingerprint，不取得 Prompt、request body、命盤或秘密；回傳結果也不保存模擬輸出，且 request／fetch／OpenAI 計數固定為零。這仍不是 production Runtime permit。
_避免：讓呼叫者自行排序 observe／Gate／claim、把 EEXIST 當成可重試、競態落敗後再建立第二份 claim、把 coordinator 結果當成 request permit、在此層加入 OpenAI 或秘密_

`d1PalaceWritingPreviewRuntimePort.server.ts` 再以一個 server-only port probe 固定未來 Runtime Adapter 的最小介面。它重用 mock-only Runtime 的兩階段順序，只把既有 Adapter Bridge 產生的 validated request 交給 injected port；command 不含 API Key、Authorization、model override、fetch 或 provider endpoint。Writing output 必須先通過同一個 source-bound parser，才會依實際結果動態建立 Fidelity request。Port exception 收斂成固定 request failure，malformed outcome fail closed，結果不保存 Prompt、request 或模型輸出。Injected port 只可在 canonical test environment 執行，其他環境會在 invocation 前 fail closed；這一層仍標示 `INJECTED_PORT_PROBE_ONLY`、`runtimeHandoffStatus=NOT_CONNECTED` 與 `productionAdapterStatus=NOT_IMPLEMENTED`，所有 request／fetch 計數為零。
_避免：讓 production adapter 自行重建 Prompt 或 Schema、在 Writing 驗證前建立 Review、把秘密塞入 stage command、將離線 probe 誤認成 production consumer、提前消耗 Runtime handoff_

`d1PalaceWritingPreviewProductionAdapter.server.ts` 再以型別精確相容於既有 `requestAiChartOpenAiStructuredResponse()` 的離線 fake，驗證 production adapter binding。它只把 Port 提供的 exact validated request 原物件委派給同一 requester，不重建 Prompt、Schema、parser 或模型政策；回傳 usage 必須是四欄 exact、安全且算術一致，缺少 usage、malformed result 或 exception 都收斂成固定 request failure，不保留 provider message 或模型輸出。Probe 只允許 canonical test environment，並明確拒絕真正 server requester；它不接 handoff、不讀 Key、不 fetch，也沒有 production consumer，所以既有結果仍標示 `productionAdapterStatus=NOT_IMPLEMENTED` 且所有 request／fetch 計數為零。
_避免：用 adapter probe 直接送真實 request、為測試另造 transport、把 requester error 或未驗證 output 放進 Evidence、把型別相容誤認成 production 已接線、在缺少 safe usage 時假裝成功_

`d1PalaceWritingPreviewRuntimeBinding.server.ts` 現在把同程序 handoff 與上述離線 Adapter probe 收斂成單一 server-only 深模組。它會先驗證 canonical test environment、Plan、Golden Case、公開 handoff binding 與 fake requester 身分，通過後才同步消耗原始 handoff，再執行離線兩階段 probe。錯誤輸入或真正 requester 在消耗前固定拒絕；copy 仍沒有能力；一旦開始離線 probe，即使 requester 失敗也不能用同一 handoff 重跑；並行 binding 最多一個成功。結果固定為 `HANDOFF_BOUND_OFFLINE_ADAPTER_PROBE_ONLY`、`productionAdapterStatus=NOT_IMPLEMENTED` 且 request／fetch／OpenAI 計數為零。
_避免：由 caller 自行排列 consume 與 adapter 順序、先消耗再驗證輸入、adapter 失敗後重用 handoff、把 offline binding 誤認成 Production Runtime、因此讀 Key 或建立 Evidence_

`d1PalaceWritingPreviewExecutionLedgerContracts.ts` 再用純資料狀態機分開記錄 request attempt、fetch dispatch 與 validated stage success。Writing 成功後才綁定由實際結果衍生的 Fidelity bridge；pre-fetch failure 可忠實表示為 `attempted=1 / fetch=0 / executed=0`，post-fetch failure 則保留 safe usage 而不增加 executed。所有 failure 與完整成功都是 terminal、固定零 retry；帳本與錯誤均不可變，只接受固定失敗碼、四欄 token usage、duration 與 SHA-256，不接受模型文字或任意 metadata。它不是 capability，不會呼叫 Adapter、fetch、OpenAI 或保存 Evidence。`d1PalaceWritingPreviewContracts.ts` 現也接受 Writing 的 `1/0/0` 與 Fidelity 的 `2/1/1` pre-fetch failure；兩者都只能使用對應 request failure code 且 usage 必須為 `null`，不能用 output failure 或 token usage 偽裝成未送出。
_避免：把 attempted 當 fetch、把 fetch 當成功、預先假設 Fidelity fingerprint、讓 terminal 狀態重試、為迎合舊 Evidence parser 偽造 request 計數_

`d1PalaceWritingPreviewEvidenceProjectionContracts.ts` 現把 terminal Ledger 純投影成既有 final Evidence。它只接受 Writing／Fidelity 各自的 pre-fetch、post-fetch failure 與兩階段完整成功五種終態，並用既有狀態機重建後逐位比對，而不是信任呼叫者提供的計數或 stage。Writing 未成功時，Ledger 的 Fidelity bridge 仍是 `null`；Evidence 的 `NOT_STARTED` stage 只放 Preview Plan 的 reference fingerprint，不冒充已衍生 Runtime binding。成功 Evidence 仍阻擋客戶交付並等待人工品質審查；本層沒有檔案保存、restricted artifact、Runtime、fetch 或 OpenAI request。
_避免：直接把任意 Ledger 轉存、保存 non-terminal 狀態、把 Ledger 控制欄位放進 Evidence、把 reference fingerprint 當成已執行 bridge、把投影成功誤認成已保存或可交付_

`d1PalaceWritingPreviewEvidencePersistenceContracts.ts` 再將這份 final Evidence 綁成尚未落地的 write-once 保存封套。封套同時驗證 Preview Plan、Gate Plan 與 Ledger gate fingerprint；成功／失敗只能分別選 `request-succeeded.json`／`request-failed.json`，並固定 canonical JSON、Evidence SHA-256、Gate scope、`0700`／`0600`、exclusive create、禁止 overwrite／retry 及 restricted artifact 分離政策。封套狀態仍是 `NOT_PERSISTED`，沒有 storage root、檔案 I/O、Runtime 或 OpenAI。
_避免：由 caller 選檔名或目錄、把其他 Gate 的合法 Ledger 接到目前 claim、一般覆寫 Evidence、把保存計畫當成已建立檔案、把模型文章包進 safe Evidence_

`d1PalaceWritingPreviewEvidenceWriter.server.ts` 現把這份封套保存成 Gate-scoped、write-once 的 safe Evidence。Writer 先以 Preview Plan 與 Gate Plan 重驗 envelope、Evidence、固定檔名及 canonical SHA，再只在系統 temporary root 的固定私有目錄建立 Gate 終態 claim；成功與失敗即使並行也只能有一個取得目錄，artifact 另以 `open("wx", 0600)` 建立。既有 Gate 目錄、symlink、寬鬆權限、caller-selected root 或敏感額外欄位都 fail closed；回傳不揭露路徑，restricted model output 仍不保存。

`d1PalaceWritingPreviewEvidencePersistenceCoordinator.server.ts` 再把 terminal Execution Ledger 到實際保存收斂成單一 server-only seam。呼叫端只交付 Preview Plan、Gate Plan 與 Ledger；Coordinator 固定先建立並驗證 Persistence Envelope，再交給 write-once writer，且只回傳不含路徑的 frozen receipt。Non-terminal、Gate drift、額外或敏感欄位都會在建立 Evidence root 前拒絕；同一 Gate 重複呼叫不覆寫、不重試。Restricted model output 與客戶交付仍未開放。

`d1PalaceWritingPreviewEvidenceReadback.server.ts` 再提供人工審查前的唯一 safe Evidence 讀回邊界。它只接受 Plan、Gate 與 writer receipt，從固定私有位置以 `O_RDONLY | O_NOFOLLOW` 讀取唯一 artifact，重驗 root／Gate／file 權限與 ownership、128 KiB 上限、Evidence parser、canonical JSON、狀態／檔名及 SHA binding。缺檔、雙檔、symlink、權限漂移或內容竄改都回固定安全錯誤；成功也只回 frozen safe Evidence，不含路徑，restricted model output 固定不讀。
_避免：成功與失敗用不同檔名各寫一次、先寫再驗 Evidence、由 caller 決定 root、覆寫或刪除 partial Evidence 後重試、把 safe writer 擴成模型文章儲存_

`d1PalaceWritingPreviewRestrictedArtifactContracts.server.ts` 再把已驗證的 Writing Result 與 Fidelity Review 綁成純資料的 restricted model-output artifact。它只接受成功且已由 readback 重驗的 safe Evidence，並重新驗證 Writing／Fidelity Prompt Package、source-bound Result／Review、兩階段 bridge 與 result SHA；repair-required、失敗 Evidence、額外 storage control 或任何 identity／SHA drift 都 fail closed。Artifact 含模型正文但不含 Prompt、request body、秘密、命盤 snapshot 或出生資料，且固定 `NOT_PERSISTED`、`NOT_REVIEWED`、`BLOCKED_PENDING_HUMAN_REVIEW`；本層沒有檔案 I/O、Runtime、fetch 或 OpenAI。
_避免：把 safe Evidence 當模型正文、只看 success 不綁實際結果 SHA、把 Fidelity 技術核准當成人工核准、讓 caller 自選儲存位置或直接持久化_

`d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server.ts` 再把這份受限模型輸出綁成尚未落地的私有 write-once 封套。封套會以原 Plan、Gate、verified Evidence 與 Prompt Packages 重建 nested artifact，固定 `restricted-result.json`、完整 payload canonical SHA、Gate scope、`0700`／`0600`、exclusive create、禁止 overwrite／retry，以及 safe Evidence 分離政策。它仍是 `NOT_PERSISTED`、`NOT_REVIEWED`、`BLOCKED_PENDING_HUMAN_REVIEW`，沒有 storage root、filesystem、資料庫、Runtime 或 OpenAI。

`d1PalaceWritingPreviewRestrictedArtifactWriter.server.ts` 現把這份封套保存到與 safe Evidence 分離的私有 restricted storage。Writer 會在 I/O 前重驗 envelope 與全部權威來源，storage root、Gate 目錄與固定 `restricted-result.json` 都由 module 決定；Gate 目錄用單次 `mkdir` 排除並行雙寫，artifact 再以 `open("wx", 0600)` 寫入 canonical bytes。既有 Gate、symlink、寬鬆權限、caller-selected root 或竄改 payload 都 fail closed，receipt 不含路徑或正文。這仍只是 synthetic writer seam；artifact 維持 `NOT_REVIEWED` 與 `BLOCKED_PENDING_HUMAN_REVIEW`，尚無 readback、人工核准、Production Runtime 或 OpenAI request。

`d1PalaceWritingPreviewRestrictedArtifactReadback.server.ts` 現提供受限正文在人工審查前的唯一 bounded readback seam。它只接受 writer receipt 與原始 Plan、Gate、verified Evidence、兩階段 Prompt Packages，從固定 private root 讀取唯一 `restricted-result.json`，驗證 `0700`／`0600`、ownership、realpath、symlink、256 KiB 上限、source-bound parser、canonical bytes、artifact fingerprint 與 payload SHA。結果 frozen 且不含路徑；missing、duplicate、權限漂移、內容加料或 caller-selected root 都 fail closed。Readback 仍固定 `NOT_REVIEWED` 與 `BLOCKED_PENDING_HUMAN_REVIEW`，不提供 review decision、交付、Production Runtime 或 OpenAI request。

`d1PalaceWritingPreviewHumanReviewDecisionContracts.server.ts` 再把人工審查選擇建模成尚未授權的 metadata proposal。它重驗 verified restricted readback 與全部來源，只允許 `APPROVED`、`REPAIR_REQUIRED`、`REJECTED` 及六個固定問題碼；核准不能帶問題，修正／拒絕至少一項，未知、重複、自由文字、reviewer ID 或 caller authority 都拒絕。問題碼依 module 順序 canonicalize。所有輸出都固定 `PROPOSED_NOT_AUTHORIZED`、`NOT_VERIFIED`、`NOT_RECORDED`；即使選擇核准仍是 `BLOCKED_PENDING_TRUSTED_REVIEW_RECORD`，必須等未來 trusted human-review adapter 驗證真實 reviewer session 與權限。
_避免：由 caller 選受限檔案路徑或權限、只驗 artifact 內部 fingerprint 不驗完整 payload、把 safe Evidence 複製進模型正文檔、把封套建立誤認成已保存_

`d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server.ts` 再以離線 injected adapter probe 固定未來 reviewer session／permission 的最小安全邊界。Fake adapter 只接收 proposal、Gate、restricted artifact 與 payload fingerprints、固定 decision／issue codes，以及唯一 permission `AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW`；不接收模型正文、Prompt、命盤、出生資料、reviewer ID、notes 或 Secret。Outcome 必須逐欄綁回同一 proposal 與 artifact；通過後的 capability 只保存在 module-private `WeakMap`，copy／clone 無效，原物件最多消耗一次，並行 consumer 也只會有一個成功。這一層明確標示 `OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY`、`SYNTHETIC_AUTHORIZED_NOT_PRODUCTION`，消耗後仍 `NOT_RECORDED`、禁止正式紀錄、禁止 Production、阻擋客戶交付，下一步仍是實作真實 production human-review authorization adapter。
_避免：把 caller 傳入的 reviewer ID 或 `authorized=true` 當權限、把可複製欄位當 capability、把 synthetic session 當正式登入、消耗後直接建立審查紀錄或放行報告_

`d1PalaceWritingPreviewHumanReviewRecordPersistenceProbe.server.ts` 再消耗上述 exact handoff，固定未來人工審查紀錄的離線 write-once template。檔名只能是 `human-review-record.json`，Gate scope、canonical JSON、exclusive create、`0700`／`0600`、禁止 overwrite／retry 及四個來源 fingerprint 都由 module 固定；caller 不能選路徑、檔名、時間、reviewer ID 或寫入開關。因 handoff 仍是 synthetic，template 明確標示 `TEMPLATE_NOT_FORMAL_RECORD`、`NOT_PERSISTED`，且真實 authorization、reviewer identity、Server clock 都仍為 required；不可建立正式紀錄或放行客戶。Copy／clone／已消耗 handoff 固定拒絕，並行最多一個成功。
_避免：把離線 template 當正式審查紀錄、由 caller 自填 reviewer 或時間、讓同一 handoff 建立兩份紀錄、在沒有 production authorization 時實際寫檔_

`d1PalaceWritingPreviewHumanReviewProductionPortContracts.server.ts` 再把正式接線拆成三個不可省略的 Production port：request-bound reviewer authorization、trusted Server clock 與 write-once record storage。它只接受上一層模組親自建立的 exact template，copy／clone／wrapper 或 caller 注入 adapter、reviewer、時間與 storage root 都無效；同一 template 也只能交接一次。輸出只是一份 frozen port contract，固定唯一 permission、三段順序、十個 allowlisted failure code、private storage policy 與完整來源 fingerprints；不呼叫 adapter、不讀 session、不產生 reviewer ID／recordedAt，也不寫入紀錄。由於來源仍是 synthetic，Contract 固定 `PORTS_DECLARED_NOT_IMPLEMENTED`、`FORMAL_RECORD_NOT_CREATED`、零 adapter invocation／storage write／OpenAI request，客戶交付持續阻擋。
_避免：把介面宣告當成 Production adapter 已接線、讓 caller 自填 reviewer 或時間、由一般 server caller 選 storage、缺少任一 port 就建立正式紀錄、把 adapter error message 或敏感資料放進失敗碼_

`d1PalaceWritingHumanReviewRequestAuthorization.server.ts` 已實作三個 Production port 的第一段：它直接沿用既有 `requireAdminUser(request)`，由 Supabase Auth `getUser()` 驗證 Bearer session，再以 Server-only `ADMIN_EMAILS` allowlist 固定唯一 AI 命盤審查權限。輸出只保留 reviewer UUID 與固定安全 metadata，不保留 email、token、Session 或 Supabase client；能力只認同一程序的原始物件且只能消耗一次。這一層尚未接 API route，也不查 Report、不取得時間、不寫正式紀錄、不解除客戶交付。
_避免：由 Client 傳 reviewer ID、直接信任 session payload、把一般可複製 JSON 當權限、把第一個 port 完成誤認成整條正式審查流程已接好_

**多來源飛化並存**：
同一落入宮可以同時承受多條來自不同出發宮的飛化，正向與負向作用也可以並存。內部逐條保存來源、四化、被飛化星曜與作用機制；不互相抵銷、不加總成單一吉凶，也不選一條取代其他條。客戶報告可以依落入宮的同一生活主題排列，但每條作用仍要分別交代來源與表現。
_避免：正負相抵、計算總分、只留最強一條、把多個來源混成無法追查的綜合句_

**多來源共同行為**：
不同飛化影響鏈若最後形成同一項可觀察行為，內部仍保留每條獨立來源與機制；客戶文章只需描述一次該行為，並在同一段中明確交代它同時受到哪些不同來源影響。
_避免：相同行為重複成文、因合併文字而刪掉任一來源、只留下行為而失去形成原因_

**來源角色可能性**：
同一出發宮包含多個命盤支持、但尚未由客人真實背景確認的來源角色或經驗時，本命報告使用包容且可比對的來源描述。例如父母宮可寫成「爸爸、重要長輩的教育方式，或成長中的家庭經驗」。同一作用機制只寫一次，不替客人武斷選定唯一來源；未來聊天室取得客人背景後才能進一步確認。
_避免：硬判定一定是爸爸、把每個可能來源重複成一段、因客人可能沒有父親就刪除父母宮關係、在本命報告冒充已確認的人生經歷_

**飛化客戶因果句**：
把飛化結論寫成客人可代入的生活鏈：「來源人物或經驗 → 形成的內在感受或價值 → 反覆出現的選擇與行為 → 仍可能存在的結果或困擾」。宮位分面名稱只能作內部分類，不能直接拿「理財規劃受到影響」之類抽象標籤代替生活推演。
_避免：只把宮名換成正式名詞、公式翻譯、沒有說明命主為何產生該感受及之後如何行動_

**可追溯語意延伸**：
模型可以把「出發宮含義＋落入宮分面＋四化動作＋被飛化星曜核心」推演成來源沒有逐字列出的現代生活例子，但客戶句子中的每個重要人物、感受、行為與結果，都必須能沿這條證據鏈回推。副業、投資、消費等內容不是一律禁止；天機與財帛等底層確實支持時可以作為可能例子，換成太陰等其他星曜時就必須依該星核心產生不同延伸。
_避免：只因某例子在臺灣常見就自行加入、不同星曜套用同一組生活例子、讓模型常識取代星曜核心、把生活化變成無來源的新推論_

**全盤關係**：
只描述兩項以上已核准宮位主張之間的整體方向、重複模式或內在拉扯，以及有依據的深刻感受主題。
_避免：刪除、壓縮或改寫原本的宮位主張_

**跨引擎共同行為**：
本對宮、三方暗合、飛化或其他推演層若形成同一項可觀察行為，內部保留每一層的完整證據與作用機制；客戶文章只描述一次該行為，並可說明命盤中有不只一個因素加強這種傾向。只有真正相同的行為才能合併文字，不同特質、不同機制與矛盾面向仍分開保留。
_避免：重複成文、把多層證據壓成單一來源、因表面相似而合併不同機制、用整合刪除矛盾_

**十二宮直接人格分析**：
依固定順序呈現十二宮，直接告訴客人各生活領域可能的個性與現實表現，不寫成命理教學文章。
_避免：固定的星曜教學章節、飛化教學章節_

**生活主題編排**：
單一宮位客戶文章依該宮的生活分面與客人真正會問的問題排列，不依本對宮、輔煞、三方暗合或飛化等內部引擎分章。各引擎結論自然放入對應生活主題，來源仍由內部內容格與證據鏈保存。
_避免：向客人展示引擎步驟、建立三方四正或飛化教學章節、同一生活問題因來源不同散落重複_

**財帛與田宅的金錢分工**：
財帛宮分析命主如何看待金錢、賺錢、花錢、理財及實際用錢；田宅宮才處理財庫與存錢方式。兩者不能因為都和金錢有關就混在同一宮。
_避免：把存錢方式放入財帛宮、把財帛宮所有金錢結論搬到田宅宮、用同一段重複兩宮_

**田宅財庫邊界**：
本命田宅宮只分析存錢、累積與保留資產的方式、重視條件，以及哪些個性會幫助或干擾這些行為。它不能單獨證明實際財產金額、是否擁有房產、是否有錢，或最終一定守得住財富；實際結果要等大限、流年與事件推演。
現階段田宅宮不分析家世背景；正式分面只保留居住環境、附近環境、家人相處、存錢方式及資產累積保留。
_避免：把存錢傾向寫成財富結果、斷言有房或沒房、用本命人格直接預測資產成敗、從家庭條件延伸家世背景_

**紫微田宅財庫範例**：
紫微的面子、身分、尊重與價值感核心落入田宅財庫時，命主累積資產可能不是單純為了節省小錢，而是希望最後擁有拿得出手、看起來有價值的資產；例如願意為好地段、好房子或較有身價感的目標存錢。這只描述存錢目的與偏好，不代表一定存得到或一定買房。
_避免：把紫微簡化成節儉、斷言有房、把高價目標寫成已實現結果、脫離面子與價值感核心_

**核心乘分面推演**：
一般宮位落點不為十四主星逐一硬寫唯一答案。模型依「主星固定核心 × 已核准宮位分面」推演目的、想法、行為與可能表現。既有 168 筆 A2 單星十二宮資料與老師確認案例作為金標、校準與禁區，不限制模型只能照抄；講義明確指定的特殊規則才建立固定卡片。新例子必須完整回推到主星核心與宮位分面。
_避免：把所有星宮組合人工寫死、讓 A2 或金標案例成為唯一合法句子、沒有固定核心與分面就自由發揮、忽略講義特殊規則、讓新例子反向污染底層核心_

**A2 推演示範卡**：
從完整保留的 A2 原文衍生出的結構化示範，分開標示主星核心、宮位分面、機制連接、可能表現、結果邊界、規則身分與來源。它教模型如何從核心推到生活表現，不是讓模型照抄的固定答案。
_避免：修改 A2 原文、把整份 168 筆直接當 Prompt、混淆通用推演與講義特例、把示範文字視為唯一合法輸出_

**A2 原子主張**：
A2 同一段中的每一項獨立結論各自保存來源、可信層級與規則身分，不能因為共用一個段落就一起升格。實際欄位、批次轉換方式與人工驗證流程延後設計。
_避免：整段共用同一權威等級、把整理推論冒充講義原文、現在提前鎖死轉換實作_

**特殊落點優先**：
講義明確記載的特殊星宮規則必須保留，優先於模型的一般核心乘分面推演。一般推演可以補充不衝突的其他面向，不能覆蓋或反駁特殊規則；兩者不同但可同時成立時分開保留，只有真正邏輯互斥才停止並交由人工確認。
_避免：用通用公式刪除講義特例、把特例改寫成普通例子、因兩種面向不同就擅自選一個、模型自行裁決真正衝突_

**先核心、後影響**：
每個生活主題先說明本宮星曜形成的原始想法、價值與行為，再加入輔星、祿權科帶來的助力，以及煞忌、三方暗合或飛化帶來的加成、壓力與干擾。後續影響不能取代或改寫原始人格結論。
_避免：一開始只講煞忌、讓負面問題冒充整個人格、用外部影響覆蓋本宮核心、把助力或干擾寫成原本就有的特質_

**全盤導讀**：
放在十二宮文章之前、約 250–400 個中文字的閱讀入口，挑選少量最有幫助的全盤關係引導客人閱讀。
_避免：完整資料摘要、取代十二宮內容_

**客戶文章忠實度審查**：
在每宮白話文章完成後，確認文字忠於已核准內容格、保留可能性邊界且沒有新增命理的最終審查；它只能指出問題，不能直接改寫。
_避免：第二次全篇潤飾、讓審查者產生新結論_

**社會脈絡轉譯**：
在命理公式與因果主張已驗證後，先把它轉成心理感受、價值、選擇與行為，再依客人主要生活國家或地區，從同一個已核准語意範圍內選擇當地可理解的日常語彙與生活例子。臺灣脈絡只能改寫表達方式，不能增加星曜、宮位與四化證據沒有支持的行為或事件。
_避免：用國籍刻板印象推斷人格、直接把宮位分類詞交付客戶、讓在地例子反過來成為新命理結論、忽略星曜差異套用通用例子、為了生活化斷定客人真的經歷某事件_

## 品質與修復

**交付阻擋問題**：
會讓報告命理內容錯誤或失去必要覆蓋的問題，例如星曜、宮位、主體、命盤事實或可能性邊界錯誤。
_避免：把單純文句不順也視為整份失敗_

**呈現問題**：
不改變命理結論的單一例子、在地化或文字品質問題；只有在主張仍保留有效例子且覆蓋完整時，才能排除該問題內容後交付。
_避免：悄悄刪掉重要結論_

**定點修復**：
只重做被指出有問題的主張或宮位文章，其他已核准內容保持不變。
_避免：任一小錯就重跑整張命盤_

**報告配方版本**：
一份報告開始時固定的命盤 Snapshot、知識卡、SOP、Prompt、Schema 與各階段模型版本組合；整份報告必須依同一配方完成。
_避免：同一報告生成途中使用新舊混合規則_

**正式報告 Artifact 綁定**：
人工審查前，由可信任 Server adapter 把正式 Report UUID、該 Report 的 canonical 命盤 Snapshot SHA，以及 Gate、受限結果 Artifact、payload 與人工決策 fingerprints 綁成同一份不可替換 metadata。Report 必須存在、已付款、owner 關係已由 Server 驗證，且 Artifact 必須確實由同一份 Snapshot 產生。
_避免：由 Client 指定 owner 或付款狀態、把一份合法模型結果掛到另一份 Report、在綁定紀錄保存出生資料、完整命盤或模型正文_

**Server 驗證報告主體**：
由 Server 只讀查詢正式 Report 的 ID、owner、付款狀態與 canonical Snapshot，驗證 Report 存在、owner 有效、已付款且 Snapshot 合法，再只向下游傳遞 Report UUID 與 Snapshot SHA-256。這一步只證明 Report 主體可信；在 Artifact 也帶有同源 Snapshot digest 並完成相等比對前，source binding 必須保持待證明。
_避免：由 Client 傳 owner／paid／Snapshot SHA、把完整 Snapshot 放入 capability、只因 Report 合法就宣稱 Artifact 同源、用 chartId 代替 Snapshot digest_

**Request-bound 人工審查授權**：
正式人工審查只能從目前 HTTP Request 的 Server 驗證 session 取得 reviewer UUID，再由 Server 的既有管理員 allowlist授予唯一固定審查權限。授權物件只在同一程序有效且只能消耗一次；它本身不能取代 Report／Snapshot／Artifact 綁定、Server time 或正式紀錄。
_避免：由 Client 傳 reviewer、把 email／Bearer token 寫進審查 metadata、複製授權 JSON 重複使用、只驗登入就放行客戶報告_

**正式人工審查 Command**：
由 Server 把原始 request-bound reviewer 授權、已付款 Report 與 Restricted Artifact 的精確同源證明，以及人工決策 proposal 綁成同一個一次性能力。Gate、Artifact、payload 與 Snapshot 任一身分不相符都必須在消耗能力前停止。
_避免：把不同 Report、模型結果與人工決策自由拼裝、複製 JSON 重複建立紀錄_

**可信 Server 時間審查紀錄封套**：
正式人工審查 Command 通過後，時間只能由 module-owned Server clock 取得，再形成 canonical、frozen、一次性的 `human-review-record.json` 封套。封套固定 Gate scope、payload SHA、`0700`／`0600`、exclusive create、禁止 overwrite／retry；在 trusted writer 真正保存成功前仍是 `NOT_PERSISTED`，不能當正式紀錄或放行報告。
_避免：由 Client 自填審查時間、在時鐘失敗時先消耗 command、把尚未落盤的封套當正式審查結果_

**可信 write-once 人工審查紀錄保存**：
只有原始、未消耗的審查紀錄封套能交給 Server-only writer。Writer 在固定私有 temporary storage 依 Gate fingerprint 建立唯一目錄，再以 exclusive create 寫入 canonical `human-review-record.json`；receipt 不含實體路徑、Report ID、reviewer ID 或正文。保存成功只表示 `PERSISTED_AWAITING_VERIFIED_READBACK`，還不能視為已驗證的正式帳本或放行客戶報告。
_避免：由 caller 選 storage root、覆寫既有紀錄、同一 Gate 並行雙寫、把 path 或身分資料放進 receipt、未讀回驗證就交付_

**可信人工審查紀錄讀回驗證**：
Writer receipt 是同程序、不可複製且只能使用一次的讀回能力。Server-only verifier 只從固定 Gate 位置讀取唯一 `human-review-record.json`，並重驗 `0700`／`0600`、ownership、realpath、symlink、32 KiB 上限、Strict record shape、canonical bytes、payload SHA，以及 record／Gate／envelope receipt binding。驗證失敗後不能重用同一 receipt。通過只表示人工審查紀錄完整可供下一層判斷；核准仍是 `BLOCKED_PENDING_DELIVERY_COORDINATOR`，修正與拒絕也維持各自阻擋，不會直接交付。
_避免：信任可複製 receipt、讀取任意路徑或多餘檔案、只做 JSON.parse、驗證成功就直接把 Report 改成可讀、讓修正／拒絕進入交付_

**可信客戶交付協調**：
只有同程序原始、尚未消耗且決策為 `APPROVED` 的 verified human-review record 能進入交付協調。協調器必須重新以 Server read seam 核對同一 Report UUID、有效 owner、canonical Snapshot SHA、paid、尚未終止且正文尚未發布；核對成功只建立一次性的 metadata handoff，固定為 `BLOCKED_PENDING_TRUSTED_DELIVERY_ADAPTER`。修正、拒絕、copy／clone、Report／Snapshot 漂移、owner 缺失、未付款、失敗狀態或已有正文都不得進入交付 Adapter。
_避免：把人工核准直接當成客戶可讀、相信舊的 Report 狀態、由 Client 傳 paid／status／content、在協調器內直接寫 Report、讓可複製 JSON 取得交付能力_

**可信交付 Adapter Contract**：
只接受上述原始、尚未消耗的交付協調 capability，並由同一組 Report、Snapshot、Gate、review record 與 coordination fingerprints 推導固定 idempotency key。正式 Adapter 的責任順序固定為：先 append 或精確核對 durable review ledger，再以 owner／paid／pending／content absent／exact Snapshot 作原子 Report compare-and-set claim，最後才可用已驗證的 restricted artifact 發布正文。只有完全相同的重播能取得既有結果；任何 ledger、Report、Snapshot、Artifact 或 idempotency 衝突都必須 fail closed。現有先讀取 `report_content` 再更新的流程不構成原子交付證明。
_避免：先寫 Report 再補審查帳本、使用 read-then-write 冒充 compare-and-set、由 caller 自訂 idempotency key、衝突時盲目重試、把 Contract 宣告誤認成已完成 Production Adapter_

**Report Snapshot digest 保存**：
建立 Report 時，Server repository 必須先形成實際保存的 canonical Snapshot copy，再以與 N0 相同的 canonical JSON SHA-256 規則同步保存 `chart_snapshot_sha256`。Public create input 不接受 digest，Client 傳入 camelCase 或 snake_case digest 都必須在 insert 前拒絕；可信交付只能相信這個 Server 保存值。Migration 未先套用前不得部署包含這項新寫入的應用程式。
_避免：由 Client 自填 Snapshot digest、對清理前輸入計算 SHA、讓 N0 與 Report 使用不同排序規則、先部署應用程式再補資料庫欄位_

**可信交付離線 Adapter Probe**：
`d1PalaceWritingTrustedDeliveryAdapterProbe.server.ts` 只在 canonical test environment 消耗上述 exact Contract，並依序把固定 metadata command 交給 injected fake 的 durable ledger、Report atomic claim 與正文發布三個 Port。三段全新結果、三段完全相同重播，以及「前段已存在、後段繼續完成」的 partial-failure reconciliation 有不同固定狀態；idempotency 漂移、不可能的 created／existing 組合、加料 outcome、Port exception、copy／clone 或重複能力都 fail closed。開始呼叫 Port 後原 Contract 即不可重用，probe 不執行自動 retry。結果只保留固定狀態與 receipt fingerprints，仍是 `BLOCKED_OFFLINE_ADAPTER_PROBE_ONLY`，實際 ledger write、Report mutation、Artifact read 與 OpenAI request 都是零。
_避免：把 fake outcome 當真實資料庫成功、失敗後重用同一 Contract、只驗最終結果而不驗 Port 順序、將 provider message／正文放入 error、因離線 probe 通過就開放客戶交付_

**Runtime 授權耐久收據**：
GitHub protected Environment 的一次人工核准與 OIDC 短效身分不能直接當成長期 Runtime 開關。OIDC 驗證通過後，Server 必須以 `replayKeyFingerprint` 與 exact `authorizationCommandFingerprint` 兩個唯一鍵，在同一原子操作建立 immutable receipt；只有兩鍵共同指向逐欄完全相同的既有 receipt 才能 exact replay。Receipt 只保存固定 command 與 Contract fingerprints，不保存 raw claims、token、reviewer、proof、provider 文字或自由文字。Runtime 每次讀取仍須重驗目前 Release、Migration readiness 與 policy，版本漂移不得沿用舊授權。
_避免：用記憶體 Set 或先讀後寫防重送、把短效 OIDC token 當持久授權、保存 reviewer／token／claims、跨 Release 重用、用 caller boolean 開啟 Runtime_

**Runtime 授權收據離線 Probe**：
`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server.ts` 已在 test-only public Repository seam 驗證並行建立只有一個 fresh winner、exact replay、兩個唯一鍵的單鍵／交叉衝突、commit 後未知結果的唯讀 reconciliation，以及新 Release／Contract drift fail closed。Probe 不自動 retry，所有結果固定禁止 Runtime 與客戶交付；內部 Map 只模擬 atomic behavior，不是 durable storage。Storage／Adapter Mapping 已由下一層 Contract 固定。
_避免：因 Probe 通過就宣稱資料庫已持久化、用 in-memory Map 取代 unique constraint、未知寫入結果盲目重送、直接接通 GitHub／Supabase／Runtime_

**Runtime 授權收據 Storage／Adapter Mapping**：
`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server.ts` 只宣告未來 durable storage 的固定形狀：private schema 的 21 個 non-null scalar columns、command fingerprint primary key、replay fingerprint unique，以及禁止 JSONB、UPDATE、DELETE 與直接 table DML。外部 Repository 仍只有 `createOrReadExact`／`readExact`；Production Adapter 內部才使用原子 create、unknown-write 雙鍵 reconciliation 與 Runtime read 三個 RPC。第一個 write 只能一次，transport outcome unknown 時只准再做一次唯讀 reconciliation，不能 write retry。Contract 沒有 SQL、Migration、Supabase client、database connection、Runtime 或 OpenAI；下一步是 offline RPC Probe。
_避免：把 declaration 當已建立資料表、把完整 command 存 JSONB、讓 caller 選 RPC、混淆 Runtime read 與 unknown-write reconciliation、因 transport uncertainty 重送 create_

`d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server.ts` 已用 test-only injected RPC Port 實際驗證上述 mapping。外部仍只有兩個 Repository methods；create 會把 exact receipt 展開成 21 個 frozen scalar parameters，Runtime read 只帶 command fingerprint。只有 atomic write 回報 unknown outcome 時，Adapter 才以同一 command／replay fingerprints 做一次 read-only reconciliation；不重送 write，也沒有第二次 read。四個成功 result codes、七個 failure mappings、strict 22 欄 response parser、current Contract／Release／Migration／policy revalidation、caller expansion、provider payload 與 Production fail-closed 都已驗證。這仍沒有 Supabase client、`.rpc()`、SQL、Migration、database connection、Runtime、Report mutation 或 OpenAI。
_避免：把 injected fake 當正式資料庫、把 unknown write 當 retry、接受加料 row 或 provider message、讓 Runtime read 共用 reconciliation、因 Probe 通過就開啟 Production_

## 未來時間層

**本命人格底層**：
命主先天的個性、價值與選擇基準，是後續大限與流年分析的長期底圖。

**大限人格層**：
某十年期間較明顯的個性與價值取向，會與本命人格底層疊加並影響選擇。

**流年觸發層**：
某一年的想法、選擇與外在條件，會在本命與大限的脈絡中觸發具體表現。
