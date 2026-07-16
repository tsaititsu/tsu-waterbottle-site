# 22｜D1 各呼叫輸入／輸出 Schema 工作版

> 定位：提供 Codex 建立 TypeScript 型別、JSON Schema 與 OpenAI Structured Outputs。
>
> 本文件先定義資料邊界。實作時應由同一份型別來源產生 runtime validator 與 JSON Schema，避免三份定義不同步。

---

## 一、共用列舉

```ts
type PalaceName =
  | "命宮" | "父母宮" | "福德宮" | "田宅宮"
  | "官祿宮" | "僕役宮" | "遷移宮" | "疾厄宮"
  | "財帛宮" | "子女宮" | "夫妻宮" | "兄弟宮";

type MutagenType = "化祿" | "化權" | "化科" | "化忌";

type RuleStatus = "teacher_confirmed" | "lecture_backfill" | "working_inference";

type ResultStatus = "complete" | "partial" | "incomplete" | "invalid";

type Severity = "error" | "warning" | "info";

type D1Scope =
  | "personality" | "values" | "thinking" | "behavior"
  | "relationship_pattern" | "work_pattern" | "money_pattern"
  | "family_pattern" | "health_habit" | "long_term_need";
```

---

## 二、正規化命盤 `NormalizedChart`

```ts
interface NormalizedChart {
  chartId: string;
  metadata: {
    solarDate?: string;
    lunarDate?: string;
    time?: string;
    gender?: "male" | "female" | "other" | "unknown";
    fiveElementsClass?: string;
    sourceVersion?: string;
  };
  palaces: NormalizedPalace[];
  bodyPalace: {
    palace: PalaceName;
    branch: string;
    sameAsMing: boolean;
  };
  natalMutagens: NatalMutagen[];
  flyingTransformations: FlyingTransformation[];
  relationships: {
    opposites: PalaceRelation[];
    hiddenCombinations: PalaceRelation[];
    trines: TrineRelation[];
  };
  globalScan: GlobalScan;
  dataWarnings: DataIssue[];
  validationErrors: DataIssue[];
}
```

### `NormalizedPalace`

```ts
interface NormalizedPalace {
  palaceId: string;
  name: PalaceName;
  branch: string;
  majorStars: StarPlacement[];
  minorStars: StarPlacement[];
  isEmptyOfMajorStars: boolean;
  canBorrowOppositeMajorStars: boolean;
  borrowedMajorStars: StarPlacement[];
  isFourHorseBranch: boolean;
  oppositePalaceId: string;
  hiddenCombinationPalaceId: string;
  trinePalaceIds: string[];
}
```

### 星曜與四化

```ts
interface StarPlacement {
  star: string;
  order?: number;
  natalMutagens: MutagenType[];
  tags: string[];
}

interface NatalMutagen {
  type: MutagenType;
  star: string;
  palaceId: string;
  legal: boolean;
}

interface FlyingTransformation {
  flyingTransformId: string;
  sourcePalaceId: string;
  destinationPalaceId: string;
  star: string;
  type: MutagenType;
  legal: boolean;
  validationNotes: string[];
}
```

### 全盤掃描

```ts
interface GlobalScan {
  tuoLuoPalaceIds: string[];
  natalJi: NatalMutagen[];
  palaceMaleficCounts: Array<{
    palaceId: string;
    directCount: number;
    oppositeCount: number;
    hiddenCombinationCount: number;
    trineCount: number;
    totalRelevantCount: number;
    items: string[];
  }>;
  fourHorsePalaceIds: string[];
}
```

---

## 三、知識片段 `KnowledgeBundle`

```ts
interface KnowledgeBundle {
  bundleId: string;
  version: string;
  taskType: "palace" | "flying_transform" | "body" | "synthesis" | "audit" | "output";
  rules: KnowledgeRule[];
}

interface KnowledgeRule {
  ruleId: string;
  title: string;
  content: string;
  status: RuleStatus;
  sourceFile: string;
  sourceSection?: string;
  appliesTo: string[];
  priority: number;
}
```

規則內容衝突時，程式先按 `priority` 排序；模型仍須在輸出中標記實際使用的 `ruleId`。

---

## 四、P1 宮位分析輸入

```ts
interface PalaceAnalysisInput {
  runId: string;
  chartId: string;
  target: NormalizedPalace;
  opposite: NormalizedPalace;
  hiddenCombination: NormalizedPalace;
  otherTrines: NormalizedPalace[];
  globalScanForTarget: GlobalScan["palaceMaleficCounts"][number];
  knowledge: KnowledgeBundle;
  promptVersion: string;
  schemaVersion: string;
}
```

---

## 五、P1 宮位分析輸出

```ts
interface PalaceAnalysisResult {
  callId: string;
  chartId: string;
  palaceId: string;
  palace: PalaceName;
  status: ResultStatus;
  primaryAxis: {
    statement: string;
    majorStarCore: string[];
    doubleStarCore?: string;
    borrowedStarMode: "none" | "borrowed";
    usedRuleIds: string[];
  };
  directCandidates: D1Candidate[];
  oppositeInfluences: D1Candidate[];
  hiddenCombinationInfluences: D1Candidate[];
  trineInfluences: D1Candidate[];
  combinedCandidates: D1Candidate[];
  tensions: TraitTension[];
  strengths: D1Candidate[];
  imbalancePossibilities: D1Candidate[];
  coverage: PalaceCoverage;
  d2Boundaries: D2Boundary[];
  warnings: string[];
}
```

### 共用候選 `D1Candidate`

```ts
interface D1Candidate {
  candidateId: string;
  statement: string;
  lifeExamples: string[];
  scopes: D1Scope[];
  palaceIds: string[];
  starBasis: string[];
  structureBasis: Array<
    "本宮" | "對宮" | "暗合" | "三方" | "空宮借星" |
    "生年四化" | "飛化" | "煞忌" | "輔星" | "身宮"
  >;
  usedRuleIds: string[];
  ruleStatus: RuleStatus;
  intensity: "background" | "normal" | "strong";
  conflictGroupId?: string;
  d2Boundary?: string;
}
```

`intensity` 是結構強度標記，不是事件機率，也不是模型主觀信心分數。

### 覆蓋資訊

```ts
interface PalaceCoverage {
  directMeaningsConsidered: string[];
  majorStarsCovered: string[];
  minorStarsCovered: string[];
  mutagensCovered: string[];
  maleficsCovered: string[];
  noblesCovered: string[];
  oppositeProcessed: boolean;
  hiddenCombinationProcessed: boolean;
  trinesProcessed: boolean;
  omittedItems: Array<{ item: string; reason: string }>;
}
```

### 矛盾與 D2 邊界

```ts
interface TraitTension {
  tensionId: string;
  sideA: string;
  sideB: string;
  coexistenceExplanation: string;
  candidateIds: string[];
}

interface D2Boundary {
  boundaryId: string;
  topic: string;
  prohibitedD1Conclusion: string;
  allowedD1Wording: string;
  reason: string;
}
```

---

## 六、F1 飛化分析輸入

```ts
interface FlyingTransformAnalysisInput {
  runId: string;
  chartId: string;
  flyingTransformation: FlyingTransformation;
  sourcePalace: NormalizedPalace;
  destinationPalace: NormalizedPalace;
  sourceAnalysis: PalaceAnalysisResult;
  destinationAnalysis: PalaceAnalysisResult;
  sourceMeanings: MeaningItem[];
  destinationMeanings: MeaningItem[];
  knowledge: KnowledgeBundle;
  promptVersion: string;
  schemaVersion: string;
}

interface MeaningItem {
  meaningId: string;
  label: string;
  layer: "direct" | "flying_extension" | "opposite_extension";
  enabledForD1: boolean;
}
```

---

## 七、F1 飛化分析輸出

```ts
interface FlyingTransformAnalysisResult {
  callId: string;
  chartId: string;
  flyingTransformId: string;
  status: ResultStatus;
  sourceSummary: string;
  destinationSummary: string;
  transformationCore: string;
  candidates: FlyingTransformCandidate[];
  coverageMatrix: CoverageMatrixItem[];
  mergedCandidateGroups: Array<{
    retainedCandidateId: string;
    mergedCandidateIds: string[];
    reason: string;
  }>;
  d2Boundaries: D2Boundary[];
  warnings: string[];
}
```

### 飛化候選

```ts
interface FlyingTransformCandidate extends D1Candidate {
  sourceMeaningId: string;
  destinationMeaningId: string;
  bridgeMechanism: string;
  sourceBehavior: string;
  destinationEffect: string;
}
```

### 覆蓋矩陣

```ts
interface CoverageMatrixItem {
  sourceMeaningId: string;
  destinationMeaningId: string;
  status: "candidate_created" | "merged" | "excluded";
  candidateId?: string;
  mergedIntoCandidateId?: string;
  exclusionReason?: string;
}
```

每個啟用的出發宮含義與落入宮含義組合都必須出現在矩陣中。

---

## 八、B1 身宮輸出

```ts
interface BodyPalaceResult {
  callId: string;
  chartId: string;
  status: ResultStatus;
  bodyPalace: PalaceName;
  sameAsMing: boolean;
  postIndependenceNeeds: D1Candidate[];
  pursuitStyle: D1Candidate[];
  mingBodyRelationship: string;
  usedCandidateIds: string[];
  d2Boundaries: D2Boundary[];
}
```

---

## 九、S1 人格整合輸出

```ts
interface PersonalitySynthesisResult {
  callId: string;
  chartId: string;
  status: ResultStatus;
  coreTraits: SynthesizedTrait[];
  repeatedTraits: SynthesizedTrait[];
  domainSpecificTraits: SynthesizedTrait[];
  internalTensions: SynthesizedTension[];
  longTermNeeds: SynthesizedTrait[];
  recurringStruggles: SynthesizedTrait[];
  domainProfiles: Record<PalaceName, DomainProfile>;
  relationshipPatterns: SynthesizedTrait[];
  workPatterns: SynthesizedTrait[];
  moneyPatterns: SynthesizedTrait[];
  familyPatterns: SynthesizedTrait[];
  healthHabits: SynthesizedTrait[];
  mutagenCompensation: SynthesizedTrait[];
  unresolvedPossibilities: UnresolvedPossibility[];
  d2Boundaries: D2Boundary[];
  warnings: string[];
}
```

### 綜合特質

```ts
interface SynthesizedTrait {
  synthesisId: string;
  statement: string;
  lifeExamples: string[];
  sourceCandidateIds: string[];
  sourcePalaceIds: string[];
  scopes: D1Scope[];
  classification: "cross_palace" | "domain_specific" | "long_term";
  ruleStatuses: RuleStatus[];
}

interface SynthesizedTension {
  synthesisId: string;
  sideA: string;
  sideB: string;
  howTheyCoexist: string;
  likelyDomainsForA: PalaceName[];
  likelyDomainsForB: PalaceName[];
  sourceCandidateIds: string[];
}

interface DomainProfile {
  summary: string;
  traitIds: string[];
  candidateIds: string[];
}

interface UnresolvedPossibility {
  possibilityId: string;
  alternatives: string[];
  sourceCandidateIds: string[];
  whyD1CannotChoose: string;
  neededContext: Array<"lived_context" | "major_limit" | "annual_limit" | "other">;
}
```

所有 `sourceCandidateIds` 必須可以回查 P1、F1 或 B1 的既有候選。

---

## 十、A1 審核輸入與輸出

```ts
interface AuditInput {
  runId: string;
  chart: NormalizedChart;
  palaceResults: PalaceAnalysisResult[];
  flyingResults: FlyingTransformAnalysisResult[];
  bodyResult: BodyPalaceResult;
  synthesis: PersonalitySynthesisResult;
  knowledgeBundles: KnowledgeBundle[];
  promptVersion: string;
  schemaVersion: string;
}

interface AuditResult {
  callId: string;
  chartId: string;
  pass: boolean;
  issues: AuditIssue[];
  requiredRepairs: RepairRequest[];
  checkedItems: AuditCheck[];
}
```

### 審核問題

```ts
interface AuditIssue {
  issueId: string;
  severity: Severity;
  code: string;
  message: string;
  targetCallId?: string;
  jsonPath?: string;
  relatedRuleIds: string[];
}

interface RepairRequest {
  repairId: string;
  targetCallType: "P1" | "F1" | "B1" | "S1" | "FORMAT";
  targetCallId: string;
  jsonPaths: string[];
  instructions: string[];
  preserveOtherFields: true;
}

interface AuditCheck {
  checkId: string;
  passed: boolean;
  notes: string;
}
```

---

## 十一、R1 修補介面

```ts
interface RepairInput<T> {
  runId: string;
  originalResult: T;
  repairRequest: RepairRequest;
  relevantKnowledge: KnowledgeBundle;
  promptVersion: string;
  schemaVersion: string;
}

interface RepairOutput<T> {
  callId: string;
  targetCallId: string;
  repairedResult: T;
  changedJsonPaths: string[];
  preservedOtherFields: boolean;
  notes: string[];
}
```

程式端必須 diff `originalResult` 與 `repairedResult`；若修改超出允許路徑，拒絕結果並重試。

---

## 十二、O1 輸出介面

```ts
type OutputMode =
  | "full" | "concise" | "work" | "relationship"
  | "money" | "teaching" | "cta";

interface OutputRenderInput {
  runId: string;
  chartId: string;
  mode: OutputMode;
  synthesis: PersonalitySynthesisResult;
  selectedEvidence: Array<
    PalaceAnalysisResult | FlyingTransformAnalysisResult | BodyPalaceResult
  >;
  language: "zh-TW";
  tone: "teacher" | "professional" | "plain";
  lengthMode: "short" | "standard" | "deep";
}

interface OutputRenderResult {
  callId: string;
  chartId: string;
  mode: OutputMode;
  sections: Array<{
    sectionId: string;
    title: string;
    body: string;
    sourceSynthesisIds: string[];
  }>;
  omittedSynthesisIds: string[];
  warnings: string[];
}
```

Output 每一段都要保留來源 `sourceSynthesisIds`，確保表達層沒有新增結論。

---

## 十三、呼叫紀錄

```ts
interface ModelCallRecord {
  runId: string;
  callId: string;
  chartId: string;
  callType: "P1" | "F1" | "B1" | "S1" | "A1" | "R1" | "O1";
  parentCallIds: string[];
  promptVersion: string;
  schemaVersion: string;
  knowledgeBundleId: string;
  model: string;
  inputHash: string;
  outputHash?: string;
  status: "queued" | "running" | "succeeded" | "failed" | "invalid";
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

---

## 十四、Schema 驗證與重試

1. OpenAI 回傳後先做 JSON Schema 驗證。
2. 再做程式語意驗證，例如：
   - 十二宮名稱是否合法
   - candidateId 是否唯一
   - sourceCandidateIds 是否存在
   - 覆蓋矩陣是否完整
   - 飛化星曜是否存在於落入宮
3. 格式錯誤先走 FORMAT 修補。
4. 規則錯誤交 A1，再走對應 R1。
5. 同一 call 最多兩次自動重試。
6. 仍失敗時保留原始輸入、輸出與錯誤，標記 `incomplete`，不可假裝完成。

---

## 十五、尚待 Codex 實作時決定

以下屬工程配置，不在命理規格中寫死：

- 使用哪個 OpenAI 模型
- 最大併發數
- timeout
- token budget
- 儲存介面與資料庫
- queue／workflow 工具
- 是否使用 embedding 做候選去重

但無論工程選擇為何，都不得改變本文件定義的資料邊界與推理順序。
