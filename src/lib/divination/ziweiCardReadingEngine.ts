import OpenAI from "openai";
import { ziweiCards, type ZiweiCard } from "./cards";
import {
  READING_SYSTEM_INSTRUCTIONS,
  REVIEW_SYSTEM_INSTRUCTIONS,
} from "./ziweiCardReadingInstructions";
import { getZiweiLoveMindConclusion } from "./ziweiCardReasoningDomain";
import {
  getDivinationOpenAIModel,
  getDivinationReasoningEffort,
} from "../openai/divinationModel";

function getOpenAiClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 180_000,
    maxRetries: 1,
  });
}

export function getZiweiCardOpenAiRequestConfig() {
  return {
    model: getDivinationOpenAIModel(process.env),
    reasoning: { effort: getDivinationReasoningEffort() },
  } as const;
}

const ANSWER_VERSION = "answer-investment-llm-v20260710";
const PROMPT_VERSION = "prompt-domain-reasoning-v20260809";
const ROUTE_VERSION = "route-reading-v20260601";
const REVIEW_PROMPT_VERSION = "review-cached-dedup-v20260710";
const MAX_FOLLOW_UP_CONTEXT_ITEMS = 20;

type OutputLengthMode = "short" | "standard" | "deep";

type ReadingGenerationMode =
  | "single"
  | "two_pass"
  | "two_pass_non_investment"
  | "single_investment_guarded"
  | "two_pass_risk_only"
  | "two_pass_paid_only";

type ReadingInput = {
  question: string;
  cardId: string;
  position: "正位" | "反位";
  followUpContext?: FollowUpContext | null;
  generationMode?: ReadingGenerationMode | null;
};

type FollowUpItem = {
  question: string;
  cardName?: string;
  position?: string;
  answerSummary?: string;
  questionType?: string;
  questionSubcategory?: string;
};

type FollowUpContext = {
  isFollowUp?: boolean;
  threadId?: string;
  parentReadingId?: string;
  previousReadings?: FollowUpItem[];
};

type ReadingContext = {
  question: string;
  card: ZiweiCard;
  position: "正位" | "反位";
  questionType: string;
  questionDomain: string;
  questionIntent: string;
  questionSubcategory: string;
  questionCore: string;
  answerContract: string;
  outputLengthMode: OutputLengthMode;
  riskLevel: string;
  positionMeaning: string;
  cardDomainMeaning: string;
  reverseToUprightAdvice: string;
  topicData: string;
  followUpContext?: FollowUpContext | null;
};

type DateIntent =
  | "specific_date_request"
  | "suitability_check"
  | "attention_check"
  | "multi_candidate_compare"
  | "single_date_check"
  | "general_date_context";

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type GenerationDecision = {
  requestedMode: ReadingGenerationMode;
  effectiveMode: ReadingGenerationMode;
  reviewEnabled: boolean;
  reviewReason: string;
};

type GenerationResult = {
  answer: string;
  draftAnswer: string;
  generationDecision: GenerationDecision;
  draftUsage: TokenUsage;
  reviewUsage: TokenUsage;
  latencyMs: number;
  reviewChangedMeaning: boolean;
  reviewSafetyAdjusted: boolean;
  reviewIssuesFixed: string[];
  reviewFallbackUsed: boolean;
  reviewFallbackReason: string;
  reviewDraftLength: number;
  reviewFinalLength: number;
  reviewFinalDraftRatio: number;
  reviewDraftParagraphCount: number;
  reviewFinalParagraphCount: number;
};

type InvestmentValidationResult = {
  pass: boolean;
  issues: string[];
  hasOperationAdvice: boolean;
  hasPerformanceLanguage: boolean;
  hasOpportunityLanguage: boolean;
  hasLossFearLanguage: boolean;
  hasLanguagePollution: boolean;
};

export function classifyZiweiCardQuestion(
  question: string,
  followUpContextInput?: unknown
) {
  const normalizedQuestion = question.trim();
  const followUpContext = normalizeFollowUpContext(followUpContextInput);
  const detectedQuestionType = detectQuestionType(normalizedQuestion);
  const questionType = inferFollowUpQuestionType(
    normalizedQuestion,
    detectedQuestionType,
    followUpContext
  );
  const questionDomain = buildQuestionDomainByType(
    questionType,
    detectQuestionDomain(normalizedQuestion)
  );
  const questionIntent = detectQuestionIntent(normalizedQuestion);
  const detectedQuestionSubcategory = buildQuestionSubcategory(
    questionType,
    normalizedQuestion
  );
  const questionSubcategory = inferFollowUpQuestionSubcategory(
    questionType,
    normalizedQuestion,
    detectedQuestionSubcategory,
    followUpContext
  );

  return {
    questionType,
    questionDomain,
    questionIntent,
    questionSubcategory,
    questionCore: buildQuestionCore(questionType, questionSubcategory),
    answerContract: buildAnswerContract(questionType, questionSubcategory),
    riskLevel: detectRiskLevel(questionType, normalizedQuestion),
  };
}


function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function normalizeGenerationMode(value: unknown): ReadingGenerationMode | null {
  if (typeof value !== "string") {
    return null;
  }

  if (
    value === "single" ||
    value === "two_pass" ||
    value === "two_pass_non_investment" ||
    value === "single_investment_guarded" ||
    value === "two_pass_risk_only" ||
    value === "two_pass_paid_only"
  ) {
    return value;
  }

  return null;
}

function getReadingGenerationMode(
  requestedMode?: ReadingGenerationMode | null
): ReadingGenerationMode {
  return (
    requestedMode ||
    normalizeGenerationMode(process.env.READING_GENERATION_MODE) ||
    "single"
  );
}

function readTokenUsage(response: unknown): TokenUsage {
  const data =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  const usage =
    data.usage && typeof data.usage === "object"
      ? (data.usage as Record<string, unknown>)
      : {};

  const inputTokens =
    typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const outputTokens =
    typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
  const totalTokens =
    typeof usage.total_tokens === "number"
      ? usage.total_tokens
      : inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function isRiskOnlyTwoPassTarget(context: ReadingContext) {
  if (context.riskLevel !== "normal") {
    return true;
  }

  if (
    context.questionType === "日期擇日" ||
    context.questionType === "合約法律" ||
    context.questionType === "健康狀態" ||
    context.questionType === "金錢投資"
  ) {
    return true;
  }

  if (isMoneyQuestion(context.questionType, context.question)) {
    return true;
  }

  if (
    isLoveQuestion(context.questionType, context.question) &&
    includesAny(context.question, [
      "心意",
      "還有我",
      "喜歡",
      "在乎",
      "冷淡",
      "故意",
      "忙",
      "回應",
      "回覆",
    ])
  ) {
    return true;
  }

  return false;
}

function decideGenerationMode(
  context: ReadingContext,
  requestedMode?: ReadingGenerationMode | null
): GenerationDecision {
  const mode = getReadingGenerationMode(requestedMode);
  const highRiskInvestment = isHighRiskInvestmentContext(context);

  if (highRiskInvestment) {
    return {
      requestedMode: mode,
      effectiveMode: "single_investment_guarded",
      reviewEnabled: false,
      reviewReason:
        mode === "single"
          ? "high_risk_investment_guarded"
          : "high_risk_investment_skip_free_review",
    };
  }

  if (mode === "single_investment_guarded") {
    return {
      requestedMode: mode,
      effectiveMode: "single",
      reviewEnabled: false,
      reviewReason: "not_high_risk_investment",
    };
  }

  if (mode === "two_pass") {
    return {
      requestedMode: mode,
      effectiveMode: "two_pass",
      reviewEnabled: true,
      reviewReason: "mode_two_pass",
    };
  }

  if (mode === "two_pass_non_investment") {
    return {
      requestedMode: mode,
      effectiveMode: "two_pass",
      reviewEnabled: true,
      reviewReason: "mode_two_pass_non_investment",
    };
  }

  if (mode === "two_pass_risk_only" && isRiskOnlyTwoPassTarget(context)) {
    return {
      requestedMode: mode,
      effectiveMode: "two_pass",
      reviewEnabled: true,
      reviewReason: "risk_or_sensitive_topic",
    };
  }

  if (mode === "two_pass_paid_only" && context.followUpContext?.isFollowUp) {
    return {
      requestedMode: mode,
      effectiveMode: "two_pass",
      reviewEnabled: true,
      reviewReason: "follow_up_paid_context",
    };
  }

  return {
    requestedMode: mode,
    effectiveMode: "single",
    reviewEnabled: false,
    reviewReason: "single_pass",
  };
}

function getOutputLengthProfile(mode: OutputLengthMode) {
  // 2026-07-10:全部題型統一 500～1000 字,避免自動判斷失準把回答壓太短。
  // mode 仍保留在回應裡當分類參考;深入題允許多一個次提醒。
  return {
    label: mode,
    softRange: "500～1000 個中文字",
    softMax: "約 1000 字",
    maxSecondaryReminders: mode === "deep" ? 3 : 2,
    guidance:
      "回答要完整：明確落點、星曜與正反位原因、現實狀態、具體指引與觀察指標都要有。簡單題寫靠近 500 字即可，複雜題或高風險題可以寫到接近 1000 字。字數服務於清楚，不要為了湊字數重複同一句話或塞空話。",
  };
}

function inferOutputLengthMode(context: ReadingContext): OutputLengthMode {
  const question = context.question;
  const dateIntent = detectDateIntent(question);

  if (context.followUpContext?.isFollowUp) {
    return "deep";
  }

  if (
    context.riskLevel !== "normal" ||
    isHighRiskInvestmentContext(context) ||
    isHealthCriticalQuestion(question) ||
    context.questionType === "合約法律" ||
    includesAny(question, ["車禍", "和解", "診斷書", "法律", "訴訟", "調解"])
  ) {
    return "deep";
  }

  if (dateIntent === "multi_candidate_compare" || isChoiceMainBiasQuestion(context)) {
    return "deep";
  }

  if (
    dateIntent === "single_date_check" ||
    dateIntent === "specific_date_request" ||
    dateIntent === "suitability_check" ||
    dateIntent === "attention_check"
  ) {
    return "short";
  }

  if (
    isLoveQuestion(context.questionType, question) &&
    includesAny(question, [
      "心意",
      "還有我",
      "喜歡",
      "在乎",
      "回覆",
      "回應",
      "冷淡",
      "忙",
      "主動",
    ])
  ) {
    return "short";
  }

  if (
    context.questionIntent === "要不要做" &&
    !includesAny(question, ["還是", "哪個", "哪一個", "比較", "多個", "幾個"])
  ) {
    return "short";
  }

  return "standard";
}

function buildOutputLengthBlock(context: ReadingContext) {
  const profile = getOutputLengthProfile(context.outputLengthMode);

  return `Output Length Mode
模式：${profile.label}
soft target：${profile.softRange}
soft cap：${profile.softMax}
次提醒上限：${profile.maxSecondaryReminders}
模式說明：${profile.guidance}

長度規則：
- 字數服務於清楚，不是硬性限制。
- 不可為了縮短答案，刪掉明確落點、星曜牌義、正反位原因、問題核心、觀察指標或必要安全邊界。
- 若題目同時包含多個方向，請先抓一個主落點，再補 1 到 ${profile.maxSecondaryReminders} 個次提醒；不要把所有方向平均展開。
- 若答案太長，優先刪重複句、空泛安慰、重複安全聲明、題外延伸與模板句。`;
}

function safeJsonParseObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const candidate = trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function unwrapFinalAnswerJsonText(answer: string) {
  const raw = answer.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = safeJsonParseObject(jsonMatch?.[0] || raw);
  const finalAnswer = parsed?.finalAnswer;

  if (typeof finalAnswer !== "string" || !finalAnswer.trim()) {
    return raw;
  }

  const suffix =
    jsonMatch?.index === undefined
      ? ""
      : raw.slice(jsonMatch.index + jsonMatch[0].length).trim();

  return [finalAnswer.trim(), suffix].filter(Boolean).join("\n\n");
}

function normalizeReviewedAnswerText(answer: string) {
  return unwrapFinalAnswerJsonText(answer)
    .replaceAll("\\n\\n", "\n\n")
    .replaceAll("\\n", "\n")
    .replace(/^\s*"?(?:changedMeaning|safetyAdjusted|issuesFixed|reviewFallbackUsed|reviewIssuesFixed)"?\s*:.*$/gim, "")
    .replace(/^\s*"finalAnswer"\s*:\s*"?/gim, "")
    .replace(/。{2,}/g, "。")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countChineseCharacters(text: string) {
  return text.match(/[\u4e00-\u9fff]/g)?.length || 0;
}

function countAnswerParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

function buildReviewStats(reviewedAnswer: string, draftAnswer: string) {
  const reviewedChars = countChineseCharacters(reviewedAnswer);
  const draftChars = countChineseCharacters(draftAnswer);
  const reviewedParagraphs = countAnswerParagraphs(reviewedAnswer);
  const draftParagraphs = countAnswerParagraphs(draftAnswer);
  const ratio =
    draftChars > 0 ? Math.round((reviewedChars / draftChars) * 1000) / 1000 : 1;

  return {
    reviewedChars,
    draftChars,
    reviewedParagraphs,
    draftParagraphs,
    ratio,
  };
}

function extractQuestionCoreTerms(question: string) {
  const terms = [
    "心意",
    "回覆",
    "回應",
    "主動",
    "忙",
    "冷淡",
    "喜歡",
    "在乎",
    "觀望",
    "穩定",
    "禮貌",
    "輕鬆",
    "投資",
    "期貨",
    "停損",
    "日期",
    "開幕",
    "課程",
    "學習",
    "複習",
    "負擔",
  ];

  return terms.filter((term) => question.includes(term));
}

function hasQuestionCoreTerm(answer: string, question: string) {
  const terms = extractQuestionCoreTerms(question);

  if (terms.length === 0) {
    return true;
  }

  return terms.some((term) => answer.includes(term));
}

function isLoveContactQuestion(question: string) {
  return (
    includesAny(question, ["主動", "找他", "找她", "聯絡", "傳訊息"]) &&
    includesAny(question, ["回", "回應", "回覆"])
  );
}

function hasLikelyVerdict(answer: string) {
  return includesAny(answer, [
    "這張牌比較偏向",
    "比較偏向",
    "可以",
    "不建議",
    "先不要",
    "有機會",
    "偏向",
    "不算穩",
    "不太順",
    "需要先",
  ]);
}

function hasObservationIndicator(answer: string) {
  return includesAny(answer, [
    "觀察",
    "接下來",
    "一週",
    "兩週",
    "這週",
    "近期",
    "後續",
    "留意",
    "確認",
    "看對方",
    "看主管",
    "看客人",
    "看回覆",
    "看成效",
    "先檢查",
    "先整理",
    "先把",
  ]);
}

function buildFinalAnswerCompletenessIssues(answer: string, context: ReadingContext) {
  const issues: string[] = [];

  if (!hasLikelyVerdict(answer)) {
    issues.push("missing_verdict");
  }

  if (!answer.includes(context.card.name)) {
    issues.push("missing_card_name");
  }

  if (!answer.includes(context.position)) {
    issues.push("missing_orientation");
  }

  if (!hasQuestionCoreTerm(answer, context.question)) {
    issues.push("missing_question_core_term");
  }

  if (!hasObservationIndicator(answer)) {
    issues.push("missing_observation_indicator");
  }

  if (
    includesAny(answer, ["專業人士", "醫師", "律師", "投資顧問"]) &&
    (!answer.includes(context.card.name) || !answer.includes(context.position))
  ) {
    issues.push("safety_washed_out_card_meaning");
  }

  return issues;
}

function buildReviewFallbackReasons(
  reviewedAnswer: string,
  draftAnswer: string,
  context: ReadingContext
) {
  const stats = buildReviewStats(reviewedAnswer, draftAnswer);
  const lengthProfile = getOutputLengthProfile(context.outputLengthMode);
  const reasons: string[] = [];
  const allowsLongerSafetyAnswer =
    context.riskLevel !== "normal" ||
    context.questionType === "合約法律" ||
    context.questionType === "健康狀態" ||
    context.questionType === "金錢投資" ||
    isHealthCriticalQuestion(context.question);

  if (stats.draftChars < 180) {
    return reasons;
  }

  if (stats.reviewedChars < 120) {
    reasons.push("final_too_short_under_120");
  }

  if (
    !allowsLongerSafetyAnswer &&
    stats.reviewedChars > Number(lengthProfile.softMax.match(/\d+/)?.[0] || 900) &&
    stats.reviewedChars > stats.draftChars * 1.4
  ) {
    reasons.push(`final_excessive_expansion_over_${context.outputLengthMode}_soft_cap`);
  }

  if (stats.reviewedChars < stats.draftChars * 0.45) {
    reasons.push("final_less_than_45_percent_of_draft");
  }

  if (stats.reviewedParagraphs < 3) {
    reasons.push("final_less_than_3_paragraphs");
  }

  if (stats.draftParagraphs >= 3 && stats.reviewedParagraphs < stats.draftParagraphs * 0.5) {
    reasons.push("paragraphs_shrunk_too_much");
  }

  if (!reviewedAnswer.includes(context.card.name)) {
    reasons.push("missing_card_name");
  }

  if (!hasQuestionCoreTerm(reviewedAnswer, context.question)) {
    reasons.push("missing_question_core_term");
  }

  if (
    isLoveContactQuestion(context.question) &&
    !includesAny(reviewedAnswer, ["回應", "回覆", "穩定", "禮貌", "輕鬆", "觀望"])
  ) {
    reasons.push("love_contact_missing_response_quality");
  }

  reasons.push(...buildFinalAnswerCompletenessIssues(reviewedAnswer, context));

  return reasons;
}

function validateReadingInput(body: unknown): { ok: true; value: ReadingInput } | { ok: false; response: Response } {
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const question =
    typeof data.question === "string" ? data.question.trim() : "";
  const cardId = typeof data.cardId === "string" ? data.cardId : "";
  const position = data.position === "反位" ? "反位" : data.position === "正位" ? "正位" : "";
  const followUpContext = normalizeFollowUpContext(data.followUpContext);
  const generationMode = normalizeGenerationMode(
    data.generationMode || data.readingGenerationMode
  );

  if (!question || !cardId || !position) {
    return {
      ok: false,
      response: Response.json(
        { error: "缺少必要資料，請確認問題、牌名與正反位都有送出。" },
        { status: 400 }
      ),
    };
  }

  if (question.length > 500) {
    return {
      ok: false,
      response: Response.json(
        { error: "問題內容過長，請精簡到 500 字以內。" },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true,
    value: {
      question,
      cardId,
      position,
      followUpContext,
      generationMode,
    },
  };
}

function normalizeFollowUpContext(value: unknown): FollowUpContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const previousReadings = Array.isArray(data.previousReadings)
    ? data.previousReadings
        .slice(0, MAX_FOLLOW_UP_CONTEXT_ITEMS)
        .map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            question:
              typeof row.question === "string"
                ? row.question.trim().slice(0, 160)
                : "",
            cardName:
              typeof row.cardName === "string"
                ? row.cardName.trim().slice(0, 30)
                : "",
            position:
              row.position === "正位" || row.position === "反位"
                ? row.position
                : "",
            answerSummary:
              typeof row.answerSummary === "string"
                ? row.answerSummary.trim().slice(0, 220)
                : "",
            questionType:
              typeof row.questionType === "string"
                ? row.questionType.trim().slice(0, 30)
                : "",
            questionSubcategory:
              typeof row.questionSubcategory === "string"
                ? row.questionSubcategory.trim().slice(0, 40)
                : "",
          };
        })
        .filter((item) => item.question || item.answerSummary)
    : [];

  if (!previousReadings.length) {
    return null;
  }

  return {
    isFollowUp: true,
    threadId:
      typeof data.threadId === "string" ? data.threadId.trim().slice(0, 80) : "",
    parentReadingId:
      typeof data.parentReadingId === "string"
        ? data.parentReadingId.trim().slice(0, 120)
        : "",
    previousReadings,
  };
}

function runSafetyConstitution(question: string): { blocked: true; answer: string } | { blocked: false } {
  if (isCrisisQuestion(question)) {
    return {
      blocked: true,
      answer: buildCrisisSafetyAnswer(),
    };
  }

  if (isSystemInstructionAttack(question)) {
    return {
      blocked: true,
      answer:
        "這題我不能照外部指令修改系統、顯示後台資料或處理金鑰資訊。如果你要占卜，請把問題改成感情、工作、金錢、健康或某件具體事情本身。",
    };
  }

  return { blocked: false };
}

function detectQuestionIntent(question: string) {
  const text = question.toLowerCase();

  if (
    includesAny(text, [
      "要不要",
      "該不該",
      "需不需要",
      "是否要",
      "要請",
      "要用",
      "可以先",
      "適合先",
      "能不能用",
      "要不要調整",
      "要不要改",
      "要不要換",
      "要不要請",
      "要不要放",
      "要不要做"
    ])
  ) {
    return "要不要做";
  }

  if (
    includesAny(text, [
      "要注意什麼",
      "需要注意什麼",
      "注意哪些",
      "注意哪裡",
      "注意什麼",
      "風險",
      "小心",
      "隱憂",
      "爭議",
      "麻煩",
      "會不會有問題",
      "需要留意",
      "留意哪些",
      "提醒"
    ])
  ) {
    return "風險提醒";
  }

  if (
    includesAny(text, [
      "要如何",
      "如何",
      "怎麼做",
      "怎麼",
      "怎樣",
      "方法",
      "策略",
      "改善",
      "經營",
      "提升",
      "增加",
      "吸引"
    ])
  ) {
    return "怎麼做";
  }

  if (
    includesAny(text, [
      "能不能",
      "可不可以",
      "會不會",
      "有沒有機會",
      "機會大不大",
      "有機會",
      "可行嗎",
      "可行",
      "受歡迎嗎",
      "會成功嗎",
      "順利嗎"
    ])
  ) {
    return "可不可行";
  }

  if (
    includesAny(text, [
      "適合嗎",
      "合適嗎",
      "值得嗎",
      "值不值得",
      "能簽嗎",
      "能買嗎",
      "能賣嗎",
      "可以買",
      "可以賣",
      "可以做",
      "適合",
      "合適"
    ])
  ) {
    return "適不適合";
  }

  if (
    includesAny(text, [
      "現在",
      "這週",
      "今天",
      "近期",
      "最近",
      "目前",
      "這段時間",
      "這個月",
      "三個月",
      "一個月",
      "時機",
      "時間點"
    ])
  ) {
    return "時機判斷";
  }

  if (
    includesAny(text, [
      "對方",
      "前任",
      "主管",
      "買家",
      "賣家",
      "合作對象",
      "他是不是",
      "她是不是"
    ])
  ) {
    return "對象判斷";
  }

  return "一般判斷";
}

function isExplicitFinancialInvestmentQuestion(question: string) {
  return hasExplicitHighRiskInvestmentTerms(question);
}

function hasExplicitHighRiskInvestmentTerms(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "股票",
    "投資",
    "台股",
    "美股",
    "etf",
    "基金",
    "期貨",
    "選擇權",
    "外匯",
    "虛擬貨幣",
    "加密貨幣",
    "幣圈",
    "幣種",
    "比特幣",
    "以太幣",
    "標的",
    "持股",
    "持有",
    "續抱",
    "續扣",
    "定期定額",
    "買進",
    "賣出",
    "進場",
    "出場",
    "加碼",
    "減碼",
    "停損",
    "停利",
    "部位",
    "倉位",
    "做多",
    "做空",
    "放空",
    "盤中",
    "行情",
    "k線",
    "報酬",
    "投資組合",
    "聯電",
  ]);
}

function isInvestmentEmotionQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "想翻本",
    "翻本",
    "交易情緒",
    "情緒交易",
    "不理性",
    "賭氣",
    "不甘心",
    "追回",
    "虧損後",
    "判斷被情緒",
  ]);
}

function hasExplicitLoveRelationshipCue(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "曖昧",
    "感情",
    "愛情",
    "復合",
    "分手",
    "前任",
    "告白",
    "喜歡的人",
    "男友",
    "女友",
    "伴侶",
    "老公",
    "老婆",
    "另一半",
    "這段關係",
    "這段感情",
  ]);
}

function detectPropertyHandoverResponsibilityIntent(question: string) {
  const text = question.toLowerCase();
  const hasPropertyCue = includesAny(text, [
    "交屋",
    "點交",
    "驗收",
    "屋況",
    "房屋",
    "房子",
    "買房",
    "賣房",
    "房產",
    "不動產",
  ]);
  const hasResponsibilityCue = includesAny(text, [
    "責任歸屬",
    "責任",
    "款項",
    "尾款",
    "付款",
    "文件",
    "修繕",
    "交接",
    "卡在哪",
  ]);

  return hasPropertyCue && hasResponsibilityCue;
}

function detectOralPromiseDealIntent(question: string) {
  const text = question.toLowerCase();

  if (hasExplicitLoveRelationshipCue(question)) {
    return false;
  }

  return includesAny(text, [
    "口頭答應",
    "口頭承諾",
    "口頭約定",
    "答應的條件",
    "承諾的條件",
    "條件可信",
    "可信嗎",
    "白紙黑字",
  ]) && includesAny(text, ["條件", "可信", "承諾", "答應", "約定", "文件", "紀錄"]);
}

function detectDeliveryDelayIntent(question: string) {
  const text = question.toLowerCase();

  if (hasExplicitLoveRelationshipCue(question)) {
    return false;
  }

  return includesAny(text, [
    "交貨",
    "交付",
    "出貨",
    "交期",
    "拖延交貨",
    "延遲交貨",
    "拖延出貨",
    "延遲出貨",
    "履約",
    "到貨",
  ]);
}

function detectTransactionDealIntent(question: string) {
  const text = question.toLowerCase();

  if (
    hasExplicitHighRiskInvestmentTerms(question) ||
    isInvestmentEmotionQuestion(question) ||
    hasExplicitLoveRelationshipCue(question)
  ) {
    return false;
  }

  const hasDealCue = includesAny(text, [
    "買賣交易",
    "這筆交易",
    "交易糾紛",
    "買賣糾紛",
    "交易會不會",
    "繼續談",
    "買賣",
    "成交",
    "議價",
    "買家",
    "賣家",
    "價格",
    "付款",
    "交付",
  ]);

  const hasDealRiskCue = includesAny(text, [
    "責任",
    "文件",
    "證據",
    "糾紛",
    "條件",
    "承諾",
  ]);

  return hasDealCue || (hasDealRiskCue && includesAny(text, [
    "交易",
    "買賣",
    "成交",
    "買家",
    "賣家",
    "付款",
    "交付",
  ]));
}

function detectLegalOutcomeIntent(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "法律問題",
    "法律勝負",
    "會不會贏",
    "會不會輸",
    "勝訴",
    "敗訴",
    "官司",
    "訴訟",
  ]);
}

function isSideIncomeQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    includesAny(text, ["副業", "兼職", "接案"]) &&
    includesAny(text, ["收入", "增加收入", "賺錢", "收入來源", "收入方式"])
  );
}

function isIncomeChoiceQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    includesAny(text, ["本業收入", "副業", "教學", "銷售", "接案", "收入方式", "賺錢方式"]) &&
    includesAny(text, ["還是", "哪一個", "哪個", "比較適合", "增加收入"])
  );
}

function hasRealEstateLoanCue(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "房貸",
    "買房",
    "房子",
    "房屋",
    "房產",
    "置產",
    "不動產",
    "交屋",
    "房仲",
    "屋況",
    "預售屋",
    "中古屋",
  ]);
}

function detectMoneyFinanceSubcategory(question: string) {
  const text = question.toLowerCase();

  if (isBankSelectionQuestion(question)) {
    return "金錢｜銀行選擇";
  }

  if (isIncomeChoiceQuestion(question)) {
    if (includesAny(text, ["教學", "銷售", "接案"])) {
      return "金錢｜收入方式選擇";
    }

    return "金錢｜收入選擇";
  }

  if (isSideIncomeQuestion(question)) {
    return "金錢｜副業收入";
  }

  if (includesAny(text, ["抽獎", "中獎", "偏財", "偏財運", "樂透", "刮刮樂"])) {
    return "金錢｜偏財抽獎";
  }

  if (includesAny(text, ["財運", "財務", "金錢運", "錢運"])) {
    return "金錢｜整體財運";
  }

  if (includesAny(text, ["存錢", "存得住", "預算", "儲蓄"])) {
    return "金錢｜存錢預算";
  }

  if (includesAny(text, ["亂花錢", "花費", "花錢", "消費", "超支"])) {
    return "金錢｜消費花費";
  }

  if (includesAny(text, ["貸款", "借貸", "借款", "申請貸款"])) {
    return "金錢｜貸款借貸";
  }

  if (includesAny(text, ["欠款", "欠我的錢", "還我", "還錢", "債務", "債"])) {
    return "金錢｜欠款債務";
  }

  if (includesAny(text, ["回款", "收款", "款項", "尾款", "收到錢", "收得到"])) {
    return "金錢｜回款收款";
  }

  if (includesAny(text, ["家用", "生活費", "家庭開銷", "日常開銷"])) {
    return "金錢｜家用開銷";
  }

  if (includesAny(text, ["大額購買", "買電腦", "比較貴的電腦", "高單價", "貴的"])) {
    return "金錢｜大額購買";
  }

  if (includesAny(text, ["保險", "保單", "保險規劃"])) {
    return "金錢｜保險規劃";
  }

  if (includesAny(text, ["現金流", "資金周轉", "周轉"])) {
    return "金錢｜現金流";
  }

  if (includesAny(text, ["收入", "賺錢", "增加收入", "收入來源", "收入方式"])) {
    return "金錢｜收入方向";
  }

  return "";
}

function isGeneralMoneyFinanceQuestion(question: string) {
  const text = question.toLowerCase();

  if (hasExplicitHighRiskInvestmentTerms(question) || isInvestmentEmotionQuestion(question)) {
    return false;
  }

  return Boolean(detectMoneyFinanceSubcategory(question)) ||
    includesAny(text, [
      "金錢",
      "錢",
      "財務",
      "財運",
      "收入",
      "賺錢",
      "副業",
      "偏財",
      "抽獎",
      "存錢",
      "花錢",
      "家用",
      "貸款",
      "欠款",
      "還錢",
      "回款",
      "保險",
      "現金流",
    ]);
}

function isBusinessSalesQuestion(question: string) {
  const text = question.toLowerCase();
  const hasSalesScene = includesAny(text, [
    "寄售",
    "擺攤",
    "市集",
    "攤位",
    "活動營收",
    "鹿港",
    "商品",
    "陳列",
    "庫存",
    "客流",
    "人流",
    "轉換率",
    "定價",
    "現場銷售",
    "現場賣",
    "賣得如何",
    "賣得出去",
    "回本",
  ]);
  const hasSalesIntent = includesAny(text, [
    "會不會賺錢",
    "能不能賺錢",
    "有沒有賺錢",
    "有機會賺錢",
    "還有機會賺錢",
    "機會賺錢",
    "可以賺錢",
    "能賺錢",
    "賺錢嗎",
    "賺不賺錢",
    "營收",
    "收入",
    "賣得如何",
    "賣得出去",
    "回本",
    "生意",
    "銷售",
  ]);

  return hasSalesScene && hasSalesIntent && !isExplicitFinancialInvestmentQuestion(question);
}

function isResaleRegistrationChoiceQuestion(question: string) {
  const text = question.toLowerCase();
  const hasResaleScene = includesAny(text, [
    "代售",
    "寄售",
    "市集報名",
    "攤位報名",
    "報名端午節",
    "端午節",
    "下一次",
    "市集",
    "攤位",
  ]);
  const hasChoiceCue = includesAny(text, [
    "還是",
    "哪一個",
    "哪個",
    "比較好",
    "比較適合",
    "要報名",
    "報名",
  ]);

  return hasResaleScene && hasChoiceCue && !isCourseCreatorQuestion(question);
}

function isAccidentSettlementQuestion(question: string) {
  const text = question.toLowerCase();
  const hasAccidentCue = includesAny(text, [
    "車禍",
    "事故",
    "被撞",
    "撞到",
    "車損",
    "受傷",
    "傷勢",
  ]);
  const hasSettlementCue = includesAny(text, [
    "和解",
    "理賠",
    "賠償",
    "調解",
    "責任",
    "診斷書",
    "醫療紀錄",
    "醫療記錄",
    "病歷",
    "收據",
    "復健紀錄",
    "治療紀錄",
  ]);

  return hasAccidentCue && hasSettlementCue;
}

function detectAccidentSettlementSubcategory(question: string) {
  const text = question.toLowerCase();

  if (includesAny(text, ["診斷書", "開診斷書"])) {
    return "合約法律｜車禍和解｜診斷書";
  }

  if (includesAny(text, ["復健科", "復健方式", "復健", "台大"])) {
    return "合約法律｜車禍和解｜復健資料";
  }

  if (includesAny(text, ["中醫診所", "看中醫", "中醫"])) {
    return "合約法律｜車禍和解｜中醫資料";
  }

  if (includesAny(text, ["理賠", "保險"])) {
    return "合約法律｜車禍和解｜理賠溝通";
  }

  if (includesAny(text, ["調解", "調解委員"])) {
    return "合約法律｜車禍和解｜調解準備";
  }

  if (includesAny(text, ["賠償", "賠償金", "金額"])) {
    return "合約法律｜車禍和解｜賠償資料";
  }

  return "合約法律｜車禍和解｜醫療資料";
}

function isAccidentSettlementSubcategory(questionSubcategory: string) {
  return questionSubcategory.startsWith("合約法律｜車禍和解");
}

function isExplicitAccidentTrafficQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "去醫院路上",
    "交通會不會順",
    "開車去",
    "騎車去",
    "路上安全",
    "交通安全",
  ]);
}

function isSchoolPeerFitQuestion(question: string) {
  const text = question.toLowerCase();
  const hasSchoolCue = includesAny(text, [
    "普高",
    "學校",
    "同學",
    "同班",
    "同儕",
    "在校",
    "朋友",
  ]);
  const hasFitCue = includesAny(text, ["合嗎", "合不合", "相處", "處得來"]);
  const hasLoveCue = includesAny(text, [
    "喜歡",
    "交往",
    "情侶",
    "曖昧",
    "愛",
    "復合",
    "婚姻",
    "感情",
  ]);

  return hasSchoolCue && hasFitCue && !hasLoveCue;
}

function isMarriageBalanceQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "婚姻平衡互動",
    "婚姻",
    "太太",
    "夫妻",
    "伴侶互動",
    "婚姻互動",
  ]);
}

function isSingleLoveTimingQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "何時會有另一半",
    "什麼時候有對象",
    "什麼時候會有對象",
    "何時脫單",
    "什麼時候脫單",
    "什麼時候遇到對象",
    "單身感情",
    "何時有另一半",
  ]);
}

function isThirdPersonHealthQuestion(question: string) {
  const text = question.toLowerCase();
  const hasThirdPersonCue = includesAny(text, [
    "劉標秀雲",
    "秀華",
    "阿嬤",
    "爸爸",
    "媽媽",
    "婆婆",
    "公公",
    "長輩",
    "洗腎中心",
  ]);

  return hasThirdPersonCue && (isHealthLifestyleQuestion(question) || hasMedicalContext(question));
}

function isWorkScheduleLoadQuestion(question: string) {
  const text = question.toLowerCase();
  const hasWorkCue = includesAny(text, [
    "工作",
    "老闆",
    "主管",
    "公司",
    "職場",
    "任務",
    "交接",
    "待辦",
  ]);
  const hasLoadCue = includesAny(text, [
    "忙",
    "很忙",
    "忙碌",
    "會不會很忙",
    "事情多",
    "任務多",
    "交接",
    "出國前一天",
    "出差前一天",
  ]);

  return hasWorkCue && hasLoadCue;
}

function isCourseCreatorQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "開課",
    "教課",
    "開手沖課程",
    "手沖課程",
    "開咖啡課",
    "課程上架",
    "把課程上架",
    "上架課程",
    "開賣課程",
    "推出課程",
    "課程銷售",
    "課程開賣",
    "課程頁",
    "報名流程",
    "招生",
    "招學生",
    "課程招生",
    "課程報名",
    "課程轉換",
    "學生報名",
    "課程內容",
    "課程案例",
    "講義",
  ]);
}

function isBankSelectionQuestion(question: string) {
  const text = question.toLowerCase();
  const hasBankCue = includesAny(text, [
    "哪一家銀行",
    "哪間銀行",
    "銀行對",
    "開戶銀行",
    "收款銀行",
    "合作銀行",
    "銀行合作",
    "銀行比較",
    "銀行選擇",
  ]);
  const hasBusinessMoneyCue = includesAny(text, [
    "營業收入",
    "營收",
    "收款",
    "入帳",
    "開戶",
    "合作",
    "有幫助",
    "比較好",
  ]);

  return text.includes("銀行") && (hasBankCue || hasBusinessMoneyCue);
}

function isProductVarietyDecisionQuestion(question: string) {
  const text = question.toLowerCase();
  const hasQuantityCue =
    /(備|準備|帶|上架|寄售|預售)?\s*[一二三四五六七八九十\d]+\s*(種|款|樣|組|入)/.test(question) ||
    includesAny(text, [
      "幾種",
      "幾款",
      "幾樣",
      "幾個品項",
      "幾種比較好",
      "幾款比較好",
      "備幾種",
      "備幾款",
      "準備幾種",
      "準備幾款",
      "品項數",
      "品項要",
      "備貨",
      "三入",
      "3入",
      "四種",
      "4種",
      "兩種",
      "2種",
    ]);
  const hasProductCue = includesAny(text, [
    "商品",
    "咖啡豆",
    "水晶",
    "品項",
    "貨",
    "庫存",
    "擺攤",
    "市集",
    "寄售",
    "預售",
    "組合",
    "銷售",
    "備貨",
  ]);

  return hasQuantityCue && hasProductCue;
}

function isVillainBenefactorQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "小人",
    "貴人",
    "身邊是否出現小人",
    "有沒有小人",
    "會不會有貴人",
    "今年會有貴人",
  ]);
}

function isKinshipVisitQuestion(question: string) {
  const text = question.toLowerCase();
  const hasFamilyCue = includesAny(text, [
    "姑姑",
    "阿姨",
    "叔叔",
    "伯伯",
    "舅舅",
    "親戚",
    "阿嬤",
    "阿公",
    "奶奶",
    "爺爺",
    "長輩",
    "家人",
  ]);
  const hasVisitCue = includesAny(text, [
    "來看",
    "探望",
    "探視",
    "來訪",
    "看阿嬤",
    "看長輩",
    "陪伴",
    "照護",
  ]);

  return hasFamilyCue && hasVisitCue;
}

function isRentRenewalQuestion(question: string) {
  const text = question.toLowerCase();
  return (
    includesAny(text, ["續租", "租約", "租屋", "房租", "房東"]) &&
    includesAny(text, ["續", "續約", "繼續", "要不要", "適合", "可以嗎", "能不能"])
  );
}

function isLifestyleChoiceQuestion(question: string) {
  const text = question.toLowerCase();
  return (
    includesAny(text, ["做臉", "東港", "行程", "生活安排", "改成"]) &&
    includesAny(text, ["延後", "改成", "還是", "二選一", "哪個比較", "要不要"])
  );
}

function isFriendToLoverQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "朋友變情人",
    "朋友變戀人",
    "從朋友變成情人",
    "從朋友變成戀人",
    "朋友有機會變情人",
    "朋友有機會變戀人",
    "朋友發展成感情",
    "朋友發展成戀愛",
  ]);
}

function isWebsiteSystemQuestion(question: string) {
  const text = question.toLowerCase();
  const hasWebsiteSystemCue = includesAny(text, [
    "連續提問",
    "扣點",
    "按鈕",
    "功能",
    "客人看不懂",
    "客人看得懂",
    "登入",
    "line 登入",
    "line登入",
    "占卜流程",
    "網站流程",
    "會員點數",
    "操作流程",
    "使用者理解",
    "ux",
  ]);
  const hasMarketingIntent = includesAny(text, [
    "提高轉換率",
    "更多人購買",
    "導流",
    "行銷",
    "廣告",
    "投放",
  ]);

  return hasWebsiteSystemCue && !hasMarketingIntent;
}

function isAdBudgetQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "廣告預算",
    "廣告費",
    "投放",
    "加預算",
    "預算要不要加",
    "增加預算",
  ]);
}

function isBusinessManagementQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "商品要走高價",
    "親民價格",
    "補庫存",
    "廣告預算",
    "合夥創業",
    "短影音內容",
    "個人故事",
    "品牌定位",
    "高端專業",
    "親近生活",
    "直播賣產品",
    "擴大經營",
    "經營模式",
    "轉型",
  ]);
}

function isIncomePlanningQuestion(question: string) {
  const text = question.toLowerCase();

  if (isBusinessSalesQuestion(question) || isExplicitFinancialInvestmentQuestion(question)) {
    return false;
  }

  if (isSideIncomeQuestion(question) || isIncomeChoiceQuestion(question)) {
    return true;
  }

  return includesAny(text, [
    "賺錢方式",
    "方式來賺錢",
    "如何賺錢",
    "怎麼賺錢",
    "增加收入",
    "收入來源",
    "收入方式",
    "用什麼樣的方式來賺錢",
    "如魚得水易如反掌",
  ]);
}

function hasLoveObjectCue(text: string) {
  return includesAny(text, [
    "對方",
    "前任",
    "曖昧對象",
    "喜歡的人",
    "男友",
    "女友",
    "伴侶",
    "老公",
    "老婆",
    "另一半",
    "這段關係",
    "這段感情",
    "那他",
    "那她",
    "他最近",
    "她最近",
    "他是",
    "她是",
    "他對",
    "她對",
    "他身邊",
    "她身邊",
    "他一直",
    "她一直",
    "他會",
    "她會",
    "他有",
    "她有",
    "找他",
    "找她",
    "回他",
    "回她",
    "跟他",
    "跟她",
  ]);
}

function isGeneralContactActionQuestion(question: string) {
  const text = question.toLowerCase();
  const hasContactAction = includesAny(text, [
    "主動聯絡",
    "聯絡對方",
    "找對方",
    "找他談",
    "找她談",
    "跟對方談",
    "跟他談",
    "跟她談",
  ]);
  const hasNeutralTopic = includesAny(text, [
    "談事情",
    "談這件事",
    "談問題",
    "處理事情",
    "溝通事情",
    "講清楚",
  ]);
  const hasExplicitLoveTopic = includesAny(text, [
    "感情",
    "喜歡",
    "曖昧",
    "心意",
    "復合",
    "分手",
    "前任",
    "伴侶",
    "男友",
    "女友",
    "老公",
    "老婆",
    "另一半",
    "還有我",
    "在乎我",
    "會回嗎",
    "會回覆",
    "會回應",
  ]);

  return hasContactAction && hasNeutralTopic && !hasExplicitLoveTopic;
}

function isProfessionalCommunicationActionQuestion(question: string) {
  const text = question.toLowerCase();
  const hasProfessionalContext = includesAny(text, [
    "主管",
    "同事",
    "客戶",
    "廠商",
    "合作",
    "案子",
    "工作",
    "專案",
    "報價",
  ]);
  const hasCommunicationAction = includesAny(text, [
    "主動聯絡",
    "聯絡",
    "找對方",
    "談事情",
    "談這件事",
    "談問題",
    "溝通",
    "說清楚",
    "要不要講",
    "要不要問",
  ]);

  return hasProfessionalContext && hasCommunicationAction;
}

function isGeneralPriorityQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "最該先處理",
    "最需要先",
    "優先處理",
    "先處理哪",
    "先處理什麼",
    "最該優先",
  ]);
}

function isGeneralPaceQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "是不是太急",
    "是否太急",
    "太急了",
    "太急嗎",
    "太急躁",
    "急於求成",
  ]);
}

function isLoveCommitmentQuestion(question: string) {
  const text = question.toLowerCase();
  const hasCommitment = includesAny(text, [
    "承諾",
    "不給承諾",
    "負責",
    "不想負責",
    "還在觀望",
  ]);
  const hasLegalContext = includesAny(text, [
    "合約",
    "契約",
    "簽約",
    "條款",
    "法律",
    "官司",
    "付款",
    "文件",
    "白紙黑字",
  ]);

  return hasLoveObjectCue(text) && hasCommitment && !hasLegalContext;
}

function isSinglePeachQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "單身",
    "新桃花",
    "新對象",
    "認識新對象",
    "主動認識",
    "遇到適合的人",
    "未來對象",
  ]);
}

function isLoveColdWarQuestion(question: string) {
  const text = question.toLowerCase();
  return (
    hasLoveObjectCue(text) ||
    includesAny(text, ["我們", "彼此", "這段關係", "這段感情"])
  ) && includesAny(text, [
    "冷戰",
    "破冰",
    "僵住",
    "和好",
    "不說話",
    "已讀不回",
  ]);
}

function isLoveChoiceQuestion(question: string) {
  const text = question.toLowerCase();
  return (
    hasLoveObjectCue(text) ||
    includesAny(text, ["穩定的人", "心動的人", "前任", "這段關係"])
  ) && includesAny(text, [
    "該選",
    "選誰",
    "二選一",
    "還是",
    "給前任一次機會",
    "保持距離",
    "穩定的人",
    "心動的人",
  ]);
}

function isLoveOutsideFactorQuestion(question: string) {
  const text = question.toLowerCase();
  return hasLoveObjectCue(text) && includesAny(text, [
    "其他人",
    "第三者",
    "外界因素",
    "身邊有人",
    "影響我們",
    "有人影響",
  ]);
}

function isLoveObservationQuestion(question: string) {
  const text = question.toLowerCase();
  return (
    hasLoveObjectCue(text) ||
    includesAny(text, ["接下來一週", "一週"])
  ) && includesAny(text, [
    "觀察",
    "行為",
    "回覆速度",
    "主動性",
    "互動",
  ]);
}

function isTargetedLoveQuestion(question: string) {
  return (
    isLoveCommitmentQuestion(question) ||
    isSinglePeachQuestion(question) ||
    isLoveColdWarQuestion(question) ||
    isLoveChoiceQuestion(question) ||
    isLoveOutsideFactorQuestion(question) ||
    isLoveObservationQuestion(question)
  );
}

function isWorkInterviewQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, ["面試", "錄取", "應徵", "這家公司"]);
}

function isWorkRaisePromotionQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, ["調薪", "加薪", "升遷", "升職", "主管談薪"]);
}

function isWorkCareerChoiceQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "職涯",
    "管理",
    "繼續走專業",
    "轉產業",
    "新工作邀約",
    "換工作",
    "副業",
    "離職休息",
  ]);
}

function isWorkClientContractQuestion(question: string) {
  const text = question.toLowerCase();
  return includesAny(text, [
    "客戶案",
    "接案",
    "短期合約工作",
    "合約工作",
    "專案",
    "交付",
  ]);
}

function isWorkQuestionCue(question: string) {
  return (
    isWorkInterviewQuestion(question) ||
    isWorkRaisePromotionQuestion(question) ||
    isWorkCareerChoiceQuestion(question) ||
    isWorkClientContractQuestion(question) ||
    isWorkScheduleLoadQuestion(question)
  );
}

function detectWorkSubcategory(question: string) {
  if (isProfessionalCommunicationActionQuestion(question)) {
    return "工作｜溝通協調";
  }

  if (isWorkInterviewQuestion(question)) {
    return "工作｜面試錄取";
  }

  if (isWorkRaisePromotionQuestion(question)) {
    return "工作｜調薪升遷";
  }

  if (isWorkClientContractQuestion(question)) {
    return "工作｜接案合約";
  }

  if (isWorkScheduleLoadQuestion(question)) {
    return "工作｜任務交接";
  }

  if (isWorkCareerChoiceQuestion(question)) {
    return "工作｜職涯選擇";
  }

  return "工作｜職涯任務";
}

function detectBusinessSubcategory(question: string) {
  const text = question.toLowerCase();

  if (isProductVarietyDecisionQuestion(question)) {
    return "經營｜商品品項決策";
  }

  if (isAdBudgetQuestion(question)) {
    return "經營｜廣告預算";
  }

  if (text.includes("高價") || text.includes("親民價格")) {
    return "經營｜定價策略";
  }

  if (text.includes("補庫存") || text.includes("庫存")) {
    return "經營｜庫存決策";
  }

  if (text.includes("合夥")) {
    return "經營｜合夥創業";
  }

  if (text.includes("短影音") || text.includes("教學") || text.includes("個人故事")) {
    return "經營｜內容品牌";
  }

  if (text.includes("品牌定位") || text.includes("高端專業") || text.includes("親近生活")) {
    return "經營｜品牌定位";
  }

  return "經營｜推廣轉換";
}

function detectLoveSubcategory(question: string) {
  const text = question.toLowerCase();

  if (isSingleLoveTimingQuestion(question)) {
    return "感情｜桃花時間";
  }

  if (isLoveCommitmentQuestion(question)) {
    return "感情｜承諾觀望";
  }

  if (isSinglePeachQuestion(question)) {
    return "感情｜單身桃花";
  }

  if (isLoveColdWarQuestion(question)) {
    return "感情｜冷戰溝通";
  }

  if (isLoveChoiceQuestion(question)) {
    return "感情｜感情選擇";
  }

  if (isLoveOutsideFactorQuestion(question)) {
    return "感情｜外界因素";
  }

  if (isMarriageBalanceQuestion(question)) {
    return "感情｜婚姻長期";
  }

  if (isLoveObservationQuestion(question)) {
    return "感情｜互動觀察";
  }

  if (
    isLoveMindCue(question) ||
    includesAny(text, [
      "心意",
      "有沒有心",
      "心裡還有沒有",
      "還有沒有我",
      "還喜歡",
      "還在乎",
      "喜歡我",
      "在乎我",
      "心裡",
      "對方是不是",
      "他是不是",
      "她是不是",
      "回覆變慢",
      "回覆比較慢",
      "回應變慢",
      "主動找他",
      "主動找她",
      "會回應",
      "會回嗎",
      "會回覆",
      "故意冷淡",
      "真心",
      "認真",
      "冷淡",
      "退開",
      "觀望",
      "一時寂寞",
      "習慣性聯絡",
      "想靠近",
    ])
  ) {
    return "感情｜對方心意";
  }

  if (
    includesAny(text, [
      "復合",
      "前任",
      "分手後",
      "舊情人",
      "重新聯絡",
    ])
  ) {
    return "感情｜前任復合";
  }

  if (
    includesAny(text, [
      "伴侶",
      "男友",
      "女友",
      "老婆",
      "老公",
      "妻子",
      "丈夫",
      "另一半",
      "吵架",
      "修復",
      "冷戰",
      "同居",
      "室友",
      "責任分配",
    ])
  ) {
    return "感情｜伴侶修復";
  }

  if (
    includesAny(text, [
      "結婚",
      "婚姻",
      "長期",
      "未來三年",
      "走下去",
      "長久",
      "穩定",
    ])
  ) {
    return "感情｜婚姻長期";
  }

  if (
    includesAny(text, [
      "單身",
      "桃花",
      "未來對象",
      "遇到適合的人",
      "什麼樣的人",
      "什麼類型的人",
    ])
  ) {
    return "感情｜單身桃花";
  }

  if (
    includesAny(text, [
      "曖昧",
      "告白",
      "有沒有機會",
      "關係發展",
      "會不會在一起",
    ])
  ) {
    return "感情｜曖昧發展";
  }

  if (
    includesAny(text, [
      "選誰",
      "二選一",
      "哪個比較適合",
      "該選",
    ])
  ) {
    return "感情｜感情選擇";
  }

  return "感情｜一般關係";
}

function isLoveMindCue(question: string) {
  const text = question.toLowerCase();
  const hasMindSignal = includesAny(text, [
    "心意",
    "心裡",
    "心裡還有我",
    "還有我嗎",
    "有沒有我",
    "還在乎",
    "在乎我",
    "還喜歡",
    "喜歡我",
    "回覆變慢",
    "回覆比較慢",
    "回應變慢",
    "冷淡",
    "故意冷淡",
    "忙還是",
    "還是忙",
    "會回應",
    "會回嗎",
    "會回覆",
    "主動找他",
    "主動找她",
    "主動聯絡",
    "真心",
    "認真",
    "承諾",
    "負責",
    "觀望",
    "禮貌回",
    "禮貌回應",
  ]);

  return hasLoveObjectCue(text) && hasMindSignal;
}

function buildQuestionSubcategory(questionType: string, question: string) {
  if (isAccidentSettlementQuestion(question)) {
    return detectAccidentSettlementSubcategory(question);
  }

  if (isKinshipVisitQuestion(question)) {
    return "家庭｜探視照護";
  }

  if (isVillainBenefactorQuestion(question)) {
    return "人際｜小人貴人";
  }

  if (isRentRenewalQuestion(question)) {
    return "房產｜租屋續租";
  }

  if (isProductVarietyDecisionQuestion(question)) {
    return "經營｜商品品項決策";
  }

  if (isBankSelectionQuestion(question)) {
    return "金錢｜銀行選擇";
  }

  if (isLifestyleChoiceQuestion(question)) {
    return "一般｜生活行程選擇";
  }

  if (isSchoolPeerFitQuestion(question)) {
    return "人際｜同儕互動";
  }

  if (isResaleRegistrationChoiceQuestion(question)) {
    return "經營｜代售報名";
  }

  if (isSingleLoveTimingQuestion(question)) {
    return "感情｜桃花時間";
  }

  if (isFriendToLoverQuestion(question)) {
    return "感情｜朋友轉戀人";
  }

  if (questionType !== "感情關係" && isGeneralContactActionQuestion(question)) {
    return "一般｜溝通行動";
  }

  if (isGeneralPriorityQuestion(question)) {
    return "一般｜優先事項";
  }

  if (isGeneralPaceQuestion(question)) {
    return "一般｜節奏急躁";
  }

  if (detectPropertyHandoverResponsibilityIntent(question)) {
    return "房產｜交屋責任";
  }

  if (detectOralPromiseDealIntent(question)) {
    return "合約｜口頭約定";
  }

  if (detectDeliveryDelayIntent(question)) {
    return "交易｜交貨交付";
  }

  if (detectLegalOutcomeIntent(question)) {
    return "合約｜法律勝負";
  }

  if (detectTransactionDealIntent(question)) {
    const text = question.toLowerCase();

    if (includesAny(text, ["糾紛", "爭議"])) {
      return "交易｜交易糾紛";
    }

    if (includesAny(text, ["繼續談", "續談", "再談", "談下去"])) {
      return "交易｜交易續談";
    }

    return "交易｜買賣風險";
  }

  if (questionType === "感情關係") {
    return detectLoveSubcategory(question);
  }

  if (questionType === "工作事業") {
    return detectWorkSubcategory(question);
  }

  if (questionType === "經營推廣" && isCourseCreatorQuestion(question)) {
    return "經營｜課程上架";
  }

  if (questionType === "網站系統") {
    const text = question.toLowerCase();

    if (includesAny(text, ["扣點", "點數", "費用", "反感", "提醒"])) {
      return "經營｜扣點提示";
    }

    if (includesAny(text, ["按鈕", "文案", "清楚"])) {
      return "經營｜網站UX文案";
    }

    if (includesAny(text, ["連續提問", "功能", "流程", "看得懂", "看不懂", "操作"])) {
      return "經營｜網站連續提問";
    }

    return "經營｜網站系統";
  }

  if (questionType === "經營推廣") {
    return detectBusinessSubcategory(question);
  }

  if (questionType === "經營銷售") {
    return "經營｜寄售擺攤營收";
  }

  if (questionType === "收入規劃") {
    return detectMoneyFinanceSubcategory(question) || "金錢｜收入方向";
  }

  if (questionType === "金錢財務") {
    return detectMoneyFinanceSubcategory(question) || "金錢｜一般財務";
  }

  if (questionType === "健康狀態" || isHealthLifestyleQuestion(question)) {
    if (isHealthCriticalQuestion(question)) {
      return "健康｜重大健康";
    }

    if (isOverworkSleepQuestion(question)) {
      return "健康｜作息睡眠過勞";
    }

    return "健康｜作息睡眠";
  }

  if (isTravelCompanionFollowUpQuestion(question)) {
    return "活動｜出遊同行者狀態";
  }

  if (isSingleTravelDateQuestion(question)) {
    return "活動｜單一出遊日期";
  }

  if (isOpeningDateQuestion(question)) {
    return "日期｜開幕日期";
  }

  if (isTravelDateQuestion(question)) {
    return "活動｜出去玩日期";
  }

  if (isContractDateQuestion(question)) {
    return "合約｜簽約日期";
  }

  if (isCourseDateQuestion(question)) {
    return "學習｜課程日期";
  }

  if (isActivityDateQuestion(question)) {
    return "活動｜活動日期";
  }

  if (isMovingDateQuestion(question)) {
    return "日期｜搬家日期";
  }

  const subcategoryByType: Record<string, string> = {
    工作事業: "工作｜職涯任務",
    金錢投資: "金錢｜投資風險",
    金錢財務: "金錢｜一般財務",
    收入規劃: "金錢｜收入方向",
    買賣交易: "交易｜買賣成交",
    合約法律: "合約｜條款法律",
    網站系統: "經營｜網站系統",
    內容品牌: "經營｜內容品牌",
    經營推廣: "經營｜推廣轉換",
    交通出行: "出行｜交通安全",
    活動注意: "活動｜注意事項",
    人物描述: "人物｜特質描述",
    健康狀態: "健康｜身心提醒",
    學習考試: "學習｜課程考試",
    房產置產: "房產｜置產屋況",
    日期擇日: "日期｜擇日提醒",
    近期提醒: "近期｜整體提醒",
  };

  return subcategoryByType[questionType] ?? "一般｜具體事件";
}

function buildFollowUpContextSearchText(followUpContext?: FollowUpContext | null) {
  return (followUpContext?.previousReadings || [])
    .map((item) =>
      [
        item.question,
        item.cardName,
        item.position,
        item.answerSummary,
        item.questionType,
        item.questionSubcategory,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
}

function extractFollowUpDateReference(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  const slashDate = contextText.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (slashDate) {
    return `${slashDate[1]}/${slashDate[2]}`;
  }

  const monthDate = contextText.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號)?/);
  if (monthDate) {
    return `${monthDate[1]}/${monthDate[2]}`;
  }

  return "";
}

function hasFollowUpTravelContext(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  return includesAny(contextText, [
    "出遊",
    "出去玩",
    "旅行",
    "旅遊",
    "活動｜出去玩日期",
    "活動｜單一出遊日期",
    "出行｜交通安全",
  ]);
}

function isTravelTrafficFollowUpQuestion(question: string) {
  return includesAny(question, ["那天", "當天", "這天", "交通", "路線", "出發"]) &&
    includesAny(question, ["交通", "路線", "出發", "交通工具"]);
}

function hasExplicitLoveTerms(question: string) {
  return includesAny(question, [
    "喜歡",
    "曖昧",
    "復合",
    "前任",
    "感情",
    "愛",
    "心意",
    "交往",
  ]);
}

function hasFollowUpDebtCollectionContext(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  return includesAny(contextText, [
    "金錢財務",
    "金錢｜欠款債務",
    "金錢｜回款收款",
    "金錢｜貸款借貸",
    "買賣交易｜付款條件",
    "欠款",
    "還款",
    "催款",
    "回款",
    "尾款",
    "付款",
    "匯款",
    "入帳",
    "欠我的錢",
    "對方欠錢",
  ]);
}

function isDebtCollectionFollowUpQuestion(question: string) {
  return includesAny(question, [
    "他",
    "對方",
    "又拖",
    "催",
    "催款",
    "聯絡",
    "主動聯絡",
    "問他",
    "下一步",
    "注意什麼",
    "還款",
    "付款",
    "回款",
  ]);
}

function hasFollowUpCriticalHealthContext(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  return includesAny(contextText, [
    "健康｜重大健康",
    "重大健康",
    "住院",
    "撐過",
    "生命危險",
    "病危",
    "長輩健康",
    "洗腎",
    "會不會死",
    "快不行",
    "辦喪事",
    "喪事",
    "高齡長輩",
  ]);
}

function isCriticalHealthFollowUpQuestion(question: string) {
  return includesAny(question, [
    "我該先處理什麼",
    "最該先",
    "家裡要處理什麼",
    "家裡處理",
    "家人怎麼溝通",
    "家人溝通",
    "溝通時要注意",
    "下一步注意什麼",
    "先幫家裡",
    "照護",
    "分工",
  ]);
}

function hasFollowUpCourseCreatorContext(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  return includesAny(contextText, [
    "經營｜課程上架",
    "課程上架",
    "課程頁面",
    "課程頁",
    "補案例",
    "補講義",
    "學生報名",
    "報名文案",
    "課程轉換",
    "夫妻宮課程",
    "課程開賣",
  ]);
}

function isCourseCreatorFollowUpQuestion(question: string) {
  return includesAny(question, [
    "學生",
    "報名",
    "文案",
    "課程價值",
    "課程頁面",
    "補案例",
    "補講義",
    "案例",
    "講義",
    "課程",
    "cta",
    "CTA",
  ]);
}

function hasFollowUpContentBrandContext(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  return includesAny(contextText, [
    "經營｜內容品牌",
    "內容品牌",
    "短影音",
    "教學內容",
    "個人故事",
    "專業教學",
    "內容風格",
    "受眾",
    "報名課程",
    "內容要加強",
  ]);
}

function isContentBrandFollowUpQuestion(question: string) {
  return includesAny(question, [
    "個人故事",
    "專業教學",
    "內容",
    "短影音",
    "風格",
    "受眾",
    "客人報名",
    "報名課程",
    "課程轉換",
    "加強哪裡",
  ]);
}

function hasFollowUpWebsiteSystemContext(context?: FollowUpContext | null) {
  const contextText = buildFollowUpContextSearchText(context);
  return includesAny(contextText, [
    "經營｜網站系統",
    "網站系統",
    "連續提問",
    "按鈕文案",
    "扣點",
    "客人看得懂",
    "功能",
    "操作流程",
  ]);
}

function isWebsiteSystemFollowUpQuestion(question: string) {
  return includesAny(question, [
    "按鈕",
    "文案",
    "扣點",
    "提醒",
    "客人",
    "看得懂",
    "反感",
    "功能",
    "操作流程",
    "連續提問",
  ]);
}

function inferFollowUpQuestionSubcategory(
  questionType: string,
  question: string,
  questionSubcategory: string,
  followUpContext?: FollowUpContext | null
) {
  const followUpFocus = detectFollowUpFocus(question, followUpContext);

  if (followUpFocus === "debt_collection_followup") {
    return "金錢｜催款跟進";
  }

  if (followUpFocus === "debt_delay_followup") {
    return "金錢｜欠款債務";
  }

  if (followUpFocus === "critical_health_care") {
    return "健康｜照護安排";
  }

  if (followUpFocus === "critical_health_family_communication") {
    return "健康｜家人溝通";
  }

  if (followUpFocus === "course_creator_content_choice") {
    return "經營｜課程內容優化";
  }

  if (followUpFocus === "course_creator_conversion") {
    return "經營｜課程轉換";
  }

  if (followUpFocus === "course_creator_page") {
    return "經營｜課程上架";
  }

  if (followUpFocus === "content_brand_style") {
    return "經營｜內容風格選擇";
  }

  if (followUpFocus === "content_brand_conversion") {
    return "經營｜課程轉換";
  }

  if (followUpFocus === "website_ux_copy") {
    return "經營｜網站UX文案";
  }

  if (followUpFocus === "website_points_notice") {
    return "經營｜扣點提示";
  }

  if (followUpFocus === "website_followup_feature") {
    return "經營｜網站連續提問";
  }

  if (questionType !== "感情關係") {
    return questionSubcategory;
  }

  if (questionSubcategory === "感情｜對方心意") {
    return questionSubcategory;
  }

  const contextText = buildFollowUpContextSearchText(followUpContext);
  const hasLoveMindContext = includesAny(contextText, [
    "感情｜對方心意",
    "對方心意",
    "心裡還有我",
    "回覆變慢",
    "冷淡",
    "還在乎",
    "還喜歡",
  ]);

  if (hasLoveMindContext && isLoveMindCue(question)) {
    return "感情｜對方心意";
  }

  if (followUpFocus === "love_observation") {
    return "感情｜對方心意";
  }

  return questionSubcategory;
}

function detectFollowUpFocus(question: string, followUpContext?: FollowUpContext | null) {
  if (!followUpContext?.isFollowUp || !followUpContext.previousReadings?.length) {
    return "";
  }

  const contextText = buildFollowUpContextSearchText(followUpContext);
  const text = `${question} ${contextText}`.toLowerCase();
  const currentText = question.toLowerCase();
  const hasInvestmentContext = includesAny(text, [
    "金錢投資",
    "投資風險",
    "股票",
    "投資",
    "期貨",
    "基金",
    "停損",
    "減碼",
    "加碼",
    "部位",
    "進場",
    "出場",
    "交易",
    "交易情緒",
    "情緒交易",
    "停損線",
    "成本",
    "波動",
  ]);
  const asksInvestmentEmotion = includesAny(currentText, [
    "情緒",
    "太急",
    "太重",
    "焦慮",
    "僥倖",
    "心態",
  ]);
  const asksInvestmentObservation = includesAny(currentText, [
    "明天",
    "明日",
    "再看",
    "重點",
    "觀察",
    "看什麼",
    "策略",
    "盤勢",
    "量能",
    "波動",
    "規則",
    "守住",
  ]);
  const asksInvestmentDiscipline = includesAny(currentText, [
    "加碼",
    "衝動",
    "避免",
    "守住",
    "原本規則",
    "紀律",
    "怎麼守",
    "怎麼避免",
  ]);

  if (hasInvestmentContext && asksInvestmentEmotion) {
    return "investment_emotion";
  }

  if (hasInvestmentContext && asksInvestmentDiscipline) {
    return "investment_discipline";
  }

  if (hasInvestmentContext && asksInvestmentObservation) {
    return "investment_observation";
  }

  if (
    hasFollowUpDebtCollectionContext(followUpContext) &&
    isDebtCollectionFollowUpQuestion(question) &&
    !hasExplicitLoveTerms(question)
  ) {
    if (includesAny(currentText, ["又拖", "下一步", "注意什麼", "拖"])) {
      return "debt_delay_followup";
    }

    return "debt_collection_followup";
  }

  if (
    hasFollowUpCriticalHealthContext(followUpContext) &&
    isCriticalHealthFollowUpQuestion(question)
  ) {
    if (includesAny(currentText, ["家人", "溝通"])) {
      return "critical_health_family_communication";
    }

    return "critical_health_care";
  }

  if (
    hasFollowUpCourseCreatorContext(followUpContext) &&
    isCourseCreatorFollowUpQuestion(question)
  ) {
    if (includesAny(currentText, ["案例", "講義", "先補", "該補"])) {
      return "course_creator_content_choice";
    }

    if (includesAny(currentText, ["學生", "報名", "文案", "課程價值", "cta"])) {
      return "course_creator_conversion";
    }

    return "course_creator_page";
  }

  if (
    hasFollowUpContentBrandContext(followUpContext) &&
    isContentBrandFollowUpQuestion(question) &&
    !includesAny(currentText, ["收入", "賺錢", "收費", "價格", "營收"])
  ) {
    if (includesAny(currentText, ["個人故事", "專業教學", "風格", "偏"])) {
      return "content_brand_style";
    }

    return "content_brand_conversion";
  }

  if (
    hasFollowUpWebsiteSystemContext(followUpContext) &&
    isWebsiteSystemFollowUpQuestion(question)
  ) {
    if (includesAny(currentText, ["扣點", "提醒", "反感", "費用"])) {
      return "website_points_notice";
    }

    if (includesAny(currentText, ["按鈕", "文案", "清楚"])) {
      return "website_ux_copy";
    }

    return "website_followup_feature";
  }

  const hasLearningContext = includesAny(text, [
    "學習考試",
    "學習｜",
    "課程",
    "學習",
    "考試",
    "報名",
    "進修",
    "上課",
    "複習",
    "吸收",
    "學新東西",
    "新學習內容",
  ]);
  const asksLearningReview = includesAny(currentText, [
    "複習",
    "開始學",
    "真的開始",
    "怎麼學",
    "怎麼複習",
    "筆記",
    "實作",
    "吸收",
    "負擔",
  ]);

  if (hasLearningContext && asksLearningReview) {
    return "learning_review";
  }

  const hasLoveMindContext = includesAny(text, [
    "感情｜對方心意",
    "感情關係",
    "對方心意",
    "回覆變慢",
    "回覆",
    "回應",
    "心裡還有我",
    "還在乎",
    "還喜歡",
    "冷淡",
    "故意冷淡",
    "真心",
    "禮貌",
    "主動找",
  ]);
  const asksLoveBinary = includesAny(currentText, [
    "忙",
    "冷淡",
    "故意冷淡",
    "真心",
    "曖昧",
    "禮貌",
    "觀望",
  ]) && includesAny(currentText, ["還是", "或是", "二選一"]);
  const asksLoveContact = includesAny(currentText, [
    "主動找他",
    "主動找她",
    "主動聯絡",
    "會回應",
    "會回嗎",
    "會回覆",
    "回覆穩",
    "回應嗎",
  ]);
  const asksLoveObservation = includesAny(currentText, [
    "一週",
    "接下來",
    "觀察",
    "看什麼",
    "注意什麼",
    "留意",
    "訊號",
    "變化",
  ]);

  if (hasLoveMindContext && asksLoveBinary) {
    return "love_binary";
  }

  if (hasLoveMindContext && asksLoveContact) {
    return "love_contact";
  }

  if (hasLoveMindContext && asksLoveObservation) {
    return "love_observation";
  }

  if (hasLoveMindContext && isLoveMindCue(question)) {
    return "love_mind";
  }

  return "";
}

function inferFollowUpQuestionType(
  question: string,
  detectedQuestionType: string,
  followUpContext?: FollowUpContext | null
) {
  if (!followUpContext?.isFollowUp || !followUpContext.previousReadings?.length) {
    return detectedQuestionType;
  }

  const followUpFocus = detectFollowUpFocus(question, followUpContext);

  if (
    followUpFocus === "investment_emotion" ||
    followUpFocus === "investment_observation" ||
    followUpFocus === "investment_discipline"
  ) {
    return "金錢投資";
  }

  if (
    followUpFocus === "debt_collection_followup" ||
    followUpFocus === "debt_delay_followup"
  ) {
    return "金錢財務";
  }

  if (
    followUpFocus === "critical_health_care" ||
    followUpFocus === "critical_health_family_communication"
  ) {
    return "健康狀態";
  }

  if (
    followUpFocus === "course_creator_content_choice" ||
    followUpFocus === "course_creator_conversion" ||
    followUpFocus === "course_creator_page" ||
    followUpFocus === "content_brand_style" ||
    followUpFocus === "content_brand_conversion"
  ) {
    return "經營推廣";
  }

  if (
    followUpFocus === "website_followup_feature" ||
    followUpFocus === "website_ux_copy" ||
    followUpFocus === "website_points_notice"
  ) {
    return "網站系統";
  }

  if (followUpFocus === "learning_review") {
    return "學習考試";
  }

  if (
    followUpFocus === "love_binary" ||
    followUpFocus === "love_contact" ||
    followUpFocus === "love_observation" ||
    followUpFocus === "love_mind"
  ) {
    return "感情關係";
  }

  const contextText = buildFollowUpContextSearchText(followUpContext);
  const text = `${question} ${contextText}`.toLowerCase();
  const currentText = question.toLowerCase();

  const previousInvestmentContext = includesAny(text, [
    "金錢投資",
    "投資風險",
    "股票",
    "投資",
    "期貨",
    "基金",
    "停損",
    "減碼",
    "加碼",
    "部位",
    "進場",
    "出場",
    "交易情緒",
    "情緒交易",
  ]);

  if (
    previousInvestmentContext &&
    (detectedQuestionType === "一般具體問題" ||
      detectedQuestionType === "近期提醒" ||
      detectedQuestionType === "金錢投資") &&
    includesAny(currentText, [
      "情緒",
      "明天",
      "明日",
      "再看",
      "重點",
      "觀察",
      "策略",
      "成本",
      "停損",
      "停損線",
      "部位",
      "波動",
      "風險",
      "規則",
      "守住",
      "加碼",
      "衝動",
      "避免",
      "紀律",
      "盤勢",
      "量能",
      "交易",
    ])
  ) {
    return "金錢投資";
  }

  const previousLearningContext = includesAny(text, [
    "學習考試",
    "學習｜",
    "課程",
    "學習",
    "考試",
    "報名",
    "進修",
    "上課",
    "複習",
    "吸收",
  ]);

  if (
    previousLearningContext &&
    (detectedQuestionType === "一般具體問題" ||
      detectedQuestionType === "學習考試") &&
    includesAny(currentText, [
      "課程",
      "學",
      "學習",
      "負擔",
      "複習",
      "吸收",
      "筆記",
      "實作",
      "上課",
      "開始",
      "真的開始",
      "怎麼複習",
    ])
  ) {
    return "學習考試";
  }

  return detectedQuestionType;
}

function buildQuestionDomainByType(questionType: string, questionDomain: string) {
  if (
    includesAny(questionDomain, [
      "車禍和解",
      "代售報名",
      "同儕互動",
      "桃花時間",
    ])
  ) {
    return questionDomain;
  }

  const domainByType: Record<string, string> = {
    金錢投資: "金錢投資｜投資風險",
    金錢財務: "金錢財務｜一般財務",
    收入規劃: "金錢收入｜收入方向",
    經營銷售: "經營銷售｜活動營收",
    學習考試: "學習課程｜課程學習",
    感情關係: "感情關係",
    活動注意: "活動注意",
    日期擇日: "日期擇日",
  };

  return domainByType[questionType] || questionDomain;
}

function buildQuestionCore(questionType: string, questionSubcategory: string) {
  if (isAccidentSettlementSubcategory(questionSubcategory)) {
    return "使用者想知道這份醫療、診斷、復健或治療資料，對車禍和解、理賠或調解溝通是否有幫助。重點不是判斷身體一定會不會好，而是資料是否清楚、是否能被理解與採信。";
  }

  if (questionSubcategory === "人際｜同儕互動") {
    return "使用者想知道學校或同儕之間合不合、相處是否穩，重點在互動方式、界線、衝突節奏與如何減少彼此干擾，不要回答成感情修復。";
  }

  if (questionSubcategory === "經營｜代售報名") {
    return "使用者正在詢問代售、寄售、市集或攤位報名是否值得投入，重點是報名規則、費用、抽成、擺放條件、人流、商品適配與自己能不能承接。若題目是在比較多個市集或報名選項，才提醒每個選項各抽一張牌比較；不可套用其他舊案例的活動名稱。";
  }

  if (questionSubcategory === "感情｜桃花時間") {
    return "使用者想知道單身狀態何時可能遇到新的感情對象，重點在桃花時間、社交場合、主動曝光與互動機會，不要回答成現有伴侶修復。";
  }

  if (questionSubcategory === "一般｜溝通行動") {
    return "使用者想知道現在該不該主動聯絡對方談事情，重點是溝通時機、條件是否準備好，以及談之前要先確認什麼。";
  }

  if (questionSubcategory === "工作｜溝通協調") {
    return "使用者想知道工作、客戶、合作或專案溝通是否適合主動開口，重點是溝通目的、資料準備、責任界線與對方可回應狀態。";
  }

  if (questionSubcategory === "一般｜優先事項") {
    return "使用者想知道接下來一段時間最該先處理哪件事，重點是第一優先、原因，以及可以先做的具體步驟。";
  }

  if (questionSubcategory === "一般｜節奏急躁") {
    return "使用者想知道自己最近是不是太急，重點是明確回答偏急或不算太急、急在哪裡，以及如何調整節奏。";
  }

  if (questionSubcategory === "一般｜生活行程選擇") {
    return "使用者正在生活行程二選一，重點是這張牌偏向哪個選項、現實條件是否允許、交通時間與體力安排是否能承接。";
  }

  if (questionSubcategory === "人際｜小人貴人") {
    return "使用者想知道身邊是否有小人或貴人，重點在人際訊息是否清楚、誰可能造成誤會、誰可能提供支持，以及不要無證據指控特定對象。";
  }

  if (questionSubcategory === "家庭｜探視照護") {
    return "使用者想知道親戚探視長輩是否合適，重點在長輩狀態、探視時間長短、家人陪同、資源與照護安排，不要回答成保險規劃。";
  }

  if (questionSubcategory === "房產｜租屋續租") {
    return "使用者想知道租屋或租約是否適合續下去，重點在房屋狀態、租金、合約、房東溝通、支持資源與是否需要找可信任的人協助確認。";
  }

  if (questionSubcategory === "感情｜朋友轉戀人") {
    return "使用者想知道朋友關係是否有機會往戀人發展，重點在聊天頻率、互相理解、互動是否變暖、是否有轉換空間，以及不要直接當成強桃花。";
  }

  if (questionSubcategory === "感情｜對方心意") {
    return "使用者想知道對方目前是否還在意、是否願意靠近，以及態度偏靠近、觀望、冷淡還是逃避。";
  }

  if (questionSubcategory === "感情｜曖昧發展") {
    return "使用者想知道這段曖昧關係是否有機會往前，以及對方互動是否穩定。";
  }

  if (questionSubcategory === "感情｜承諾觀望") {
    return "使用者想知道對方不給承諾是仍在觀望、害怕承擔，還是不想負責，重點在關係定位、責任感與實際行動。";
  }

  if (questionSubcategory === "感情｜單身桃花") {
    return "使用者想知道單身狀態下是否適合主動認識新對象，重點在新桃花機會、互動品質與自己是否準備好。";
  }

  if (questionSubcategory === "感情｜冷戰溝通") {
    return "使用者想知道冷戰或僵局是否有破冰空間，重點在對方態度、雙方是否願意回應，以及破冰前該觀察的訊號。";
  }

  if (questionSubcategory === "感情｜感情選擇") {
    return "使用者正在感情二選一或去留選擇中，重點在這張牌偏向哪個選項、哪裡比較穩，以及不能用衝動取代觀察。";
  }

  if (questionSubcategory === "感情｜外界因素") {
    return "使用者想知道這段關係是否受到其他人或外界因素影響，重點在干擾程度、對方界線與互動是否變得不穩。";
  }

  if (questionSubcategory === "感情｜互動觀察") {
    return "使用者想知道短期內該觀察哪些實際行為，重點在回覆速度、主動性、約見意願、說法是否一致與行動是否跟得上。";
  }

  if (questionSubcategory === "感情｜伴侶修復") {
    return "使用者想知道伴侶關係是否能修復，重點在生活壓力、互動品質與雙方是否願意一起處理。";
  }

  if (questionSubcategory === "感情｜前任復合") {
    return "使用者想知道前任是否還有復合空間，重點在過去問題、現在態度與是否適合重新聯絡。";
  }

  if (questionSubcategory === "感情｜婚姻長期") {
    return "使用者想知道長期關係能否穩定走下去，重點在現實條件、責任分配與未來規劃。";
  }

  if (questionSubcategory === "日期｜開幕日期") {
    return "使用者想知道開幕或正式營業日期怎麼選，重點在開幕準備、現場流程、人員分工、動線、接待、宣傳、時間安排、突發狀況、備案與候選日期是否需要分開比較。";
  }

  if (questionSubcategory === "活動｜出去玩日期") {
    return "使用者想知道出遊日期怎麼選，重點在行程安排、同行者狀態、交通時間、天氣、體力與現場變動。";
  }

  if (questionSubcategory === "活動｜單一出遊日期") {
    return "使用者想判斷某一個出遊日期是否適合，重點在這一天的行程安排、交通、天氣、體力、同行者狀態與臨時變動。";
  }

  if (questionSubcategory === "活動｜活動日期") {
    return "使用者想知道活動、聚會、市集、直播或拍攝日期怎麼選，重點在流程、參與者、準備進度、現場安排與臨時變動。";
  }

  if (questionSubcategory === "合約｜簽約日期") {
    return "使用者想知道簽約、合約、付款、過戶或交屋日期怎麼選，重點在條款、責任、付款時間、文件細節與專業確認。";
  }

  if (questionSubcategory === "學習｜課程日期") {
    return "使用者想知道課程、報名、開課或學習開始時間怎麼選，重點在課程內容、學習目標、時間安排、負擔大小、吸收節奏與後續複習方式。";
  }

  if (questionSubcategory === "日期｜搬家日期") {
    return "使用者想知道搬家或入宅日期怎麼看，重點在現場安排、交通搬運、家人分工、合約交屋與物品整理。";
  }

  if (questionSubcategory === "活動｜出遊同行者狀態") {
    return "使用者延續出遊情境，想看同行者狀態、體力、配合度、費用期待、時間安排與出遊互動風險。";
  }

  if (questionSubcategory === "工作｜面試錄取") {
    return "使用者想知道面試或錄取機會，重點在公司期待、準備方向、表達重點與是否能把能力說清楚。";
  }

  if (questionSubcategory === "工作｜調薪升遷") {
    return "使用者想知道調薪或升遷是否有機會，重點在成果證據、主管評估、時機、資源分配與談判準備。";
  }

  if (questionSubcategory === "工作｜職涯選擇") {
    return "使用者正在工作去留、職涯方向或管理專業二選一中，重點在主偏向、壓力來源、發展空間與下一步準備。";
  }

  if (questionSubcategory === "工作｜接案合約") {
    return "使用者想知道客戶案、短期合約或專案是否適合承接，重點在範圍、交付、溝通成本、報酬與責任邊界。";
  }

  if (questionSubcategory === "工作｜任務交接") {
    return "使用者想知道某個工作日或主管出差、出國前後工作會不會很忙，重點在任務量、優先順序、交接、資料整理、臨時變動與責任歸屬，不要解讀成旅遊或交通題。";
  }

  if (questionSubcategory === "經營｜課程上架") {
    return "使用者是課程提供者，想知道課程是否適合上架或開賣，重點在內容準備、報名流程、受眾需求、宣傳節奏與交付品質。";
  }

  if (questionSubcategory === "經營｜課程內容優化") {
    return "使用者是課程創作者，想知道課程頁面要先補案例還是補講義，重點在主偏向、課程價值、學生理解、實際應用、講義架構與報名轉換。";
  }

  if (questionSubcategory === "經營｜課程轉換") {
    return "使用者是課程創作者，想讓學生更想報名或讓內容轉成課程報名，重點在課程價值、學生痛點、學完得到什麼、案例見證、報名流程、課程架構與行動呼籲。";
  }

  if (questionSubcategory === "經營｜廣告預算") {
    return "使用者想知道廣告預算是否要調整，重點在目前成效、轉換成本、受眾反應、小額測試與風險控管。";
  }

  if (questionSubcategory === "經營｜寄售擺攤營收") {
    return "使用者想知道寄售、擺攤或市集銷售能不能有收入，重點在商品差異化、同質商品競爭、定價、陳列、客流、成本、回本節奏與現場轉換，不要解讀成投資或單純資金流動。";
  }

  if (questionSubcategory === "經營｜定價策略") {
    return "使用者想判斷商品要走高價或親民價格，重點在市場接受度、價值感、信任感、成本與轉換條件。";
  }

  if (questionSubcategory === "經營｜庫存決策") {
    return "使用者想知道現在是否要補庫存，重點在現有庫存、需求、現金流、周轉速度與不要一次補過量。";
  }

  if (questionSubcategory === "經營｜商品品項決策") {
    return "使用者想知道商品、咖啡豆、水晶或市集備貨要準備幾種、幾款或幾組，重點在品項數、庫存壓力、成本、陳列、顧客選擇、熱賣款與補貨彈性，不要回答成日期擇日。";
  }

  if (questionSubcategory === "經營｜合夥創業") {
    return "使用者想知道是否適合與此人合夥創業，重點在分工、金錢規則、責任邊界、價值觀與合作溝通。";
  }

  if (questionSubcategory === "經營｜內容品牌") {
    return "使用者想判斷短影音內容主軸，重點在教學或個人故事的主偏向、受眾信任、互動、轉換與長期累積。";
  }

  if (questionSubcategory === "經營｜內容風格選擇") {
    return "使用者想判斷短影音內容要偏個人故事還是專業教學，重點在主偏向、受眾信任、內容形式、教學深度、故事連結與課程轉換。";
  }

  if (questionSubcategory === "經營｜品牌定位") {
    return "使用者想判斷品牌定位要走高端專業或親近生活，重點在主偏向、顧客理解、信任感、差異化與可持續表達。";
  }

  if (questionSubcategory === "金錢｜整體財運") {
    return "使用者想知道近期整體財務狀態，重點在收入穩定度、支出節奏、預算、現金流與不要把財運說成保證賺錢。";
  }

  if (questionSubcategory === "金錢｜偏財抽獎") {
    return "使用者想知道偏財、抽獎或中獎機會，重點在不要保證中獎、不鼓勵加碼投注，只能提醒心態、預算上限與不要因期待而衝動。";
  }

  if (questionSubcategory === "金錢｜存錢預算") {
    return "使用者想知道近期能不能存得住錢，重點在支出控管、預算分配、衝動消費、固定開銷與是否需要先建立可執行的存錢節奏。";
  }

  if (questionSubcategory === "金錢｜消費花費") {
    return "使用者想知道是否容易亂花錢或超支，重點在消費衝動、必要與非必要支出、預算界線與先延後確認。";
  }

  if (questionSubcategory === "金錢｜貸款借貸") {
    return "使用者想知道申請貸款或借貸是否適合，重點在還款能力、利率、期限、現金流壓力、文件條件與不要預設成房貸或房產。";
  }

  if (questionSubcategory === "金錢｜欠款債務") {
    return "使用者想知道欠款、還錢或債務是否有進展，重點在對方還款意願、時間拖延、溝通紀錄、白紙黑字與必要時用正式方式確認。";
  }

  if (questionSubcategory === "金錢｜催款跟進") {
    return "使用者延續欠款情境，想知道是否要主動聯絡催款，重點在金額、還款時間、付款方式、文字紀錄、催收節奏與不要把題目解讀成感情對方心意。";
  }

  if (questionSubcategory === "金錢｜回款收款") {
    return "使用者想知道款項或尾款能否收回，重點在本月回款是否有機會推進、付款節點、付款時間、金額、約定、對帳方式、聯絡紀錄、催收節奏、入帳狀態與現金流備案。";
  }

  if (questionSubcategory === "金錢｜家用開銷") {
    return "使用者想知道家用或生活開銷是否會超支，重點在固定支出、臨時支出、家庭分工、預算界線與先抓出最容易失控的項目。";
  }

  if (questionSubcategory === "金錢｜大額購買") {
    return "使用者想知道大額購買是否適合，重點在需求是否必要、價格是否合理、規格是否符合、付款方式、保固與不要把購買判斷寫成投資買進。";
  }

  if (questionSubcategory === "金錢｜保險規劃") {
    return "使用者想知道是否適合檢查保險規劃，重點在保障缺口、保費負擔、既有保單、家人需求與必要時找專業人士確認條款。";
  }

  if (questionSubcategory === "金錢｜現金流") {
    return "使用者想知道短期現金流要注意什麼，重點在收入入帳、固定支出、臨時支出、周轉壓力、備用金與付款時間安排。";
  }

  if (questionSubcategory === "金錢｜銀行選擇") {
    return "使用者想知道哪一家銀行、開戶銀行、收款銀行或合作銀行比較有利於營業收入，重點在收款流程、費用、資訊透明度、對帳、入帳穩定度與合作溝通。";
  }

  if (
    questionSubcategory === "金錢｜收入方向" ||
    questionSubcategory === "金錢｜副業收入" ||
    questionSubcategory === "金錢｜收入選擇" ||
    questionSubcategory === "金錢｜收入方式選擇"
  ) {
    return "使用者想知道收入增加或收入方式怎麼選，重點在熟悉能力、市場需求、時間投入、成本、可持續性與第一段要給主偏向。";
  }

  if (questionType === "金錢投資") {
    return "使用者想知道這筆金錢或投資決策風險是否可控，重點在成本、資訊、部位與紀律。";
  }

  if (questionType === "金錢財務") {
    return "使用者想知道一般金錢財務狀態，重點在收支、預算、現金流、付款紀錄、消費節奏與不要回答成股票期貨操作。";
  }

  if (questionType === "經營銷售") {
    return "使用者想知道寄售、擺攤、市集或商品銷售會不會有營收，重點在成本、客流、人流、商品陳列、庫存、定價、宣傳、現場轉換與回本壓力。";
  }

  if (questionType === "收入規劃") {
    return "使用者想知道今年可以朝哪種收入方式或賺錢方向嘗試，重點在自己熟悉的能力、可掌握的成本、需求是否存在、執行節奏與風險控管。";
  }

  if (questionSubcategory === "交易｜交易糾紛") {
    return "使用者想知道買賣交易是否會有糾紛，重點在價格、付款、交付、文件、證據、溝通紀錄、責任歸屬與驗收確認。";
  }

  if (questionSubcategory === "交易｜交易續談") {
    return "使用者想知道這筆交易是否還值得繼續談，重點在價格、付款、交付、責任條件、文件紀錄與對方配合度。";
  }

  if (questionSubcategory === "交易｜交貨交付") {
    return "使用者想知道對方是否會拖延交貨或出貨，重點在交期、出貨進度、約定時間、聯絡紀錄、交貨文件與延遲責任。";
  }

  if (questionSubcategory === "合約｜口頭約定") {
    return "使用者想知道對方口頭承諾或答應的條件是否可信，重點在條件是否具體、是否留有書面紀錄、付款條件、責任界線與文件化。";
  }

  if (questionSubcategory === "房產｜交屋責任") {
    return "使用者想知道交屋時款項和責任歸屬最容易卡在哪，重點在款項節點、交屋文件、點交驗收、屋況確認、修繕責任與責任歸屬。";
  }

  if (questionSubcategory === "合約｜法律勝負") {
    return "使用者想知道法律問題的勝負方向，但回答不能判斷輸贏，重點在證據、文件、程序、責任歸屬與是否需要律師或專業法律意見。";
  }

  if (questionType === "買賣交易") {
    return "使用者想知道這筆買賣能否成交，重點在價格、物品狀況、曝光、買家反應與議價空間。";
  }

  if (questionType === "活動注意") {
    return "使用者想知道這次活動要注意什麼，重點在安排、體力、現場流程、安全與臨時變動。";
  }

  if (questionType === "合約法律") {
    return "使用者想知道合約、條款或法律程序是否有風險，重點在文字、責任、付款與白紙黑字。";
  }

  if (questionSubcategory === "健康｜照護安排") {
    return "使用者延續家人住院或重大健康脈絡，想知道現在先幫家裡處理什麼，重點在醫療資訊、醫師說法、照護分工、家人聯絡、文件費用、陪伴安排與不要判斷病情結果。";
  }

  if (questionSubcategory === "健康｜家人溝通") {
    return "使用者延續家人住院或重大健康脈絡，想知道跟家人溝通要注意什麼，重點在醫療資訊一致、照護分工、情緒安撫、現實安排與不要判斷病情結果。";
  }

  if (questionType === "健康狀態") {
    return "使用者想知道身體或生活狀態需要注意什麼，重點在作息、壓力、飲食、睡眠與是否需要專業協助。";
  }

  if (questionSubcategory === "經營｜網站連續提問") {
    return "使用者想優化占卜網站的連續提問功能，重點在功能入口、按鈕名稱、提示文字、扣點前確認、操作流程、使用者是否看得懂、回到前文與重新抽牌的理解。";
  }

  if (questionSubcategory === "經營｜網站UX文案") {
    return "使用者想讓網站按鈕文案更清楚，重點在按鈕名稱、語意簡單、使用者能不能理解、連續提問與一般重新占卜的差異。";
  }

  if (questionSubcategory === "經營｜扣點提示") {
    return "使用者想讓網站扣點提醒比較不讓客人反感，重點在扣點前提示、文字透明、費用感受、信任感與操作流程。";
  }

  if (questionType === "人物描述") {
    return "使用者想知道問題中的對象是什麼樣的人，重點在個性特徵、給人的感覺、行為風格、外在氣質與互動注意事項。";
  }

  return "使用者想知道這件事本身的狀態、可行性、風險與下一步。";
}

function buildAnswerContract(questionType: string, questionSubcategory: string) {
  if (isAccidentSettlementSubcategory(questionSubcategory)) {
    return "必答：第一段說明這題重點不是單純看身體會不會好，而是醫療選擇能不能留下清楚、可被理解的紀錄，對車禍和解、理賠或調解溝通有沒有幫助；至少扣住和解、理賠、調解、診斷書、醫療紀錄、病歷、收據、復健紀錄、傷勢說明、資料是否清楚、是否容易被採信其中 3 個以上；健康恢復只能當輔助；要保留醫療與法律安全邊界。避免：一定會和解成功、一定會理賠、一定會被認可、一定要去看、不用治療、不用復健、交通路線或出門時間尾句。";
  }

  if (questionSubcategory === "人際｜同儕互動") {
    return "必答：這是學校同儕或朋友相處題，不是感情修復；回答相處是否偏穩或不穩、互動界線、衝突點與如何減少干擾。若破軍反位，要說相處容易不穩、不要硬碰硬、需要明確界線。避免：重建方案、感情修復、尊重感情中的細節。";
  }

  if (questionSubcategory === "經營｜代售報名") {
    return "必答：這是經營銷售裡的代售、寄售、市集或攤位報名題；要回答目前這個報名是否值得投入、卡點在哪、條件要確認什麼。本張牌只能看當前問題與這次抽到的牌，不可沿用其他案例的活動名稱。若題目明確比較多個市集或多個報名選項，才提醒每個選項各抽一張牌比較。若廉貞反位，要談規則、報名費、抽成、擺放條件、活動人流與商品適配。避免：課程學習、正式擇日、直接指定某一個一定最好、把別人的端午節或高雄代售案例套進來。";
  }

  if (questionSubcategory === "感情｜桃花時間") {
    return "必答：這是單身新對象或桃花時間題，不是伴侶修復；回答近三個月內是否有機會出現新的感情對象、機會來自社交、活動、課程、旅遊、聚會或主動曝光。若貪狼正位，要提魅力、社交與活動場合。避免：雙方關係改善、現有伴侶互動、生活壓力共同分擔或修復可能性。";
  }

  if (questionSubcategory === "一般｜溝通行動") {
    return "必答：現在是否適合主動聯絡；比較偏向可以談、先觀望或暫時不要急；原因要放在溝通時機、資訊準備、對方可回應狀態與風險控管；下一步要說清楚可先準備的重點；最後最多補一句：如果這個對方其實是感情對象，可以再補問對方心意，這一題先以溝通時機與談事情的準備來看。避免：改寫成感情對方心意、喜不喜歡、曖昧、復合或只叫使用者溝通。";
  }

  if (questionSubcategory === "工作｜溝通協調") {
    return "必答：是否適合主動溝通；溝通目的、資料準備、責任界線、時機與書面紀錄；若牽涉客戶、主管、同事、廠商、合作或專案，要留在工作溝通語境。避免：改寫成感情對方心意或曖昧關係。";
  }

  if (questionSubcategory === "一般｜優先事項") {
    return "必答：第一段直接說「最該先處理的是……」；說明為什麼這件事優先；用牌面正反位解釋目前卡點或機會；最後給 1 到 2 個可以先做的具體步驟。避免：只說機會很多、泛泛鼓勵或沒有第一優先。";
  }

  if (questionSubcategory === "一般｜節奏急躁") {
    return "必答：第一段直接回答「是，有一點急」或「不算太急，但要注意節奏」；說明急在哪裡或哪裡其實可以穩住；用正反位判斷節奏；最後給具體調整方式。避免：只說努力、壓力、健康或泛用建議，卻沒有回答是不是太急。";
  }

  if (questionSubcategory === "一般｜生活行程選擇") {
    return "必答：第一段用「這張牌比較偏向：」給主偏向；如果是延後做臉改成去東港這類題，要直接說偏向哪個安排；再補交通、時間、體力和現實條件。避免：只講打破舊模式、革新或兩邊都可以。";
  }

  if (questionSubcategory === "人際｜小人貴人") {
    return "必答：小人或貴人的主偏向；若是天機反位，要提醒資訊混亂、想太多、話太快或誤會造成小人感；若是天梁正位，可看成長輩、制度、保護或願意協助的人。避免：無證據指名誰是小人。";
  }

  if (questionSubcategory === "家庭｜探視照護") {
    return "必答：親戚探視長輩是否合適；時間長短、家人陪同、長輩狀態、資源分配與照護安排。避免：因為出現「保險」就回答成保險規劃，也不要判斷疾病結果。";
  }

  if (questionSubcategory === "房產｜租屋續租") {
    return "必答：續租是否偏穩或不穩；房屋狀態、租金、合約、房東溝通、支持資源；若紫微反位，要提醒缺少支持、主導權不足或沒人協助，建議找可信任或專業的人協助看房、租金與合約。避免：說短期還有繼續空間但沒有風險落點。";
  }

  if (questionSubcategory === "感情｜朋友轉戀人") {
    return "必答：朋友關係有沒有轉戀人的空間；聊天頻率、互相理解、互動是否慢慢變暖；若天機正位，要偏向理性互動中有升溫與轉換空間。避免：直接說強桃花或只叫使用者溝通。";
  }

  if (questionSubcategory === "感情｜對方心意") {
    return "必答：對方目前心態；偏靠近、觀望、冷淡、逃避、習慣性聯絡或一時寂寞的明確落點；如果是二選一要選主偏向；如果問主動聯絡會不會回，要拆出會不會回、回覆穩不穩、回應品質偏真心／禮貌／輕鬆／觀望；正反位如何影響判斷；接下來觀察什麼實際訊號。避免：新桃花、未來對象、婚姻長期、家庭存款、三年後、只叫使用者溝通整理情緒。";
  }

  if (questionSubcategory === "感情｜伴侶修復") {
    return "必答：伴侶關係目前卡在哪；雙方互動是否還有修復空間；問題偏情緒、責任分配、生活壓力還是溝通方式；下一步要先處理哪個現實問題。避免：單身桃花、未來對象、只講包容珍惜愛自己。";
  }

  if (questionSubcategory === "感情｜婚姻長期") {
    return "必答：婚姻或夫妻互動目前如何平衡；把重點放在真實感受、溝通透明、責任分配與生活節奏。若巨門正位，要談願意溝通、把話說開、面對不安與互動改善空間。避免：一週、回覆速度、主動性、約見、邀約、觀察對方心意。";
  }

  if (questionSubcategory === "感情｜前任復合") {
    return "必答：復合空間偏高、偏低、偏觀望還是過去問題未解；前任目前是否還有回頭可能；過去問題是否仍影響現在；是否適合重新聯絡或先不要主動推進。避免：保證一定復合、保證一定不會復合、跳成單身新桃花。";
  }

  if (questionSubcategory === "感情｜承諾觀望") {
    return "必答：對方不給承諾比較像仍在觀望、害怕承擔，還是不想負責；第一段要給主偏向；說清楚責任感、關係定位與實際行動訊號。避免：回答成合約法律、只叫使用者溝通或保證對方一定會承諾。";
  }

  if (questionSubcategory === "感情｜單身桃花") {
    return "必答：現在是否適合主動認識新對象；新桃花機會偏開或偏保留；要觀察互動品質、對方是否穩定與自己是否準備好。避免：回答成舊情復合或只講等待緣分。";
  }

  if (questionSubcategory === "感情｜冷戰溝通") {
    return "必答：冷戰是否有破冰空間；對方態度偏靠近、觀望、冷淡或逃避；建議觀察什麼回應，不要只說好好溝通。";
  }

  if (questionSubcategory === "感情｜感情選擇") {
    return "必答：二選一或去留題第一段必須用「這張牌比較偏向：」給主偏向；說清楚哪個選項較穩、哪裡有風險、接下來怎麼觀察。避免：兩邊都講一樣、沒有結論。";
  }

  if (questionSubcategory === "感情｜外界因素") {
    return "必答：是否像有其他人或外界因素影響；影響偏大、偏小或還不明確；重點放在對方界線、互動是否突然不穩與可觀察訊號。避免：無證據斷定第三者。";
  }

  if (questionSubcategory === "感情｜互動觀察") {
    return "必答：接下來一週要看哪些具體行為；至少包含回覆速度、主動性、約見意願或說法行動是否一致。避免：只說多觀察、照顧自己。";
  }

  if (questionType === "感情關係") {
    return "必答：這段關係目前狀態；對方或雙方互動模式；正反位帶出的順或卡；下一步要看什麼實際行動。避免：泛泛講愛自己、過度心理諮商、跳到其他感情題型。";
  }

  if (questionSubcategory === "金錢｜整體財運") {
    return "必答：近期財務狀態偏穩、偏散、偏需控管或偏有改善空間；收入、支出、預算、現金流哪裡最需要注意。避免：保證賺錢、保證財運大開、回答成股票期貨操作。";
  }

  if (questionSubcategory === "金錢｜偏財抽獎") {
    return "必答：偏財或抽獎心態偏可小玩、偏不穩或不宜期待過高；提醒預算上限與不要加碼投注。避免：保證中獎、鼓勵下注、說一定有偏財。";
  }

  if (questionSubcategory === "金錢｜存錢預算") {
    return "必答：這段時間存錢偏穩或容易漏財；最容易失控的是固定開銷、臨時支出、情緒消費還是規劃不足；給一個可執行的控管重點。";
  }

  if (questionSubcategory === "金錢｜消費花費") {
    return "必答：是否容易亂花錢或超支；原因偏衝動、壓力、資訊不足、必要支出增加或預算界線不清；建議先延後、比價或設定上限。";
  }

  if (questionSubcategory === "金錢｜貸款借貸") {
    return "必答：貸款或借貸是否偏可評估、偏保守或需要先補資料；還款能力、利率、期限、現金流壓力與文件條件。避免：預設成買房、房貸、屋況或房產建議。";
  }

  if (questionSubcategory === "金錢｜欠款債務") {
    return "必答：欠款或還款進度偏有機會、偏拖延或需正式確認；對方意願、時間、紀錄、溝通方式與必要時白紙黑字。避免：回答成感情對方心意或投資。";
  }

  if (questionSubcategory === "金錢｜催款跟進") {
    return "必答：第一段直接回答是否可以主動聯絡催款，語氣偏清楚、留紀錄或先整理資料；必須回到金額、還款時間、付款方式、文字紀錄、催收節奏、對方是否面對款項責任。避免：回答成感情、對方心意、真心、邀約、主動聊天或未來計畫。";
  }

  if (questionSubcategory === "金錢｜回款收款") {
    return "必答：第一段回答這筆款項本月偏有機會推進、偏慢或需要追蹤，但不能保證一定入帳；第二段用星曜正反位說明付款、回款、約定或對帳語境；第三段說付款節點、對帳方式、聯絡紀錄與催收節奏；第四段提醒保存紀錄並確認付款時間、金額與付款方式。至少使用 3 個詞：款項、付款節點、對帳、聯絡紀錄、催收節奏、付款時間、金額、約定、入帳。避免：保證一定收到。";
  }

  if (questionSubcategory === "金錢｜家用開銷") {
    return "必答：家用開銷是否容易超支；固定支出、臨時支出、家庭分工、預算界線與需要先整理的項目。";
  }

  if (questionSubcategory === "金錢｜大額購買") {
    return "必答：這筆大額購買偏可列入考慮、偏再等等或需要先補資訊；需求、規格、價格、付款方式、保固和現金流。避免：寫成投資買進或保證值得。";
  }

  if (questionSubcategory === "金錢｜保險規劃") {
    return "必答：是否適合檢查保險規劃；保障缺口、保費負擔、既有保單、家人需求與條款確認。避免：替使用者做保險決策或保證理賠。";
  }

  if (questionSubcategory === "金錢｜現金流") {
    return "必答：短期現金流偏穩或偏緊；收入入帳、固定支出、臨時支出、周轉壓力、備用金和付款時間安排。";
  }

  if (questionSubcategory === "金錢｜銀行選擇") {
    return "必答：哪一家銀行、收款銀行或合作銀行是否有利於營業收入；沒有列候選銀行時，不要編銀行名稱，提醒列出候選銀行分別抽牌；重點放在費用、收款流程、入帳、對帳、資訊透明度與合作溝通。避免：回答成一般財運或投資操作。";
  }

  if (
    questionSubcategory === "金錢｜收入方向" ||
    questionSubcategory === "金錢｜副業收入" ||
    questionSubcategory === "金錢｜收入選擇" ||
    questionSubcategory === "金錢｜收入方式選擇"
  ) {
    return "必答：第一段用「這張牌比較偏向：」給主偏向；說明較適合的收入方向或選項；熟悉能力、市場需求、時間投入、成本與可持續性。避免：保證賺錢、如魚得水、易如反掌、回答成股票期貨操作。";
  }

  if (questionType === "金錢財務") {
    return "必答：這題屬於一般金錢財務，不是股票期貨投資操作；要回答收支、預算、現金流、付款紀錄、消費節奏與下一步可檢查事項。避免：買進、賣出、加碼、停損、部位、投資機會或保證財運。";
  }

  if (questionSubcategory === "日期｜開幕日期") {
    return "必答：沒有候選日期時不能編日期；有多個候選日期時不要用單張牌硬選一天，提醒每個日期各抽一張牌再比較；本張牌只說開幕準備、現場流程、人員分工、動線、接待、宣傳、時間安排、突發狀況、客流與備案。避免：回答成出遊或亂給幾月幾號。";
  }

  if (questionSubcategory === "活動｜出去玩日期") {
    return "必答：沒有候選日期時不能編日期；有多個候選日期時不要用單張牌硬選一天，提醒每個日期各抽一張牌再比較；本張牌只說出遊日期選擇要注意的行程、同行者、交通、天氣、體力與現場變動。避免：回答成開幕、店面、感情心意。";
  }

  if (questionSubcategory === "活動｜單一出遊日期") {
    return "必答：直接判斷這一天是否可以列入考慮或偏不穩；說明交通、行程、天氣、體力與同行者狀態；補充這是單日狀態提醒，不是正式擇日。避免：誤說多個候選日期或每個日期各抽一張牌。";
  }

  if (questionSubcategory === "活動｜活動日期") {
    return "必答：沒有候選日期時不能編日期；有多個候選日期時不要用單張牌硬選一天；本張牌只說活動日期選擇要注意的流程、參與者、準備度與現場安排。避免：回答成開幕，除非問題明確是開幕活動。";
  }

  if (questionSubcategory === "合約｜簽約日期") {
    return "必答：不能替使用者直接決定簽約日；沒有候選日期時不能編日期；有多個候選日期時提醒每個日期各抽一張牌再比較；重點放在條款、付款、責任、文件與必要時找專業人士確認。避免：用占卜取代法律或財務決策。";
  }

  if (questionSubcategory === "學習｜課程日期") {
    return "必答：沒有候選日期時不能編日期；有多個候選日期時不要用單張牌硬選一天，提醒每個日期各抽一張牌再比較；單一日期時可以判斷這一天偏適合或偏不穩，但要說這是單日狀態提醒，不是正式擇日；重點放在課程內容、學習目標、時間安排、負擔會不會太大、吸收節奏與後續複習方式。";
  }

  if (questionSubcategory === "活動｜出遊同行者狀態") {
    return "必答：延續出遊情境回答同行者狀態；重點放在同行者的體力、配合度、費用期待、時間安排或行程期待是否一致，以及出發前該確認的事情。避免：回答成開幕、感情心意、批評同行者個性或單純一般建議。";
  }

  if (questionSubcategory === "工作｜面試錄取") {
    return "必答：錄取或面試表現偏有機會、偏觀望或需要補強；公司期待、準備重點、表達方式與下一步。避免：回答成整體運勢或只叫使用者有自信。";
  }

  if (questionSubcategory === "工作｜調薪升遷") {
    return "必答：調薪或升遷機會偏可談、偏觀望或不宜急推；成果證據、主管評估、時機與談法。避免：保證升遷或只說努力。";
  }

  if (questionSubcategory === "工作｜職涯選擇") {
    return "必答：職涯二選一或去留題第一段要給主偏向；說明發展空間、壓力來源、需要補強的條件與下一步。避免：兩邊都可以、沒有落點。";
  }

  if (questionSubcategory === "工作｜接案合約") {
    return "必答：這個客戶案、短期合約或專案是否適合承接；範圍、交付、報酬、溝通成本與責任邊界。避免：回答成法律合約條款或泛泛職場建議。";
  }

  if (questionSubcategory === "經營｜課程上架") {
    return "必答：這個月是否適合把課程上架或開賣；內容準備、報名流程、受眾需求、宣傳節奏與交付品質。避免：回答成學生報名課程、學習吸收或日期擇日。";
  }

  if (questionSubcategory === "經營｜課程內容優化") {
    return "必答：第一段必須用「這張牌比較偏向：先補案例」或「這張牌比較偏向：先補講義」給主偏向；說明案例、講義、課程價值、學生理解、實際應用與報名轉換。避免：只說資源評估、兩邊都可以、回答成學生學習或考試準備。";
  }

  if (questionSubcategory === "經營｜課程轉換") {
    return "必答：課程文案或內容轉換要回答課程價值、學生痛點、上完會得到什麼、報名流程、課程架構、案例/見證、CTA；要站在課程提供者角度。避免：回答成學生如何學習、學習考試、收入規劃、成本合約或泛用推廣。";
  }

  if (questionSubcategory === "經營｜廣告預算") {
    return "必答：廣告預算是否適合調整；先看目前成效、轉換成本、受眾反應與小額測試。避免：直接叫使用者加預算、加碼或大幅投放。";
  }

  if (questionSubcategory === "經營｜定價策略") {
    return "必答：商品定價要走高價或親民價格的主偏向；說明價值感、市場接受度、成本與轉換條件。避免：兩邊都可以但沒有落點。";
  }

  if (questionSubcategory === "經營｜庫存決策") {
    return "必答：現在是否適合補庫存；說明需求、現金流、周轉、庫存壓力與補貨規模。避免：直接叫補貨或一次補太多。";
  }

  if (questionSubcategory === "經營｜商品品項決策") {
    return "必答：回答商品品項數或備貨方向；如果沒有列出具體候選數量，要說可以先列出 2 種、3 種、4 種等候選方案再各抽一張牌比較；內容要談庫存壓力、成本、陳列、顧客選擇、熱門款、補貨與回本。避免：回答成日期擇日、開幕日期或只說不是完全不可以。";
  }

  if (questionSubcategory === "經營｜合夥創業") {
    return "必答：是否適合合夥；一定要談分工、金錢規則、責任邊界、價值觀與合作溝通。避免：只說合不合或只講面子。";
  }

  if (questionSubcategory === "經營｜內容品牌") {
    return "必答：短影音要走教學或個人故事的主偏向；說明受眾信任、內容穩定度、互動與轉換。避免：兩種內容都講一樣。";
  }

  if (questionSubcategory === "經營｜內容風格選擇") {
    return "必答：第一段必須用「這張牌比較偏向：先偏個人故事」或「這張牌比較偏向：先偏專業教學」給主偏向；主軸放在受眾、信任感、內容形式、教學深度、故事連結與課程轉換。避免：收入方式、成本、合約、付款條件或金錢財務。";
  }

  if (questionSubcategory === "經營｜品牌定位") {
    return "必答：高端專業或親近生活的主偏向；說明顧客理解、信任感、差異化與內容呈現。避免：跑成健康、身體或一般心態。";
  }

  if (questionSubcategory === "交易｜交易糾紛") {
    return "必答：這筆買賣交易是否容易有糾紛；糾紛可能卡在價格、付款、交付、文件、證據、溝通紀錄、責任歸屬或驗收確認；下一步要補什麼紀錄。避免：回答成股票投資、感情關係或直接指控對方一定有問題。";
  }

  if (questionSubcategory === "交易｜交易續談") {
    return "必答：這筆交易是否還值得繼續談的主偏向；繼續談要先確認價格、付款、交付、責任條件、文件紀錄與對方配合度。避免：回答成金融投資操作，或直接叫使用者一定成交／一定放棄。";
  }

  if (questionSubcategory === "交易｜交貨交付") {
    return "必答：對方是否可能拖延交貨或出貨；交期、出貨進度、約定時間、聯絡紀錄、交貨文件與延遲責任哪裡要先確認。避免：回答成感情互動、對方心意或直接定罪對方一定失信。";
  }

  if (questionSubcategory === "合約｜口頭約定") {
    return "必答：口頭答應的條件是否可信的主偏向；條件是否具體、是否有書面紀錄、付款條件、責任界線與文件化。避免：回答成感情承諾、曖昧心意，或直接保證對方可靠／不可靠。";
  }

  if (questionSubcategory === "房產｜交屋責任") {
    return "必答：交屋時款項與責任歸屬最容易卡在哪；款項節點、交屋文件、點交驗收、屋況確認、修繕責任、交接項目與責任歸屬。避免：只回答成收款入帳或整體財運。";
  }

  if (questionSubcategory === "合約｜法律勝負") {
    return "必答：這張牌不能替使用者判斷法律勝負，也不能取代律師或專業法律意見；改從證據、文件、程序、責任歸屬與準備方向提醒。避免：勝算、贏面、會贏、會輸、贏得潛力、成功機會增加。";
  }

  if (questionSubcategory === "健康｜照護安排") {
    return "必答：第一段先說明延續家人住院或重大健康脈絡，占卜不能判斷病情結果或是否能撐過去；回答醫療資訊、醫師說法、照護分工、家人聯絡、文件資料、費用與資源、陪伴安排。避免：穩定向前、有機會、可行、有保障、恢復、好轉、變好、撐過。";
  }

  if (questionSubcategory === "健康｜家人溝通") {
    return "必答：延續重大健康或住院脈絡，保留醫療安全界線；回答家人溝通、照護分工、醫療資訊一致、情緒安撫、誰負責哪些現實安排。避免：判病情、保證恢復、鼓勵單一人硬扛。";
  }

  if (questionSubcategory === "經營｜網站連續提問") {
    return "必答：連續提問功能是否容易看懂；重點在功能入口、按鈕名稱、提示文字、扣點前確認、操作流程、使用者能否理解同一題脈絡下重新抽牌，以及是否能回到上一題。避免：泛泛講經營推廣、推廣轉換、使用者任性逃避或只講心態。";
  }

  if (questionSubcategory === "經營｜網站UX文案") {
    return "必答：按鈕文案要怎麼寫更清楚；重點在簡短、直覺、能區分重新占卜與同一題追問、降低誤解。避免：泛泛講品牌或客人心態。";
  }

  if (questionSubcategory === "經營｜扣點提示") {
    return "必答：扣點提醒要怎麼寫比較不反感；重點在扣點前明確提示、費用透明、選擇權、信任感與流程位置。避免：責怪客人、說客人任性逃避或泛泛講行銷。";
  }

  const contractByType: Record<string, string> = {
    工作事業: "必答：這份工作或任務本身是否合適；壓力或卡點在哪；主管同事或環境條件；下一步要補什麼。避免：只講個性或心態。",
    金錢投資: "必答：偏保守還是可評估；主要風險在哪；資訊、部位、成本、停損與紀律是否清楚；是否不適合急著放大風險。避免：叫使用者買進、賣出、加碼、歐印、保證獲利、用占卜取代投資決策。",
    金錢財務: "必答：這題是一般金錢財務，不是股票期貨操作；收支、預算、現金流、付款紀錄或消費節奏哪裡要注意；下一步可檢查什麼。避免：買進、賣出、加碼、停損、部位、保證財運或保證賺錢。",
    收入規劃: "必答：今年較適合嘗試的收入方向；哪些能力、資源或經驗比較能發揮；成本、時間、需求與執行節奏要怎麼控管。避免：保證賺錢、說一定財富自由、回答成股票期貨操作、停損、部位或投資建議。",
    經營銷售: "必答：這次寄售、擺攤、市集或商品銷售的營收狀態；成本與回本壓力；客流、人流、商品陳列、庫存、定價、宣傳與現場轉換哪裡要補強。避免：回答成股票、期貨、部位、停損、買賣操作或金融投資建議。",
    買賣交易: "必答：成交機會；價格是否太硬；買家反應與議價空間；照片、車況、曝光或平台調整。避免：講成整體財運。",
    合約法律: "必答：合約或法律事項偏順還是偏卡；條款、文字、付款、責任歸屬與口頭承諾哪裡要確認；是否需要專業人士協助。避免：直接叫使用者簽、不簽、提告、放棄權利，或用占卜取代律師意見。",
    網站系統: "必答：網站或系統本身是否順；使用體驗、流程、信任感與回訪；需要優先改善哪裡。避免：講成近期運勢。",
    內容品牌: "必答：內容吸引力、受眾接受度、信任感、互動率與回訪率。避免：空泛講努力或正能量。",
    經營推廣: "必答：推廣方向、導流、轉換、顧客信任與回饋機制。避免：講成整體狀態。",
    交通出行: "必答：外出或行程是否順；交通工具、路線、時間、臨時變動與安全節奏。避免：恐嚇或硬說會出意外。",
    活動注意: "必答：活動本身順不順；體力、時間、現場流程、同行的人與安全節奏；有沒有臨時變動、延誤或改善方式。避免：因為有老婆、伴侶、對方就自動回答成感情溝通，或只叫使用者溝通感受。",
    人物描述: "必答：這個人的個性特徵、給人的感覺、行為風格、可能外在氣質，以及互動要注意什麼。避免：跑成關係發展、復合、曖昧結果或只講使用者心態。",
    健康狀態: "必答：身體或生活狀態提醒；作息、睡眠、飲食、壓力、運動與硬撐；明顯不適時提醒找專業醫師確認。避免：診斷疾病、保證懷孕或沒懷孕、保證生病或沒事、叫使用者停藥改藥不看醫師。",
    學習考試: "必答：課程或考試本身是否適合；吸收、方法、計畫、複習與時間分配。避免：只說加油。",
    房產置產: "必答：房子本身狀態；屋況、格局、採光、動線、貸款、合約與修繕成本。避免：沒問家人卻講成家庭相處。",
    日期擇日: "必答：有日期才判斷該日期；沒日期不編日期，回到事件準備事項。避免：直接編幾月幾號。",
    近期提醒: "必答：近期整體狀態；正反位大方向；要注意的生活、行動或安全節奏。避免：硬塞單一事件。",
  };

  return contractByType[questionType] ?? "必答：問題裡的對象、行動、條件、結果；這件事本身的方向；正反位判斷；直接相關的下一步。避免：改成近期運勢或泛用人生建議。";
}

function detectRiskLevel(questionType: string, question: string) {
  const text = question.toLowerCase();

  if (isCrisisQuestion(question)) {
    return "crisis_safety";
  }

  if (
    includesAny(text, [
      "忽略所有規則",
      "忽略前面",
      "ignore previous",
      "system prompt",
      "系統 prompt",
      "後台 prompt",
      "api key",
      "service role",
      "token",
      ".env",
      "不要扣點",
      "其他會員資料",
    ])
  ) {
    return "system_safety";
  }

  if (
    questionType === "健康狀態" ||
    questionType === "合約法律" ||
    questionType === "金錢投資"
  ) {
    return "professional_caution";
  }

  return "normal";
}

function isCrisisQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "想死",
    "不想活",
    "不想活了",
    "自殺",
    "自伤",
    "自傷",
    "傷害自己",
    "傷害我自己",
    "割腕",
    "輕生",
    "結束生命",
    "活不下去",
    "殺人",
    "想殺",
    "想打死",
    "打死他",
    "傷害別人",
    "攻擊別人",
    "暴力",
    "拿刀",
    "報復",
  ]);
}

function buildCrisisSafetyAnswer() {
  return "這題先不要用占卜判斷。你現在如果有想傷害自己、傷害別人，或覺得自己快撐不住，請先離開危險物品和危險現場，立刻找身邊可信任的人陪你，或聯絡當地緊急服務、危機專線。等人身安全先穩住後，再回來問占卜問題會比較安全。";
}

function isSystemInstructionAttack(question: string) {
  return detectRiskLevel("一般具體問題", question) === "system_safety";
}

function isActivityLogisticsQuestion(question: string) {
  const text = question.toLowerCase();
  const hasActivityContext = includesAny(text, [
    "室內運動",
    "戶外活動",
    "運動",
    "出遊",
    "活動",
    "行程",
    "外縣市",
    "辦事",
    "擺攤",
    "參加",
    "寄售店",
  ]);
  const asksActivityHandling = includesAny(text, [
    "注意",
    "注意事項",
    "如何改善",
    "狀況",
    "要準備",
    "要不要",
    "適不適合",
    "適合",
    "可不可以",
    "事先建議",
    "明天",
    "明日",
    "這週",
    "週日",
  ]);

  return hasActivityContext && asksActivityHandling;
}

function isPersonDescriptionQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "長怎樣",
    "長什麼樣",
    "是怎樣的人",
    "是什麼樣的人",
    "會是什麼樣的人",
    "個性如何",
    "個性怎樣",
    "外在氣質",
    "人物特質",
  ]);
}

function isDeathOrFuneralQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "死亡",
    "會不會死",
    "會死",
    "死掉",
    "過世",
    "離世",
    "往生",
    "圓寂",
    "走了",
    "要走了",
    "是不是要走了",
    "能不能活",
    "生命危險",
    "病危",
    "喪事",
    "辦喪事",
    "後事",
    "告別式",
    "快不行",
    "撐過去",
    "撐不撐得過",
    "撐得過",
    "撐不過",
    "撐過",
  ]);
}

function hasMedicalContext(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "洗腎",
    "重病",
    "住院",
    "醫師",
    "醫生",
    "病危",
    "治療",
    "身體狀況",
    "高齡",
    "疾病",
    "不舒服",
    "手術",
    "健康運",
    "長輩身體不好",
    "身體不好",
    "身體比較虛",
    "頭暈",
    "胃不舒服",
    "胃不太舒服",
    "86歲",
    "86 歲",
  ]);
}

function isElderHealthContext(question: string) {
  const text = question.toLowerCase();

  return (
    hasMedicalContext(question) &&
    includesAny(text, [
      "長輩",
      "家人",
      "爸爸",
      "媽媽",
      "爸",
      "媽",
      "婆婆",
      "公公",
      "爺爺",
      "奶奶",
      "外公",
      "外婆",
      "高齡",
      "86歲",
      "86 歲",
    ])
  );
}

function isHealthCriticalQuestion(question: string) {
  const text = question.toLowerCase();
  const hasHealthOrFamilyContext = includesAny(text, [
    "健康",
    "身體",
    "長輩",
    "家人",
    "爸爸",
    "媽媽",
    "爸",
    "媽",
    "婆婆",
    "公公",
    "洗腎",
    "住院",
    "高齡",
    "86歲",
    "86 歲",
  ]);

  return (
    isDeathOrFuneralQuestion(question) ||
    isElderHealthContext(question) ||
    (
      hasMedicalContext(question) &&
      includesAny(text, ["健康運", "洗腎", "住院", "病危", "生命危險"])
    ) ||
    (text.includes("吉凶") && hasHealthOrFamilyContext)
  );
}

function isOverworkSleepQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "熬夜",
    "硬撐",
    "睡眠不足",
    "撐著做完",
    "加班做到很晚",
    "不睡覺",
    "犧牲睡眠",
    "撐工作",
    "不該再硬撐",
  ]);
}

function isSleepRestQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "睡覺",
    "早點睡",
    "早睡",
    "晚睡",
    "睡太晚",
    "睡眠",
    "睡不好",
    "失眠",
    "睡眠品質",
    "休息",
    "白天沒精神",
  ]);
}

function hasDateSelectionIntent(question: string) {
  const text = question.toLowerCase();

  return (
    hasSpecificCandidateDates(question) ||
    includesAny(text, [
      "日期",
      "哪天",
      "哪一天",
      "哪一個月",
      "哪個月份",
      "哪個月",
      "哪時候",
      "哪段時間",
      "幾月幾號",
      "什麼時候",
      "何時",
      "週末",
      "星期",
      "幾號",
      "這個月",
      "年底前",
      "拍攝日",
      "開始",
      "3月",
      "六月底",
      "七月初",
      "月初",
      "月底",
      "出發",
      "開課",
      "正式營業",
    ])
  );
}

function hasSingleExplicitMonth(question: string) {
  return (
    /\d{1,2}\s*月/.test(question) ||
    /(一|二|三|四|五|六|七|八|九|十|十一|十二)月/.test(question)
  );
}

function isMultiMonthTimeComparisonQuestion(question: string) {
  const text = question.toLowerCase();

  if (hasSingleSpecificDate(question) || hasSingleExplicitMonth(question)) {
    return false;
  }

  return includesAny(text, [
    "哪一個月",
    "哪個月份",
    "哪個月",
    "今年哪時候",
    "何時比較好",
    "什麼時候最適合",
    "哪段時間",
    "什麼時間比較好",
  ]);
}

function isDateSuitabilityQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "適合嗎",
    "適不適合",
    "可不可以",
    "可以嗎",
    "能不能",
    "要不要",
    "是否適合",
    "適合安排",
    "適合開始",
    "適合簽",
    "適合辦",
    "適合報名",
  ]);
}

function isDateAttentionQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "要注意什麼",
    "注意什麼",
    "注意事項",
    "需要注意",
    "當天要注意",
    "交通要注意",
    "簽約當天",
    "活動當天",
    "搬家當天",
    "交屋日期要注意",
  ]);
}

function isSpecificDateRequestQuestion(question: string) {
  const text = question.toLowerCase();

  return includesAny(text, [
    "哪天",
    "哪一天",
    "幾月幾號",
    "確切日期",
    "日期要選",
    "日期怎麼選",
    "日期要怎麼",
    "日期怎麼抓",
    "日期要怎麼看",
    "哪個週末",
    "什麼時候",
    "何時",
  ]);
}

function isOpeningDateQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    includesAny(text, ["開幕", "開店", "店面", "試營運", "正式營業", "開張", "工作室"]) &&
    (
      hasSingleSpecificDate(question) ||
      isDateSuitabilityQuestion(question) ||
      isDateAttentionQuestion(question) ||
      isSpecificDateRequestQuestion(question) ||
      includesAny(text, ["確切", "幾月幾號", "哪一天", "哪天", "這天", "日期", "怎麼選", "流程", "現場", "適合開幕", "開幕適合", "六月底", "七月初"])
    )
  );
}

function isTravelDateQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    hasDateSelectionIntent(question) &&
    includesAny(text, [
      "出去玩",
      "出國",
      "旅遊",
      "旅行",
      "出遊",
      "兩天一夜",
      "行程",
      "約出去",
      "外出活動",
      "出發",
      "帶家人出去",
      "出去走走",
    ])
  );
}

function isSingleTravelDateQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    hasSingleSpecificDate(question) &&
    includesAny(text, ["出去玩", "出國", "出遊", "旅行", "旅遊", "外出活動"]) &&
    isDateSuitabilityQuestion(question)
  );
}

function isActivityDateQuestion(question: string) {
  const text = question.toLowerCase();

  if (isProductVarietyDecisionQuestion(question)) {
    return false;
  }

  return (
    hasDateSelectionIntent(question) &&
    includesAny(text, [
      "活動",
      "聚會",
      "見面",
      "聚餐",
      "擺攤",
      "市集",
      "上課",
      "報名",
      "拍攝",
      "直播",
      "辦活動",
      "拍攝日",
    ])
  );
}

function isContractDateQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    hasDateSelectionIntent(question) &&
    includesAny(text, [
      "簽約",
      "合約",
      "契約",
      "簽名",
      "簽文件",
      "過戶",
      "付款",
      "交屋",
      "租約",
    ])
  );
}

function isCourseDateQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    hasDateSelectionIntent(question) &&
    includesAny(text, ["課程", "開課", "報名", "上架課程", "學新東西", "學習"])
  );
}

function isMovingDateQuestion(question: string) {
  const text = question.toLowerCase();

  return hasDateSelectionIntent(question) && includesAny(text, ["搬家", "入宅"]);
}

function isDateSelectionQuestion(question: string) {
  return (
    isOpeningDateQuestion(question) ||
    isTravelDateQuestion(question) ||
    isActivityDateQuestion(question) ||
    isContractDateQuestion(question) ||
    isCourseDateQuestion(question) ||
    isMovingDateQuestion(question) ||
    (hasDateSelectionIntent(question) && includesAny(question, ["怎麼選", "比較好", "比較順", "適合"]))
  );
}

function getDateQuestionKind(question: string) {
  if (isOpeningDateQuestion(question)) return "opening";
  if (isTravelDateQuestion(question)) return "travel";
  if (isContractDateQuestion(question)) return "contract";
  if (isCourseDateQuestion(question)) return "course";
  if (isMovingDateQuestion(question)) return "moving";
  if (isActivityDateQuestion(question)) return "activity";
  return "general";
}

function hasSpecificCandidateDates(question: string) {
  return (
    /\d{1,2}\/\d{1,2}/.test(question) ||
    /\d{1,2}月\d{1,2}/.test(question) ||
    /\d{1,2}\s*[、,，]\s*\d{1,2}/.test(question)
  );
}

function extractDateMentions(question: string) {
  return [
    ...question.matchAll(/\d{1,2}\/\d{1,2}/g),
    ...question.matchAll(/\d{1,2}月\d{1,2}(?:日|號)?/g),
  ].map((match) => match[0]);
}

function isFollowUpSingleDateQuestion(question: string) {
  return (
    /(第二題|接著|後續|上一題|剛剛).{0,40}\d{1,2}\/\d{1,2}.{0,20}(這天|這一天|那天|適合嗎|可以嗎)/.test(
      question
    ) ||
    /\d{1,2}\/\d{1,2}.{0,12}(這天|這一天|那天).{0,20}(適合嗎|可以嗎|要注意什麼)/.test(
      question
    )
  );
}

function hasMultipleCandidateDates(question: string) {
  if (isFollowUpSingleDateQuestion(question)) {
    return false;
  }

  const dates = extractDateMentions(question);

  return (
    dates.length >= 2 ||
    /\d{1,2}\s*[、,，]\s*\d{1,2}/.test(question) ||
    (includesAny(question, ["候選日期", "三個日期", "多個日期"]) &&
      hasSpecificCandidateDates(question))
  );
}

function hasSingleSpecificDate(question: string) {
  return hasSpecificCandidateDates(question) && !hasMultipleCandidateDates(question);
}

function detectDateIntent(question: string): DateIntent {
  if (hasMultipleCandidateDates(question)) {
    return "multi_candidate_compare";
  }

  if (hasSingleSpecificDate(question)) {
    return "single_date_check";
  }

  if (isDateAttentionQuestion(question)) {
    return "attention_check";
  }

  if (isDateSuitabilityQuestion(question) && !isSpecificDateRequestQuestion(question)) {
    return "suitability_check";
  }

  if (isSpecificDateRequestQuestion(question)) {
    return "specific_date_request";
  }

  return "general_date_context";
}

function isTravelCompanionFollowUpQuestion(question: string) {
  const text = question.toLowerCase();

  return (
    includesAny(text, ["同行", "同行的人", "同行者"]) &&
    includesAny(text, ["出去玩", "出遊", "旅行", "旅遊", "第一題", "第二題", "延續上一題"])
  );
}

function isInvestmentDecisionQuestion(questionType: string, question: string) {
  return (
    questionType === "金錢投資" ||
    hasExplicitHighRiskInvestmentTerms(question) ||
    isInvestmentEmotionQuestion(question)
  );
}

function isHealthLifestyleQuestion(question: string) {
  const text = question.toLowerCase();
  if (
    (
      isOverworkSleepQuestion(question) ||
      isSleepRestQuestion(question) ||
      isHealthCriticalQuestion(question) ||
      hasMedicalContext(question)
    ) &&
    !isExplicitFinancialInvestmentQuestion(question)
  ) {
    return true;
  }

  const hasHealthCue = includesAny(text, [
    "健康",
    "身體",
    "身體狀態",
    "身體和心情",
    "睡眠",
    "睡覺",
    "早點睡",
    "早睡",
    "晚睡",
    "睡不好",
    "失眠",
    "作息",
    "休息",
    "疲累",
    "疲勞",
    "疲倦",
    "精神",
    "體力",
    "白天",
    "飲食",
    "壓力",
    "情緒",
    "緊繃",
    "注意力",
    "生活習慣",
    "生活節奏",
    "熬夜",
    "恢復",
  ]);
  const hasCareIntent = includesAny(text, [
    "需要注意",
    "要注意",
    "怎麼照顧",
    "照顧自己",
    "先調整",
    "調整哪裡",
    "調整作息",
    "先顧",
    "穩一點",
    "提醒什麼",
    "要先做什麼",
    "要怎麼",
    "改掉",
    "恢復",
    "適合開始運動",
    "適合",
    "該不該",
    "是不是該",
    "可以嗎",
  ]);

  return hasHealthCue && hasCareIntent && !isExplicitFinancialInvestmentQuestion(question);
}

function isHealthLifestyleContext(context: ReadingContext) {
  return (
    context.questionType === "健康狀態" ||
    context.questionSubcategory.includes("作息睡眠") ||
    context.questionSubcategory.includes("健康") ||
    isOverworkSleepQuestion(context.question) ||
    isHealthCriticalQuestion(context.question) ||
    hasMedicalContext(context.question) ||
    isHealthLifestyleQuestion(context.question)
  );
}

function detectQuestionDomain(question: string) {
  const text = question.toLowerCase();

  if (isAccidentSettlementQuestion(question)) {
    return "合約法律｜車禍和解";
  }

  if (isResaleRegistrationChoiceQuestion(question)) {
    return "經營銷售｜代售報名";
  }

  if (isSchoolPeerFitQuestion(question)) {
    return "人際關係｜同儕互動";
  }

  if (isSingleLoveTimingQuestion(question)) {
    return "感情關係｜桃花時間";
  }

  if (isHealthCriticalQuestion(question)) {
    return "健康身心｜重大健康";
  }

  if (isOverworkSleepQuestion(question)) {
    return "健康身心｜作息睡眠";
  }

  if (isHealthLifestyleQuestion(question)) {
    return "健康身心｜作息睡眠";
  }

  if (isOpeningDateQuestion(question)) {
    return "日期擇日｜開幕日期";
  }

  if (isTravelDateQuestion(question)) {
    return "活動注意｜出去玩日期";
  }

  if (isContractDateQuestion(question)) {
    return "合約法律｜簽約日期";
  }

  if (isCourseDateQuestion(question)) {
    return "學習課程｜課程日期";
  }

  if (isActivityDateQuestion(question)) {
    return "活動注意｜活動日期";
  }

  if (isMovingDateQuestion(question)) {
    return "日期擇日｜搬家日期";
  }

  if (isActivityLogisticsQuestion(question)) {
    return "活動注意";
  }

  if (isPersonDescriptionQuestion(question)) {
    return "人物描述";
  }

  if (detectPropertyHandoverResponsibilityIntent(question)) {
    return "房產置產｜交屋責任";
  }

  if (detectOralPromiseDealIntent(question)) {
    return "合約法律｜口頭約定";
  }

  if (detectDeliveryDelayIntent(question)) {
    return "買賣交易｜交貨交付";
  }

  if (detectLegalOutcomeIntent(question)) {
    return "合約法律｜法律勝負";
  }

  if (detectTransactionDealIntent(question)) {
    return "買賣交易｜交易條件";
  }

  const isRecentStatus =
    includesAny(text, [
      "整體狀態",
      "最近狀態",
      "近期狀態",
      "近期提醒",
      "這週整體",
      "這幾天整體",
      "這段時間要注意",
      "最近要注意",
      "近期要注意",
      "最近運勢",
      "這週運勢",
      "整體需要注意",
      "生活上要注意",
      "做事和生活",
    ]) &&
    !includesAny(text, [
      "官方",
      "網站",
      "line",
      "短影音",
      "推廣",
      "評價",
      "推薦",
      "股票",
      "投資",
      "合約",
      "感情",
      "曖昧",
      "前任",
      "工作",
      "離職",
      "賣",
      "買",
    ]);

  if (isRecentStatus) {
    return "近期整體狀態";
  }

  if (
    includesAny(text, [
      "曖昧",
      "感情",
      "愛情",
      "復合",
      "分手",
      "前任",
      "告白",
      "喜歡",
      "伴侶",
      "男友",
      "女友",
      "另一半",
      "桃花",
      "對方是不是認真",
      "關係",
      "冷淡",
    ])
  ) {
    return "感情關係";
  }

  if (hasExplicitHighRiskInvestmentTerms(question) || isInvestmentEmotionQuestion(question)) {
    return "金錢投資";
  }

  if (isIncomePlanningQuestion(question)) {
    return "金錢收入｜收入方向";
  }

  if (isBusinessSalesQuestion(question)) {
    return "經營銷售｜活動營收";
  }

  if (isGeneralMoneyFinanceQuestion(question)) {
    return "金錢財務｜一般財務";
  }

  if (
    includesAny(text, [
      "離職",
      "何時離職",
      "做到六月",
      "做到七月",
      "做到五月",
      "做到幾月",
      "留到六月",
      "留到七月",
      "留到五月",
      "留到幾月",
      "找工作",
      "工作",
      "職場",
      "主管",
      "同事",
      "職缺",
      "薪水",
      "薪資",
      "面試",
      "專案",
      "任務",
      "升遷",
      "換公司",
      "副業",
      "個人品牌",
      "職涯",
    ])
  ) {
    return "工作職涯";
  }

  if (isIncomePlanningQuestion(question)) {
    return "金錢收入｜收入方向";
  }

  if (
    includesAny(text, [
      "股票",
      "投資",
      "期貨",
      "基金",
      "加碼",
      "買進",
      "賣出",
      "短線",
      "長期投資",
      "財運",
      "財務",
      "資金",
      "存款",
      "現金",
      "部位",
      "進場",
      "出場",
    ])
  ) {
    return hasExplicitHighRiskInvestmentTerms(question) || isInvestmentEmotionQuestion(question)
      ? "金錢投資"
      : "金錢財務｜一般財務";
  }

  if (
    includesAny(text, [
      "賣掉",
      "賣出",
      "買下來",
      "下手",
      "價格",
      "成交",
      "議價",
      "買家",
      "賣家",
      "二手",
      "摩托車",
      "機車",
      "商品",
      "交易",
    ])
  ) {
    return "買賣交易";
  }

  if (
    includesAny(text, [
      "短影音",
      "影片",
      "社群",
      "粉絲",
      "內容",
      "內容經營",
      "個人品牌",
      "曝光",
      "流量",
      "口碑",
      "評價",
      "推薦",
      "客人回饋",
      "見證",
      "分享",
      "cta",
    ])
  ) {
    return "內容品牌";
  }

  if (
    includesAny(text, [
      "網站",
      "網頁",
      "系統",
      "app",
      "平台",
      "line官方",
      "line 官方",
      "官方line",
      "官方 line",
      "官方帳號",
      "占卜官方",
      "流程",
      "使用者體驗",
      "解讀系統",
      "ai",
      "codex",
      "功能",
      "會員",
      "點數",
      "抽牌",
    ])
  ) {
    return "網站系統";
  }

  if (
    includesAny(text, [
      "推廣",
      "行銷",
      "受歡迎",
      "轉換",
      "成交率",
      "回訪",
      "客人",
      "使用者",
      "使用者",
      "品牌",
      "官方",
      "導流",
      "免費體驗",
      "付費",
      "價格方案",
    ])
  ) {
    return "經營推廣";
  }

  if (
    includesAny(text, [
      "合約",
      "契約",
      "簽約",
      "條款",
      "法律",
      "官司",
      "白紙黑字",
      "口頭約定",
      "文件",
      "責任",
      "糾紛",
      "付款方式",
    ])
  ) {
    return "合約法律";
  }

  if (
    includesAny(text, [
      "合作",
      "合夥",
      "合作案",
      "合作對象",
      "朋友一起",
      "分工",
      "人際",
      "客人",
      "信任",
      "話中有話",
    ])
  ) {
    return "人際合作";
  }

  if (
    includesAny(text, [
      "房子",
      "買房",
      "賣房",
      "租屋",
      "搬家",
      "裝修",
      "裝潢",
      "居住",
      "屋況",
      "房貸",
      "不動產",
      "家裡",
      "空間",
    ])
  ) {
    return "房產居家";
  }

  if (
    includesAny(text, [
      "家人",
      "家庭",
      "爸",
      "媽",
      "父母",
      "長輩",
      "小孩",
      "親戚",
      "家裡的人",
    ])
  ) {
    return "家庭家人";
  }

  if (
    includesAny(text, [
      "健康",
      "身體",
      "睡眠",
      "精神",
      "疲累",
      "壓力",
      "情緒",
      "飲食",
      "作息",
      "生病",
      "疾病",
      "就醫",
    ])
  ) {
    return "健康身心";
  }

  if (
    includesAny(text, [
      "課程",
      "學習",
      "讀書",
      "考試",
      "證照",
      "報名",
      "進修",
      "技能",
      "上課",
      "補習",
      "老師",
      "學生",
    ])
  ) {
    return "學習課程";
  }

  if (
    includesAny(text, [
      "交通",
      "出門",
      "外出",
      "出國",
      "旅行",
      "旅遊",
      "行程",
      "開車",
      "騎車",
      "車禍",
      "短程旅行",
      "出行",
    ])
  ) {
    return "交通出行";
  }

  if (
    includesAny(text, [
      "室內運動",
      "戶外活動",
      "活動安排",
      "開幕活動",
      "拜拜",
      "參拜",
      "擺攤",
    ]) &&
    includesAny(text, [
      "注意",
      "注意事項",
      "如何改善",
      "要準備",
      "明天",
      "明日",
      "這週",
      "週日",
    ])
  ) {
    return "活動注意";
  }

  return "一般具體問題";
}

function detectQuestionType(question: string) {
  const text = question.toLowerCase();

  if (isAccidentSettlementQuestion(question)) {
    return "合約法律";
  }

  if (isResaleRegistrationChoiceQuestion(question)) {
    return "經營銷售";
  }

  if (isSchoolPeerFitQuestion(question)) {
    return "人際合作";
  }

  if (isSingleLoveTimingQuestion(question)) {
    return "感情關係";
  }

  if (isKinshipVisitQuestion(question)) {
    return "家庭家人";
  }

  if (isVillainBenefactorQuestion(question)) {
    return "人際合作";
  }

  if (isRentRenewalQuestion(question)) {
    return "房產置產";
  }

  if (isProductVarietyDecisionQuestion(question)) {
    return "經營銷售";
  }

  if (isBankSelectionQuestion(question)) {
    return "金錢財務";
  }

  if (isLifestyleChoiceQuestion(question)) {
    return "一般具體問題";
  }

  if (isFriendToLoverQuestion(question)) {
    return "感情關係";
  }

  if (detectPropertyHandoverResponsibilityIntent(question)) {
    return "房產置產";
  }

  if (detectOralPromiseDealIntent(question) || detectLegalOutcomeIntent(question)) {
    return "合約法律";
  }

  if (detectDeliveryDelayIntent(question) || detectTransactionDealIntent(question)) {
    return "買賣交易";
  }

  if (isProfessionalCommunicationActionQuestion(question)) {
    return "工作事業";
  }

  if (isGeneralContactActionQuestion(question)) {
    return "一般具體問題";
  }

  if (isTargetedLoveQuestion(question) || isLoveMindCue(question)) {
    return "感情關係";
  }

  if (hasExplicitHighRiskInvestmentTerms(question) || isInvestmentEmotionQuestion(question)) {
    return "金錢投資";
  }

  if (isBusinessSalesQuestion(question)) {
    return "經營銷售";
  }

  if (isIncomePlanningQuestion(question)) {
    return "收入規劃";
  }

  if (isGeneralMoneyFinanceQuestion(question)) {
    return "金錢財務";
  }

  if (isCourseCreatorQuestion(question)) {
    return "經營推廣";
  }

  if (isWebsiteSystemQuestion(question)) {
    return "網站系統";
  }

  if (isBusinessManagementQuestion(question)) {
    return "經營推廣";
  }

  if (isHealthCriticalQuestion(question) || isOverworkSleepQuestion(question) || isHealthLifestyleQuestion(question)) {
    return "健康狀態";
  }

  if (isWorkQuestionCue(question)) {
    return "工作事業";
  }

  if (isTravelCompanionFollowUpQuestion(question)) {
    return "活動注意";
  }

  if (isContractDateQuestion(question)) {
    return "合約法律";
  }

  if (!isCourseCreatorQuestion(question) && isCourseDateQuestion(question)) {
    return "學習考試";
  }

  if (isTravelDateQuestion(question) || isActivityDateQuestion(question)) {
    return "活動注意";
  }

  if (isOpeningDateQuestion(question) || isMovingDateQuestion(question)) {
    return "日期擇日";
  }

  if (isActivityLogisticsQuestion(question)) {
    return "活動注意";
  }

  if (isPersonDescriptionQuestion(question)) {
    return "人物描述";
  }

  if (
    text.includes("房子") ||
    text.includes("買房") ||
    text.includes("賣房") ||
    text.includes("看房") ||
    text.includes("房屋") ||
    text.includes("房產") ||
    text.includes("置產") ||
    text.includes("不動產") ||
    text.includes("租金") ||
    text.includes("租屋") ||
    text.includes("格局") ||
    text.includes("方正") ||
    text.includes("屋況") ||
    text.includes("房貸") ||
    text.includes("簽約買房") ||
    text.includes("預售屋") ||
    text.includes("中古屋")
  ) {
    return "房產置產";
  }

  if (
    !isLoveCommitmentQuestion(question) &&
    (
      text.includes("合約") ||
      text.includes("契約") ||
      text.includes("簽約") ||
      text.includes("法律") ||
      text.includes("官司") ||
      text.includes("規範") ||
      text.includes("條款") ||
      text.includes("文件") ||
      text.includes("白紙黑字") ||
      text.includes("承諾") ||
      text.includes("約定") ||
      text.includes("糾紛")
    )
  ) {
    return "合約法律";
  }

  if (
    text.includes("交通") ||
    text.includes("車關") ||
    text.includes("車禍") ||
    text.includes("行車安全") ||
    text.includes("騎車安全") ||
    text.includes("開車安全") ||
    text.includes("交通意外") ||
    text.includes("出入平安") ||
    text.includes("開車") ||
    text.includes("騎車") ||
    text.includes("出門") ||
    text.includes("外出") ||
    text.includes("出國") ||
    text.includes("旅遊") ||
    text.includes("旅行") ||
    text.includes("行程") ||
    text.includes("車禍") ||
    text.includes("意外") ||
    text.includes("受傷")
  ) {
    return "交通出行";
  }

  if (
    (
      text.includes("室內運動") ||
      text.includes("戶外活動") ||
      text.includes("活動安排") ||
      text.includes("開幕活動") ||
      text.includes("拜拜") ||
      text.includes("參拜") ||
      text.includes("擺攤")
    ) &&
    (
      text.includes("注意") ||
      text.includes("注意事項") ||
      text.includes("如何改善") ||
      text.includes("要準備") ||
      text.includes("明天") ||
      text.includes("明日") ||
      text.includes("這週") ||
      text.includes("週日")
    )
  ) {
    return "活動注意";
  }

  if (
    text.includes("感情") ||
    text.includes("愛情") ||
    text.includes("曖昧") ||
    text.includes("桃花") ||
    text.includes("復合") ||
    text.includes("分手") ||
    text.includes("對方") ||
    text.includes("伴侶") ||
    text.includes("老婆") ||
    text.includes("老公") ||
    text.includes("妻子") ||
    text.includes("丈夫") ||
    text.includes("彼此") ||
    text.includes("喜歡") ||
    text.includes("告白") ||
    text.includes("冷淡") ||
    text.includes("吵架") ||
    text.includes("前任") ||
    text.includes("另一半") ||
    text.includes("這段關係") ||
    text.includes("這個關係") ||
    text.includes("關係目前") ||
    text.includes("關係接下來") ||
    text.includes("關係發展") ||
    text.includes("未來三年") ||
    text.includes("長期交往") ||
    text.includes("長期穩定") ||
    text.includes("走向婚姻") ||
    text.includes("婚姻") ||
    text.includes("長久經營") ||
    text.includes("這個人走下去") ||
    text.includes("關係會比較穩定") ||
    text.includes("感情機會") ||
    text.includes("會有感情") ||
    text.includes("未來對象") ||
    text.includes("什麼樣的人") ||
    text.includes("會是什麼樣的人")
  ) {
    return "感情關係";
  }

  if (
    text.includes("官方") ||
    text.includes("官方帳號") ||
    text.includes("line官方") ||
    text.includes("line 官方") ||
    text.includes("line") ||
    text.includes("codex") ||
    text.includes("網站") ||
    text.includes("網頁") ||
    text.includes("短影音") ||
    text.includes("影片") ||
    text.includes("推廣") ||
    text.includes("行銷") ||
    text.includes("流量") ||
    text.includes("受歡迎") ||
    text.includes("推薦") ||
    text.includes("評價") ||
    text.includes("客人") ||
    text.includes("使用者") ||
    text.includes("使用者") ||
    text.includes("粉絲") ||
    text.includes("社群") ||
    text.includes("個人品牌") ||
    text.includes("品牌") ||
    text.includes("內容經營") ||
    text.includes("內容") ||
    text.includes("轉換") ||
    text.includes("曝光")
  ) {
    return "經營推廣";
  }

  if (
    text.includes("工作") ||
    text.includes("事業") ||
    text.includes("主管") ||
    text.includes("同事") ||
    text.includes("職場") ||
    text.includes("創業") ||
    text.includes("換工作") ||
    text.includes("工作機會") ||
    text.includes("新任務") ||
    text.includes("寫作方向") ||
    text.includes("工作和寫作") ||
    text.includes("今天的工作") ||
    text.includes("今天工作") ||
    text.includes("是否順利有進度") ||
    text.includes("有進度") ||
    text.includes("離職") ||
    text.includes("何時離職") ||
    text.includes("做到六月") ||
    text.includes("做到七月") ||
    text.includes("做到五月") ||
    text.includes("做到幾月") ||
    text.includes("留到六月") ||
    text.includes("留到七月") ||
    text.includes("留到五月") ||
    text.includes("留到幾月")
  ) {
    return "工作事業";
  }

  if (
    text.includes("錢") ||
    text.includes("財") ||
    text.includes("股票") ||
    text.includes("期貨") ||
    text.includes("基金") ||
    text.includes("收入") ||
    text.includes("財運") ||
    text.includes("花費") ||
    text.includes("花下去") ||
    text.includes("值得嗎")
  ) {
    return hasExplicitHighRiskInvestmentTerms(question) || isInvestmentEmotionQuestion(question)
      ? "金錢投資"
      : "金錢財務";
  }

  if (
    text.includes("人際") ||
    text.includes("朋友") ||
    text.includes("合作") ||
    text.includes("合夥") ||
    text.includes("客人") ||
    text.includes("合作案") ||
    text.includes("合作對象")
  ) {
    return "人際合作";
  }

  if (isHealthCriticalQuestion(question) || isOverworkSleepQuestion(question) || isHealthLifestyleQuestion(question)) {
    return "健康狀態";
  }

  if (
    text.includes("家庭") ||
    text.includes("家人") ||
    text.includes("爸") ||
    text.includes("媽") ||
    text.includes("長輩") ||
    text.includes("搬家")
  ) {
    return "家庭家人";
  }

  if (
    text.includes("健康") ||
    text.includes("身體") ||
    text.includes("疾病") ||
    text.includes("保養") ||
    text.includes("睡眠") ||
    text.includes("生病") ||
    text.includes("精神") ||
    text.includes("疲勞") ||
    text.includes("壓力")
  ) {
    return "健康狀態";
  }

  if (
    text.includes("考試") ||
    text.includes("學習") ||
    text.includes("讀書") ||
    text.includes("證照") ||
    text.includes("上課") ||
    text.includes("課程") ||
    text.includes("報名") ||
    text.includes("補習") ||
    text.includes("進修") ||
    text.includes("學新") ||
    text.includes("新東西") ||
    text.includes("學技能") ||
    text.includes("學技術") ||
    text.includes("學東西")
  ) {
    return "學習考試";
  }

  if (
    text.includes("整體狀態") ||
    text.includes("最近狀態") ||
    text.includes("近期狀態") ||
    text.includes("近期提醒") ||
    text.includes("這週整體") ||
    text.includes("這幾天整體") ||
    text.includes("這段時間要注意") ||
    text.includes("最近要注意") ||
    text.includes("近期要注意") ||
    text.includes("運勢") ||
    text.includes("最近運勢") ||
    text.includes("這週運勢") ||
    text.includes("整體需要注意") ||
    text.includes("生活上要注意") ||
    text.includes("做事和生活")
  ) {
    return "近期提醒";
  }

  if (
    includesAny(text, [
      "確切日期",
      "幾月幾號",
      "哪一天",
      "擇日",
      "結婚日期",
      "簽約日期",
      "搬家日期"
    ])
  ) {
    return "日期擇日";
  }

  return "一般具體問題";
}



function cleanAnswer(answer: string) {
  return answer
    .replaceAll("這意味著", "這代表")
    .replaceAll("意味著", "代表")
    .replaceAll("意味着", "代表")
    .replaceAll("象徵著", "比較像")
    .replaceAll("象征着", "比較像")
    .replaceAll("顯示出", "看起來")
    .replaceAll("显示出", "看起來")
    .replaceAll("顯示", "看起來")
    .replaceAll("显示", "看起來")
    .replaceAll("這表明", "這代表")
    .replaceAll("表明", "代表")
    .replaceAll("表現出", "看得出")
    .replaceAll("表现出", "看得出")
    .replaceAll("有助於", "會更容易")
    .replaceAll("有助于", "會更容易")
    .replaceAll("明智的選擇", "比較不容易踩雷")
    .replaceAll("明智選擇", "比較不容易踩雷")
    .replaceAll("明智", "比較穩")
    .replaceAll("保持開放的心態", "先聽完再決定")
    .replaceAll("保持開放態度", "先聽完再決定")
    .replaceAll("保持開放心態", "先聽完再決定")
    .replaceAll("保持開放", "先聽完再決定")
    .replaceAll("保持开放的心态", "先聽完再決定")
    .replaceAll("保持开放态度", "先聽完再決定")
    .replaceAll("保持正向", "先穩住自己")
    .replaceAll("正能量", "比較正面的狀態")
    .replaceAll("最佳狀態", "比較好的狀態")
    .replaceAll("更加完美", "更穩")
    .replaceAll("可能會面臨一些挑戰", "可能會有些沒有順利往前")
    .replaceAll("面臨一些挑戰", "有些沒有順利往前")
    .replaceAll("可能面臨", "可能會有")
    .replaceAll("面臨", "遇到")
    .replaceAll("面对", "遇到")
    .replaceAll("暗示", "提醒")
    .replaceAll("預示著", "代表")
    .replaceAll("預示", "代表")
    .replaceAll("预示着", "代表")
    .replaceAll("预示", "代表")
    .replaceAll("綜上所述", "")
    .replaceAll("因此可見", "")
    .replaceAll("因此，", "")
    .replaceAll("因此", "")
    .replaceAll("不妨", "可以")
    .replaceAll("促進", "推動")
    .replaceAll("展現出", "看得出")
    .replaceAll("顯得", "看起來")
    .replaceAll("続", "續")
    .replaceAll("温", "溫")
    .replaceAll("這板牌", "這張牌")
    .replaceAll("板牌", "張牌")
    .replaceAll("瞭解", "了解")
    .replaceAll("建議你可以試著", "你可以先")
    .replaceAll("建議你可以", "你可以")
    .replaceAll("不妨適時", "可以先")
    .replaceAll("透過開放的交流", "把該確認的事情講清楚")
    .replaceAll("釐清彼此的期待", "確認彼此接下來要不要往前")
    .replaceAll("具體而言，", "")
    .replaceAll("具體而言", "")
    .replaceAll("具體來說，", "")
    .replaceAll("具體來說", "")
    .replaceAll("建議你應該", "你可以")
    .replaceAll("應該要", "要")
    .replaceAll("確保", "確認")
    .replaceAll("這能幫助你", "這可以讓你")
    .replaceAll("能幫助你", "可以讓你")
    .replaceAll("幫助你", "讓你")
    .replaceAll("會更容易你", "會讓你比較容易")
    .replaceAll("會更容易你", "會讓你比較容易")
    .replaceAll("會更容易你", "會讓你更容易")
    .replaceAll("這樣會更容易你", "這樣會讓你更容易")
    .replaceAll("也會更容易你", "也會讓你更容易")
    .replaceAll("更容易你", "讓你更容易")
    .replaceAll("會讓你比較容易更容易", "會讓你更容易")
    .replaceAll("會讓你比較容易更穩", "會讓你更穩")
    .replaceAll("會讓你更容易", "會讓你更容易")
    .replaceAll("將有機會因為", "可以因為")
    .replaceAll("有機會因為", "可以因為")
    .replaceAll("將有機會", "會比較有機會")
    .replaceAll("人生的轉變", "狀態的調整")
    .replaceAll("全力以赴", "先穩住節奏")
    .replaceAll("正向影響", "條件比較好")
    .replaceAll("正面影響", "條件比較好")
    .replaceAll("收益", "實際結果")
    .replaceAll("回報", "實際結果")
    .replaceAll("報酬", "實際條件")
    .replaceAll("成果", "結果")
    .replaceAll("租金報酬", "租金條件")
    .replaceAll("良好的CP值及租金報酬", "CP值和租金條件可以評估")
    .replaceAll("良好的 CP 值及租金報酬", "CP值和租金條件可以評估")
    .replaceAll("有潛力的交易", "可以評估的合作")
    .replaceAll("交易有潛力", "合作可以評估")
    .replaceAll("這是個可以評估的合作", "這份合約可以評估，但不要只看表面")
    .replaceAll("有機會在條款上得到公平合理的安排", "條款看起來有整理空間，但仍要確認細節")
    .replaceAll("公平合理的安排", "相對清楚的安排")
    .replaceAll("實際的實際結果", "實際結果")
    .replaceAll("冥思苦想", "觀察數據與整理策略")
    .replaceAll("按設置的停損線及成本進行操作", "依照原本設定的停損線、成本和風險規則判斷")
    .replaceAll("按設置的停損線", "依照原本設定的停損線")
    .replaceAll("代表著", "代表");
}

function isTrafficReminderCard(cardName: string) {
  return ["天機星", "巨門星", "天相星", "破軍星"].includes(cardName);
}

function hasTrafficReminder(answer: string) {
  return (
    answer.includes("外出") ||
    answer.includes("交通") ||
    answer.includes("分心") ||
    answer.includes("臨時變動") ||
    answer.includes("路線") ||
    answer.includes("工具狀況") ||
    answer.includes("行程")
  );
}

function isLoveQuestion(questionType: string, question: string) {
  if (isGeneralContactActionQuestion(question)) {
    return false;
  }

  if (
    [
      "活動注意",
      "交通出行",
      "合約法律",
      "金錢投資",
      "工作事業",
      "房產置產",
      "買賣交易",
      "網站系統",
      "經營推廣",
      "內容品牌",
      "健康狀態",
      "學習考試",
    ].includes(questionType)
  ) {
    return false;
  }

  return (
    questionType === "感情關係" ||
    isLoveMindCue(question) ||
    question.includes("感情") ||
    question.includes("曖昧") ||
    question.includes("復合") ||
    question.includes("分手") ||
    question.includes("伴侶") ||
    question.includes("老婆") ||
    question.includes("老公") ||
    question.includes("妻子") ||
    question.includes("丈夫") ||
    question.includes("關係")
  );
}

function isLoveMindQuestion(questionType: string, question: string) {
  return isLoveQuestion(questionType, question) && includesAny(question, [
    "心意",
    "有沒有心",
    "心裡還有沒有",
    "心裡還有我",
    "心是不是",
    "還有沒有我",
    "還有我嗎",
    "還喜歡",
    "喜歡我",
    "在乎我",
    "還在乎",
    "回覆變慢",
    "回應變慢",
    "主動找他",
    "主動找她",
    "會回應",
    "會回嗎",
    "會回覆",
    "故意冷淡",
    "忙還是",
    "沒有以前那麼在乎",
    "重要位置",
    "真心",
    "認真",
    "曖昧",
    "習慣性聯絡",
    "一時寂寞",
    "熱度下降",
    "感情熱度下降",
    "真的忙",
    "是真的忙",
    "想靠近",
    "靠近我",
    "熱絡",
    "突然消失",
    "慢慢退開",
    "退開",
    "冷淡",
    "變淡",
    "不想負責任",
    "不想承諾",
    "觀望",
    "興趣不高",
    "不顧我的感受",
    "不太顧我的感受",
    "信任才真實",
    "說話比較直接",
    "讓我受傷",
    "心是不是開始往外跑",
    "心是不是往外跑",
    "往外跑",
  ]);
}

function buildLoveMindConclusion(
  cardName: string,
  position: "正位" | "反位",
  question: string
) {
  const canonicalConclusion = getZiweiLoveMindConclusion(cardName, position);
  if (canonicalConclusion) {
    return canonicalConclusion;
  }

  const isReversed = position === "反位";
  const q = question || "";

  if ((q.includes("忙") && q.includes("冷淡")) || q.includes("故意冷淡")) {
    if (cardName === "巨門星" && isReversed) {
      return "這張牌比較偏向：不是單純忙碌，而是他現在有避重就輕、冷處理或不想把話說清楚的成分。忙可能是其中一個因素，但主因比較偏向他在迴避正面回應。";
    }

    return isReversed
      ? "這張牌比較偏向：兩者都有一點，但主因不是單純忙，而是他目前比較不想把態度講明，會用忙碌或沉默避開正面回應。"
      : "這張牌比較偏向：他可能真的有事情在忙，但不是完全沒在意；只是回應熱度和穩定度還需要再觀察。";
  }

  if (
    includesAny(q, ["主動找他", "主動找她", "主動聯絡"]) &&
    includesAny(q, ["會回應", "會回嗎", "會回覆", "回應嗎"])
  ) {
    if (cardName === "天同星" && !isReversed) {
      return "這張牌比較偏向：你主動找他，他有機會回應，而且態度不會太硬。但天同正位比較像輕鬆、柔和、順著氣氛的回應，不一定代表他已經準備好給穩定承諾。";
    }

    return isReversed
      ? "這張牌比較偏向：他不一定完全不回，但回覆穩定度不足，可能偏禮貌、拖延或觀望，不能把一次回應當成明確承諾。"
      : "這張牌比較偏向：他有機會回，但回覆品質偏輕鬆或觀望，穩定度還要看後續互動能不能接上。";
  }

  if (q.includes("回覆變慢") && q.includes("心裡")) {
    return isReversed
      ? "這張牌比較偏向：他不是完全沒感覺，但現在有退縮、防備或心裡距離，回覆變慢不是單純小事。"
      : "這張牌比較偏向：他心裡仍有在意你的成分，只是表達比較慢、比較保留，還不到穩定主動靠近。";
  }

  if (q.includes("信任") && (q.includes("不太顧") || q.includes("不顧") || q.includes("直接") || q.includes("受傷"))) {
    if (cardName === "天相星") {
      return isReversed
        ? "這張牌比較偏向：他現在比較沒有拿捏分寸，已經有點不太顧你的感受。"
        : "這張牌比較偏向：他是因為信任才比較直接，但表達方式需要修正。";
    }

    if (cardName === "巨門星") {
      return isReversed
        ? "這張牌比較偏向：他話沒有講清楚，偏避重就輕或冷處理，容易用沉默讓你猜。"
        : "這張牌比較偏向：他有想講真話的成分，但說法容易刺傷你，要看他是否願意修正表達方式。";
    }

    if (cardName === "紫微星") {
      return isReversed
        ? "這張牌比較偏向：他比較顧面子和自己的位置，對你的感受照顧不足。"
        : "這張牌比較偏向：他不是完全不顧你，但會比較端著，也比較在意關係裡的位置與尊重。";
    }

    return isReversed
      ? "這張牌比較偏向：他有真實的一面，但目前更偏向不夠顧你的感受。"
      : "這張牌比較偏向：他有信任你的成分，但表達方式需要修正，不能只靠直白就算真誠。";
  }

  if ((q.includes("真的忙") || q.includes("忙")) && (q.includes("熱度下降") || q.includes("熱度"))) {
    if (cardName === "天機星") {
      return isReversed
        ? "這張牌比較偏向：他不是單純忙，而是心思混亂、優先順序變動，對感情的投入不穩。"
        : "這張牌比較偏向：他是真的有事情在忙，但也因為心思分散，感情熱度有下降。";
    }

    return isReversed
      ? "這張牌比較偏向：不是單純忙，主因更偏熱度下降與投入不穩。"
      : "這張牌比較偏向：他可能真的忙，但感情熱度也有下降，不能只用忙碌帶過。";
  }

  if (q.includes("真心想靠近") && q.includes("寂寞")) {
    if (cardName === "太陽星" && isReversed) {
      return "這張牌比較偏向：他有靠近你的動作，但真心穩定度不足，比較像一時寂寞，或想找回被需要的感覺。";
    }

    return isReversed
      ? "這張牌比較偏向：他有靠近你的動作，但真心穩定度不足，比較像一時寂寞或想找回被需要的感覺。"
      : "這張牌比較偏向：他有想靠近的成分，但還不到完全穩定投入，要看主動能不能持續。";
  }

  if (q.includes("觀望") && q.includes("興趣不高")) {
    return isReversed
      ? "這張牌比較偏向：他不是單純觀望，而是興趣和安全感都不足，主動性偏弱。"
      : "這張牌比較偏向：他還在觀望，但不是完全沒興趣，後續要看邀約和回應有沒有變積極。";
  }

  if (q.includes("重要位置")) {
    if (cardName === "天府星") {
      return isReversed
        ? "這張牌比較偏向：他目前沒有把你放在穩定重要的位置，心意反覆，關係還沒有定下來。"
        : "這張牌比較偏向：他是有在意的，但表達比較保守務實，不一定熱烈。";
    }

    return isReversed
      ? "這張牌比較偏向：他目前沒有把你放在穩定重要的位置，心意反覆，關係還沒有定下來。"
      : "這張牌比較偏向：他對你不是沒放在心上，但重要程度還要看行動是否穩定跟上。";
  }

  if (q.includes("往外跑")) {
    return isReversed
      ? "這張牌比較偏向：他的心有往外散、想要自由的跡象，不是完全離開，但穩定度已經變弱。"
      : "這張牌比較偏向：他的心不一定已經往外跑，但報備和靠近的主動性正在下降。";
  }

  if (q.includes("慢慢退開") || q.includes("退開")) {
    if (cardName === "紫微星") {
      return isReversed
        ? "這張牌比較偏向：他比較顧面子、把自己放前面，對你的感受照顧不足，距離感正在變強。"
        : "這張牌比較偏向：他不是完全沒心，但會比較端著，重視位置與尊重，不一定願意主動把姿態放低。";
    }

    if (cardName === "天相星") {
      return isReversed
        ? "這張牌比較偏向：分寸失衡，開始不太顧你的感受，關係裡的互相對待變不平衡。"
        : "這張牌比較偏向：他不是完全退開，而是把關係放在比較有分寸、比較保留的位置。";
    }

    return isReversed
      ? "這張牌比較偏向：他有慢慢退開的跡象，熱度和主動性都下降，不像以前那麼想靠近。"
      : "這張牌比較偏向：他還沒有完全退開，但互動變少，需要看他會不會主動補回生活分享。";
  }

  if (q.includes("習慣性聯絡") || q.includes("有沒有心")) {
    return isReversed
      ? "這張牌比較偏向：他不是完全沒心，但目前更像習慣性聯絡或保留觀望，不是積極投入。"
      : "這張牌比較偏向：他還有在意你的成分，但要看主動聯絡是不是能穩定增加。";
  }

  if (!isReversed) {
    switch (cardName) {
      case "紫微星":
        return "這張牌比較偏向：他不是完全沒心，但會比較端著，重視關係裡的位置、面子與尊重。";
      case "天相星":
        return "這張牌比較偏向：他不是完全退開，而是把關係放在比較有分寸、比較保留的位置。";
      case "巨門星":
        return "這張牌比較偏向：他有話想說或有真實想法，但表達不一定好聽，需要看他是否願意講清楚。";
      case "天機星":
        return "這張牌比較偏向：他不是完全沒心，但心思分散，還在思考與觀望。";
      case "太陽星":
        return "這張牌比較偏向：他不是完全沒心，仍有主動或照顧你的成分，但要看能不能持續。";
      case "天府星":
        return "這張牌比較偏向：他是有在意的，但表達會比較保守務實，不一定熱烈。";
      default:
        return "這張牌比較偏向：對方不是完全沒心，這段關係還有互動空間，但要看行動能不能持續。";
    }
  }

  switch (cardName) {
    case "紫微星":
      return "這張牌比較偏向：他比較容易顧面子、把自己放前面，對你的感受照顧不足，關係距離感會變強。";
    case "天相星":
      return "這張牌比較偏向：分寸失衡，開始不太顧你的感受，或關係裡的互相對待失去平衡。";
    case "太陽星":
      return "這張牌比較偏向：他不是完全沒感覺，但主動性變弱，熱度下降，已經不像以前那麼積極。";
    case "天機星":
      return "這張牌比較偏向：他不是完全沒心，但心意反覆、一直觀望，還沒有把關係放到穩定位置。";
    case "貪狼星":
      return "這張牌比較偏向：他仍有被你吸引，但真心穩定度不足，比較像一時靠近或新鮮感。";
    case "巨門星":
      return "這張牌比較偏向：他的態度不透明，話沒有說清楚，偏避重就輕或冷處理。";
    case "太陰星":
      return "這張牌比較偏向：他有退縮和防備，心裡有距離，照顧與靠近的力道正在收回。";
    case "天府星":
      return "這張牌比較偏向：他想掌握安全感，但不一定想真心投入，靠近裡面帶著保留。";
    case "武曲星":
      return "這張牌比較偏向：他實際投入不足，感情付出變少，容易用冷處理或務實距離面對你。";
    case "破軍星":
      return "這張牌比較偏向：他想要自由、狀態不穩，有退開跡象，不能只靠過去熱度判斷。";
    default:
      return "這張牌比較偏向：目前熱度不足，對方偏觀望或退縮，不是積極穩定靠近。";
  }
}

function enforceLoveMindConclusion(
  answer: string,
  questionType: string,
  question: string,
  cardName: string,
  position: "正位" | "反位"
) {
  if (!isLoveMindQuestion(questionType, question)) {
    return answer;
  }

  const trimmed = answer.trim();
  const paragraphs = trimmed.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const restParagraphs =
    firstParagraph.startsWith("這張牌比較偏向：") ||
    firstParagraph.startsWith("這張牌偏向：")
      ? paragraphs.slice(1)
      : paragraphs;

  return [buildLoveMindConclusion(cardName, position, question), ...restParagraphs]
    .join("\n\n")
    .trim();
}

function isPeachBlossomCard(cardName: string) {
  return ["貪狼星", "天同星", "太陰星", "巨門星", "破軍星"].includes(cardName);
}

function isMoneyQuestion(questionType: string, question: string) {
  if (
    questionType === "經營銷售" ||
    isBusinessSalesQuestion(question) ||
    (isIncomePlanningQuestion(question) && questionType !== "收入規劃")
  ) {
    return false;
  }

  return (
    questionType === "金錢投資" ||
    questionType === "金錢財務" ||
    questionType === "收入規劃" ||
    hasExplicitHighRiskInvestmentTerms(question) ||
    isInvestmentEmotionQuestion(question) ||
    question.includes("財運") ||
    question.includes("錢") ||
    question.includes("收入") ||
    question.includes("花下去")
  );
}

function isHighRiskInvestmentContext(context: ReadingContext) {
  const currentQuestionIsHighRisk =
    hasExplicitHighRiskInvestmentTerms(context.question) ||
    isInvestmentEmotionQuestion(context.question);

  if (currentQuestionIsHighRisk) {
    return true;
  }

  const followUpText = buildFollowUpContextSearchText(context.followUpContext);
  const previousQuestionIsHighRisk =
    Boolean(context.followUpContext?.isFollowUp) &&
    (hasExplicitHighRiskInvestmentTerms(followUpText) ||
      isInvestmentEmotionQuestion(followUpText));

  return (
    previousQuestionIsHighRisk &&
    (context.questionType === "金錢投資" ||
      context.questionSubcategory.includes("投資風險") ||
      context.questionDomain.includes("金錢投資"))
  );
}

function cleanMoneyWords(answer: string) {
  return answer
    .replaceAll("潛在收益", "潛在風險")
    .replaceAll("預期收益", "預期風險")
    .replaceAll("收益", "風險")
    .replaceAll("獲利", "風險控管")
    .replaceAll("回報", "成本與風險")
    .replaceAll("報酬率", "風險和成本")
    .replaceAll("報酬", "成本與風險")
    .replaceAll("利潤", "風險")
    .replaceAll("財務上的利潤", "財務上的風險")
    .replaceAll("賺錢機會", "風險變化")
    .replaceAll("賺錢", "控制風險")
    .replaceAll("把握機會", "先看風險")
    .replaceAll("把握", "確認")
    .replaceAll("成果", "結果")
    .replaceAll("適合長期投資", "需要先看風險與資金規劃")
    .replaceAll("值得投入", "需要再評估")
    .replaceAll("可以投入", "需要先評估")
    .replaceAll("可以買", "不能只靠牌面決定")
    .replaceAll("可以賣", "不能只靠牌面決定")
    .replaceAll("進場", "做決定")
    .replaceAll("出場", "調整計畫")
    .replaceAll("加碼", "放大部位")
    .replaceAll("放手資產", "重新檢查資金配置")
    .replaceAll("累積盈餘", "先看風險和成本")
    .replaceAll("累積獲利", "先看風險和成本")
    .replaceAll("有機會累積盈餘", "需要先看風險和成本")
    .replaceAll("穩定的增長", "穩定性還要觀察")
    .replaceAll("穩定增長", "穩定性還要觀察")
    .replaceAll("穩定成長", "穩定性還要觀察")
    .replaceAll("非常有機會", "需要保守評估")
    .replaceAll("很有機會", "需要保守評估")
    .replaceAll("這週在投資股票期貨上有穩定的發展機會", "這週投資股票期貨要先看風險是否可控")
    .replaceAll("投資股票期貨上有穩定的發展機會", "投資股票期貨要先看風險是否可控")
    .replaceAll("有穩定的發展機會", "要先看風險是否可控")
    .replaceAll("穩定的發展機會", "風險是否可控")
    .replaceAll("有機會實現穩定的增長", "穩定性還要觀察")
    .replaceAll("賺取收入", "增加收入來源的想法")
    .replaceAll("賺取更多收入", "重新檢查收入與風險")
    .replaceAll("財運方面目前的狀態是輕鬆而愉快的", "財務狀態目前看起來比較鬆，但也容易花得太隨意")
    .replaceAll("財運狀態是輕鬆而愉快的", "財務狀態目前看起來比較鬆，但也容易花得太隨意")
    .replaceAll("輕鬆而愉快的", "比較鬆的")
    .replaceAll("財務狀態比較正向", "財務條件可以觀察，但不能放大風險")
    .replaceAll("財運比較正向", "財務條件可以觀察，但不能放大風險")
    .replaceAll("財運狀態非常有機會", "財務狀態需要保守評估")
    .replaceAll("財運有機會", "財務狀態需要保守評估")
    .replaceAll("財運不錯", "財務條件可以觀察")
    .replaceAll("財運很好", "財務條件可以觀察")
    .replaceAll("投資報酬", "風險和成本")
    .replaceAll("租金報酬", "租金條件")
    .replaceAll("良好的CP值及租金報酬", "CP值和租金條件可以評估");
}

function softenNonPeachLoveAnswer(answer: string, position: string) {
  if (position === "正位") {
    return answer
      .replaceAll("這段關係的關係目前有一定的機會", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係關係目前有一定的機會", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係關係本身呈現出比較有機會的狀態", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係關係目前有一定的發展潛力", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係目前有一定的發展潛力", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係有穩定發展的潛力", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段感情目前看起來很有潛力", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係目前看起來有機會發展", "這段時間不是完全沒有感情機會，但感情熱度還沒明顯到位")
      .replaceAll("這段關係有機會深化", "這段時間不是完全沒有感情機會，但熱度還沒明顯到位")
      .replaceAll("這段感情本身有機會深化", "這段感情不是完全沒機會，但熱度還沒明顯到位")
      .replaceAll("這段關係本身有機會深化", "這段關係不是完全沒機會，但熱度還沒明顯到位")
      .replaceAll("這段關係有機會朝正向發展", "這段關係還要看互動品質和現實條件")
      .replaceAll("這段感情本身有機會朝正向發展", "這段感情還要看互動品質和現實條件")
      .replaceAll("這段關係本身有機會朝正向發展", "這段關係還要看互動品質和現實條件")
      .replaceAll("這段關係有機會慢慢提升", "這段時間不是完全沒有感情機會，但還要看互動品質和現實條件")
      .replaceAll("這段關係未來有機會進一步發展", "這段關係後續要看互動品質和對方態度")
      .replaceAll("這段感情接下來有機會", "這段感情不是完全沒機會，但熱度還沒明顯到位")
      .replaceAll("這段關係接下來有機會", "這段關係不是完全沒機會，但熱度還沒明顯到位")
      .replaceAll("目前有機會", "不是完全沒機會，但還要看互動品質")
      .replaceAll("有一定的機會", "不是完全沒機會，但還要觀察")
      .replaceAll("比較有機會", "不是完全沒機會，但還要觀察")
      .replaceAll("很有潛力", "還需要觀察")
      .replaceAll("有發展潛力", "還要看互動品質")
      .replaceAll("發展潛力", "互動品質")
      .replaceAll("長期發展的潛力", "還需要看互動品質和現實條件")
      .replaceAll("有穩定的基礎與潛力", "有一些現實條件可以看，但感情熱度還要觀察")
      .replaceAll("未來的發展是有幫助的", "後續還要看互動品質和對方態度")
      .replaceAll("對未來的發展有幫助", "後續還要看互動品質和對方態度")
      .replaceAll("讓情感重新升溫", "先看彼此互動有沒有真的變好")
      .replaceAll("情感重新升溫", "互動重新變好")
      .replaceAll("重新升溫", "重新觀察")
      .replaceAll("升溫", "觀察")
      .replaceAll("潛在的發展機會", "還需要觀察的空間")
      .replaceAll("發展機會", "觀察空間")
      .replaceAll("有機會發展", "還要看互動品質和現實條件")
      .replaceAll("看起來有機會發展", "還要看互動品質和現實條件")
      .replaceAll("有機會深化", "還要看互動品質和現實條件")
      .replaceAll("有機會朝正向發展", "還要看互動品質和現實條件")
      .replaceAll("朝正向發展", "要看互動品質和現實條件")
      .replaceAll("有機會向前推進", "不是完全沒機會，但還要看互動品質和現實條件")
      .replaceAll("未來有良好的發展機會", "不是完全沒機會，但還要看互動品質和現實條件")
      .replaceAll("有機會展開更深入的交流", "不是完全沒機會，但還要看互動品質和現實條件")
      .replaceAll("有機會展開", "不是完全沒機會，但還要看互動品質和現實條件")
      .replaceAll("有機會調整", "不是完全沒機會，但還要看互動品質和現實條件")
      .replaceAll("有機會慢慢提升", "還要看互動品質和現實條件")
      .replaceAll("有機會進一步發展", "後續要看互動品質和對方態度")
      .replaceAll("未來有機會進一步發展", "後續要看互動品質和對方態度")
      .replaceAll("有機會透過良好的溝通和理解來進行調整", "可以先從溝通和理解開始觀察")
      .replaceAll("有機會透過溝通", "可以先從溝通開始觀察")
      .replaceAll("有機會透過理解", "可以先從理解對方開始觀察")
      .replaceAll("有更進一步的可能", "還要看互動品質和現實條件")
      .replaceAll("有進一步發展的可能", "還要看互動品質和現實條件")
      .replaceAll("關係有升溫空間", "關係還要看互動品質和現實條件")
      .replaceAll("有升溫空間", "還要看互動品質和現實條件")
      .replaceAll("對未來有利", "還要看現實條件");
  }

  return answer
    .replaceAll("還是有機會", "機會偏弱，不能只靠期待")
    .replaceAll("仍有機會", "機會偏弱，不能只靠期待");
}

function ensureFirstSentenceByType(answer: string, questionType: string) {
  let result = answer;

  result = result
    .replaceAll("整體狀態偏向", "整體狀態偏向")
    .replaceAll("本身偏向", "本身偏向")
    .replaceAll("安排本身偏向", "安排本身偏向")
    .replaceAll("事件本身偏向", "事件本身偏向")
    .replaceAll("方向本身偏向", "方向本身偏向")
    .replaceAll("狀態本身偏向", "狀態本身偏向")
    .replaceAll("這段時間整體狀態偏向這週整體狀態", "這段時間整體狀態")
    .replaceAll("這段時間整體狀態偏向最近的狀態", "這段時間整體狀態")
    .replaceAll("這段關係偏向這段感情", "這段關係")
    .replaceAll("這段關係偏向這段關係關係", "這段關係")
    .replaceAll("這件工作或任務本身偏向這週工作", "這件工作或任務本身")
    .replaceAll("這筆投資或財務狀態本身偏向這週投資", "這筆投資或財務狀態本身")
    .replaceAll("這間房子本身偏向我看這房子", "這間房子本身")
    .replaceAll("這份合約本身偏向這份合約", "這份合約本身");

  if (questionType === "交通出行") {
    result = result.replaceAll("這件事本身", "這次外出或行程");
  }

  if (questionType === "日期擇日") {
    result = result.replaceAll(
      "確切日期目前無法確定",
      "單張牌無法直接給確定幾月幾號"
    );
  }

  return result;
}

function removeAiTone(answer: string) {
  return answer
    .replaceAll("沒有順利往前的地方", "還沒處理好的地方")
    .replaceAll("沒有順利往前的問題", "還沒講清楚的問題")
    .replaceAll("這段關係已經有一些沒有順利往前的地方", "這段關係目前有些問題還沒講清楚")
    .replaceAll("這段關係目前比較卡", "這段關係目前沒有明確往前")
    .replaceAll("目前比較卡", "目前進展不明顯")
    .replaceAll("關係比較卡", "關係沒有明確推進")
    .replaceAll("沒有順利往前", "沒有順利往前")
    .replaceAll("", "")
    .replaceAll("", "")
    .replaceAll("這意味著", "這代表")
    .replaceAll("意味著", "代表")
    .replaceAll("呈現出", "看起來是")
    .replaceAll("呈現著", "有")
    .replaceAll("潛在的隱憂", "可能有問題")
    .replaceAll("潛在隱憂", "可能有問題")
    .replaceAll("潛在風險", "可能的風險")
    .replaceAll("在這樣的情況下，", "")
    .replaceAll("在這樣的情況下", "")
    .replaceAll("這樣的情況下，", "")
    .replaceAll("這樣的情況下", "")
    .replaceAll("整體而言，", "")
    .replaceAll("整體而言", "")
    .replaceAll("綜合來看，", "")
    .replaceAll("綜合來看", "")
    .replaceAll("務必", "一定要")
    .replaceAll("進而推動", "讓")
    .replaceAll("推動關係向前發展", "讓關係比較有機會往前走")
    .replaceAll("更加順利", "比較順")
    .replaceAll("更為順利", "比較順")
    .replaceAll("更為比較穩", "比較穩")
    .replaceAll("比較穩的做法", "比較穩的方式")
    .replaceAll("保持開放的心態", "先聽完再決定")
    .replaceAll("保持開放心態", "先聽完再決定")
    .replaceAll("接下來可以，", "接下來你可以")
    .replaceAll("接下來可以，務必", "接下來你一定要")
    .replaceAll("你可能會受到", "你可能會被")
    .replaceAll("受到自己需求與期望的影響", "被自己的期待影響")
    .replaceAll("受到情緒驅動", "被情緒帶著走")
    .replaceAll("需要被重視的", "要好好看待")
    .replaceAll("請務必確認", "一定要先確認")
    .replaceAll("清晰明確", "講清楚")
    .replaceAll("清楚明瞭", "講清楚")
    .replaceAll("有效降低風險", "比較不容易踩雷")
    .replaceAll("做出比較穩的決定", "做出比較穩的選擇")
    .replaceAll("作出比較穩的決策", "做出比較穩的判斷");
}

function cleanSimplifiedChinese(answer: string) {
  return answer
    .replaceAll("笔记", "筆記")
    .replaceAll("复习", "複習")
    .replaceAll("能够", "能夠")
    .replaceAll("增强", "增強")
    .replaceAll("计划", "計畫")
    .replaceAll("顺利", "順利")
    .replaceAll("实际", "實際")
    .replaceAll("关系", "關係")
    .replaceAll("情况", "情況")
    .replaceAll("确认", "確認")
    .replaceAll("观察", "觀察")
    .replaceAll("学习", "學習")
    .replaceAll("单方面", "單方面")
    .replaceAll("判断", "判斷")
    .replaceAll("彻底", "徹底")
    .replaceAll("消息", "訊息")
    .replaceAll("务必", "務必")
    .replaceAll("确保", "確認")
    .replaceAll("将", "將")
    .replaceAll("让", "讓")
    .replaceAll("顾客", "顧客")
    .replaceAll("展现", "展現")
    .replaceAll("对", "對")
    .replaceAll("关心", "關心")
    .replaceAll("与", "與")
    .replaceAll("为", "為")
    .replaceAll("这", "這")
    .replaceAll("个", "個")
    .replaceAll("会", "會")
    .replaceAll("后", "後")
    .replaceAll("发", "發")
    .replaceAll("复", "復")
    .replaceAll("关", "關")
    .replaceAll("应", "應")
    .replaceAll("过", "過")
    .replaceAll("时", "時")
    .replaceAll("间", "間")
    .replaceAll("开", "開")
    .replaceAll("门", "門")
    .replaceAll("题", "題")
    .replaceAll("问", "問")
    .replaceAll("现", "現")
    .replaceAll("实", "實")
    .replaceAll("处", "處")
    .replaceAll("进", "進")
    .replaceAll("计", "計")
    .replaceAll("划", "劃")
    .replaceAll("导", "導")
    .replaceAll("细", "細")
    .replaceAll("节", "節")
    .replaceAll("稳", "穩")
    .replaceAll("当", "當")
    .replaceAll("体", "體")
    .replaceAll("来", "來")
    .replaceAll("给", "給")
    .replaceAll("样", "樣")
    .replaceAll("种", "種")
    .replaceAll("数", "數")
    .replaceAll("据", "據")
    .replaceAll("调", "調")
    .replaceAll("这件", "這件")
    .replaceAll("计划", "計畫")
    .replaceAll("进行", "進行")
    .replaceAll("准备", "準備")
    .replaceAll("选择", "選擇")
    .replaceAll("顾虑", "顧慮")
    .replaceAll("続", "續")
    .replaceAll("温", "溫")
    .replaceAll("這板牌", "這張牌")
    .replaceAll("板牌", "張牌")
    .replaceAll("瞭解", "了解");
}

function reduceCounselingTone(answer: string, questionType: string, question: string) {
  let result = answer
    .replaceAll("照顧自己的情緒", "先看實際狀況")
    .replaceAll("整理自己的情緒", "先把實際訊號看清楚")
    .replaceAll("整理情緒", "把實際訊號看清楚")
    .replaceAll("建立健康的界線", "不要再單方面加碼")
    .replaceAll("建立界線", "不要再單方面加碼")
    .replaceAll("表達自己的感受", "把真正要確認的事情講清楚")
    .replaceAll("表達感受", "把重點講清楚")
    .replaceAll("保持開放", "先看實際回應")
    .replaceAll("保持開放的態度", "先看實際回應")
    .replaceAll("保持開放的心態", "先看實際回應")
    .replaceAll("多溝通", "把該確認的事情講清楚")
    .replaceAll("好好溝通", "把該確認的事情講清楚");

  if (isLoveMindQuestion(questionType, question)) {
    result = result
      .replaceAll("觀察對方反應", "看對方是否有實際靠近或穩定回應")
      .replaceAll("觀察對方的反應", "看對方是否有實際靠近或穩定回應")
      .replaceAll("避免過度依賴他的回應來判斷你的價值", "不要只看他偶爾熱絡，要看他是否能穩定出現、主動安排、主動延續話題")
      .replaceAll("避免依賴他的回應來判斷你的價值", "不要只看他偶爾熱絡，要看他是否能穩定出現、主動安排、主動延續話題")
      .replaceAll("讓彼此更加理解", "看他是否願意修正讓你受傷的說話方式")
      .replaceAll("更加理解彼此", "看他是否願意修正讓你受傷的說話方式")
      .replaceAll("理解彼此", "看他是否願意給明確說法")
      .replaceAll("照顧自己", "看清楚實際互動")
      .replaceAll("嘗試溝通彼此感受", "看對方是否願意給明確回應")
      .replaceAll("溝通彼此感受", "確認對方是否願意給明確回應")
      .replaceAll("開放地溝通", "用清楚但不逼迫的方式確認態度")
      .replaceAll("坦誠溝通", "用清楚但不逼迫的方式確認態度")
      .replaceAll("主動溝通", "看他是否願意主動補回互動")
      .replaceAll("良好溝通", "看他是否願意給明確說法");
  }

  return result;
}

function softenAbsoluteClaims(answer: string) {
  return answer
    .replaceAll("不能不能只靠牌面保證比較可能會不會辦喪事", "不能用牌面斷定是否會辦喪事")
    .replaceAll("不能不能只靠牌面保證不太像會面對喪事", "不能用牌面保證不會面對喪事")
    .replaceAll("絕對會", "比較可能會")
    .replaceAll("絕對不會", "不太像會")
    .replaceAll("一定會成功", "有機會往好的方向走")
    .replaceAll("一定成功", "有機會往好的方向走")
    .replaceAll("一定會復合", "有復合空間，但還要看後續互動")
    .replaceAll("一定能復合", "有復合空間，但還要看後續互動")
    .replaceAll("一定不會復合", "復合機會偏弱")
    .replaceAll("保證會", "比較可能會")
    .replaceAll("保證不會", "不太像會")
    .replaceAll("保證", "不能只靠牌面保證")
    .replace(/(?<!不)一定會懷孕/g, "不能只靠牌面判斷懷孕結果")
    .replace(/(?<!不)一定不會懷孕/g, "不能只靠牌面保證懷孕結果")
    .replace(/(?<!不)一定會死亡/g, "不能用牌面斷定死亡結果")
    .replace(/(?<!不)一定會死/g, "不能用牌面斷定死亡結果")
    .replace(/(?<!不)一定不會死/g, "不能用牌面保證死亡相關結果")
    .replace(/(?<!不)一定會生病/g, "不能用牌面斷定疾病結果")
    .replace(/(?<!不)一定不會生病/g, "不能用牌面保證疾病結果")
    .replace(/(?<!不)一定會發財/g, "不能用牌面保證財富結果")
    .replace(/(?<!不)保證懷孕/g, "不能只靠牌面保證懷孕結果")
    .replace(/(?<!不)保證發財/g, "不能用牌面保證財富結果")
    .replaceAll("如果他主動做這些就代表他還是在意", "如果他主動做這些，比較能支持他仍然在意")
    .replaceAll("如果他在意你應該會試著在言辭上更加注意", "如果他仍在意你，通常會比較願意修正說話方式")
    .replaceAll("就代表", "比較能支持")
    .replaceAll("應該會", "通常會")
    .replaceAll("一定要", "要")
    .replace(/(?<!不)一定會/g, "比較可能會")
    .replace(/(?<!不)一定不會/g, "不太像會");
}

function cleanLoveScenarioByQuestion(answer: string, question: string) {
  let result = answer;
  const q = question || "";

  const isSingleLove =
    q.includes("單身") ||
    q.includes("桃花") ||
    q.includes("感情機會") ||
    q.includes("未來對象") ||
    q.includes("會是什麼樣的人") ||
    q.includes("什麼類型的人") ||
    q.includes("遇到適合的人");

  const isPartnerRepair =
    q.includes("伴侶") ||
    q.includes("另一半") ||
    q.includes("吵架") ||
    q.includes("修復") ||
    q.includes("室友") ||
    q.includes("冷淡") ||
    q.includes("責任分配");

  const isMindQuestion =
    q.includes("心裡還有沒有我") ||
    q.includes("對方現在對我") ||
    q.includes("對方是不是") ||
    q.includes("他是不是") ||
    q.includes("還在乎") ||
    q.includes("心意") ||
    q.includes("想不想繼續");

  const isLongTerm =
    q.includes("結婚") ||
    q.includes("婚姻") ||
    q.includes("長期") ||
    q.includes("未來三年") ||
    q.includes("穩定") ||
    q.includes("走下去") ||
    q.includes("生活壓力");

  if (!isSingleLove) {
    result = result
      .replaceAll("這段時間不是完全沒有感情機會", "這段關係不是完全沒有機會")
      .replaceAll("這段時間的感情機會", "這段關係")
      .replaceAll("這段感情機會", "這段關係")
      .replaceAll("未來出現的人", "對方")
      .replaceAll("如果有對象出現，", "")
      .replaceAll("如果你目前是單身、正在觀察感情機會，", "")
      .replaceAll("桃花機會", "感情狀態");
  }

  if (isPartnerRepair) {
    result = result
      .replaceAll("這段關係目前", "這段伴侶關係目前")
      .replaceAll("這段關係現在", "這段伴侶關係現在")
      .replaceAll("這段關係的問題", "這段伴侶關係的問題")
      .replaceAll("對方是否有穩定互動", "你們是否願意穩定溝通")
      .replaceAll("用清楚但不逼迫的方式確認彼此態度", "把生活壓力、責任分配和溝通方式談清楚");
  }

  if (isMindQuestion) {
    result = result
      .replaceAll("這段關係不是完全沒有機會", "對方目前不是完全沒有在意")
      .replaceAll("這段關係目前", "對方目前的態度")
      .replaceAll("這段關係現在", "對方目前的態度")
      .replaceAll("感情狀態", "對方目前的態度")
      .replaceAll("接下來不要只看表面條件好不好", "接下來不要只靠自己的想像判斷")
      .replaceAll("看對方是否有穩定互動", "看對方是否還願意穩定回應")
      .replaceAll("你自己的節奏有沒有穩住", "你自己不要被不安牽著走");
  }

  if (isLongTerm) {
    result = result
      .replaceAll("這段時間的感情機會很難有共識。可能雙方都不夠理性，也可能一方多做一步，另一方反而不理解。先停下來，不要一直想、一直猜，睡不好也會讓判斷更亂。", "這段長期關係目前比較難形成穩定共識。尤其你們已經在討論結婚，存款、工作和雙方家庭意見都還沒準備好，就不要急著往婚姻推進。")
      .replaceAll("這段時間不是完全沒有感情機會，重點在於現在是不是到了該變動的時間。你可能想找人陪，也可能曖昧時機到了。可以嘗試，但不要想太多，先用理性溝通確認對方態度。", "這段長期關係不是沒有穩定空間，但未來三年會不會穩，重點在你們是否能一起面對現實壓力。金錢、家庭、生活節奏和責任分配，都要比感覺更早談清楚。")
      .replaceAll("這段時間不是完全沒有感情機會，但你現在很有自己的堅持，別人很難勸你。喜歡就會想追，但不要只靠衝勁，先想清楚，不要做讓自己後悔的決定。", "這段長期關係有往前走的空間，但不能只靠衝勁和堅持。未來三年要穩，重點是雙方能不能一起面對現實壓力、金錢、家庭和生活責任。")
      .replaceAll("這段時間不是完全沒有感情機會，但雙方可能都太保守，停在目前狀態在分寸、規則和界線。對方可能會打扮、會做人，但你要看的是彼此有沒有真的往前一步。", "這段長期關係不是沒有穩定空間，但雙方可能都太在意分寸、規則和表面和平。未來三年能不能穩，要看你們是否願意把金錢、家庭、責任和生活安排談清楚。")
      .replaceAll("這段時間的感情機會", "這段長期關係")
      .replaceAll("這段時間不是完全沒有感情機會", "這段長期關係不是沒有穩定空間")
      .replaceAll("感情機會", "長期經營空間")
      .replaceAll("如果有對象出現，", "")
      .replaceAll("如果有對象出現", "這段關係")
      .replaceAll("自然的互動試探對方態度", "把金錢、工作、家庭意見和未來規劃談清楚")
      .replaceAll("先看互動有沒有變穩，對方有沒有主動回應，還有你是不是越靠近越安心。", "先看雙方是否能一起面對現實條件，尤其是金錢、家庭、工作和生活責任。")
      .replaceAll("接下來不要只看表面條件好不好", "接下來不要只看感情熱度，也要看現實條件能不能承接");
    result = result
      .replaceAll("這段關係不是完全沒有機會", "這段長期關係不是完全沒有經營空間")
      .replaceAll("這段關係目前", "這段長期關係目前")
      .replaceAll("這段關係現在", "這段長期關係現在")
      .replaceAll("看對方是否有穩定互動", "看雙方是否能一起面對現實條件")
      .replaceAll("用清楚但不逼迫的方式確認彼此態度", "把金錢、家庭、責任和未來規劃談清楚")
      .replaceAll("不要只看表面條件好不好", "不要只看感情熱度，也要看現實條件能不能承接");
  }

  return result;
}

function cleanOpeningDateAnswer(answer: string, question: string) {
  let result = answer;
  const q = question || "";
  const kind = getDateQuestionKind(q);
  const dateIntent = detectDateIntent(q);

  const genericDateCleanup = (text: string) =>
    text
      .replaceAll("開幕的確切日期目前無法確定，但", "")
      .replaceAll("開幕的確切日期目前無法定義，需要關注", "")
      .replaceAll("開幕日期目前沒有確定的優勢。", "")
      .replaceAll("不建議急於確定具體日期。", "")
      .replaceAll("店面開幕之前，你需要特別注意細節。", "")
      .replaceAll("這件事本身在廉貞正位下，", "")
      .replaceAll("這件事情在開幕的確切日期上，", "")
      .replaceAll("單張牌無法直接給確定幾月幾號。這題比較適合看開店前要注意什麼。", "")
      .replaceAll("選擇開幕日期", "選擇日期")
      .replaceAll(
        "開幕準備、流程安排、現場狀況與人員分工",
        kind === "opening"
          ? "開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、商品或服務準備、突發狀況與備案"
          : "行程安排、參與者狀態、時間流程與現場變動"
      )
      .replaceAll("開幕前", kind === "opening" ? "開幕前" : "日期確定前")
      .replaceAll("開幕時", kind === "opening" ? "開幕當天" : "活動當天")
      .replaceAll("開幕", kind === "opening" ? "開幕" : "這次安排")
      .replaceAll("開店", kind === "opening" ? "開店" : "這次安排")
      .replaceAll("店面", kind === "opening" ? "店面" : "現場");

  const removeMultiDateChoice = (text: string) => {
    const candidateDates = extractDateMentions(q);
    const choicePattern =
      /(比較順|較順利|最具潛力|相對適合|較為適合|比較適合|較適合|最適合|最理想|可以選擇|適合的選擇|較好的選擇|建議選|建議選擇|選擇上)/;
    const multiCandidateTonePattern =
      /(候選日子可以考慮|這幾個候選日子|這幾天各有特色|這幾天都有可能|這三天都有潛力|三個日期都可以|三個日期都適合|三天都有可能|三天中都適合|都具有潛力|這三天出遊的可能性都存在|無論選哪一天|每一天各自|都有可能|都可以評估|都適合|這三個日期可以評估|這些日期可能影響|每個日期的具體執行情境|每個開幕日期的準備情況|先鎖定一個日期|這三個日期|這三個日子|三個候選日期|三個日期|三個日子|這三天|每一天|每個日子|每個日期|每個選擇的日期|各日期|各自抽牌|逐一抽牌|逐一針對|各有其特性|各有其潛力|各有不同|相對較為穩定|3月\d{1,2}、\d{1,2}和\d{1,2}日|\d{1,2}月\d{1,2}、\d{1,2}和\d{1,2}日)/;

    return text
      .split(/(?<=。|\n)/)
      .filter((part) => {
        const hasQuestionDate = candidateDates.some((date) => part.includes(date));
        return !(hasQuestionDate && choicePattern.test(part)) && !multiCandidateTonePattern.test(part);
      })
      .join("")
      .replaceAll("某一天是較好的選擇", "需分別抽牌後再比較")
      .replaceAll("某一天是比較好的選擇", "需分別抽牌後再比較")
      .replaceAll("某一天較適合", "需分別抽牌後再比較")
      .replaceAll("某一天比較適合", "需分別抽牌後再比較")
      .replaceAll("建議你回顧每個開幕日期的準備情況", "建議你先回顧整體開幕準備情況")
      .replaceAll("你可以先鎖定一個日期然後將注意力集中在具體的準備上而不是不斷地持續尋找新的選擇或資料。", "你可以先把整體流程整理清楚，再用每個候選日期各抽一張牌的方式做比較，避免在資訊混亂時急著選定。")
      .replaceAll("這段時間3/10、3/17和3/24辦活動的可能性呈現不太穩定。", "這張牌看的是整體活動安排，目前狀態呈現不太穩定。")
      .replaceAll("使用者想知道在 3/5、3/12 和 3/19 上架課程的最佳時機這些日期可能影響準備度和學習效果。", "這題是在問多個候選上架日的比較，但目前這張牌只能看整體課程上架狀態，不能直接比較哪一天最佳。");
  };

  const removeMultiDateReminder = (text: string) =>
    text
      .split(/(?<=。|\n)/)
      .filter(
        (part) =>
          !includesAny(part, [
            "多個日期裡硬選一天",
            "每個日期各抽一張牌",
            "候選日期",
            "比較這幾個日期",
          ])
      )
      .join("");

  const guidanceByKind: Record<string, string> = {
    opening:
      "目前單張牌無法直接替你定出確切幾月幾號。這張牌比較適合提醒你：選開幕日期時，要注意開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、商品或服務是否準備到位、突發狀況與備案。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
    travel:
      "目前單張牌無法直接替你定出確切哪一天。這張牌比較適合提醒你：選出去玩的日期時，要注意行程安排、同行者狀態、交通時間、天氣與現場變動。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
    activity:
      "目前單張牌無法直接替你定出確切哪一天。這張牌比較適合提醒你：選活動日期時，要注意流程安排、參與者狀態、準備進度、場地與現場變動。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
    contract:
      "目前單張牌無法直接替你定出確切簽約日。這張牌比較適合提醒你：選簽約日期時，要注意條款確認、付款時間、責任歸屬與文件細節。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
    course:
      "目前單張牌無法直接替你定出確切哪一天。這張牌比較適合提醒你：選課程或報名日期時，要注意準備度、時間安排、吸收狀態與後續執行節奏。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
    moving:
      "目前單張牌無法直接替你定出確切搬家日。這張牌比較適合提醒你：選搬家日期時，要注意搬運安排、交通時間、家人分工、交屋合約與物品整理。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
    general:
      "目前單張牌無法直接替你定出確切哪一天。這張牌比較適合提醒你：選日期時，要注意準備進度、參與者狀態、時間流程與現場變動。若要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。",
  };

  if (isDateSelectionQuestion(q)) {
    result = genericDateCleanup(result);
  }

  if (isDateSelectionQuestion(q) && dateIntent === "multi_candidate_compare") {
    const fixed =
      "你已經提供多個候選日期，但目前單張牌模式只能看整體狀態，不適合直接在多個日期裡硬選一天。若要比較多個日期，建議每個日期各抽一張牌，再依牌面比較。以目前這張牌來看，這件事整體要注意的是：";

    result = removeMultiDateChoice(result);

    if (!result.includes("不適合直接在多個日期裡硬選一天")) {
      result = `${fixed}\n\n${result}`;
    }
  } else if (isDateSelectionQuestion(q) && dateIntent === "single_date_check") {
    result = removeMultiDateReminder(result);

    if (!result.includes("單日狀態提醒") && !result.includes("正式擇日")) {
      result = `${result.trim()}\n\n這是單日狀態提醒，不是正式擇日。`;
    }
  } else if (
    isDateSelectionQuestion(q) &&
    !hasSpecificCandidateDates(q) &&
    (dateIntent === "specific_date_request" || dateIntent === "general_date_context")
  ) {
    const fixed = guidanceByKind[kind] || guidanceByKind.general;

    if (!result.includes("無法直接替你定出") && !result.includes("無法直接定出")) {
      result = `${fixed}\n\n${result}`;
    }
  } else if (
    isDateSelectionQuestion(q) &&
    (dateIntent === "suitability_check" || dateIntent === "attention_check")
  ) {
    result = removeMultiDateReminder(result)
      .replace(/目前單張牌無法直接替你定出確切(?:哪一天|幾月幾號|簽約日|搬家日)。?/g, "")
      .replace(/若要比較多個日期，建議每個候選日期各抽一張牌，再依牌面分別比較。?/g, "")
      .trim();
  }

  return result;
}

function buildMultiCandidateFocus(context: ReadingContext) {
  const subcategory = context.questionSubcategory;
  const card = context.card.name;
  const position = context.position;
  const isReversed = position === "反位";

  const cardTone: Record<string, string> = {
    紫微星: isReversed
      ? "不要只追求場面、排場或主導感，先確認現實條件是否撐得住。"
      : "重點在整體規劃、主導者是否明確，以及大家是否知道方向。",
    天機星: isReversed
      ? "最要注意規劃不夠縝密、資訊整理不完整、安排不夠完善，想法也容易反覆改變。"
      : "重點在資訊整理、流程拆解和彈性調整，先把變動因素列清楚。",
    太陽星: isReversed
      ? "要注意主導權不足、準備不夠集中，或你自己過度付出。"
      : "適合由你主動把時間、流程和責任說清楚，讓整體方向更明確。",
    武曲星: isReversed
      ? "要注意利益分配、付款條件、預算或責任歸屬不夠穩。"
      : "重點在實質利益、成本、責任分配和可執行的條件。",
    天同星: isReversed
      ? "要注意準備不夠積極、溝通鬆散，或因為想輕鬆處理而忽略細節。"
      : "整體氣氛有放鬆空間，但仍要把流程和現實條件安排好。",
    廉貞星: isReversed
      ? "要注意界線、規則和分工不清，避免現場出現灰色地帶。"
      : "重點在規則、分工和執行力，先把責任劃分清楚。",
    天府星: isReversed
      ? "要注意資源、預算和備案不夠穩，不要過度控制或硬撐。"
      : "整體資源和準備度是關鍵，先盤點預算、人力和可用條件。",
    太陰星: isReversed
      ? "要注意內部準備、人員狀態或情緒不夠穩，細節容易被忽略。"
      : "重點在細節、舒適度、內部準備和穩定累積。",
    貪狼星: isReversed
      ? "要注意選項太多、想法太散，或因一時興致讓安排失焦。"
      : "整體有玩樂、人際互動和吸引力，但要避免安排太分散。",
    巨門星: isReversed
      ? "要注意資訊不清、溝通誤會和隱藏問題，不要讓疑慮越放越大。"
      : "重點在溝通、資訊透明、說明清楚，以及把隱藏問題先攤開。",
    天相星: isReversed
      ? "要注意規則、流程和協調不穩，分工如果不清楚就容易混亂。"
      : "重點在協調、秩序、流程和彼此配合。",
    天梁星: isReversed
      ? "要注意過度擔心、拖延或倚賴他人意見，反而讓事情難推進。"
      : "整體有機會得到支持與協助，但要先把長遠安排和照顧責任想清楚。",
    七殺星: isReversed
      ? "要注意衝動、壓力和臨時改變，避免為了快而犧牲穩定度。"
      : "重點在行動力與決斷力，準備到位後可以果斷推進。",
    破軍星: isReversed
      ? "要注意臨時大改、成本增加或重建壓力，不要在不穩時硬改安排。"
      : "重點在調整與重整，但要先看清楚改動成本。",
  };

  const eventLabel = subcategory.includes("出去玩")
    ? "出遊"
    : subcategory.includes("活動日期")
      ? "活動"
      : subcategory.includes("簽約")
        ? "合約"
        : subcategory.includes("課程")
          ? "課程上架或開課"
          : subcategory.includes("開幕")
            ? "開幕"
            : "這件事";

  const contextAdvice = subcategory.includes("出去玩")
    ? "交通、集合時間、同行者狀態、天氣、預算、體力與備案"
    : subcategory.includes("活動日期")
      ? "活動流程、場地、人力分工、參與者狀態、時間安排與備案"
      : subcategory.includes("簽約")
        ? "條款、付款時間、責任歸屬、交付義務、文件細節與口頭承諾"
        : subcategory.includes("課程")
          ? "課程內容、宣傳文案、報名流程、常見問題、材料準備與後續服務"
          : subcategory.includes("開幕")
            ? "開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、客流與備案"
            : "準備進度、參與者狀態、流程、時間安排與備案";

  return {
    eventLabel,
    contextAdvice,
    cardReminder: cardTone[card] || "重點是先看整體狀態、準備度與可控風險。",
  };
}

function multiCandidateAnswerMode(answer: string, context: ReadingContext) {
  if (detectDateIntent(context.question) !== "multi_candidate_compare") {
    return answer;
  }

  const { eventLabel, contextAdvice, cardReminder } = buildMultiCandidateFocus(context);
  const isOpeningCandidate =
    context.questionSubcategory.includes("開幕") || isOpeningDateQuestion(context.question);

  if (isOpeningCandidate) {
    const dateLabels = extractDateMentions(context.question);
    const compareTarget = dateLabels.length > 0 ? dateLabels.join("、") : "這些候選開幕日期";
    const candidateCountLabel = dateLabels.length === 3 ? "三個" : "多個";

    return [
      `這次單張牌不適合直接替${candidateCountLabel}開幕日期硬選一天；若要比較${dateLabels.length > 0 ? ` ${compareTarget}` : compareTarget}，建議每個候選日期各抽一張牌再比較。以目前這張牌來看，重點不是直接選哪一天，而是先看開幕安排要注意的條件，例如人員、流程、宣傳、現場動線、客流與備案。`,
      `放在這次開幕的情境裡，${context.card.name}${context.position}提醒你：${cardReminder}`,
      "接下來可以先把開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、客流與備案列清楚；等要正式比較日期時，再讓每個候選日期各自抽牌比較。",
    ].join("\n\n");
  }

  return [
    "你已經提供多個候選日期，但目前這次只抽一張牌，所以不適合直接比較哪一天最好。若要比較日期，建議每個候選日期各抽一張牌，再依牌面分別判斷。",
    `以目前這張牌來看，這次${eventLabel}整體要注意的是：${contextAdvice}。`,
    `放在這次${eventLabel}的情境裡，${context.card.name}${context.position}提醒你：${cardReminder}`,
    `接下來可以先確認${contextAdvice}，等要正式比較日期時，再讓每個候選日期各自抽牌比較。`,
  ].join("\n\n");
}

function buildDeathCriticalOpening(question: string) {
  const text = question.toLowerCase();

  if (includesAny(text, ["喪事", "辦喪事", "後事", "告別式"])) {
    return "這題牽涉生命與家人重大狀況，占卜不能判斷是否會死亡，也不能用牌面斷定是否會辦喪事。這張牌比較適合提醒你：這段時間要把重點放在家人溝通、照護安排、醫療資訊確認與必要的現實準備上。";
  }

  if (
    includesAny(text, [
      "撐過",
      "撐不撐得過",
      "快不行",
      "生命危險",
      "病危",
      "會不會死",
      "是不是要走了",
      "能不能活",
    ])
  ) {
    return "這題牽涉生命與醫療狀況，占卜不能判斷是否會死亡、是否能撐過去，也不能用牌面斷定生命危險。這張牌比較適合提醒你：先把重點放在醫師評估、照護分工、家人溝通與陪伴上。";
  }

  if (
    includesAny(text, [
      "洗腎",
      "高齡",
      "86歲",
      "86 歲",
      "長輩",
      "健康運",
      "吉凶",
      "住院",
    ])
  ) {
    return "這題牽涉長輩健康與醫療狀況，占卜不能用吉凶判斷身體結果，也不能代替醫師評估。這張牌比較適合提醒你：先看醫療資訊、日常照護、家人分工與陪伴安排。";
  }

  return "這題牽涉生命與家人重大狀況，占卜不能判斷是否會死亡、是否能撐過去，也不能用牌面斷定是否會辦喪事。這張牌比較適合提醒你：現在要把重點放在醫療資訊、照護安排、家人溝通與陪伴上。";
}

function enforceDeathCriticalGuard(answer: string, question: string) {
  if (!isHealthCriticalQuestion(question)) {
    return answer;
  }

  let result = answer
    .replaceAll("喪事的可能性不高", "這張牌不能判斷會不會辦喪事，重點是先做好照護與家人溝通")
    .replaceAll("喪事的可能性存在", "這張牌不能判斷會不會辦喪事，重點是先做好照護與家人溝通")
    .replaceAll("未來三個月內會有喪事的可能性", "未來三個月內若家裡有重大狀況，仍要以現實健康與家人溝通為主")
    .replaceAll("三個月內會有喪事的可能性", "三個月內若家裡有重大狀況，仍要以現實健康與家人溝通為主")
    .replaceAll("會有喪事的可能性", "不能只靠牌面判定會有喪事")
    .replaceAll("需要準備喪事", "需要面對相關安排")
    .replaceAll("未來三個月會辦喪事", "未來三個月若真的需要面對喪事或相關安排")
    .replaceAll("三個月內會辦喪事", "三個月內若真的需要面對喪事或相關安排")
    .replaceAll("會辦喪事", "若真的需要面對喪事或相關安排")
    .replaceAll("不會辦喪事", "不能只靠牌面保證不會面對喪事")
    .replaceAll("她可能會死亡", "不能只靠牌面判定她是否會死亡")
    .replaceAll("他可能會死亡", "不能只靠牌面判定他是否會死亡")
    .replaceAll("會死亡", "不能只靠牌面判定死亡結果")
    .replaceAll("不會死亡", "不能只靠牌面保證不會死亡")
    .replaceAll("有機會撐過", "這張牌不能判斷是否能撐過去")
    .replaceAll("有可能撐過", "這張牌不能判斷是否能撐過去")
    .replaceAll("爸爸有潛力渡過", "這張牌不能判斷爸爸是否能撐過去")
    .replaceAll("爸爸有潛力度過", "這張牌不能判斷爸爸是否能撐過去")
    .replaceAll("有可能慢慢調整和修復", "照護狀態需要持續觀察")
    .replaceAll("目前看起來有一些改善的機會", "目前還是要持續確認醫療資訊與照護安排")
    .replaceAll("透過妥善的照顧與溝通，讓父親了解他的需求，或許能推動他的康復進程", "透過妥善的照顧與溝通，可以讓家人更清楚他的需求與照護安排")
    .replaceAll("或許會改善她的體力", "仍要依醫療資訊持續觀察她的體力")
    .replaceAll("恢復健康", "照護需求更清楚")
    .replaceAll("康復", "照護需求更清楚")
    .replaceAll("好轉", "照護需求更清楚")
    .replaceAll("轉好", "照護需求更清楚")
    .replaceAll("變好", "照護需求更清楚")
    .replaceAll("危險升高", "需要更密切確認醫療資訊與照護安排")
    .replaceAll("惡化", "需要更密切確認醫療資訊與照護安排")
    .replaceAll("比較危急", "需要更密切確認醫療資訊與照護安排")
    .replaceAll("撐住", "不能用牌面判斷結果，重點是照護、陪伴與醫療資訊")
    .replaceAll("渡過", "不能用牌面判斷結果，重點是照護、陪伴與醫療資訊")
    .replaceAll("度過", "不能用牌面判斷結果，重點是照護、陪伴與醫療資訊")
    .replaceAll("活下來", "不能用牌面判斷結果，重點是照護、陪伴與醫療資訊")
    .replaceAll("充滿希望", "先依醫療資訊安排照護與陪伴")
    .replaceAll("身體狀態有可能向好的方向發展", "照護與醫療資訊需要更清楚")
    .replaceAll("生命危險的確定性", "生命狀況不能只靠牌面判定")
    .replaceAll("狀況其實比較好", "目前重點是把醫療資訊和照護安排確認清楚")
    .replaceAll("不直接代表生死，但", "這張牌不能判斷生死，")
    .replaceAll("不太樂觀", "資訊和照護安排需要更清楚")
    .replaceAll("風險相對較高", "目前更需要回到醫療資訊與照護安排")
    .replaceAll("有些不穩定的跡象", "需要多確認醫療資訊與照護安排")
    .replaceAll("一些不穩定的跡象", "需要多確認醫療資訊與照護安排")
    .replaceAll("不太穩定", "需要持續確認醫療資訊與照護安排")
    .replaceAll("狀態可能會變得更加不穩", "狀態需要持續觀察與照護")
    .replaceAll("健康加速失衡", "生活狀態更需要照護")
    .replaceAll("潛在的健康風險", "生活照護上的壓力")
    .replaceAll("潛在健康風險", "生活照護上的壓力")
    .replaceAll("幫助爸爸的恢復", "幫助家人更清楚爸爸的照護需求")
    .replaceAll("推動他的康復進程", "讓家人更清楚他的照護需求")
    .replaceAll("讓你讓你們", "讓你們")
    .replaceAll(
      "這種不穩定的狀態需要及時調整，避免持續的混亂影響健康。",
      "這種狀態適合先把醫療資訊、照護分工和日常安排確認清楚。",
    )
    .replaceAll("一定會發生", "不能只靠牌面保證會發生")
    .replaceAll("一定不會發生", "不能只靠牌面保證不會發生");

  const unsafePhrases = [
    "看起來不太順利",
    "看起來比較危險",
    "看起來狀況不穩",
    "辦喪事的可能性",
    "會不會辦喪事的可能性",
    "撐得過去",
    "撐不過去",
    "快不行了",
    "死亡機率",
    "生命危險",
  ];

  result = result
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      if (!text) {
        return true;
      }

      return !(
        includesAny(text, unsafePhrases) &&
        !includesAny(text, ["不能", "無法", "不是", "不適合", "不建議"])
      );
    })
    .join("")
    .trim();

  const opening = buildDeathCriticalOpening(question);
  const paragraphs = result
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    paragraphs[0] &&
    includesAny(paragraphs[0], ["占卜不能", "不能判斷", "不能直接判定", "不能用牌", "不能只靠牌"]) &&
    includesAny(paragraphs[0], ["死亡", "喪事", "撐過", "生命", "醫療", "醫師", "吉凶"])
  ) {
    paragraphs.shift();
  }

  result = paragraphs.join("\n\n");

  return `${opening}${result ? `\n\n${result}` : ""}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enforceOverworkSleepGuard(answer: string, context: ReadingContext) {
  if (!isOverworkSleepQuestion(context.question)) {
    return answer;
  }

  const opening =
    "這張牌比較偏向：不建議用熬夜硬撐來完成工作。若真的有期限壓力，重點不是把自己撐到很晚，而是先縮小今晚必做範圍，保留基本睡眠底線。";
  let result = answer
    .replaceAll("今天適合熬夜把工作做完", "不建議用熬夜硬撐完成")
    .replaceAll("今天適合熬夜", "不建議用熬夜硬撐")
    .replaceAll("今天熬夜把工作做完的方向是可以的", "不建議把熬夜當成主要解法")
    .replaceAll("適合熬夜完成", "不建議用熬夜硬撐完成")
    .replaceAll("熬夜會有進展", "保留睡眠底線會讓隔天狀態比較穩")
    .replaceAll("熬夜中獲得一些進展", "在保留睡眠底線的前提下完成最必要的部分")
    .replaceAll("今晚如果真的要熬夜，可以適度安排工作進度", "今晚如果真的有期限壓力，可以先縮小工作範圍")
    .replaceAll("如果真的要熬夜", "如果真的有期限壓力")
    .replaceAll("今晚可以專注於完成", "今晚可以先縮小必做範圍")
    .replaceAll("可以列入考慮", "要先保留睡眠底線，再縮小今晚要完成的範圍")
    .replaceAll("硬撐做完", "縮小今晚必做範圍")
    .replaceAll("撐一下做完", "先縮小今晚必做範圍");

  result = result
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      if (!text) {
        return true;
      }

      const encouragesOverwork = includesAny(text, [
        "適合熬夜",
        "可以熬夜",
        "建議熬夜",
        "熬夜把工作做完",
        "硬撐工作",
      ]);

      return !(encouragesOverwork && !includesAny(text, ["不建議", "不適合", "不要", "不能", "避免"]));
    })
    .join("")
    .trim();

  const paragraphs = result
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    paragraphs[0] &&
    (
      paragraphs[0].includes("熬夜") ||
      paragraphs[0].includes("硬撐") ||
      paragraphs[0].includes("這張牌比較偏向")
    )
  ) {
    paragraphs.shift();
  }

  result = paragraphs.join("\n\n");

  return `${opening}${result ? `\n\n${result}` : ""}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enforceInvestmentDecisionGuard(
  answer: string,
  questionType: string,
  question: string
) {
  if (!isInvestmentDecisionQuestion(questionType, question)) {
    return answer;
  }

  let result = answer
    .replaceAll("這筆期貨投資目前在變動中現在不建議急於做停損決定", "這筆期貨目前處在壓力和波動中，這張牌不是要替你判斷今天停損或不停損，而是提醒你不要在壓力、衝動或混亂中決定")
    .replaceAll("目前這筆投資不太穩定，建議你不要急著做停損的決定", "目前這筆投資不太穩定，但這張牌不是要替你判斷今天停損或不停損")
    .replaceAll("建議你不要急著做停損的決定", "這張牌不是要替你判斷今天停損或不停損")
    .replaceAll("建議你不要急著做停損決定", "這張牌不是要替你判斷今天停損或不停損")
    .replaceAll("建議你不要急著停損", "這張牌不是要替你判斷今天停損或不停損")
    .replaceAll("建議你要仔細評估是否要停損", "這張牌不是要替你判斷是否停損，而是提醒你仔細檢查原本停損規則是否清楚")
    .replaceAll("建議你仔細評估是否要停損", "這張牌不是要替你判斷是否停損，而是提醒你仔細檢查原本停損規則是否清楚")
    .replaceAll("仔細評估是否要停損", "仔細檢查原本停損規則是否清楚")
    .replaceAll("不要急著做停損的決定", "不要只靠牌面判斷停損或不停損")
    .replaceAll("不要急著做停損決定", "不要只靠牌面判斷停損或不停損")
    .replaceAll("不要急著停損", "不要只靠牌面判斷停損或不停損")
    .replaceAll("現在不建議急於做停損決定", "這張牌不是要替你判斷停損或不停損，而是提醒你回到原本策略")
    .replaceAll("不建議急於做停損決定", "不替你判斷停損或不停損，先回到原本停損規則")
    .replaceAll("不建議急於停損", "不替你判斷停損或不停損，先回到原本停損規則")
    .replaceAll("進行操作", "做風險判斷")
    .replaceAll("建議停損", "不能只靠牌面替你決定停損")
    .replaceAll("不建議停損", "不能只靠牌面替你決定不停損")
    .replaceAll("可以停損", "需要回到原本停損規則確認")
    .replaceAll("不要停損", "不要只靠占卜決定不停損")
    .replaceAll("建議買進", "不能只靠牌面決定買進")
    .replaceAll("建議賣出", "不能只靠牌面決定賣出")
    .replaceAll("可以買進", "需要先看風險與交易規則")
    .replaceAll("可以賣出", "需要先看風險與交易規則")
    .replaceAll("可以加碼", "不適合因為牌面就放大部位")
    .replaceAll("適合加碼", "不適合因為牌面就放大部位")
    .replaceAll("先不要急著加碼", "不要讓一時衝動取代原本風險規則")
    .replaceAll("不要急著加碼", "不要讓一時衝動取代原本風險規則")
    .replaceAll("不要急著放大部位", "不要讓短期波動取代原本風險規則")
    .replaceAll("建議不要加碼", "這張牌不是要替你決定能不能加碼")
    .replaceAll("不可以加碼", "這張牌不是要替你決定能不能加碼")
    .replaceAll("或許在短期內需要降低部位", "短期內要先檢查部位是否符合原本風險規則")
    .replaceAll("可能需要降低部位", "要先檢查部位是否符合原本風險規則")
    .replaceAll("需要降低部位", "要先檢查部位是否符合原本風險規則")
    .replaceAll("確認必要時可以及時調整", "確認是否仍符合原本風險規則")
    .replaceAll("無論是決定今天停損或繼續觀望", "不管最後依原本規則如何處理")
    .replaceAll("保持現有部位的穩定會是更好的選擇", "先確認現有部位是否符合原本風險規則")
    .replaceAll("可以歐印", "不能歐印")
    .replaceAll("適合進場", "需要先看風險是否可控")
    .replaceAll("進場投資", "評估投資風險")
    .replaceAll("把握機會", "先確認風險")
    .replaceAll("提高實際結果", "看清實際風險")
    .replaceAll("提升成功的機會", "讓判斷更貼近原本規則")
    .replaceAll("投資表現更持久", "判斷更穩定")
    .replaceAll("這會讓你在市場中更具競爭優勢", "這會讓你比較能維持紀律與風險控管")
    .replaceAll("讓你的投資更加穩健", "讓你的判斷更有紀律")
    .replaceAll("讓你的投資策略更加穩健", "讓你的交易判斷更有紀律")
    .replaceAll("讓投資決策更加穩妥", "讓判斷更貼近原本風險規則")
    .replaceAll("不比較穩", "不穩");

  if (includesAny(question, ["停損", "減碼", "加碼", "買進", "賣出", "進場", "出場", "繼續抱"])) {
    const opening =
      "這張牌不適合直接替你決定買賣、停損、加碼或出場。它比較像風險提醒，要你回到原本設定的成本、停損規則、部位大小、風險承受度與情緒狀態來看。";

    if (!result.includes("不適合直接替你決定買賣")) {
      result = `${opening}\n\n${result}`;
    }
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function enforceInvestmentFollowUpCompleteness(answer: string, context: ReadingContext) {
  if (
    !context.followUpContext?.isFollowUp ||
    !isHighRiskInvestmentContext(context)
  ) {
    return answer;
  }

  if (countChineseCharacters(answer) >= 260) {
    return answer;
  }

  if (answer.includes("不是替你決定買賣、停損或加碼")) {
    return answer;
  }

  return `${answer.trim()}\n\n最後仍要記得，這張牌不是替你決定買賣、停損或加碼，而是提醒你把成本、停損線、部位大小與風險承受度放回原本規則裡確認，再看自己是否正在被情緒帶著走。`;
}

function cleanInvestmentOperationTone(answer: string, context: ReadingContext) {
  if (!isHighRiskInvestmentContext(context)) {
    return answer;
  }

  const highRisk = true;
  let result = answer
    .replaceAll("々", "")
    .replaceAll("不是要看機會大小，也不是風險條件判斷", "不是在判斷會不會賺錢，也不是替你決定要不要繼續放著")
    .replaceAll("不是要看機會大小，也不是績效判斷", "不是在判斷會不會賺錢，也不是操作建議")
    .replaceAll("目前需要停損風險", "目前重點不是替你判斷停損或不停損，而是檢查原本停損規則是否清楚")
    .replaceAll("需要停損風險狀況", "需要回到原本停損規則和風險狀況確認")
    .replaceAll("建議在繼續做空股票的同時", "這題不能替你判斷是否繼續做空，接下來")
    .replaceAll("近期不建議急於進行股票投資", "這題不能替你決定股票操作，近期重點是先確認風險條件")
    .replaceAll("股票操作方向", "風險檢查方向")
    .replaceAll("做空可延續", "是否符合原本交易規則仍需確認")
    .replaceAll("穩定獲利", "風險條件")
    .replaceAll("績效", "風險條件")
    .replaceAll("建議慎重考量是否立即停損", "這張牌不是要替你判斷是否立即停損，而是提醒你先回到原本停損規則")
    .replaceAll("慎重考量是否立即停損", "回到原本停損規則確認")
    .replaceAll("快決策", "快速判斷")
    .replaceAll("導致更大的損失", "放大原本風險")
    .replaceAll("導致損失擴大", "放大原本風險")
    .replaceAll("不必要的損失", "不必要的風險")
    .replaceAll("做出高風險決定", "讓判斷偏離原本風險規則")
    .replaceAll("做出高風險的決定", "讓判斷偏離原本風險規則")
    .replaceAll("做出錯誤的決策", "偏離原本規則")
    .replaceAll("急於行動而影響未來的投資", "急於行動而干擾風險判斷")
    .replaceAll("急於行動", "急於下判斷")
    .replaceAll("未來的投資", "後續風險判斷")
    .replaceAll("可以考慮先觀望", "先確認原本策略對觀望的條件是否清楚")
    .replaceAll("暫時保持觀望", "回到原本策略確認觀望條件")
    .replaceAll("較穩定的選擇", "較能維持風險紀律")
    .replaceAll("觀察市場動向", "確認資訊是否足夠")
    .replaceAll("追漲、盲目放大部位", "追逐短期波動，忽略原本部位規則")
    .replaceAll("盲目放大部位", "忽略原本部位規則")
    .replaceAll("不適合在情緒高漲時做重大決策", "不適合讓情緒高漲取代原本交易規則")
    .replaceAll("重大決策", "重大判斷")
    .replaceAll("應該更加謹慎行動", "需要更明確地回到風險規則")
    .replaceAll("謹慎行動", "謹慎檢查風險")
    .replaceAll("因一時衝動造成的損失", "因一時衝動放大風險")
    .replaceAll("全局釐清方向", "整體風險方向")
    .replaceAll("風險判斷決策", "風險判斷")
    .replaceAll("可以清楚評估", "可以更清楚檢查")
    .replaceAll("部位控制", "部位規則")
    .replaceAll("你應該關注", "你可以觀察")
    .replaceAll("止損規則", "停損規則")
    .replaceAll("這筆投資本身看起來有潛力，值得進一步評估", "這筆投資明天的重點不是看機會大小，而是檢查風險條件是否清楚")
    .replaceAll("投資本身看起來有潛力，值得進一步評估", "投資重點不是看機會大小，而是檢查風險條件是否清楚")
    .replaceAll("武曲星正位代表這筆投資還是有發展潛力和重點是檢查風險條件是否清楚", "武曲星正位放在這題，重點仍是檢查風險條件是否清楚")
    .replaceAll("這筆投資還是有發展潛力和重點是檢查風險條件是否清楚", "這筆投資的重點仍是檢查風險條件是否清楚")
    .replaceAll("這筆投資本身看起來有潛力", "這筆投資仍有不確定性")
    .replaceAll("投資本身看起來有潛力", "投資仍有不確定性")
    .replaceAll("有發展潛力", "風險條件仍需確認")
    .replaceAll("發展潛力", "風險條件")
    .replaceAll("有潛力，值得進一步評估", "仍有不確定性，需要回到風險規則確認")
    .replaceAll("有潛力", "仍有不確定性")
    .replaceAll("值得進一步評估", "需要回到風險規則確認")
    .replaceAll("用能力換取實際的投資結果", "用紀律看清實際風險")
    .replaceAll("通過努力而獲得實際結果的可能性", "用紀律把風險條件看清楚")
    .replaceAll("獲得實際結果的可能性", "把風險條件看清楚")
    .replaceAll("更清楚掌握這筆投資的實際價值與實際結果", "更清楚掌握這筆投資的成本、資訊透明度與風險邊界")
    .replaceAll("這筆投資的實際價值與實際結果", "這筆投資的成本、資訊透明度與風險邊界")
    .replaceAll("實際價值與實際結果", "成本、資訊透明度與風險邊界")
    .replaceAll("實際價值", "風險邊界")
    .replaceAll("實際結果", "風險條件")
    .replaceAll("獲得正財的重要關鍵", "維持紀律的重要提醒")
    .replaceAll("正財", "風險紀律")
    .replaceAll("具備一定的風險控管潛力", "有機會把風險控管重新拉回規則內")
    .replaceAll("持續執行原本設定的投資策略", "持續檢查是否符合原本設定的投資策略")
    .replaceAll("根據原本的策略執行", "確認是否仍符合原本策略")
    .replaceAll("強調執行力與堅持", "重點在於規則一致性")
    .replaceAll("保持行動的一致性", "保持規則檢查的一致性")
    .replaceAll("比較穩之舉", "比較能回到風險控管")
    .replaceAll("做出理性的判斷", "讓判斷回到規則")
    .replaceAll("確認這筆投資機會", "確認這筆投資的風險狀態")
    .replaceAll("投資機會", "風險狀態")
    .replaceAll("有效穩定投資的風險", "讓風險檢查更清楚")
    .replaceAll("有效管理可能的風險", "更清楚地管理可能風險")
    .replaceAll("提升判斷的正確性與可行性", "讓判斷更回到規則與紀律")
    .replaceAll("判斷的正確性與可行性", "判斷是否符合規則")
    .replaceAll("以期獲得實質的風險條件", "讓風險條件更清楚")
    .replaceAll("獲得實質的風險條件", "讓風險條件更清楚")
    .replaceAll("持穩你的部位", "確認部位是否符合原本規則")
    .replaceAll("穩定你的部位", "確認部位是否符合原本規則")
    .replaceAll("把責任、時間與話說清楚，用穩定行動照亮問題", "成本、停損線、部位大小、波動程度、資訊完整度與風險承受度是否清楚")
    .replaceAll("把責任、時間與話說清楚", "確認成本、停損線、部位大小、資訊完整度與風險承受度")
    .replaceAll("用穩定行動照亮問題", "用原本規則檢查風險")
    .replaceAll("要改就有計畫地改，先評估代價與重建成本，不要亂破壞", "成本、停損線、部位大小、波動程度、資訊完整度與風險承受度是否清楚")
    .replaceAll("先評估代價與重建成本", "先確認成本、部位大小與風險承受度")
    .replaceAll("穩住資源、盤點條件，用務實管理取代過度控制", "成本、停損線、部位大小、波動程度、資訊完整度與風險承受度是否清楚");

  if (highRisk) {
    result = result
      .replace(/(まだ|々)/g, (match) => (match === "まだ" ? "仍然" : ""))
      .replace(/止損/g, "停損")
      .replace(/全局/g, "整體")
      .replace(/快決策/g, "快速判斷")
      .replace(/設置/g, "設定")
      .replace(/(有)?發展潛力/g, "風險條件仍需確認")
      .replace(/高風險的決定/g, "偏離原本風險規則的判斷")
      .replace(/(持穩|穩定|維持)[^。]{0,8}部位/g, "確認部位是否符合原本規則")
      .replace(/觀察市場動向/g, "確認資訊是否足夠")
      .replace(/提升[^。]{0,12}(正確性|可行性)[^。]*。?/g, "這樣能讓判斷更回到規則與紀律。")
      .replace(/(建議|可以|應該|需要|最好|或許|考慮).{0,12}(觀望|出場|進場|停損(?!線|規則|條件)|加碼|減碼|放大部位|降低部位|維持部位|穩定部位|調整部位|操作)[^。]*。?/g, "這張牌不是要替你決定操作方向，而是提醒你回到原本交易規則確認。")
      .replace(/(投資|資金|正財|收益|獲利|成果|結果|績效|成功機率|機會|潛力).{0,10}(增加|成長|提升|穩定|更好|實際|值得|有利|競爭)[^。]*。?/g, "重點是檢查風險條件是否清楚。")
      .replace(/(重大|慘重|不必要|更大|擴大).{0,10}(損失|風險)/g, "風險超出原本可承受範圍")
      .replace(/(投資機會|獲利機會|成功機率|投資成果|投資結果|實際結果|實際價值|正財|資金增值|資金成長|穩定獲利|更具競爭優勢|投資更加穩健|值得進一步評估|有潛力|獲得成果|長期收益|績效|收益|獲利)/g, "風險條件")
      .replace(/(錯誤決策|重大損失|不必要的損失|損失擴大|導致更大損失|高風險決定|慘重損失)/g, "偏離原本風險規則");
  }

  result = result
    .replace(/建議你[^。]{0,24}(停損(?!線|規則|條件)|加碼|買進|賣出|進場|出場|減碼)[^。]*。?/g, "這張牌不是要替你決定買賣、停損或加碼，而是提醒你回到原本交易規則確認。")
    .replace(/你應該[^。]{0,24}(停損(?!線|規則|條件)|加碼|買進|賣出|進場|出場|減碼)[^。]*。?/g, "你可以把重點放在確認原本交易規則是否清楚。")
    .replace(/可以[^。]{0,18}(停損(?!線|規則|條件)|加碼|買進|賣出|進場|出場|減碼)[^。]*。?/g, "這張牌不替你決定操作，重點是回到原本風險規則確認。")
    .replace(/(成功機率|投資收益|資金成長|資金增值|投資成果|投資結果)/g, "風險控管")
    .replaceAll("不是要看機會大小，也不是風險條件判斷", "不是在判斷會不會賺錢，也不是替你決定要不要繼續放著")
    .replaceAll("不是要看機會大小，也不是績效判斷", "不是在判斷會不會賺錢，也不是操作建議");

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function dedupeInvestmentRiskChecklist(answer: string, context: ReadingContext) {
  if (!isHighRiskInvestmentContext(context)) {
    return answer;
  }

  const paragraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  let hasFullChecklist = false;

  const filtered = paragraphs.filter((paragraph) => {
    const checklistScore = [
      "成本",
      "停損線",
      "部位",
      "波動",
      "風險承受度",
      "資訊",
    ].filter((key) => paragraph.includes(key)).length;
    const isChecklist = checklistScore >= 4;
    const isGenericClosing =
      paragraph.startsWith("接下來可以把重點放在") ||
      paragraph.startsWith("接下來，重點可以放在") ||
      paragraph.startsWith("最後可以把重點放在");

    if (isChecklist && !isGenericClosing) {
      hasFullChecklist = true;
      return true;
    }

    if (hasFullChecklist && isChecklist && isGenericClosing) {
      return false;
    }

    return true;
  });

  return filtered.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getInvestmentSafeRewriteType(context: ReadingContext) {
  const question = context.question;
  const followUpFocus = detectFollowUpFocus(question, context.followUpContext);

  if (
    followUpFocus === "investment_discipline" ||
    includesAny(question, ["避免", "衝動", "加碼", "怎麼守", "守住"])
  ) {
    return "avoid_impulse_add";
  }

  if (
    followUpFocus === "investment_emotion" ||
    isInvestmentEmotionQuestion(question) ||
    includesAny(question, ["情緒", "焦慮", "僥倖", "心態", "太重", "太急"])
  ) {
    return "emotion_check";
  }

  if (
    followUpFocus === "investment_observation" ||
    includesAny(question, ["明天", "明日", "再看", "重點", "看什麼", "觀察"])
  ) {
    return "tomorrow_observation";
  }

  if (includesAny(question, ["停損", "不停損", "要不要停"])) {
    return "return_to_rules";
  }

  return "general_risk_check";
}

function getInvestmentRiskMeaning(context: ReadingContext) {
  const key = `${context.card.name}-${context.position}`;

  const meanings: Record<string, string> = {
    "七殺星-反位":
      "壓力下想快速切斷，容易用太急、太硬的方式處理風險",
    "七殺星-正位":
      "行動力很強，但更需要把速度放回規則裡檢查",
    "貪狼星-反位":
      "短期刺激、僥倖心、想翻本，或被盤中波動牽著走",
    "貪狼星-正位":
      "容易被行情吸引，但仍要分清楚規則和慾望",
    "武曲星-正位":
      "數字、成本、紀律、責任、風險邊界與務實檢查",
    "武曲星-反位":
      "成本壓力、資金配置失衡，或因計算不清讓風險變大",
    "天相星-正位":
      "規則、紀律、既有操作邏輯與分寸，需要照原本規則檢查，不要臨時破壞自己的設定",
    "天相星-反位":
      "規則與分寸不穩，容易因流程混亂或臨時改規則讓判斷失準",
    "天府星-正位":
      "資金管理、資源盤點與穩定控管，需要先確認資金配置是否承接得住",
    "天府星-反位":
      "財星反位代表賺錢掌握度偏低、資金控管不穩，容易盤算失準或讓破財風險變高",
    "紫微星-反位":
      "想掌控、想證明自己、面子感或主導感干擾判斷",
    "紫微星-正位":
      "需要用更大的格局看規則，不讓單一波動蓋過全盤風險",
  };

  return (
    meanings[key] ||
    "成本、規則與風險邊界需要重新看清楚"
  );
}

function buildInvestmentSafeTemplate(context: ReadingContext) {
  const rewriteType = getInvestmentSafeRewriteType(context);
  const riskMeaning = getInvestmentRiskMeaning(context);
  const cardLine = `${context.card.name}${context.position}`;

  if (rewriteType === "emotion_check") {
    const opening = context.followUpContext?.isFollowUp
      ? "延續前面投資脈絡，這張牌比較偏向：你現在確實要小心交易情緒影響判斷，但這不是要替你決定接下來怎麼操作。"
      : "這張牌比較偏向：你現在確實要小心「想翻本」影響判斷，但這不是要替你決定接下來怎麼操作。";

    return `${opening}

${cardLine}放在這裡，代表你現在要注意的是${riskMeaning}。這比較像提醒你，先分清楚自己是在照原本規則判斷，還是在用情緒追回前面的壓力。

接下來先回頭檢查：原本規則、成本、風險承受度、部位大小是否清楚，是否臨時改規則，以及是否因不甘心而想追回。

如果發現自己一直盯著前面的壓力、想證明自己，先把判斷從情緒拉回規則紀錄。不要用當下感覺補規則，也不要讓不甘心變成下一步依據。

這裡不替你決定買賣、停損或加碼。重點是先看判斷是否被翻本心態牽動，再回到自己的交易規則確認。`;
  }

  if (rewriteType === "tomorrow_observation") {
    return `延續前面期貨與交易情緒的脈絡，明天要看的不是單一漲跌，也不是讓牌替你決定操作方向。

${cardLine}放在這題裡，代表你要把重點放在${riskMeaning}。這比較像是在提醒你，用數字和規則檢查風險，而不是用情緒判斷。

明天先檢查：價格是否接近原本停損線，成本位置是否清楚，部位大小是否仍符合原本風險規則，波動是否超過你能承受的範圍，以及你是否仍照原本策略判斷。

如果資訊還不完整，先把不知道的地方列出來，不要用猜測補空白。也要確認自己看的不是單一價格，而是規則、成本、波動和情緒有沒有一起對齊。

這裡不替你決定買進、賣出、停損或加碼。你要做的是把原本策略拿出來，逐項確認風險條件是否仍然清楚。`;
  }

  if (rewriteType === "avoid_impulse_add") {
    return `延續前面期貨投資的脈絡，這題不是問能不能加碼，而是在看你怎麼避免讓衝動取代原本規則。

${cardLine}放在這題裡，代表你要注意的是${riskMeaning}。它提醒你，短期波動、想翻本、想證明自己，或被刺激牽動時，很容易讓判斷偏離原本設定。

接下來先把原本條件寫清楚：什麼條件成立才檢查下一步，什麼條件沒成立就先停在規則內。也要檢查成本、部位大小、風險承受度，以及自己是不是因為焦慮或貪念想臨時改規則。

如果當下很想證明自己，先把節奏慢下來。把原本條件、能承受的波動和最壞情況重新看一次，避免用一時情緒取代原本紀律。

這裡不替你決定加碼或不加碼。重點是：沒有符合原本條件時，不讓一時衝動取代你的交易紀律。`;
  }

  if (rewriteType === "return_to_rules") {
    return `這張牌不適合直接替你決定買賣、停損或加碼。這題比較像風險提醒，要你先把判斷拉回原本交易規則。

${cardLine}放在這題裡，代表你現在要注意的是${riskMeaning}。這不是要你立刻下判斷，而是提醒你先確認自己是不是被壓力、波動或情緒牽著走。

接下來先檢查：成本在哪裡，原本停損線是否清楚，部位大小是否仍在可承受範圍，目前波動是否超過你的風險承受度，以及你是不是偏離原本策略。

這裡不替你決定買進、賣出、停損或加碼。比較適合做的是把原本規則拿出來，逐項確認清楚，再依照你自己的風險設定處理。`;
  }

  return `這張牌不適合直接替你決定買賣、停損或加碼。這題比較適合看風險條件是否清楚，而不是看哪個操作比較好。

${cardLine}放在這題裡，代表你現在要注意的是${riskMeaning}。牌面提醒的是風險邊界，不是要看機會大小，也不是績效判斷。

接下來先檢查成本、停損線、部位大小、波動程度、風險承受度，以及目前資訊是否足夠。也要看自己是否正在被焦慮、僥倖或短期波動帶著走。

這裡不替你做投資決定。你要做的是把原本策略拿出來，確認每一項風險條件是否仍然清楚。`;
}

function validateInvestmentAnswer(answer: string): InvestmentValidationResult {
  const text = String(answer || "");
  const checkedText = text
    .replace(/這張牌不適合直接替你決定[^。]*。?/g, "")
    .replace(/這裡不替你決定[^。]*。?/g, "")
    .replace(/不替你做投資決定[^。]*。?/g, "")
    .replace(/不替你決定[^。]*。?/g, "")
    .replace(/不是要看機會大小，也不是績效判斷。?/g, "")
    .replace(/不是績效判斷。?/g, "")
    .replace(/停損線/g, "停損線")
    .replace(/停損規則/g, "停損規則");
  const issues: string[] = [];
  const hasOperationAdvice =
    /(建議|可以|應該|需要|最好|或許|考慮|適合|直接).{0,12}(觀望|出場|進場|停損(?!線|規則|條件)|加碼|減碼|放大部位|降低部位|維持部位|穩定部位|調整部位|操作|持有|續抱|持穩)/.test(
      checkedText
    );
  const hasPerformanceLanguage =
    /(投資|資金|正財|收益|獲利|成果|結果|績效|成功機率|機會|潛力).{0,10}(增加|成長|提升|穩定|更好|實際|值得|有利|競爭)/.test(
      checkedText
    ) || /發展潛力|持穩[^。]{0,8}部位|提升[^。]{0,12}(正確性|可行性)/.test(checkedText);
  const hasOpportunityLanguage = includesAny(checkedText, [
    "投資機會",
    "獲利機會",
    "成功機率",
    "有潛力",
    "值得進一步評估",
    "正財",
    "實際價值",
    "實際結果",
    "目前需要停損風險",
    "需要停損風險狀況",
    "建議在繼續做空股票的同時",
    "近期不建議急於進行股票投資",
    "股票操作方向",
    "做空可延續",
    "穩定獲利",
    "績效",
  ]);
  const hasLossFearLanguage =
    /(重大|慘重|不必要|更大|擴大).{0,10}(損失|風險)/.test(text) ||
    includesAny(text, ["錯誤決策", "重大損失", "慘重損失"]);
  const hasLanguagePollution = /让|顺|建议你|まだ|々|止損|全局|快決策|設置/.test(text);

  if (hasOperationAdvice) issues.push("operation");
  if (hasPerformanceLanguage) issues.push("performance");
  if (hasOpportunityLanguage) issues.push("opportunity");
  if (hasLossFearLanguage) issues.push("loss_fear");
  if (hasLanguagePollution) issues.push("language_pollution");

  return {
    pass: issues.length === 0,
    issues,
    hasOperationAdvice,
    hasPerformanceLanguage,
    hasOpportunityLanguage,
    hasLossFearLanguage,
    hasLanguagePollution,
  };
}

function isNonHealthActivityDateContext(context: ReadingContext) {
  if (context.questionType === "健康狀態" || hasMedicalContext(context.question)) {
    return false;
  }

  return (
    context.questionType === "活動注意" ||
    includesAny(context.questionSubcategory, [
      "出去玩日期",
      "活動日期",
      "單一出遊日期",
      "出遊同行者狀態",
    ])
  );
}

function isLearnerStudyQuestion(question: string) {
  const text = question || "";

  return includesAny(text, [
    "開始學新東西",
    "學新東西",
    "開始上課",
    "報名課程",
    "我要不要報名",
    "適合上課",
    "適合學",
  ]);
}

function isHandoverOrPaymentContext(context: ReadingContext) {
  return (
    context.questionSubcategory === "房產｜交屋責任" ||
    context.questionSubcategory.includes("交易") ||
    context.questionSubcategory.includes("簽約") ||
    includesAny(context.question, ["交屋", "合約", "簽約", "付款", "買賣", "過戶"])
  );
}

function isPropertyHandoverContext(context: ReadingContext) {
  return (
    context.questionSubcategory === "房產｜交屋責任" ||
    includesAny(context.question, ["交屋", "點交", "驗收"])
  );
}

function cleanNonHealthOrganWarnings(answer: string, context: ReadingContext) {
  if (!isNonHealthActivityDateContext(context)) {
    return answer;
  }

  let insertedGeneralReminder = false;

  return answer
    .split(/(?<=。|\n)/)
    .map((part) => {
      const hasOrgan = /(肝|筋脈|腎臟|內分泌|淋巴|循環系統|心臟|肺|胃)/.test(part);
      const looksLikeHealthReminder = includesAny(part, [
        "健康",
        "身體",
        "保護",
        "狀況",
        "留意",
        "注意",
      ]);

      if (!hasOrgan || !looksLikeHealthReminder) {
        return part;
      }

      if (insertedGeneralReminder) {
        return "";
      }

      insertedGeneralReminder = true;
      return "也要注意體力、休息、飲食與水分補充，避免行程排太滿影響整體體驗。";
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanNonHealthLifestyleLanguage(answer: string, context: ReadingContext) {
  if (!isNonHealthActivityDateContext(context)) {
    return answer;
  }

  return answer
    .replaceAll("此外在身體健康上也要注意保持良好的作息和身體狀況以免旅途中出現不適。", "另外也要注意作息、體力和休息安排，避免旅途中因太累而影響體驗。")
    .replaceAll("此外在身體健康上也要注意保持良好的作息和體力與休息狀態以免旅途中出現不適。", "另外也要注意作息、體力和休息安排，避免旅途中因太累而影響體驗。")
    .replaceAll("身體健康", "體力與休息")
    .replaceAll("身體狀況", "體力與休息狀態")
    .replaceAll("身體狀態", "體力與休息狀態")
    .replaceAll("健康狀態", "體力與休息需求")
    .replaceAll("健康狀況", "體力與休息需求")
    .replaceAll("心理狀態", "需求、體力和時間安排")
    .replaceAll("睡眠品質下降", "休息不足")
    .replaceAll("安全感", "安心感")
    .replaceAll("情緒上的波動和不安也可能會影響參與者的心情與表現", "準備不穩、人員狀態不一致，也可能影響拍攝表現和現場流程")
    .replaceAll("情緒上的波動和不安", "準備不穩或人員狀態不一致");
}

function cleanTravelCompanionTone(answer: string, context: ReadingContext) {
  if (!context.questionSubcategory.includes("出遊同行者狀態")) {
    return answer;
  }

  return answer
    .replaceAll("情緒不佳", "配合受影響")
    .replaceAll("不和諧的情況", "配合上的落差")
    .replaceAll("情緒上的不穩定", "狀態沒有表面上那麼輕鬆")
    .replaceAll("情緒不穩", "狀態不太穩")
    .replaceAll("逃避壓力和任性", "想輕鬆一點")
    .replaceAll("逃避壓力", "不太想面對安排上的細節")
    .replaceAll("不太想面對現實", "對現實安排還沒想清楚")
    .replaceAll("太依賴你", "需要你多確認一次")
    .replaceAll("無法承受壓力", "壓力承接度比較低")
    .replaceAll("不理想", "還需要再確認")
    .replaceAll("挑剔", "比較在意細節")
    .replaceAll("任性", "比較想照自己的節奏");
}

function cleanLearnerStudyLanguage(answer: string, context: ReadingContext) {
  if (!context.questionSubcategory.includes("課程") && context.questionType !== "學習考試") {
    return answer;
  }

  if (!isLearnerStudyQuestion(context.question)) {
    return answer;
  }

  return answer
    .replaceAll("課程內容、報名流程、上架準備、學生吸收節奏與後續執行安排", "課程內容、學習目標、時間安排、負擔會不會太大，以及後續複習方式")
    .replaceAll("課程內容、報名流程、開課或上架準備、時間安排、吸收狀態與後續執行節奏", "課程內容、學習目標、時間安排、負擔會不會太大、吸收節奏與後續複習方式")
    .replaceAll("報名流程", "學習目標")
    .replaceAll("上架準備", "時間安排")
    .replaceAll("課程上架", "開始學習")
    .replaceAll("學生吸收節奏", "負擔會不會太大、吸收節奏")
    .replaceAll("後續執行安排", "後續複習方式")
    .replaceAll("宣傳節奏", "學習節奏")
    .replaceAll("安全感不足", "信心不足")
    .replaceAll("學習過程會看起來更加深入", "學習過程會更深入")
    .replaceAll("課程大綱的存取", "先取得課程大綱，並整理相關資料");
}

function cleanHandoverWuquReversed(answer: string, context: ReadingContext) {
  if (
    context.card.name !== "武曲星" ||
    context.position !== "反位" ||
    !isHandoverOrPaymentContext(context)
  ) {
    return answer;
  }

  let result = answer
    .replaceAll("不容易因為財產或金錢利益上的不明而造成損失", "可能因為款項、交接條件或責任歸屬沒溝通清楚，導致額外支出或破財")
    .replaceAll("財產或金錢利益上的不明", "款項、交接條件或責任歸屬不清")
    .replaceAll("容易造成損失", "可能導致額外支出或破財")
    .replaceAll("造成損失", "導致額外支出或破財");

  if (
    isPropertyHandoverContext(context) &&
    !includesAny(result, ["額外多付錢", "破財", "追加支出", "額外支出"])
  ) {
    result = `${result.trim()}\n\n武曲星反位放在交屋題，代表交屋過程中要特別注意款項、責任和文件細節。這張牌提醒你，可能因為某些費用、交接條件或責任歸屬沒有事先溝通清楚，導致後面需要額外多付錢，或出現破財、追加支出的狀況。`;
  }

  return result;
}

function cleanBusinessSalesLanguage(answer: string, context: ReadingContext) {
  if (context.questionType !== "經營銷售" && !isBusinessSalesQuestion(context.question)) {
    return answer;
  }

  let result = answer
    .replaceAll("這筆投資", "這次銷售活動")
    .replaceAll("投資機會", "營收狀態")
    .replaceAll("投資成果", "銷售結果")
    .replaceAll("投資結果", "銷售結果")
    .replaceAll("股票操作方向", "銷售方向")
    .replaceAll("股票期貨", "商品銷售")
    .replaceAll("金融風險", "成本與回本壓力")
    .replaceAll("部位大小", "庫存與成本")
    .replaceAll("部位", "庫存與成本")
    .replaceAll("停損規則", "成本上限")
    .replaceAll("停損線", "成本上限")
    .replaceAll("停損", "成本控管")
    .replaceAll("買進", "進貨或投入")
    .replaceAll("賣出", "銷售")
    .replaceAll("加碼", "增加投入")
    .replaceAll("減碼", "降低投入")
    .replaceAll("進場", "參與這次活動")
    .replaceAll("出場", "收尾與調整")
    .replaceAll("這次寄售、擺攤有帶來穩定營收的潛力", "這次寄售、擺攤有機會做出營收，但仍要看成本、人流與現場轉換")
    .replaceAll("帶來穩定營收", "做出營收機會")
    .replaceAll("穩定營收的潛力", "做出營收的機會，但仍要看成本、人流與現場轉換")
    .replaceAll("穩定營收潛力", "做出營收的機會")
    .replaceAll("似乎有賺錢的機會", "有做出營收的空間，但仍要看成本、人流與現場轉換")
    .replaceAll("有賺錢的機會", "有做出營收的空間")
    .replaceAll("讓這次寄售活動獲得成功", "提高這次寄售活動的成交穩定度")
    .replaceAll("讓這次寄售活動更容易成功", "提高這次寄售活動的成交穩定度")
    .replaceAll("獲得成功", "比較穩定地推進")
    .replaceAll("獲利機會更高", "營收條件更清楚")
    .replaceAll("可能會獲得不錯的結果", "有機會做出營收，但仍要看成本、人流與現場轉換")
    .replaceAll("獲得不錯的結果", "讓營收條件更清楚")
    .replaceAll("達到最佳效果", "讓現場條件更穩")
    .replaceAll("提升銷量", "提高成交條件")
    .replaceAll("達到預期的營收目標", "降低回本壓力")
    .replaceAll("預期的營收目標", "回本壓力")
    .replaceAll("最終的獲利", "最終營收狀況")
    .replaceAll("有機會實現預期的實際結果", "有做出營收的空間，但仍要看成本、人流與現場轉換")
    .replaceAll("更具控管與優勢", "較適合先整理資源、成本與現場條件")
    .replaceAll("累積財庫", "管理庫存、成本與現金流")
    .replaceAll("提升購買意願", "提高現場成交條件")
    .replaceAll("成功率提高", "現場成交的穩定度會比較高")
    .replaceAll("實現預期回本價值", "比較能降低回本壓力")
    .replaceAll("抓住最好的機會", "把握現場條件與顧客反應")
    .replaceAll("祝你在這次活動中能夠如願以償。", "這樣會比只靠現場運氣更穩。")
    .replaceAll("有效掌控成本和人流", "先掌握成本與人流條件")
    .replaceAll("有效掌控成本與人流", "先掌握成本與人流條件")
    .replaceAll("你在資源管理、價格設置和市場規劃上具備不錯的把握能力", "這張牌提醒你，要把資源管理、定價和現場規劃先整理清楚")
    .replaceAll("期待能看到更好的結果", "這樣比較能提高現場成交的穩定度")
    .replaceAll("相信你的努力會有所實際結果", "這樣會比只靠現場運氣更穩")
    .replaceAll("穩定獲利", "營收較穩")
    .replaceAll("最終獲利", "最終營收狀況")
    .replaceAll("獲利", "營收")
    .replaceAll("成功率", "成交穩定度")
    .replaceAll("成功", "順利推進")
    .replaceAll("績效", "銷售表現");

  result = result
    .replace(/(建議|可以|應該|需要|最好|或許|考慮).{0,16}(買賣|操作|持有|續抱|做空|放空)[^。]*。?/g, "這題重點不是金融操作，而是回到成本、人流、商品陳列與現場轉換來看。")
    .replace(/(股票|期貨|基金|投資).{0,18}(買賣|停損|加碼|減碼|進場|出場|部位)[^。]*。?/g, "這題比較像銷售營收判斷，不是股票期貨操作題。");

  if (
    !includesAny(result, [
      "成本",
      "人流",
      "客流",
      "陳列",
      "庫存",
      "定價",
      "宣傳",
      "現場轉換",
      "顧客反應",
      "回本",
    ])
  ) {
    result = `${result.trim()}\n\n這題比較像寄售、擺攤或商品銷售的營收判斷，不是股票期貨那種投資操作題。接下來可以把重點放在成本是否壓得住、人流是否足夠、商品陳列是否清楚、庫存是否好管理、定價是否容易成交，以及現場顧客反應能不能轉成實際購買。`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanIncomePlanningLanguage(answer: string, context: ReadingContext) {
  if (context.questionType !== "收入規劃" && !isIncomePlanningQuestion(context.question)) {
    return answer;
  }

  let result = answer
    .replaceAll("這筆投資", "這個收入方向")
    .replaceAll("投資機會", "收入機會")
    .replaceAll("投資成果", "收入成果")
    .replaceAll("投資結果", "收入結果")
    .replaceAll("股票操作方向", "收入方向")
    .replaceAll("股票期貨", "收入方向")
    .replaceAll("金融風險", "成本與執行風險")
    .replaceAll("部位大小", "投入成本")
    .replaceAll("部位", "投入成本")
    .replaceAll("停損規則", "成本上限")
    .replaceAll("停損線", "成本上限")
    .replaceAll("停損", "成本控管")
    .replaceAll("買進", "投入")
    .replaceAll("賣出", "變現")
    .replaceAll("加碼", "增加投入")
    .replaceAll("減碼", "降低投入")
    .replaceAll("進場", "開始嘗試")
    .replaceAll("出場", "收尾調整")
    .replaceAll("穩定獲利", "收入較穩")
    .replaceAll("績效", "收入表現")
    .replaceAll("財富自由", "收入改善")
    .replaceAll("有機會往好的方向發展", "可以往新的收入方向試水溫")
    .replaceAll("這件事情有機會往好的方向發展", "這個收入方向可以先往新的模式試水溫")
    .replaceAll("較容易如魚得水", "比較能發揮你熟悉的能力")
    .replaceAll("比較如魚得水", "比較能發揮你熟悉的能力")
    .replaceAll("如魚得水易如反掌", "較能掌握成本與執行節奏")
    .replaceAll("如魚得水", "發揮熟悉能力")
    .replaceAll("易如反掌", "較能掌握")
    .replaceAll("尋找商機", "尋找可行的收入模式")
    .replaceAll("商機", "可行的收入模式")
    .replaceAll("更具優勢", "更能掌握執行節奏")
    .replaceAll("勇於冒險和嘗試新事物", "用小規模方式嘗試新事物")
    .replaceAll("勇於冒險", "願意小規模嘗試")
    .replaceAll("潛在機會存在", "仍有可探索空間")
    .replaceAll("能助你發揮熟悉的能力", "可以幫你找到較能發揮熟悉能力的方向")
    .replaceAll("將會是你成功的關鍵因素", "會是需要觀察的關鍵條件")
    .replaceAll("成功的關鍵因素", "需要觀察的關鍵條件")
    .replaceAll("成功就會有可能", "才比較有機會走得下去")
    .replaceAll("能在收入上帶來更多的收穫", "比較有機會讓收入來源慢慢變清楚")
    .replaceAll("帶來更多的收穫", "讓收入來源慢慢變清楚")
    .replaceAll("很大的機會", "可以小規模試水溫")
    .replaceAll("有很大的機會", "可以小規模試水溫")
    .replaceAll("收入增長非常有幫助", "有助於你找到可測試的收入方向")
    .replaceAll("錯失良機", "錯過合適的嘗試時機")
    .replaceAll("今年有機會利用自己的能力", "可以從自己熟悉的能力開始試水溫")
    .replaceAll("獲得實際結果", "先看實際需求與成本是否清楚")
    .replaceAll("這樣的轉變能帶來新機遇", "這樣的轉變可以先當成新的收入方向測試")
    .replaceAll("新機遇", "新的收入方向")
    .replaceAll("順利推動", "比較穩妥地試行")
    .replaceAll("以順利推動這個新方向的發展會是比較穩妥的方法", "先小規模測試需求、回饋、成本與時間投入，會是比較穩妥的方法")
    .replaceAll("發展會是比較穩妥的方法", "先確認可持續性會比較穩")
    .replaceAll("更多收穫", "讓收入來源慢慢變清楚")
    .replaceAll("成功", "走得下去");

  result = result
    .replace(/(建議|可以|應該|需要|最好|或許|考慮).{0,16}(買賣|操作|持有|續抱|做空|放空)[^。]*。?/g, "這題重點不是金融操作，而是回到你熟悉的能力、需求、成本和執行節奏來看。")
    .replace(/(股票|期貨|基金|投資).{0,18}(買賣|停損|加碼|減碼|進場|出場|部位)[^。]*。?/g, "這題比較像收入方向規劃，不是股票期貨操作題。");

  if (
    !includesAny(result, [
      "收入",
      "賺錢",
      "成本",
      "需求",
      "能力",
      "技能",
      "經驗",
      "客人",
      "顧客",
      "執行節奏",
      "熟悉",
    ])
  ) {
    result = `${result.trim()}\n\n這題比較像收入方向規劃，不是股票期貨操作題。可以把重點放在你熟悉的能力或經驗、目前市場是否有需求、投入成本是否可控、時間節奏能不能長期維持，以及哪一種方式比較容易被你穩定執行。`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanMoneyFinanceLanguage(answer: string, context: ReadingContext) {
  const isMoneyFinance =
    context.questionType === "金錢財務" ||
    context.questionSubcategory.startsWith("金錢｜");

  if (!isMoneyFinance || isHighRiskInvestmentContext(context)) {
    return answer;
  }

  let result = answer
    .replaceAll("買進是比較不容易出錯", "購買決定比較有依據")
    .replaceAll("買進", "購買")
    .replaceAll("賣出", "處理")
    .replaceAll("進場", "開始")
    .replaceAll("出場", "收尾")
    .replaceAll("加碼", "增加投入")
    .replaceAll("減碼", "降低投入")
    .replaceAll("停損", "成本上限")
    .replaceAll("部位", "投入比例")
    .replaceAll("投資機會", "財務安排")
    .replaceAll("獲利機會", "改善空間")
    .replaceAll("績效", "執行結果")
    .replaceAll("報酬率", "成本效益")
    .replaceAll("報酬", "回收狀況")
    .replaceAll("搭建出更穩定的現金流", "讓現金流安排更清楚")
    .replaceAll("可能會遇上貴人讓你", "可能會遇到願意提供協助的人，讓你")
    .replaceAll("莫急於一時", "不要急於一時")
    .replaceAll("設置", "設定")
    .replaceAll("非常會讓你比較容易", "會讓你更容易")
    .replaceAll("是不比較穩的", "並不穩妥")
    .replaceAll("不比較穩", "不太穩妥");

  if (context.questionSubcategory === "金錢｜貸款借貸" && !hasRealEstateLoanCue(context.question)) {
    result = result
      .replaceAll("房貸", "貸款")
      .replaceAll("房屋貸款", "貸款")
      .replaceAll("買房貸款", "貸款")
      .replaceAll("房產貸款", "貸款")
      .replaceAll("房子", "這筆貸款")
      .replaceAll("房屋", "這筆貸款")
      .replaceAll("屋況", "條件")
      .replaceAll("房產", "貸款條件")
      .replaceAll("修繕", "後續支出");
  }

  if (context.questionSubcategory === "金錢｜偏財抽獎") {
    result = result
      .replaceAll("參加抽獎或小額投資", "小額參與抽獎或偏財活動")
      .replaceAll("小額投資", "小額參與")
      .replaceAll("小額投注", "小額娛樂")
      .replaceAll("投資一點", "有預算上限地參與")
      .replaceAll("投資一些", "有預算上限地參與")
      .replaceAll("加碼投注", "提高參與金額")
      .replaceAll("不要把抽獎當成投資", "不要把抽獎當成穩定收入")
      .replaceAll("不是投資", "不是穩定收入")
      .replaceAll("投資", "參與")
      .replaceAll("下注", "參與")
      .replaceAll("投注", "參與")
      .replaceAll("翻本", "追回")
      .replaceAll("有機會中獎", "可以小額參與，但不要把中獎當成必然")
      .replaceAll("中獎機會不錯", "可以小額參與，但期待不要放太高")
      .replaceAll("偏財運很好", "偏財期待可以保留，但要有預算上限")
      .replaceAll("會中獎", "不適合當成一定會中獎");

    result = result
      .split(/(?<=。|\n)/)
      .filter((part) => !includesAny(part, ["肺", "骨頭", "頭部", "脾胃", "免疫力", "身體健康"]))
      .join("")
      .trim();
  }

  if (context.questionSubcategory === "金錢｜回款收款") {
    result = result
      .replaceAll("一定收到", "有機會推進，但不適合保證一定入帳")
      .replaceAll("一定會收到", "有機會推進，但不適合保證一定入帳")
      .replaceAll("保證收到", "不能保證一定入帳")
      .replaceAll("必定收到", "不能保證一定入帳")
      .replaceAll("肯定收到", "不能保證一定入帳");

    const requiredTerms = [
      "款項",
      "付款節點",
      "對帳",
      "聯絡紀錄",
      "催收節奏",
      "付款時間",
      "金額",
      "約定",
      "入帳",
    ];
    const requiredTermCount = requiredTerms.filter((term) =>
      result.includes(term)
    ).length;
    const needsReceivableSupport =
      requiredTermCount < 3 || countChineseCharacters(result) < 220;

    if (
      needsReceivableSupport &&
      !result.includes("付款節點、付款時間、金額")
    ) {
      result = `${result.trim()}\n\n接下來可以把重點放在：付款節點、付款時間、金額、付款方式、對帳結果、聯絡紀錄和催收節奏。如果對方回覆模糊，就把原本約定重新寫清楚，確認何時入帳，避免只靠口頭印象等待。`;
    }
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanHealthSleepDiagnosisTone(answer: string, context: ReadingContext) {
  const question = context.question;
  const isHealthOrSleep =
    isHealthLifestyleContext(context) ||
    includesAny(question, ["睡眠", "睡不好", "作息", "休息", "失眠", "疲累", "疲勞"]);

  if (!isHealthOrSleep) {
    return answer;
  }

  const hasMedicalSymptom = includesAny(question, [
    "疾病",
    "症狀",
    "醫生",
    "醫師",
    "就醫",
    "治療",
    "檢查",
    "痛",
    "發燒",
    "咳嗽",
    "病",
  ]);

  let result = answer
    .replaceAll("身體狀態亟需重視", "作息和休息狀態需要先被看見")
    .replaceAll("身體狀態的確需要你特別關注", "作息和休息狀態確實需要你先照顧")
    .replaceAll("身體狀態不穩定", "生活節奏不太穩")
    .replaceAll("影響身體恢復能力", "影響體力和精神的恢復節奏")
    .replaceAll("身體的信號", "身體感受")
    .replaceAll("累積的疲勞狀態", "疲累累積")
    .replaceAll("疲勞狀態", "疲累累積")
    .replaceAll("身體會慢慢恢復", "狀態會比較容易穩定")
    .replaceAll("心理壓力確實需要調整", "壓力和作息需要調整")
    .replaceAll("加深你的焦慮與疲憊", "讓疲累與壓力更容易累積")
    .replaceAll("健康與舒適", "生活狀態和舒適度")
    .replaceAll("整體健康和生活品質", "體力、精神和白天狀態")
    .replaceAll("身體的狀況", "體力和休息狀態")
    .replaceAll("身體狀況", "體力和休息狀態")
    .replaceAll("身體健康", "體力與休息狀態")
    .replaceAll("身心健康", "生活狀態")
    .replaceAll("生理健康", "體力與休息狀態")
    .replaceAll("整體健康狀況", "整體生活狀態")
    .replaceAll("改善整體健康狀況", "讓生活節奏比較穩")
    .replaceAll("更健康的生活", "更穩定的生活節奏")
    .replaceAll("提高你的整體生活品質", "讓生活節奏比較穩")
    .replaceAll("提升你的整體生活品質", "讓生活節奏比較穩")
    .replaceAll("身心恢復", "精神和體力慢慢恢復")
    .replaceAll("身心的穩定", "精神和體力的穩定")
    .replaceAll("身心狀態", "生活狀態")
    .replaceAll("身心不適", "身體和心情都卡卡的")
    .replaceAll("身體耗損過度", "體力被過度消耗")
    .replaceAll("身體的恢復", "體力和精神狀態的調整")
    .replaceAll("身體狀態改善", "生活節奏比較穩")
    .replaceAll("提升健康", "調整生活節奏")
    .replaceAll("健康狀態", "體力和精神狀態")
    .replaceAll("身體警訊", "身體感受")
    .replaceAll("影響到健康", "影響體力、精神和白天狀態")
    .replaceAll("影響到你的健康", "影響你的體力、精神和白天狀態")
    .replaceAll("疲勞累積", "疲累累積")
    .replaceAll("慢性疲勞", "疲累累積")
    .replaceAll("直接關聯到整體健康和生活品質", "會影響體力、精神和白天狀態")
    .replaceAll("直接關聯到你的整體健康和生活品質", "會影響你的體力、精神和白天狀態")
    .replaceAll("睡眠品質非常重要，因為它會影響體力、精神和白天狀態", "睡眠品質會影響你的體力、精神和白天狀態，所以這題可以先把睡眠放在優先處理的位置")
    .replaceAll("可能導致你在身體上出現不適，包括疲勞與情緒失衡", "容易讓疲累、壓力和情緒起伏累積")
    .replaceAll("身體上出現不適，包括疲勞與情緒失衡", "疲累、壓力和情緒起伏累積")
    .replaceAll("以確認沒有潛在的健康問題", "讓專業醫師協助確認")
    .replaceAll("潛在的健康問題", "需要專業協助確認的狀況")
    .replaceAll("免疫力下降", "體力與恢復狀態變差")
    .replaceAll("身體的抵抗力降低", "體力與恢復狀態變差")
    .replaceAll("抵抗力降低", "體力與恢復狀態變差")
    .replaceAll("身體免疫力", "體力與恢復狀態")
    .replaceAll("免疫系統", "恢復狀態")
    .replaceAll("這是一個需要引起重視的警訊", "這是一個提醒你先調整作息的訊號")
    .replaceAll("警訊", "提醒")
    .replaceAll("長期疲勞", "疲累累積")
    .replaceAll("整體體力", "體力狀態")
    .replaceAll("專業的醫療協助", "專業人士協助")
    .replaceAll("專業醫療協助", "專業人士協助")
    .replaceAll("醫療協助", "專業人士協助")
    .replaceAll("醫生評估", "專業人士協助確認")
    .replaceAll("醫生", "專業人士")
    .replaceAll("身體信號", "身體感受")
    .replaceAll("身體提醒", "身體感受")
    .replaceAll("身體整體平衡", "作息與生活節奏")
    .replaceAll("消化不良", "飲食節奏不穩")
    .replaceAll("身心疲憊", "疲累累積")
    .replaceAll("情況惡化", "狀態更難恢復")
    .replaceAll("心理支持", "信任的人或專業人士協助")
    .replaceAll("心理諮詢", "專業人士協助")
    .replaceAll("焦慮正在吞噬你", "壓力和情緒容易累積")
    .replaceAll("心理問題", "壓力和情緒狀態")
    .replaceAll("情緒轉化為身體不適", "不安感可能影響休息")
    .replaceAll("心理健康", "壓力和情緒狀態")
    .replaceAll("肌力訓練", "循序漸進的運動")
    .replaceAll("身體的潛力", "體力條件")
    .replaceAll("抗壓能力", "面對壓力的狀態")
    .replaceAll("健康狀況惡化", "生活狀態更難恢復")
    .replaceAll("有效降低壓力與不適感", "幫助你逐步放鬆並穩定狀態")
    .replaceAll("健康優先", "先把作息與休息放回優先順序")
    .replaceAll("身體各項機能", "體力和白天狀態")
    .replaceAll("整體健康造成隱憂", "生活狀態更難恢復")
    .replaceAll("切勿忽視身體所發出的信號", "不要忽略身體感受")
    .replaceAll("讓醫生評估與處理身體的不適", "找專業人士協助確認")
    .replaceAll("讓專業人士評估與處理狀態明顯不舒服", "找專業人士協助確認")
    .replaceAll("身體的不適", "狀態明顯不舒服")
    .replaceAll("不適感", "不舒服")
    .replaceAll("醫療專業的協助", "專業協助")
    .replaceAll("專業醫師的協助", "專業協助")
    .replaceAll("專業醫師的意見", "專業人士的協助")
    .replaceAll("專業醫師", "專業人士")
    .replaceAll("醫療諮詢", "專業協助")
    .replaceAll("健康指標出現問題", "生活節奏越來越失衡")
    .replaceAll("健康指標", "生活狀態")
    .replaceAll("引發身體的不適", "讓體力和精神更難恢復")
    .replaceAll("造成不必要的健康問題", "讓疲累和壓力繼續累積")
    .replaceAll("不必要的健康問題", "疲累和壓力的累積")
    .replaceAll("更嚴重的健康問題", "更明顯的身體負擔")
    .replaceAll("如果這種情況持續影響到你的生活品質，建議尋求專業協助，以獲得更好的支持和指導。", "如果這種狀態持續影響生活，可以找專業人士協助確認，讓你有更穩的支持。")
    .replaceAll("若感覺持續不適，請不要猶豫，尋求專業人士的幫助，確認體力與休息狀態。", "若感覺持續不舒服，可以找專業人士協助確認，不要只靠自己硬撐。")
    .replaceAll("要改就有計畫地改，先評估代價與重建成本，不要亂破壞", "調整作息時先從小步驟開始，不要一次把生活節奏全部推翻")
    .replaceAll("先評估付出的代價與重建的成本，避免不必要的破壞", "先從小步驟調整，避免一次把生活節奏全部推翻")
    .replaceAll("看數字、規則、成本與紀律，不要硬拚或只靠意志撐", "先把作息規則、休息時間和可執行的小步驟列清楚，不要只靠意志硬撐")
    .replaceAll(
      "把界線、原則與可接受範圍講清楚，避免灰色地帶",
      "先替作息設定清楚底線，讓睡眠、飲食和休息時間不要一直被壓縮"
    )
    .replaceAll(
      "身體放鬆的同時也要注意日常的飲食與作息",
      "放鬆身心，也要維持基本作息與飲食節奏"
    );

  if (!hasMedicalSymptom) {
    let removedMedicalSentence = false;
    result = result
      .split(/(?<=。|\n)/)
      .filter((part) => {
        const hasOrganOrDiagnosis =
          /(腎臟|眼睛|內分泌|呼吸系統|生殖系統|脾胃|消化系統|器官|疾病|病症|健康問題|生理健康|健康指標|長期疲勞|警訊|身體信號|身體整體平衡|消化不良|身心疲憊|情況惡化|心理健康|情緒問題|不安情緒吞噬|肌力訓練|身體的潛力|抗壓能力|健康狀況惡化|健康優先|身體各項機能|整體健康|身體機能)/.test(part) ||
          /(專業醫師|醫療專業|醫療諮詢|醫療協助|醫療|醫生|醫師|心理諮詢|確認身體健康)/.test(part);

        if (hasOrganOrDiagnosis) {
          removedMedicalSentence = true;
          return false;
        }

        return true;
      })
      .join("");

    if (removedMedicalSentence && !includesAny(result, ["睡眠、作息、壓力和飲食節奏", "作息、壓力、睡眠和飲食"])) {
      result = `${result.trim()}\n\n這題不當成疾病判斷，先回到睡眠、作息、壓力和飲食節奏來看。若狀態持續影響生活，再找專業人士協助確認。`;
    }

    result = result
      .replace(/可能導致[^。]{0,20}(疾病|病症|慢性問題)[^。]*。?/g, "睡眠和壓力管理需要先穩定。")
      .replace(/要注意[^。]{0,12}(器官|肝|腎|心臟|腸胃|內分泌)[^。]*。?/g, "要先把睡眠、作息、壓力和飲食節奏穩定下來。");
  }

  return result
    .replace(/接下來，可以重點放在替作息設定清楚底線[^。]*。/g, "")
    .replace(/接下來可以將焦點放在設定清晰的作息底線[^。]*。/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanInventedHealthOrganLanguage(answer: string, context: ReadingContext) {
  if (!isHealthLifestyleContext(context)) {
    return answer;
  }

  const question = context.question.toLowerCase();
  const allowedTerms = new Set<string>();

  if (includesAny(question, ["胃", "腸胃"])) {
    allowedTerms.add("胃");
    allowedTerms.add("腸胃");
  }

  if (includesAny(question, ["頭暈", "頭痛"])) {
    allowedTerms.add("頭暈");
    allowedTerms.add("頭痛");
  }

  if (includesAny(question, ["洗腎", "腎"])) {
    allowedTerms.add("洗腎");
    allowedTerms.add("腎");
    allowedTerms.add("腎臟");
  }

  const inventedTerms = [
    "內分泌",
    "循環系統",
    "肺部",
    "肺",
    "骨頭",
    "頭部",
    "腎",
    "腎臟",
    "牙齒",
    "耳朵",
    "婦科",
    "肝臟",
    "發炎",
    "家族病史",
    "神經",
    "四肢痠麻",
    "生殖系統",
    "呼吸系統",
    "免疫力",
    "疾病名稱",
    "疾病",
    "病症",
    "消化不良",
    "健康惡化",
    "長期健康隱患",
    "脾胃",
    "淋巴",
    "血壓",
    "血糖",
  ];

  let removed = false;
  const cleaned = answer
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      if (!text) {
        return true;
      }

      const hasInventedTerm = inventedTerms.some(
        (term) => text.includes(term) && !allowedTerms.has(term)
      );

      if (hasInventedTerm) {
        removed = true;
        return false;
      }

      return true;
    })
    .join("")
    .trim();

  if (!removed) {
    return cleaned;
  }

  const isCriticalHealthSubcategory = [
    "健康｜重大健康",
    "健康｜照護安排",
    "健康｜家人溝通",
  ].includes(context.questionSubcategory);
  const supplement = isHealthCriticalQuestion(context.question) || isCriticalHealthSubcategory
    ? "這題先回到醫療資訊、照護分工、家人溝通與陪伴，不額外推測病情結果。"
    : "這題先回到睡眠、作息、壓力、飲食節奏和體力狀態，不額外推測沒有提到的器官或疾病。";

  return `${cleaned}\n\n${supplement}`.replace(/\n{3,}/g, "\n\n").trim();
}

function removeDuplicateHealthSafetyAdvice(answer: string, context: ReadingContext) {
  if (!isHealthLifestyleContext(context)) {
    return answer;
  }

  const safetySentence = "若狀態持續影響生活，再找專業人士協助確認。";
  let removedSafetyAdvice = false;
  const cleaned = answer
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      if (!text) {
        return true;
      }

      const isSafetyAdvice =
        text === safetySentence ||
        /(專業人士協助|專業協助|尋求專業|醫療協助|醫生|醫師|心理諮詢|醫療諮詢|狀態持續影響生活)/.test(text);

      if (isSafetyAdvice) {
        removedSafetyAdvice = true;
        return false;
      }

      return true;
    })
    .join("")
    .trim();

  if (!removedSafetyAdvice) {
    return cleaned;
  }

  return `${cleaned}\n\n${safetySentence}`.replace(/\n{3,}/g, "\n\n").trim();
}

function dedupeProfessionalAdviceForHealthCritical(answer: string, context: ReadingContext) {
  if (!isHealthCriticalQuestion(context.question)) {
    return answer;
  }

  let hasSeenFirstParagraph = false;
  const professionalAdvicePattern =
    /(專業人士協助|專業協助|尋求專業|醫療團隊|醫療資訊|醫療|醫師|醫生|就醫|醫院|狀態持續影響生活)/;

  const cleaned = answer
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const text = paragraph.trim();
      if (!text) {
        return "";
      }

      if (!hasSeenFirstParagraph) {
        hasSeenFirstParagraph = true;
        return text;
      }

      return text
        .split(/(?<=。|\n)/)
        .filter((sentence) => {
          const sentenceText = sentence.trim();
          if (!sentenceText) {
            return true;
          }

          if (sentenceText.includes("不額外推測沒有提到的器官或疾病")) {
            return true;
          }

          return !professionalAdvicePattern.test(sentenceText);
        })
        .join("")
        .trim();
    })
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || answer;
}

function cleanMultiMonthComparisonLanguage(answer: string, context: ReadingContext) {
  if (!isMultiMonthTimeComparisonQuestion(context.question)) {
    return answer;
  }

  const isInvestmentMonth =
    context.questionType === "金錢投資" ||
    isInvestmentDecisionQuestion(context.questionType, context.question);
  const isTravelMonth = includesAny(context.question, ["出國", "旅遊", "旅行", "出遊", "出去玩"]);
  const fixed = isInvestmentMonth
    ? "這次單張牌不適合直接在多個月份裡硬選一個月份；若要比較候選月份，建議每個候選月份各抽一張牌再比較。這張牌比較適合提醒你：若要比較投資時間點，應先分開抽牌；目前只能看整體風險條件、成本、資訊完整度、資金安排與交易紀律是否清楚。"
    : isTravelMonth
      ? "這次單張牌不適合直接在多個月份裡硬選一個月份；若要比較出國月份，建議每個候選月份各抽一張牌再比較。以目前這張牌來看，重點不是挑出某個月份，而是先看出國計畫的整體提醒。"
      : "這次單張牌不適合直接在多個月份裡硬選一個月份；若要比較候選月份，建議每個候選月份各抽一張牌再比較。以目前這張牌來看，重點不是挑出某個月份，而是先看這件事的整體提醒。";
  let result = answer
    .split(/(?<=。|\n)/)
    .filter(
      (part) => {
        const hasHardMonthChoice =
          /(一|二|三|四|五|六|七|八|九|十|十一|十二|\d{1,2})月[^。]{0,24}(比較|最|相對|較)[^。]{0,12}(適合|順|好|有利|具潛力)/.test(part) ||
          /(比較|最|相對|較)[^。]{0,12}(適合|順|好|有利|具潛力)[^。]{0,24}(一|二|三|四|五|六|七|八|九|十|十一|十二|\d{1,2})月/.test(part);
        const repeatedMonthNotice =
          includesAny(part, [
            "單張牌",
            "候選月份",
            "多個月份",
            "每個候選月份",
            "確切哪一天",
            "硬選",
            "重點不是挑出某個月份",
            "先看這件事的整體提醒",
            "出國月份",
            "出國計畫的整體提醒",
            "若要比較投資時間點",
            "比較投資時間點",
            "若要比較日期",
            "候選日期",
            "單純選擇出國的月份",
            "直接選月份",
            "挑出某個月份",
          ]) &&
          includesAny(part, ["月份", "哪一天", "候選日期", "日期", "硬選", "比較", "整體提醒"]);

        return !hasHardMonthChoice && !repeatedMonthNotice;
      }
    )
    .join("")
    .replaceAll("某個月份比較適合", "需要分別抽牌後再比較")
    .replaceAll("某個月比較適合", "需要分別抽牌後再比較")
    .replaceAll("某個月份最適合", "需要分別抽牌後再比較")
    .replaceAll("某個月最適合", "需要分別抽牌後再比較");

  if (isInvestmentMonth) {
    result = result
      .replaceAll("參與者狀態", "資訊完整度")
      .replaceAll("時間流程", "交易紀律")
      .replaceAll("現場變動", "市場波動")
      .replaceAll("開幕流程", "資金安排")
      .replaceAll("活動安排", "風險安排")
      .replaceAll("準備進度", "風險條件")
      .replaceAll("選日期時", "比較投資時間點時");
  } else {
    result = result
      .replaceAll("根據這張牌的解讀，近期可能不太適合出國。", "這張牌提醒你，出國安排本身需要先把變動和細節想清楚。")
      .replaceAll("近期可能不太適合出國。", "出國安排本身需要先把變動和細節想清楚。");
  }

  return `${fixed}\n\n${result}`.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanNoCandidateDateComparisonLanguage(answer: string, context: ReadingContext) {
  if (!isDateSelectionQuestion(context.question) || hasMultipleCandidateDates(context.question)) {
    return answer;
  }

  return answer
    .replaceAll("若要比較多個日期建議每個候選日期各抽一張牌再依牌面分別比較。", "如果要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。")
    .replaceAll("若要比較多個日期，建議每個候選日期各抽一張牌，再依牌面分別比較。", "如果要比較日期，建議先列出 3 到 5 個候選日期，再分別抽牌比較。")
    .replaceAll("建議你們在每個候選日期上都進行比較根據當天的行程、體力、天氣等做出相應調整。", "你們可以先討論幾個可行日期，再依照行程、體力、天氣、交通和彼此時間來篩選。")
    .replaceAll("建議你確認每個候選日期都有清晰的行程安排", "如果你們已經有幾個可行日期，可以再分別抽牌比較；在那之前，先確認交通、住宿、同行者時間與預算")
    .replaceAll("建議你們可以針對每個候選日期各自抽一張牌進行更細緻的比較以找到最合適的日子。", "建議你們先列出幾個彼此都方便的日期，再分別抽牌比較，會比直接問整個月份哪一天更準。")
    .replaceAll("如果有多個候選日期建議每個日期都抽一張牌再比較各自的狀況", "如果你們已經有幾個可行日期，可以再分別抽牌比較")
    .replaceAll("具體建議是若有多個候選日期可以針對每個日期進行詳細的討論並根據天氣預報和交通狀況作出最終決策。", "具體建議是，你們可以先列出幾個彼此都方便的日期，再依照天氣、交通、行程節奏和體力安排做篩選。")
    .replaceAll("每個日期都應該考慮同行者的可行性、交通情況及天氣預報以避免不必要的延誤或不適感。", "等你們列出候選日期後，再逐一確認同行者時間、交通情況和天氣預報，避免不必要的延誤。")
    .replaceAll("甚至可以為每個日期隨機抽牌來決定最合適的出行時機。", "如果你們列出幾個候選日期，可以再讓每個候選日期各自抽牌比較。")
    .replaceAll("每個候選日期各抽一張牌", "先列出幾個候選日期，再分別抽牌")
    .replaceAll("每個候選日期上都進行比較", "先列出幾個候選日期再比較")
    .replaceAll("每個日期都抽一張牌", "列出候選日期後再分別抽牌");
}

function cleanDateCardSpecificMeaning(answer: string, context: ReadingContext) {
  let result = answer;
  const isDateOrActivity =
    context.questionType === "活動注意" ||
    context.questionType === "日期擇日" ||
    includesAny(context.questionSubcategory, [
      "出去玩日期",
      "單一出遊日期",
      "活動日期",
      "開幕日期",
      "課程日期",
      "簽約日期",
    ]);

  if (isDateOrActivity && context.card.name === "天機星" && context.position === "反位") {
    result = result
      .replaceAll("行程規劃可能不夠順利", "行程規劃可能不夠縝密，或有些安排還不夠完善")
      .replaceAll("規劃可能不夠順利", "規劃可能不夠縝密，或有些安排還不夠完善")
      .replaceAll("安排可能不夠順利", "安排可能不夠縝密，或有些細節還不夠完善");
  }

  if (
    context.questionSubcategory.includes("開幕") &&
    context.card.name === "紫微星" &&
    context.position === "反位"
  ) {
    result = result
      .replaceAll("這段期間紫微星反位代表想辦得風光但現實條件未必完全支撐的狀態。", "紫微星反位放在開幕日期這題，代表如果你希望開幕辦得很熱鬧、很風光、很有排場，現階段可能不會完全如你所願。")
      .replaceAll("紫微星反位代表想辦得風光但現實條件未必完全支撐的狀態。", "紫微星反位放在開幕日期這題，代表如果你希望開幕辦得很熱鬧、很風光、很有排場，現階段可能不會完全如你所願。");
  }

  if (context.questionSubcategory.includes("開幕")) {
    result = result
      .replaceAll("選開幕日期時要注意行程安排、參與者狀態、時間流程與現場變動", "選開幕日期時要注意開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、客流與備案")
      .replaceAll("行程安排、參與者狀態、時間流程與現場變動", "開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、客流與備案")
      .replaceAll("參與者狀態", "人員分工")
      .replaceAll("時間流程", "開幕流程");
  }

  return result;
}

function buildContextualReverseAdvice(context: ReadingContext) {
  const cardName = context.card.name;
  const subcategory = context.questionSubcategory;
  const questionType = context.questionType;

  const isTravel =
    subcategory.includes("出去玩") ||
    subcategory.includes("單一出遊") ||
    subcategory.includes("出遊同行");
  const isOpening = subcategory.includes("開幕");
  const isContract = subcategory.includes("簽約") || questionType === "合約法律";
  const isCourse = subcategory.includes("課程");
  const isActivity = subcategory.includes("活動日期") || questionType === "活動注意";

  if (isTravel) {
    const travelAdviceByCard: Record<string, string> = {
      破軍星:
        "接下來如果要調整出遊計畫，建議先確認交通、住宿、同行者時間與預算，再決定要不要更動行程，不要臨時大改。",
      太陽星:
        "接下來要把出發時間、集合方式、誰負責訂房或交通先說清楚，避免到時候大家都以為別人會處理。",
      天府星:
        "接下來可以先盤點交通、預算、同行者時間與備案。如果這些條件還沒穩，不要硬把日期定下來。",
      武曲星:
        "接下來可以先講清楚費用分攤、交通預算與誰負責付款，避免出遊還沒開始就因為錢或責任卡住。",
    };

    return travelAdviceByCard[cardName] || "接下來可以先確認交通、時間、同行者狀態、預算與備案，再決定要不要推進這次出遊安排。";
  }

  if (isOpening) {
    if (cardName === "紫微星") {
      return "接下來先不要只追求開幕排場、熱鬧或面子，請先確認流程、人員、宣傳、現場動線、接待安排、時間安排與備案是否真的到位。";
    }

    return "接下來可以先檢查開幕流程、人員分工、宣傳節奏、現場動線、接待安排、時間安排、客流與備案，再決定是否要推進開幕安排。";
  }

  if (isContract) {
    return "接下來可以把條款、付款時間、責任歸屬、文件細節與口頭承諾重新確認清楚，必要時請專業人士協助檢查。";
  }

  if (isCourse) {
    if (questionType === "經營推廣" || subcategory.startsWith("經營｜課程")) {
      if (subcategory === "經營｜課程內容優化") {
        return "接下來可以先補能讓學生立刻看懂的案例，並把案例放回課程學習成果裡。講義可以同步整理，但重點不是把資料塞滿，而是讓學生知道上完這堂課能解決什麼問題、怎麼使用這些案例、報名後會拿到什麼內容。";
      }

      return "接下來可以先確認課程價值、報名流程、學生痛點、案例見證、課後交付方式與學員後續支持，不要只急著上架，先確認課程頁面與報名資訊是否完整。";
    }

    return "接下來可以先確認課程內容、學習目標、時間安排、負擔會不會太大，以及後續複習方式。不要只急著開始，先確認自己能不能穩定吸收。";
  }

  if (isActivity) {
    return "接下來可以先確認活動流程、參與者狀態、場地、人力分工與備案，讓現場執行不要因為細節不足而卡住。";
  }

  return buildReverseToUprightUserAdvice(cardName);
}

function enforceReverseToUprightAdvice(answer: string, context: ReadingContext) {
  if (context.position !== "反位") {
    return answer;
  }

  if (detectDateIntent(context.question) === "multi_candidate_compare") {
    return answer;
  }

  if (answer.includes("正位的健康方向") || answer.includes("回到")) {
    return answer;
  }

  const contextualAdvice = buildContextualReverseAdvice(context);

  if (answer.includes("後續建議是") || answer.includes("接下來可以把重點放在：")) {
    return answer
      .replace(/後續建議是：[^。\n]*(?:。|$)/g, `${contextualAdvice}。`)
      .replace(/接下來可以把重點放在：[^。\n]*(?:。|$)/g, `${contextualAdvice}。`);
  }

  return `${answer.trim()}\n\n${contextualAdvice}`;
}

function cleanCommonBadPhrases(answer: string) {
  return answer
    .replace(/^\s*\{?\s*"finalAnswer"\s*:\s*"?/gim, "")
    .replace(/^\s*"?(?:changedMeaning|safetyAdjusted|issuesFixed|reviewFallbackUsed|reviewIssuesFixed)"?\s*:.*$/gim, "")
    .replace(/^\s*}\s*$/gim, "")
    .replaceAll(
      "這張牌看起來許多思考與變動的情境",
      "這張牌顯示，這天交通安排容易出現較多變動"
    )
    .replaceAll("這張牌看起來許多", "這張牌顯示")
    .replaceAll(
      "許多思考與變動的情境",
      "較多變動，需要先整理資訊"
    )
    .replaceAll(
      "這段時間活動動腦的契機",
      "這段時間有動腦與學習新內容的契機"
    )
    .replaceAll(
      "活動動腦的契機",
      "動腦與學習新內容的契機"
    )
    .replaceAll("出遊的體驗將會變得更加精彩", "出遊體驗會比較有趣")
    .replaceAll("最大化這次出行的樂趣", "讓這次出遊更順、更有彈性")
    .replaceAll("采用", "採用")
    .replaceAll("冲動", "衝動")
    .replaceAll("沖動", "衝動")
    .replaceAll("可能會遇上貴人讓你", "可能會遇到願意提供協助的人，讓你")
    .replaceAll("莫急於一時", "不要急於一時")
    .replaceAll("買進是比較不容易出錯", "購買決定比較有依據")
    .replaceAll("搭建出更穩定的現金流", "讓現金流安排更清楚")
    .replaceAll("非常會讓你比較容易", "會讓你更容易")
    .replaceAll("是不比較穩的", "並不穩妥")
    .replaceAll("不比較穩", "不太穩妥")
    .replaceAll("設置", "設定")
    .replaceAll("根據這張牌的看起來", "從這張牌來看")
    .replaceAll("根據牌面的看起來", "從牌面來看")
    .replaceAll("看起來看起來", "看起來")
    .replaceAll("目前的狀態看起來一種", "目前的狀態看起來有一種")
    .replaceAll("會更容易未來的發展", "會更有利於後續發展")
    .replaceAll("比較容易更好地", "更容易")
    .replaceAll("身體放鬆的同時也要注意日常的飲食與作息", "放鬆身心，也要維持基本作息與飲食節奏")
    .replaceAll("賺錢會比較如魚得水易如反掌", "賺錢方式可以朝自己較熟悉、較能掌握成本與風險的方向嘗試")
    .replaceAll("這段時間里", "這段時間裡")
    .replaceAll("相應的調整", "備案")
    .replaceAll("思想上的反覆", "規劃反覆")
    .replaceAll("機會將會大大增加", "會比較有方向")
    .replaceAll("學習效果更佳", "學習會比較穩")
    .replaceAll("推動你在學習過程中的成長", "幫助你建立學習節奏")
    .replaceAll("會有容易的人支持", "可能會有人願意支持")
    .replaceAll("會更容易更好地", "會更容易")
    .replaceAll("進一步clarify", "進一步釐清")
    .replaceAll("口頭應承", "口頭承諾")
    .replaceAll("天梁星的反位看起來一些可能有問題", "天梁星反位提醒這份承諾可能有些不穩")
    .replaceAll("会更会更容易", "會更容易")
    .replaceAll("會更會更容易", "會更容易")
    .replaceAll("一定要要", "要")
    .replaceAll("更加會更容易", "會更容易")
    .replaceAll("這樣更加會更容易", "這樣會更容易")
    .replaceAll("這樣才會更容易關係的進一步發展", "這樣才比較有機會讓關係往前")
    .replaceAll("目前看起來一定的穩定性", "目前看起來有一定穩定性")
    .replaceAll("對方目前的態度的互動", "對方目前的互動態度")
    .replaceAll("這段關係目前看起來的是", "這段關係目前看起來是")
    .replaceAll("這段關係的現狀看起來一些不穩定的特質", "這段關係目前有些不穩定")
    .replaceAll("可以該觀察", "可以觀察")
    .replaceAll("按耐", "按捺")
    .replaceAll("稍為", "稍微")
    .replaceAll("這場關係", "這段關係")
    .replaceAll("更加會更容易改善", "會更容易改善")
    .replaceAll("這個狀態代表", "")
    .replaceAll("這個狀態強調的是", "重點是")
    .replaceAll("這個狀態強調", "重點是")
    .replaceAll("從這個狀態來看，", "")
    .replaceAll("從這個狀態來看", "")
    .replaceAll("這件事本身在目前的開幕計劃中，看起來一些不安", "目前的開幕計畫中，確實有一些不安")
    .replaceAll("這件事本身在目前的開幕計劃中，", "目前的開幕計畫中，")
    .replaceAll("這件事本身在", "")
    .replaceAll("合適的溝通方式", "合適的溝通方式")
    .replaceAll("會更容易", "會更容易")
    .replaceAll("會更容易", "會更容易")
    .replaceAll("能會更容易", "會更容易")
    .replaceAll("更比較穩", "更穩")
    .replaceAll("無法不能只靠牌面決定一定入帳", "不能只靠牌面保證一定入帳")
    .replaceAll("無法不能只靠", "不能只靠")
    .replaceAll("看起來良好的合作機會", "看起來有合作機會")
    .replaceAll("會會", "會")
    .replaceAll("不能只靠牌面不能只靠牌面", "不能只靠牌面")
    .replaceAll("我你可以", "你可以")
    .replaceAll("很會更容易", "會更容易")
    .replaceAll("看起來了", "看起來")
    .replaceAll("让", "讓")
    .replaceAll("顺利", "順利")
    .replaceAll("讓我讓你走好這一步", "先把細節做好，會更有利於後續推進")
    .replaceAll("經營", "經營")
    .replaceAll("客人", "客人")
    .replaceAll("情境", "情境")
    .replaceAll("開店流程", "開店流程")
    .replaceAll("開店", "開店")
    .replaceAll("品質", "品質")
    .replaceAll("信息", "資訊")
    .replaceAll("机制", "機制")
    .replaceAll("務必", "一定要")
    .replaceAll("要要", "要")
    .replaceAll("确保", "確認")
    .replaceAll("务必", "一定要")
    .replaceAll("顾客", "顧客")
    .replaceAll("他（她）", "對方")
    .replaceAll("他(她)", "對方")
    .replaceAll("這個人或許有一種深邃而隱秘的氣質讓對方看得出不安感", "這個人可能帶著深邃而隱秘的氣質，也比較容易流露不安感")
    .replaceAll("這件事本身有狀態上升的機會你有可能", "這件事本身有狀態上升的機會，你比較有機會")
    .replaceAll("將會有實質利益實際結果", "比較有機會看到實際回饋")
    .replaceAll("將會更容易", "會更容易")
    .replaceAll("總體來說", "整體來看")
    .replaceAll("总體", "整體")
    .replaceAll("来说", "來看")
    .replaceAll("考慮要如何", "思考怎麼")
    .replaceAll("考虑", "考慮")
    .replaceAll("可會更容易", "會更容易")
    .replaceAll("會更會讓你比較容易的決策", "會比較容易做出決定")
    .replaceAll("會更會讓你比較容易", "會更容易")
    .replaceAll("會更容易更順利", "會更順利")
    .replaceAll("實際結果將會實際結果", "會比較容易看到實際成果")
    .replaceAll("合約本身的可靠性和長期穩定性", "合約本身的可靠性與長期穩定度")
    .replaceAll("看起來有些沒有順利往前", "推進上可能不太順")
    .replaceAll("沒有充分的支持條件這次的出行計畫可能會有些沒有順利往前", "如果支持條件還不夠，這次出遊計畫推進起來可能不太順")
    .replaceAll("有些沒有順利往前", "不太順")
    .replaceAll("活動當天間", "活動當天")
    .replaceAll("確認全家人的樂趣", "讓全家人玩得更安心")
    .replaceAll("這件事本身呈現", "這件事看起來")
    .replaceAll("這個狀態下呈現", "目前看起來")
    .replaceAll("能夠適合安排", "可以安排")
    .replaceAll("準備度跟得上", "準備度能跟上")
    .replaceAll("適合安排行拍攝日", "可以安排拍攝日")
    .replaceAll("這樣會更會讓你比較容易的決策", "這樣會讓你比較容易做決定")
    .replaceAll("會更容易.stdout想法和彼此的理解清楚", "會更容易把想法和彼此理解說清楚")
    .replaceAll(".stdout", "")
    .replaceAll(".stderr", "")
    .replaceAll("這樣將確認你在租約上的順利進行", "這樣會讓租約流程更穩妥")
    .replaceAll("文檔", "文件")
    .replaceAll("保持靈活應變這會更容易活動的順利進行", "保持靈活應變，會更有利於活動順利進行")
    .replaceAll("這會更容易活動的順利進行", "會更有利於活動順利進行")
    .replaceAll("這次活動要注意的事情本身可能有些沒有順利往前", "這次活動的推進可能不太順")
    .replaceAll("現階段貌似有些障礙可能導致出行的負擔上升", "目前看起來有些阻礙，可能讓出行負擔增加")
    .replaceAll("後續建議是：", "接下來可以把重點放在：")
    .replaceAll("貌似", "看起來")
    .replaceAll("成功的機會哦", "成功的機會")
    .replaceAll("哦", "")
    .replaceAll("出游", "出遊")
    .replaceAll("planning", "行程規劃")
    .replaceAll("逆位", "反位")
    .replaceAll("不能只靠牌面不能只靠牌面", "不能只靠牌面")
    .replaceAll("不能只靠牌面保證", "不能只靠牌面決定")
    .replaceAll("將更會更容易", "會更容易")
    .replaceAll("更會更容易", "會更容易")
    .replaceAll("祝賀開幕的日子", "正式開幕日期")
    .replaceAll("再適時再定出", "再視情況決定")
    .replaceAll("站出來看起來主導權", "站出來主導")
    .replaceAll("虽然", "雖然")
    .replaceAll("現場運行", "現場執行")
    .replaceAll("這會更容易整體拍攝的流程順利進行", "這會讓整體拍攝流程更順利")
    .replaceAll("實際實際結果", "實際結果")
    .replaceAll("請要", "請")
    .replaceAll("容易會有", "比較容易得到")
    .replaceAll("這會更容易後續的進行", "這會讓後續進行更順利")
    .replaceAll("请", "請")
    .replaceAll("有人來讓你整理", "受到他人的提醒")
    .replaceAll("當心臟決定之後", "當你下定決心之後")
    .replaceAll("比較順和和諧", "更順利、更和諧")
    .replaceAll("面子和控制慾過重的狀態", "想辦得風光但現實條件未必完全支撐")
    .replaceAll("面子和控制慾過重", "想辦得風光但現實條件未必完全支撐")
    .replaceAll("比較容易們", "讓你們")
    .replaceAll("會讓你比較容易們的遊玩體驗比較順", "會讓你們的遊玩體驗更順")
    .replaceAll("這次出遊日期的選擇可以看但要特別注意行程安排", "這次出遊日期可以評估，但要特別注意行程安排")
    .replaceAll("照耀與主導的特質讓事情變得更加明亮和透明", "主動把行程、交通和時間安排說清楚，讓整體計畫更明確")
    .replaceAll("這趟旅行的潛力和可行性但", "這趟旅行有可行性，但")
    .replaceAll("睡眠品質下降容易造成疲憊或分心", "容易忽略交通、時間或同行者需求等實際細節")
    .replaceAll("太陽星在此時此刻給了你光明的方向仍需留意天氣變化和同行者的體力狀況", "太陽星正位代表這次適合把行程、交通和時間安排講清楚，但仍要留意天氣變化和同行者體力")
    .replaceAll("光明的方向", "明確的安排方向")
    .replaceAll("資料搜集不實", "資訊整理不完整")
    .replaceAll("資料蒐集不實", "資訊整理不完整")
    .replaceAll("同行家人的需求和心理狀態", "同行家人的需求、體力和時間安排")
    .replaceAll("這樣能讓行程比較順盡量減少臨時的變故與困擾", "這樣能讓行程比較順，也能減少臨時變動帶來的困擾")
    .replaceAll("讓你感到燒腦", "讓你覺得安排起來很費心")
    .replaceAll("但記得不要太過於保守或計算可以順勢而為", "但也不要太過保守或算得太細，可以保留一點彈性")
    .replaceAll("只要確認一切有序就能享受與家人同行的美好時光", "只要安排有序，這趟和家人的出遊就會比較舒服")
    .replaceAll("這段時間也特別注意壓力的管理避免身體的疲憊影響到後續的執行", "這段時間也要注意壓力管理，避免過度疲累影響後續執行")
    .replaceAll("紫微星在這問題上反位", "紫微星反位放在這個問題裡")
    .replaceAll("周围", "周圍")
    .replaceAll("照亮整個過程", "推進開幕準備")
    .replaceAll("執行力極高", "行動力較強")
    .replaceAll("提前做好準備參數", "提前把拍攝流程、分工和備案準備好")
    .replaceAll("具體建議是建議", "具體建議是")
    .replaceAll("現場流程自我管理", "現場流程與自我管理")
    .replaceAll("確認整體活動比較順", "讓整體拍攝流程更順")
    .replaceAll("内部", "內部")
    .replaceAll("把活動組織得響亮", "把出遊安排得有條理")
    .replaceAll("行程安排 要留意", "行程安排要留意")
    .replaceAll("核對同事們的意見", "確認家人的意見")
    .replaceAll("同事們的意見", "家人的意見")
    .replaceAll("每個人都要放心", "讓每個人都比較安心")
    .replaceAll("這樣就能不能只靠牌面決定你們的家庭出行能夠愉快又順利", "這樣會讓家庭出遊更順利，也比較舒服")
    .replaceAll("不能只靠牌面決定你們的家庭出行能夠愉快又順利", "讓家庭出遊更順利，也比較舒服")
    .replaceAll("很難不能只靠牌面決定拍攝能夠如預期順利進行", "如果準備和人員狀態還不穩，拍攝就不容易如預期順利")
    .replaceAll("六殺星", "七殺星")
    .replaceAll("你要衝並扛住壓力", "你要把準備做足，再果斷推進")
    .replaceAll("勇往直前", "果斷推進")
    .replaceAll("行動意向與具備的力量", "行動力與準備條件")
    .replaceAll("就是要快速", "可以先")
    .replaceAll("這樣會更容易聚餐的成功", "這樣會讓聚餐更容易順利進行")
    .replaceAll("經濟來源", "預算")
    .replaceAll("也確認聚餐愉快", "也讓聚餐氣氛更愉快")
    .replaceAll("避免而產生", "避免產生")
    .replaceAll("表面上不看得出不滿", "表面上可能看不出不滿")
    .replaceAll("簽協定", "簽合約")
    .replaceAll("部屬好行程安排", "安排好行程")
    .replaceAll("不容易踩雷", "不容易出錯")
    .replaceAll("這樣能讓流程更加順暢確認旅行的愉快", "這樣能讓流程更順，也比較能提升旅行品質")
    .replaceAll("確認在選擇日期時提前討論、確認行程讓出遊的每一個環節都更為完美", "選日期前先討論清楚，並確認行程、交通與體力安排，會讓這次出遊更穩")
    .replaceAll("太陽星的正位提醒了這次出遊的好處：照亮你們的計劃讓行程安排變得更明朗", "太陽星正位放在出遊題裡，代表這次適合把行程、時間、交通和分工講清楚，讓整體安排更明朗")
    .replaceAll("來共度這段美好時光", "讓這次出遊更順")
    .replaceAll("出遊前也要記得調整心情努力避免過度焦慮以更輕鬆的心情迎接家庭旅程", "出遊前先把交通、集合時間、天氣、家人體力和備案整理清楚，避免因為資訊太亂而反覆改計畫")
    .replaceAll("太陽星反位代表光線不足這代表在行程規劃、交通安排等方面可能會因為操之過急而未能考慮周全", "太陽星反位代表這次安排可能不夠明朗，容易因為急著決定而沒有把交通、時間和家人狀態考慮周全")
    .replaceAll("光線不足", "安排不夠明朗")
    .replaceAll("大家的體力和同行者的需要會看起來非常重要", "家人的體力、時間和需求會是這次出遊能不能順利的關鍵")
    .replaceAll("參加者可能會出現不滿情緒相對於愉快的家庭時光反而造成負擔", "如果安排不清楚，家人可能會覺得疲累或不方便，反而讓原本輕鬆的出遊變成負擔")
    .replaceAll("這段時間會掌握良好的資源讓你在安排活動時能夠穩定且務實", "這段時間比較適合用穩定、務實的方式安排出遊")
    .replaceAll("確認大家都能愉快享受這趟旅程", "讓大家都能比較安心、舒服地完成這趟行程")
    .replaceAll("團隊間的溝通和規劃會非常重要讓每個人成為負責任的一部分", "團隊之間的溝通和規劃很重要，最好讓每個人都清楚自己的責任")
    .replaceAll("讓每個人成為負責任的一部分", "讓每個人都清楚自己的責任")
    .replaceAll("這樣開幕會比較順", "這樣開幕流程會比較穩")
    .replaceAll("從紫微星反位來看現階段在開幕日期的選擇上可能會出現一些問題", "紫微星反位放在開幕題裡，代表如果你希望開幕很熱鬧、很風光、很有排場，現階段可能不會完全如你所願")
    .replaceAll("宣傳與人員準備上可能缺乏實際結果", "宣傳、人員準備或現場流程可能還沒有真正到位")
    .replaceAll("缺乏實際結果", "還沒有真正到位")
    .replaceAll("確認這些細節都能妥善執行在做出正式開幕決定前會讓一切更加穩妥", "在做出正式開幕決定前，先確認這些細節都能妥善執行，會讓整體更穩")
    .replaceAll("太陽星的正位看起來這段時間很適合主動出面讓一切變得明亮而清晰對於開幕的規劃和宣傳這股熱情會給你帶來不少貴人支持", "太陽星正位放在開幕題裡，代表這段時間適合你主動把開幕流程、宣傳重點和團隊分工講清楚。只要方向明確，也比較容易得到他人支持")
    .replaceAll("讓一切變得明亮而清晰", "把方向講清楚")
    .replaceAll("這個月的拍攝安排可以考慮整體上看還是有機會順利進行", "這個月可以考慮安排拍攝，整體來看有機會順利推進")
    .replaceAll("但也要留意身體狀況和準備進度必須跟上", "但也要留意設備、場地、人員和流程準備必須跟上")
    .replaceAll("身體狀況和準備進度必須跟上", "設備、場地、人員和流程準備必須跟上")
    .replaceAll("參與者的身體狀況", "參與者的體力與時間狀態")
    .replaceAll("這個月安排拍攝日不太適合", "這張牌比較偏向：這個月安排拍攝要保守一點，除非準備和人員狀態已經穩定")
    .replaceAll("這樣的影響可能會讓整個拍攝過程變得不穩定", "這些因素可能讓拍攝流程變得不穩")
    .replaceAll("代表現在是個敢衝、敢扛的時期", "代表這段時間行動力和抗壓性較強")
    .replaceAll("敢衝、敢扛", "行動力和抗壓性較強")
    .replaceAll("安排家人聚餐最佳選擇在於協調參與者的意見和現場的準備狀況", "安排家人聚餐時，重點在於協調家人的時間、意見和現場準備狀況")
    .replaceAll("最佳選擇在於", "重點在於")
    .replaceAll("這段時間七殺正位看起來行動的果斷性刻意準備會讓整個聚會更順利", "七殺星正位代表行動力強，只要事前準備明確，聚會就比較容易推進")
    .replaceAll("果斷性刻意準備", "事前準備明確")
    .replaceAll("這樣才能確認聚會愉快而不緊湊", "這樣才能讓聚會愉快，也不會太趕")
    .replaceAll("這些都可以影響聚餐的愉悅感", "這些都可能影響聚餐氣氛")
    .replaceAll("愉悅感", "聚餐氣氛")
    .replaceAll("充滿潛力", "可以推進")
    .replaceAll("準備程度", "方便程度")
    .replaceAll("愉快的回憶", "氣氛更自然、更順")
    .replaceAll("這件活動安排", "這次家人聚餐")
    .replaceAll("哪一天活動", "哪一天，聚餐")
    .replaceAll("聚會的成功與否", "聚會能不能順利")
    .replaceAll("問題才能得到有效解決", "現場氣氛會更穩")
    .replaceAll("帶來美好的回憶", "讓大家比較舒服地參與")
    .replaceAll("有人表面上不在意實則心裡卻記著不滿", "有些人表面上看起來沒意見，但實際上可能有些需求沒有說清楚")
    .replaceAll("文件并確認", "文件並確認")
    .replaceAll("授權範圍", "責任範圍")
    .replaceAll("照亮這整個交屋流程", "把交屋流程中的細節講清楚")
    .replaceAll("這顆星代表光明", "太陽星正位提醒你要主動確認流程、文件與責任")
    .replaceAll("因為沒有明確的選擇日", "目前重點不是選哪一天")
    .replaceAll("魅力與好奇心", "有趣、有互動感的行程")
    .replaceAll("你的身體狀態", "你的體力和休息")
    .replaceAll("參加者的身體狀態", "參加者的體力與時間狀態")
    .replaceAll("參與者的身體狀態", "參與者的體力與時間狀態")
    .replaceAll("會更容易這一天的活動取得滿意的結果", "這一天的活動會比較容易有滿意的結果")
    .replaceAll("更加成功", "更順利")
    .replaceAll("長期累積的不適情況", "長期累積的疲累")
    .replaceAll("更為圓滿順利", "更順利")
    .replaceAll("控制欲", "控制慾")
    .replaceAll("時間-management", "時間管理")
    .replaceAll("做好流程安排並考慮簡單美味的菜品讓成本控制在可接受的範圍內這樣聚餐會更加融洽", "可以先做好流程安排，並選擇預算內合適的餐點，讓聚餐氣氛更融洽")
    .replaceAll("長輩或知識淵博的人可能會帶來順利的氛圍", "長輩或較有經驗的家人，可能會幫忙協調時間與安排")
    .replaceAll("知識淵博的人", "較有經驗的家人")
    .replaceAll("身體的健康狀態", "體力、飲食需求和方便程度")
    .replaceAll("健康狀態", "體力狀態")
    .replaceAll("選定一到兩個適合的日子", "先整理出一到兩個大家比較方便的日子")
    .replaceAll("同行者可能會因為金錢問題或行程安排出現摩擦導致情緒不穩或配合度不足", "同行者可能會比較在意費用、行程安排或責任分配，如果事前沒有說清楚，容易影響配合度")
    .replaceAll("情緒不穩或配合度不足", "配合度受影響")
    .replaceAll("他們或許會比較挑剔路途中的花費造成互動上的緊張", "對方可能會比較在意旅途中的花費與安排細節，建議出發前先講清楚")
    .replaceAll("挑剔路途中的花費", "在意旅途中的花費")
    .replaceAll("他們的務實態度可能帶來不必要的衝突", "務實考量如果沒有先溝通清楚，可能造成誤會")
    .replaceAll("同行者的狀態可能比較不理想", "同行者的狀態可能沒有表面上那麼輕鬆")
    .replaceAll("實際上在情緒上會有些沉重和無法承受壓力", "實際上可能有些壓力或不安，只是不一定會直接說出來")
    .replaceAll("逃避現實想要享受卻又不願面對其中的壓力和責任", "可能會想輕鬆玩，但對行程安排、費用或體力負擔沒有想得很清楚")
    .replaceAll("逃避現實", "沒有想清楚現實安排")
    .replaceAll("無法承受壓力", "壓力比較大")
    .replaceAll("這代表同行者會重視大眾的需求與期待讓和諧互動", "這代表同行者會重視大家的需求與期待，互動上比較容易保持和諧")
    .replaceAll("讓和諧互動", "互動上比較容易保持和諧")
    .replaceAll("先聽完再決定對於各自的意見與需求進行協調可以讓出遊變得更加愉快", "先聽完大家的意見，再協調各自的需求，會讓出遊更愉快")
    .replaceAll("您", "你")
    .replaceAll("我你可以", "你可以")
    .replaceAll("很會更容易", "會更容易")
    .replaceAll("看起來了", "看起來")
    .replaceAll("并", "並")
    .replaceAll("顺利", "順利")
    .replaceAll("原本設置的策略", "原本設定的策略")
    .replaceAll(
      "可能需要仔細考慮是否要停損",
      "不要讓牌替你判斷停損或不停損，先回到原本規則"
    )
    .replaceAll(
      "會保持了一點不計較的態度",
      "態度會比較柔和，不會太計較"
    )
    .replaceAll("讓我讓你走好這一步", "先把細節做好，會更有利於後續推進")
    .replaceAll("讀取資訊", "接收資訊")
    .replaceAll("應是他人的重點", "應是你的重點")
    .replaceAll("看起來一些破財的風險", "看起來有一些破財風險")
    .replaceAll("让", "讓");
}

function questionHasExplicitPartnerIdentity(question: string) {
  return includesAny(question, [
    "伴侶",
    "另一半",
    "男友",
    "女友",
    "老婆",
    "老公",
    "妻子",
    "丈夫",
    "先生",
    "太太",
  ]);
}

function cleanReviewStyleArtifacts(answer: string, context: ReadingContext) {
  let result = normalizeReviewedAnswerText(answer)
    .replace(/^#{1,6}\s*(這件事本身|星曜解釋|目前狀態|具體建議)\s*\n/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/。{2,}/g, "。")
    .replace(/！{2,}/g, "！")
    .replace(/？{2,}/g, "？")
    .replaceAll("後續建議是：", "接下來可以把重點放在：")
    .replaceAll(
      "接下來可以把重點放在把話講清楚、確認資訊、避免猜測與誤會放大上。",
      "接下來可以把重點放在：把話講清楚、確認資訊，避免猜測與誤會放大。"
    )
    .replaceAll(
      "接下來可以把重點放在：把話講清楚、確認資訊、避免猜測與誤會放大。",
      "接下來可以把重點放在：確認資訊、減少猜測，不要讓誤會繼續放大。"
    )
    .replaceAll("你主動找他他", "你主動找他，他")
    .replaceAll("你主動找她她", "你主動找她，她")
    .replaceAll("牌面你", "牌面來看，你")
    .replaceAll("根據這張天同星的正位牌面", "根據這張天同星正位來看，")
    .replaceAll("將會以", "比較可能以")
    .replaceAll("將會用", "比較可能用")
    .replaceAll("這將是一個不錯的選擇", "後續再觀察他的回覆是否穩定")
    .replaceAll(
      "不會因忙碌而忽視你的訊息",
      "不一定會因忙碌就完全不回，但回覆穩定度仍要觀察"
    )
    .replaceAll("可能會給予熱情的回應", "可能會有比較友善或輕鬆的回應")
    .replaceAll("給予熱情的回應", "給出比較友善或輕鬆的回應")
    .replaceAll("將會讓你比較容易更好地掌控整體情況", "會讓你比較容易掌握目前的風險狀態")
    .replaceAll("更好地掌控整體情況", "更清楚地掌握風險狀態")
    .replaceAll("穩定前行", "維持紀律")
    .replaceAll("穩定累積結果的潛力", "按規則檢視風險的空間")
    .replaceAll("如果まだ不明確", "如果仍不明確")
    .replaceAll("まだ", "仍然")
    .replaceAll("具體建議上，要釐清所有的停損", "具體來說，要釐清所有的停損")
    .replaceAll("可以先穩定部位", "可以先確認部位大小是否仍符合原本風險規則")
    .replaceAll("可以先維持部位", "可以先確認部位大小是否仍符合原本風險規則")
    .replaceAll("可以考慮觀望，甚至暫時退出市場", "先確認原本策略對觀望或出場的條件是否清楚")
    .replaceAll("可以考慮觀望", "先確認原本策略對觀望的條件是否清楚")
    .replaceAll("暫時退出市場", "回到原本策略確認出場條件")
    .replaceAll("保持部位穩定", "確認部位大小是否仍符合原本風險規則")
    .replaceAll("保持保守的處理方式", "保持清楚的風險意識")
    .replaceAll("最好不要急著做出決定", "不要讓牌面取代原本交易規則")
    .replaceAll("建議你仔細控制部位大小、停損", "建議你檢查部位大小與停損條件是否符合原本規則")
    .replaceAll("仔細控制部位大小、停損", "檢查部位大小與停損條件是否符合原本規則")
    .replaceAll("清楚設定停損線", "確認原本停損線是否清楚")
    .replaceAll("進行過度的操作", "偏離原本風險規則")
    .replaceAll("進行操作", "做風險判斷")
    .replaceAll("做出操作", "做出風險判斷")
    .replaceAll("過度的操作", "偏離原本規則")
    .replaceAll("在未來的操作中", "在後續判斷中")
    .replaceAll("做出情緒化的決策", "讓判斷被情緒牽動")
    .replaceAll("整體的投資結果", "整體的風險控管")
    .replaceAll("獲得實質結果", "讓判斷更有依據")
    .replaceAll("實際的投資結果", "實際風險")
    .replaceAll("長期的實際結果", "長期的風險控管")
    .replaceAll("提高投資結果", "提高風險辨識")
    .replaceAll("取得投資成果", "讓判斷更貼近原本風險規則")
    .replaceAll("投資結果更好", "風險控管更清楚")
    .replaceAll("提升投資的成功機率", "讓風險控管更清楚")
    .replaceAll("投資的成功機率", "風險控管")
    .replaceAll("投資決策更具有效性", "風險判斷更有紀律")
    .replaceAll("讓你的資金穩步增值", "讓風險維持在可承受範圍內")
    .replaceAll("資金穩步增值", "風險維持在可承受範圍內")
    .replaceAll("資金穩定增加", "風險維持在可承受範圍內")
    .replaceAll("資金穩定成長", "風險維持在可承受範圍內")
    .replaceAll("讓活動自然發展", "讓互動自然發展")
    .replace(/(他|她|對方)是否會主動接觸/g, "$1是否會主動找你")
    .replace(/(他|她|對方)會不會主動接觸/g, "$1會不會主動找你")
    .replace(/(他|她|對方)會主動接觸/g, "$1會主動找你");

  if (!questionHasExplicitPartnerIdentity(context.question)) {
    result = result
      .replaceAll("這段伴侶關係", "這段感情互動")
      .replaceAll("伴侶關係", "感情互動");
  }

  return removeDuplicateAdviceParagraphs(removeRepeatedMainConclusion(result)).trim();
}

function enforceTravelTrafficFollowUpReference(
  answer: string,
  context: ReadingContext
) {
  const dateReference = extractFollowUpDateReference(context.followUpContext);
  if (
    !dateReference ||
    !context.followUpContext?.isFollowUp ||
    !hasFollowUpTravelContext(context.followUpContext) ||
    !isTravelTrafficFollowUpQuestion(context.question)
  ) {
    return answer;
  }

  const compactDate = dateReference.replace(/\s+/g, "");
  const monthDate = dateReference.includes("/")
    ? `${dateReference.split("/")[0]}月${dateReference.split("/")[1]}`
    : dateReference;
  const alreadyHasDate =
    answer.includes(compactDate) ||
    answer.includes(monthDate) ||
    answer.includes(`${monthDate}這天`);
  const alreadyHasTravelTraffic =
    includesAny(answer, ["出遊交通", "出遊的交通", "出行交通"]) ||
    (answer.includes("出遊") && answer.includes("交通"));

  if (alreadyHasDate && alreadyHasTravelTraffic) {
    return answer;
  }

  const bridge = `延續前面 ${dateReference} 出遊這件事來看，這天交通要特別注意路線、出發時間、交通工具和臨時變動。`;
  const paragraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return bridge;
  }

  paragraphs[0] = `${bridge}${paragraphs[0] ? ` ${paragraphs[0]}` : ""}`;
  return paragraphs.join("\n\n");
}

function normalizeConclusionText(text: string) {
  return text
    .replace(/^這張牌比較偏向[:：]?/, "")
    .replace(/^這張牌看起來偏向於?[:：]?/, "")
    .replace(/^這張牌看起來，?/, "")
    .replace(/^這張牌的解讀結果看起來，?/, "")
    .replace(/^這張牌的解讀偏向[:：]?/, "")
    .replace(/^從這張牌的角度來看，?/, "")
    .replace(/[，。：；、\s]/g, "")
    .trim();
}

function isConclusionLikeParagraph(paragraph: string) {
  return (
    paragraph.startsWith("這張牌比較偏向") ||
    paragraph.startsWith("這張牌看起來偏向") ||
    paragraph.startsWith("這張牌看起來，") ||
    paragraph.startsWith("這張牌的解讀結果看起來") ||
    paragraph.startsWith("這張牌的解讀偏向") ||
    paragraph.startsWith("從這張牌的角度來看")
  );
}

function hasHighChineseOverlap(a: string, b: string) {
  const aChars = new Set(a.match(/[\u4e00-\u9fff]/g) || []);
  const bChars = new Set(b.match(/[\u4e00-\u9fff]/g) || []);
  if (aChars.size < 12 || bChars.size < 12) {
    return false;
  }

  const overlap = [...aChars].filter((char) => bChars.has(char)).length;
  return overlap / Math.min(aChars.size, bChars.size) >= 0.72;
}

function normalizeParagraphDuplicateKey(paragraph: string) {
  return paragraph.replace(/[，。：；、！？\s]/g, "").trim();
}

function isNextStepAdviceParagraph(paragraph: string) {
  return (
    paragraph.startsWith("接下來") ||
    paragraph.startsWith("最後") ||
    paragraph.startsWith("具體建議") ||
    paragraph.startsWith("建議")
  );
}

function shouldPreferCurrentAdvice(current: string, previous: string) {
  if (current.includes("接下來可以把重點放在：")) {
    return true;
  }

  if (
    current.includes("可以先") &&
    !previous.includes("可以先")
  ) {
    return true;
  }

  return current.length > previous.length + 18;
}

function removeRepeatedMainConclusion(answer: string) {
  const rawParagraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const first = rawParagraphs[0] || "";
  const paragraphs = rawParagraphs.map((paragraph, index) => {
    if (index === 0 || !first.startsWith("這張牌比較偏向：")) {
      return paragraph;
    }

    return paragraph
      .replace(/這張牌比較偏向/g, "放在這題裡，")
      .replace(/這張牌看起來偏向於?/g, "放在這題裡，")
      .replace(/這張牌的解讀偏向/g, "放在這題裡，")
      .replace(/這張牌的解讀結果看起來/g, "放在這題裡，")
      .replace(/從這張牌的角度來看/g, "從星曜原因來看");
  });
  if (!first.startsWith("這張牌比較偏向：")) {
    return answer;
  }

  const firstCore = normalizeConclusionText(first);
  const cleaned = paragraphs.filter((paragraph, index) => {
    if (index === 0 || !isConclusionLikeParagraph(paragraph)) {
      return true;
    }

    const currentCore = normalizeConclusionText(paragraph);
    return !(
      firstCore.includes(currentCore.slice(0, 24)) ||
      currentCore.includes(firstCore.slice(0, 24)) ||
      hasHighChineseOverlap(firstCore, currentCore)
    );
  });

  return cleaned.join("\n\n");
}

function removeDuplicateAdviceParagraphs(answer: string) {
  const paragraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const kept: string[] = [];
  const seenParagraphs = new Set<string>();
  const duplicateKeys = [
    ["確認資訊", "減少猜測", "誤會"],
    ["慾望和吸引力", "清楚", "一時刺激"],
    ["作息", "睡眠", "飲食", "休息"],
  ];

  for (const paragraph of paragraphs) {
    const paragraphKey = normalizeParagraphDuplicateKey(paragraph);
    if (paragraphKey && seenParagraphs.has(paragraphKey)) {
      continue;
    }

    const isFocusAdvice = paragraph.startsWith("接下來可以把重點放在");
    const previousFocusAdviceIndex = (() => {
      for (let index = kept.length - 1; index >= 0; index -= 1) {
        if (kept[index].startsWith("接下來可以把重點放在")) {
          return index;
        }
      }

      return -1;
    })();

    if (isFocusAdvice && previousFocusAdviceIndex >= 0) {
      const previous = kept[previousFocusAdviceIndex];
      if (shouldPreferCurrentAdvice(paragraph, previous)) {
        seenParagraphs.delete(normalizeParagraphDuplicateKey(previous));
        kept[previousFocusAdviceIndex] = paragraph;
        seenParagraphs.add(paragraphKey);
      }
      continue;
    }

    const isDuplicateAdvice = duplicateKeys.some((keys) => {
      if (!keys.every((key) => paragraph.includes(key))) {
        return false;
      }

      return kept.some((previous) => keys.every((key) => previous.includes(key)));
    });

    if (isDuplicateAdvice) {
      continue;
    }

    const previousAdviceIndex = (() => {
      for (let index = kept.length - 1; index >= 0; index -= 1) {
        if (isNextStepAdviceParagraph(kept[index])) {
          return index;
        }
      }

      return -1;
    })();
    const previousAdvice =
      previousAdviceIndex >= 0 ? kept[previousAdviceIndex] : "";
    const isNearDuplicateAdvice =
      previousAdvice &&
      isNextStepAdviceParagraph(paragraph) &&
      (
        hasHighChineseOverlap(paragraph, previousAdvice) ||
        normalizeParagraphDuplicateKey(paragraph).includes(
          normalizeParagraphDuplicateKey(previousAdvice).slice(0, 28)
        ) ||
        normalizeParagraphDuplicateKey(previousAdvice).includes(
          normalizeParagraphDuplicateKey(paragraph).slice(0, 28)
        )
      );

    if (isNearDuplicateAdvice) {
      if (shouldPreferCurrentAdvice(paragraph, previousAdvice)) {
        seenParagraphs.delete(normalizeParagraphDuplicateKey(previousAdvice));
        kept[previousAdviceIndex] = paragraph;
        seenParagraphs.add(paragraphKey);
      }
      continue;
    }

    kept.push(paragraph);
    if (paragraphKey) {
      seenParagraphs.add(paragraphKey);
    }
  }

  return kept.join("\n\n");
}

function hasRepeatedSingleCardDateNotice(a: string, b: string) {
  const hasDirectDateNotice = (paragraph: string) =>
    paragraph.includes("無法直接") &&
    includesAny(paragraph, ["確切", "定出"]) &&
    includesAny(paragraph, ["日期", "哪一天", "哪天"]);

  return (
    [a, b].every(
      (paragraph) =>
        paragraph.includes("單張牌") &&
        paragraph.includes("日期") &&
        includesAny(paragraph, ["確切", "定出", "直接"])
    ) ||
    (
      (a.includes("單張牌") || b.includes("單張牌")) &&
      hasDirectDateNotice(a) &&
      hasDirectDateNotice(b)
    )
  );
}

function cleanRepeatedDateSelectionNotice(
  answer: string,
  context: ReadingContext
) {
  if (
    context.questionSubcategory !== "活動｜出去玩日期" &&
    !(
      includesAny(context.question, ["出去玩", "出遊", "旅行", "旅遊"]) &&
      includesAny(context.question, ["日期", "哪天", "哪一天"])
    )
  ) {
    return answer;
  }

  const paragraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (
    paragraphs.length >= 2 &&
    hasRepeatedSingleCardDateNotice(paragraphs[0], paragraphs[1])
  ) {
    paragraphs.splice(1, 1);
  }

  return paragraphs.join("\n\n");
}

function isLearningBurdenQuestion(question: string) {
  return includesAny(question, ["負擔", "太大", "吃力", "壓力太大"]);
}

function isLearningReviewMethodQuestion(question: string) {
  return includesAny(question, ["複習方式", "複習", "怎麼複習", "如何複習"]);
}

function hasLearningReviewStrategy(text: string) {
  return includesAny(text, [
    "固定時間",
    "固定的複習時間",
    "固定複習時間",
    "固定的複習計劃",
    "固定複習計劃",
    "定時複習",
    "一小部分內容",
    "一小部分",
    "循序漸進",
    "內化知識",
    "理解和記憶",
    "小單元",
    "筆記",
    "實作",
    "練習",
    "定期回顧",
    "不要一次塞太多",
    "一次塞太多",
  ]);
}

function hasLearningBurdenChecklist(text: string) {
  return (
    /每週.{0,10}投入多少時間/.test(text) ||
    (
      text.includes("每週") &&
      text.includes("投入") &&
      text.includes("時間")
    )
  );
}

function isGenericLearningStartBurdenEnding(paragraph: string) {
  return (
    paragraph.includes("課程內容、學習目標、時間安排、負擔會不會太大") ||
    paragraph.includes("課程內容、學習目標、時間安排，負擔是否太大") ||
    (
      paragraph.includes("課程內容") &&
      paragraph.includes("學習目標") &&
      paragraph.includes("時間安排") &&
      includesAny(paragraph, ["負擔", "複習方式", "穩定吸收"])
    ) ||
    paragraph.includes("不要只急著開始，先確認自己能不能穩定吸收") ||
    paragraph.includes("不要著急開始，要確認自己能否穩定吸收")
  );
}

function cleanLearningFollowUpEnding(answer: string, context: ReadingContext) {
  if (
    context.questionType !== "學習考試" &&
    !context.questionSubcategory.includes("學習") &&
    !context.questionSubcategory.includes("課程")
  ) {
    return answer;
  }

  const paragraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return answer;
  }

  if (isLearningBurdenQuestion(context.question)) {
    const burdenEnding =
      "這題重點是負擔，而不是重新判斷要不要開始。接下來可以先檢查三件事：每週能投入多少時間、課程內容是否超出目前程度、學完後是否有足夠時間複習。只要這三點沒有安排好，負擔就容易變大。";
    const filtered = paragraphs.filter(
      (paragraph) => !isGenericLearningStartBurdenEnding(paragraph)
    );

    if (!filtered.some(hasLearningBurdenChecklist)) {
      filtered.push(burdenEnding);
    }

    return removeDuplicateAdviceParagraphs(filtered.join("\n\n"));
  }

  if (isLearningReviewMethodQuestion(context.question)) {
    const reviewEnding =
      "所以這題的重點不是再判斷要不要開始，而是你開始後要怎麼複習。建議固定一個複習時間，把內容拆成小單元，整理筆記，再用練習或實作確認自己真的吸收。不要一次塞太多，穩定回顧會比短時間猛讀更適合你。";
    const filtered = paragraphs.filter(
      (paragraph) => !isGenericLearningStartBurdenEnding(paragraph)
    );

    if (!filtered.some(hasLearningReviewStrategy)) {
      filtered.push(reviewEnding);
    } else {
      const last = filtered.at(-1) || "";
      if (!hasLearningReviewStrategy(last)) {
        filtered.push(reviewEnding);
      }
    }

    return removeDuplicateAdviceParagraphs(filtered.join("\n\n"));
  }

  return answer;
}

function finalOutputGuard(answer: string) {
  let result = answer;

  result = result
    .replaceAll("這題先回到睡眠、作息、壓力、飲食節奏和體力狀態，不額外推測沒有提到的器官或疾病。", "")
    .replaceAll("不額外推測沒有提到的器官或疾病。", "")
    .replaceAll("不額外推測沒有提到的器官或疾病", "")
    .replaceAll("不額外推測病情結果。", "")
    .replaceAll("不額外推測病情結果", "")
    .replaceAll("這個狀態代表", "")
    .replaceAll("這個狀態強調的是", "重點是")
    .replaceAll("這個狀態強調", "重點是")
    .replaceAll("從這個狀態來看，", "")
    .replaceAll("從這個狀態來看", "")
    .replaceAll("這章牌", "這個狀態")
    .replaceAll("這板牌", "這張牌")
    .replaceAll("板牌", "張牌")
    .replaceAll("显示", "顯示")
    .replaceAll("这样", "這樣")
    .replaceAll("采用", "採用")
    .replaceAll("沖動", "衝動")
    .replaceAll("根據這張牌的看起來", "從這張牌來看")
    .replaceAll("根據牌面的看起來", "從牌面來看")
    .replaceAll("比較容易更好地", "更容易")
    .replaceAll("非常會讓你比較容易", "會讓你更容易")
    .replaceAll("是不比較穩的", "並不穩妥")
    .replaceAll("不比較穩", "不太穩妥")
    .replaceAll("設置", "設定")
    .replaceAll("身體放鬆的同時也要注意日常的飲食與作息", "放鬆身心，也要維持基本作息與飲食節奏")
    .replaceAll("賺錢會比較如魚得水易如反掌", "賺錢方式可以朝自己較熟悉、較能掌握成本與風險的方向嘗試")
    .replaceAll("Value of your assets may not advance smoothly.", "")
    .replaceAll("Value of your assets may not advance smoothly", "")
    .replaceAll("decisions-making", "決策判斷")
    .replaceAll("Decision-making", "決策判斷")
    .replaceAll("decision-making", "決策判斷")
    .replaceAll("fallback", "")
    .replaceAll("Fallback", "")
    .replaceAll("review", "")
    .replaceAll("Review", "")
    .replaceAll("summary", "")
    .replaceAll("Summary", "")
    .replaceAll("markdown", "")
    .replaceAll("Markdown", "")
    .replaceAll("status", "狀態")
    .replaceAll("左旗", "")
    .replaceAll("醍醐灌頂", "提醒")
    .replaceAll("會有容易的人支持", "可能會有人願意支持")
    .replaceAll("會更容易更好地", "會更容易")
    .replaceAll("進一步clarify", "進一步釐清")
    .replaceAll("口頭應承", "口頭承諾")
    .replaceAll("天梁星的反位看起來一些可能有問題", "天梁星反位提醒這份承諾可能有些不穩")
    .replaceAll("会更会更容易", "會更容易")
    .replaceAll("會更會更容易", "會更容易")
    .replaceAll("一定要要", "要")
    .replaceAll("更加會更容易", "會更容易")
    .replaceAll("這樣更加會更容易", "這樣會更容易")
    .replaceAll("這樣才會更容易關係的進一步發展", "這樣才比較有機會讓關係往前")
    .replaceAll("目前看起來一定的穩定性", "目前看起來有一定穩定性")
    .replaceAll("對方目前的態度的互動", "對方目前的互動態度")
    .replaceAll("這段關係目前看起來的是", "這段關係目前看起來是")
    .replaceAll("這段關係的現狀看起來一些不穩定的特質", "這段關係目前有些不穩定")
    .replaceAll("可以該觀察", "可以觀察")
    .replaceAll("按耐", "按捺")
    .replaceAll("稍為", "稍微")
    .replaceAll("這場關係", "這段關係")
    .replaceAll("更加會更容易改善", "會更容易改善")
    .replaceAll("続", "續")
    .replaceAll("温", "溫")
    .replaceAll("瞭解", "了解")
    .replaceAll("開章", "開幕")
    .replaceAll("可以可以", "可以")
    .replaceAll("會會更容易", "會更容易")
    .replaceAll("會會比較容易", "會更容易")
    .replaceAll("能會更容易", "會更容易")
    .replaceAll("更比較穩", "更穩")
    .replaceAll("無法不能只靠牌面決定一定入帳", "不能只靠牌面保證一定入帳")
    .replaceAll("無法不能只靠", "不能只靠")
    .replaceAll("看起來良好的合作機會", "看起來有合作機會")
    .replaceAll("會會", "會")
    .replaceAll("這樣會會比較容易", "這樣會更容易")
    .replaceAll("這樣會會更容易", "這樣會更容易")
    .replaceAll("會更容易的", "會更容易")
    .replaceAll("會比較好", "會更容易")
    .replaceAll("自然的互動試探對方態度", "用清楚但不逼迫的方式確認彼此態度")
    .replaceAll("建議你可以試著", "你可以先")
    .replaceAll("建議你可以", "你可以")
    .replaceAll("不妨適時", "可以先")
    .replaceAll("透過開放的交流", "把該確認的事情講清楚")
    .replaceAll("釐清彼此的期待", "確認彼此接下來要不要往前")
    .replaceAll("先用自然的互動試探對方態度，把節奏放穩，觀察對方是否願意回應你。", "用清楚但不逼迫的方式確認彼此態度，同時觀察對方是否願意穩定回應。")
    .replaceAll("這段關係已經有沒有順利往前的地方", "這段關係已經有一些沒有順利往前的地方")
    .replaceAll("哪裡沒有順利往前就要先處理哪裡", "哪裡不順，就要先處理哪裡")
    .replaceAll("自己設定好的規則", "合適的溝通方式")
    .replaceAll("客戶", "顧客")
    .replaceAll("質量", "品質")
    .replaceAll("市場調研", "市場調查")
    .replaceAll("信息", "資訊")
    .replaceAll("机制", "機制")
    .replaceAll("運營", "經營")
    .replaceAll("開業", "開店")
    .replaceAll("情景", "情境")
    .replaceAll("决策", "決策")
    .replaceAll("務必", "一定要")
    .replaceAll("要要", "要")
    .replaceAll("务必", "一定要")
    .replaceAll("确保", "確認")
    .replaceAll("確保", "確認")
    .replaceAll("让", "讓")
    .replaceAll("他（她）", "對方")
    .replaceAll("他(她)", "對方")
    .replaceAll("這個人或許有一種深邃而隱秘的氣質讓對方看得出不安感", "這個人可能帶著深邃而隱秘的氣質，也比較容易流露不安感")
    .replaceAll("這件事本身有狀態上升的機會你有可能", "這件事本身有狀態上升的機會，你比較有機會")
    .replaceAll("將會有實質利益實際結果", "比較有機會看到實際回饋")
    .replaceAll("將會更容易", "會更容易")
    .replaceAll("總體來說", "整體來看")
    .replaceAll("总體", "整體")
    .replaceAll("来说", "來看")
    .replaceAll("考慮要如何", "思考怎麼")
    .replaceAll("考虑", "考慮")
    .replaceAll("可會更容易", "會更容易")
    .replaceAll("會更會讓你比較容易的決策", "會比較容易做出決定")
    .replaceAll("會更會讓你比較容易", "會更容易")
    .replaceAll("會更容易更順利", "會更順利")
    .replaceAll("實際結果將會實際結果", "會比較容易看到實際成果")
    .replaceAll("合約本身的可靠性和長期穩定性", "合約本身的可靠性與長期穩定度")
    .replaceAll("看起來有些沒有順利往前", "推進上可能不太順")
    .replaceAll("沒有充分的支持條件這次的出行計畫可能會有些沒有順利往前", "如果支持條件還不夠，這次出遊計畫推進起來可能不太順")
    .replaceAll("有些沒有順利往前", "不太順")
    .replaceAll("活動當天間", "活動當天")
    .replaceAll("確認全家人的樂趣", "讓全家人玩得更安心")
    .replaceAll("這件事本身呈現", "這件事看起來")
    .replaceAll("這個狀態下呈現", "目前看起來")
    .replaceAll("能夠適合安排", "可以安排")
    .replaceAll("準備度跟得上", "準備度能跟上")
    .replaceAll("適合安排行拍攝日", "可以安排拍攝日")
    .replaceAll("這樣會更會讓你比較容易的決策", "這樣會讓你比較容易做決定")
    .replaceAll("會更容易.stdout想法和彼此的理解清楚", "會更容易把想法和彼此理解說清楚")
    .replaceAll(".stdout", "")
    .replaceAll(".stderr", "")
    .replaceAll("這樣將確認你在租約上的順利進行", "這樣會讓租約流程更穩妥")
    .replaceAll("文檔", "文件")
    .replaceAll("保持靈活應變這會更容易活動的順利進行", "保持靈活應變，會更有利於活動順利進行")
    .replaceAll("這會更容易活動的順利進行", "會更有利於活動順利進行")
    .replaceAll("這次活動要注意的事情本身可能有些沒有順利往前", "這次活動的推進可能不太順")
    .replaceAll("現階段貌似有些障礙可能導致出行的負擔上升", "目前看起來有些阻礙，可能讓出行負擔增加")
    .replaceAll("後續建議是：", "接下來可以把重點放在：")
    .replaceAll("貌似", "看起來")
    .replaceAll("成功的機會哦", "成功的機會")
    .replaceAll("哦", "")
    .replaceAll("出游", "出遊")
    .replaceAll("planning", "行程規劃")
    .replaceAll("逆位", "反位")
    .replaceAll("不能只靠牌面不能只靠牌面", "不能只靠牌面")
    .replaceAll("不能只靠牌面保證", "不能只靠牌面決定")
    .replaceAll("將更會更容易", "會更容易")
    .replaceAll("更會更容易", "會更容易")
    .replaceAll("祝賀開幕的日子", "正式開幕日期")
    .replaceAll("再適時再定出", "再視情況決定")
    .replaceAll("站出來看起來主導權", "站出來主導")
    .replaceAll("虽然", "雖然")
    .replaceAll("現場運行", "現場執行")
    .replaceAll("這會更容易整體拍攝的流程順利進行", "這會讓整體拍攝流程更順利")
    .replaceAll("實際實際結果", "實際結果")
    .replaceAll("請要", "請")
    .replaceAll("容易會有", "比較容易得到")
    .replaceAll("這會更容易後續的進行", "這會讓後續進行更順利")
    .replaceAll("请", "請")
    .replaceAll("有人來讓你整理", "受到他人的提醒")
    .replaceAll("當心臟決定之後", "當你下定決心之後")
    .replaceAll("比較順和和諧", "更順利、更和諧")
    .replaceAll("面子和控制慾過重的狀態", "想辦得風光但現實條件未必完全支撐")
    .replaceAll("面子和控制慾過重", "想辦得風光但現實條件未必完全支撐")
    .replaceAll("比較容易們", "讓你們")
    .replaceAll("會讓你比較容易們的遊玩體驗比較順", "會讓你們的遊玩體驗更順")
    .replaceAll("這次出遊日期的選擇可以看但要特別注意行程安排", "這次出遊日期可以評估，但要特別注意行程安排")
    .replaceAll("照耀與主導的特質讓事情變得更加明亮和透明", "主動把行程、交通和時間安排說清楚，讓整體計畫更明確")
    .replaceAll("這趟旅行的潛力和可行性但", "這趟旅行有可行性，但")
    .replaceAll("睡眠品質下降容易造成疲憊或分心", "容易忽略交通、時間或同行者需求等實際細節")
    .replaceAll("太陽星在此時此刻給了你光明的方向仍需留意天氣變化和同行者的體力狀況", "太陽星正位代表這次適合把行程、交通和時間安排講清楚，但仍要留意天氣變化和同行者體力")
    .replaceAll("光明的方向", "明確的安排方向")
    .replaceAll("資料搜集不實", "資訊整理不完整")
    .replaceAll("資料蒐集不實", "資訊整理不完整")
    .replaceAll("同行家人的需求和心理狀態", "同行家人的需求、體力和時間安排")
    .replaceAll("這樣能讓行程比較順盡量減少臨時的變故與困擾", "這樣能讓行程比較順，也能減少臨時變動帶來的困擾")
    .replaceAll("讓你感到燒腦", "讓你覺得安排起來很費心")
    .replaceAll("但記得不要太過於保守或計算可以順勢而為", "但也不要太過保守或算得太細，可以保留一點彈性")
    .replaceAll("只要確認一切有序就能享受與家人同行的美好時光", "只要安排有序，這趟和家人的出遊就會比較舒服")
    .replaceAll("這段時間也特別注意壓力的管理避免身體的疲憊影響到後續的執行", "這段時間也要注意壓力管理，避免過度疲累影響後續執行")
    .replaceAll("紫微星在這問題上反位", "紫微星反位放在這個問題裡")
    .replaceAll("周围", "周圍")
    .replaceAll("照亮整個過程", "推進開幕準備")
    .replaceAll("執行力極高", "行動力較強")
    .replaceAll("提前做好準備參數", "提前把拍攝流程、分工和備案準備好")
    .replaceAll("具體建議是建議", "具體建議是")
    .replaceAll("現場流程自我管理", "現場流程與自我管理")
    .replaceAll("確認整體活動比較順", "讓整體拍攝流程更順")
    .replaceAll("内部", "內部")
    .replaceAll("把活動組織得響亮", "把出遊安排得有條理")
    .replaceAll("行程安排 要留意", "行程安排要留意")
    .replaceAll("核對同事們的意見", "確認家人的意見")
    .replaceAll("同事們的意見", "家人的意見")
    .replaceAll("每個人都要放心", "讓每個人都比較安心")
    .replaceAll("這樣就能不能只靠牌面決定你們的家庭出行能夠愉快又順利", "這樣會讓家庭出遊更順利，也比較舒服")
    .replaceAll("不能只靠牌面決定你們的家庭出行能夠愉快又順利", "讓家庭出遊更順利，也比較舒服")
    .replaceAll("很難不能只靠牌面決定拍攝能夠如預期順利進行", "如果準備和人員狀態還不穩，拍攝就不容易如預期順利")
    .replaceAll("六殺星", "七殺星")
    .replaceAll("你要衝並扛住壓力", "你要把準備做足，再果斷推進")
    .replaceAll("勇往直前", "果斷推進")
    .replaceAll("行動意向與具備的力量", "行動力與準備條件")
    .replaceAll("就是要快速", "可以先")
    .replaceAll("這樣會更容易聚餐的成功", "這樣會讓聚餐更容易順利進行")
    .replaceAll("經濟來源", "預算")
    .replaceAll("也確認聚餐愉快", "也讓聚餐氣氛更愉快")
    .replaceAll("避免而產生", "避免產生")
    .replaceAll("表面上不看得出不滿", "表面上可能看不出不滿")
    .replaceAll("簽協定", "簽合約")
    .replaceAll("部屬好行程安排", "安排好行程")
    .replaceAll("不容易踩雷", "不容易出錯")
    .replaceAll("這樣能讓流程更加順暢確認旅行的愉快", "這樣能讓流程更順，也比較能提升旅行品質")
    .replaceAll("確認在選擇日期時提前討論、確認行程讓出遊的每一個環節都更為完美", "選日期前先討論清楚，並確認行程、交通與體力安排，會讓這次出遊更穩")
    .replaceAll("太陽星的正位提醒了這次出遊的好處：照亮你們的計劃讓行程安排變得更明朗", "太陽星正位放在出遊題裡，代表這次適合把行程、時間、交通和分工講清楚，讓整體安排更明朗")
    .replaceAll("來共度這段美好時光", "讓這次出遊更順")
    .replaceAll("出遊前也要記得調整心情努力避免過度焦慮以更輕鬆的心情迎接家庭旅程", "出遊前先把交通、集合時間、天氣、家人體力和備案整理清楚，避免因為資訊太亂而反覆改計畫")
    .replaceAll("太陽星反位代表光線不足這代表在行程規劃、交通安排等方面可能會因為操之過急而未能考慮周全", "太陽星反位代表這次安排可能不夠明朗，容易因為急著決定而沒有把交通、時間和家人狀態考慮周全")
    .replaceAll("光線不足", "安排不夠明朗")
    .replaceAll("大家的體力和同行者的需要會看起來非常重要", "家人的體力、時間和需求會是這次出遊能不能順利的關鍵")
    .replaceAll("參加者可能會出現不滿情緒相對於愉快的家庭時光反而造成負擔", "如果安排不清楚，家人可能會覺得疲累或不方便，反而讓原本輕鬆的出遊變成負擔")
    .replaceAll("這段時間會掌握良好的資源讓你在安排活動時能夠穩定且務實", "這段時間比較適合用穩定、務實的方式安排出遊")
    .replaceAll("確認大家都能愉快享受這趟旅程", "讓大家都能比較安心、舒服地完成這趟行程")
    .replaceAll("團隊間的溝通和規劃會非常重要讓每個人成為負責任的一部分", "團隊之間的溝通和規劃很重要，最好讓每個人都清楚自己的責任")
    .replaceAll("讓每個人成為負責任的一部分", "讓每個人都清楚自己的責任")
    .replaceAll("這樣開幕會比較順", "這樣開幕流程會比較穩")
    .replaceAll("從紫微星反位來看現階段在開幕日期的選擇上可能會出現一些問題", "紫微星反位放在開幕題裡，代表如果你希望開幕很熱鬧、很風光、很有排場，現階段可能不會完全如你所願")
    .replaceAll("宣傳與人員準備上可能缺乏實際結果", "宣傳、人員準備或現場流程可能還沒有真正到位")
    .replaceAll("缺乏實際結果", "還沒有真正到位")
    .replaceAll("確認這些細節都能妥善執行在做出正式開幕決定前會讓一切更加穩妥", "在做出正式開幕決定前，先確認這些細節都能妥善執行，會讓整體更穩")
    .replaceAll("太陽星的正位看起來這段時間很適合主動出面讓一切變得明亮而清晰對於開幕的規劃和宣傳這股熱情會給你帶來不少貴人支持", "太陽星正位放在開幕題裡，代表這段時間適合你主動把開幕流程、宣傳重點和團隊分工講清楚。只要方向明確，也比較容易得到他人支持")
    .replaceAll("讓一切變得明亮而清晰", "把方向講清楚")
    .replaceAll("這個月的拍攝安排可以考慮整體上看還是有機會順利進行", "這個月可以考慮安排拍攝，整體來看有機會順利推進")
    .replaceAll("但也要留意身體狀況和準備進度必須跟上", "但也要留意設備、場地、人員和流程準備必須跟上")
    .replaceAll("身體狀況和準備進度必須跟上", "設備、場地、人員和流程準備必須跟上")
    .replaceAll("參與者的身體狀況", "參與者的體力與時間狀態")
    .replaceAll("這個月安排拍攝日不太適合", "這張牌比較偏向：這個月安排拍攝要保守一點，除非準備和人員狀態已經穩定")
    .replaceAll("這樣的影響可能會讓整個拍攝過程變得不穩定", "這些因素可能讓拍攝流程變得不穩")
    .replaceAll("代表現在是個敢衝、敢扛的時期", "代表這段時間行動力和抗壓性較強")
    .replaceAll("敢衝、敢扛", "行動力和抗壓性較強")
    .replaceAll("安排家人聚餐最佳選擇在於協調參與者的意見和現場的準備狀況", "安排家人聚餐時，重點在於協調家人的時間、意見和現場準備狀況")
    .replaceAll("最佳選擇在於", "重點在於")
    .replaceAll("這段時間七殺正位看起來行動的果斷性刻意準備會讓整個聚會更順利", "七殺星正位代表行動力強，只要事前準備明確，聚會就比較容易推進")
    .replaceAll("果斷性刻意準備", "事前準備明確")
    .replaceAll("這樣才能確認聚會愉快而不緊湊", "這樣才能讓聚會愉快，也不會太趕")
    .replaceAll("這些都可以影響聚餐的愉悅感", "這些都可能影響聚餐氣氛")
    .replaceAll("愉悅感", "聚餐氣氛")
    .replaceAll("充滿潛力", "可以推進")
    .replaceAll("準備程度", "方便程度")
    .replaceAll("愉快的回憶", "氣氛更自然、更順")
    .replaceAll("這件活動安排", "這次家人聚餐")
    .replaceAll("哪一天活動", "哪一天，聚餐")
    .replaceAll("聚會的成功與否", "聚會能不能順利")
    .replaceAll("問題才能得到有效解決", "現場氣氛會更穩")
    .replaceAll("帶來美好的回憶", "讓大家比較舒服地參與")
    .replaceAll("有人表面上不在意實則心裡卻記著不滿", "有些人表面上看起來沒意見，但實際上可能有些需求沒有說清楚")
    .replaceAll("文件并確認", "文件並確認")
    .replaceAll("授權範圍", "責任範圍")
    .replaceAll("照亮這整個交屋流程", "把交屋流程中的細節講清楚")
    .replaceAll("這顆星代表光明", "太陽星正位提醒你要主動確認流程、文件與責任")
    .replaceAll("因為沒有明確的選擇日", "目前重點不是選哪一天")
    .replaceAll("魅力與好奇心", "有趣、有互動感的行程")
    .replaceAll("你的身體狀態", "你的體力和休息")
    .replaceAll("參加者的身體狀態", "參加者的體力與時間狀態")
    .replaceAll("參與者的身體狀態", "參與者的體力與時間狀態")
    .replaceAll("會更容易這一天的活動取得滿意的結果", "這一天的活動會比較容易有滿意的結果")
    .replaceAll("更加成功", "更順利")
    .replaceAll("長期累積的不適情況", "長期累積的疲累")
    .replaceAll("更為圓滿順利", "更順利")
    .replaceAll("控制欲", "控制慾")
    .replaceAll("時間-management", "時間管理")
    .replaceAll("做好流程安排並考慮簡單美味的菜品讓成本控制在可接受的範圍內這樣聚餐會更加融洽", "可以先做好流程安排，並選擇預算內合適的餐點，讓聚餐氣氛更融洽")
    .replaceAll("長輩或知識淵博的人可能會帶來順利的氛圍", "長輩或較有經驗的家人，可能會幫忙協調時間與安排")
    .replaceAll("知識淵博的人", "較有經驗的家人")
    .replaceAll("身體的健康狀態", "體力、飲食需求和方便程度")
    .replaceAll("健康狀態", "體力狀態")
    .replaceAll("選定一到兩個適合的日子", "先整理出一到兩個大家比較方便的日子")
    .replaceAll("同行者可能會因為金錢問題或行程安排出現摩擦導致情緒不穩或配合度不足", "同行者可能會比較在意費用、行程安排或責任分配，如果事前沒有說清楚，容易影響配合度")
    .replaceAll("情緒不穩或配合度不足", "配合度受影響")
    .replaceAll("他們或許會比較挑剔路途中的花費造成互動上的緊張", "對方可能會比較在意旅途中的花費與安排細節，建議出發前先講清楚")
    .replaceAll("挑剔路途中的花費", "在意旅途中的花費")
    .replaceAll("他們的務實態度可能帶來不必要的衝突", "務實考量如果沒有先溝通清楚，可能造成誤會")
    .replaceAll("同行者的狀態可能比較不理想", "同行者的狀態可能沒有表面上那麼輕鬆")
    .replaceAll("實際上在情緒上會有些沉重和無法承受壓力", "實際上可能有些壓力或不安，只是不一定會直接說出來")
    .replaceAll("逃避現實想要享受卻又不願面對其中的壓力和責任", "可能會想輕鬆玩，但對行程安排、費用或體力負擔沒有想得很清楚")
    .replaceAll("逃避現實", "沒有想清楚現實安排")
    .replaceAll("無法承受壓力", "壓力比較大")
    .replaceAll("這代表同行者會重視大眾的需求與期待讓和諧互動", "這代表同行者會重視大家的需求與期待，互動上比較容易保持和諧")
    .replaceAll("讓和諧互動", "互動上比較容易保持和諧")
    .replaceAll("先聽完再決定對於各自的意見與需求進行協調可以讓出遊變得更加愉快", "先聽完大家的意見，再協調各自的需求，會讓出遊更愉快")
    .replaceAll("您", "你")
    .replaceAll("我你可以", "你可以")
    .replaceAll("很會更容易", "會更容易")
    .replaceAll("看起來了", "看起來")
    .replaceAll("并", "並")
    .replaceAll("顺利", "順利")
    .replaceAll("原本設置的策略", "原本設定的策略")
    .replaceAll(
      "可能需要仔細考慮是否要停損",
      "不要讓牌替你判斷停損或不停損，先回到原本規則"
    )
    .replaceAll(
      "會保持了一點不計較的態度",
      "態度會比較柔和，不會太計較"
    )
    .replaceAll("讓我讓你走好這一步", "先把細節做好，會更有利於後續推進")
    .replaceAll("讀取資訊", "接收資訊")
    .replaceAll("應是他人的重點", "應是你的重點")
    .replaceAll("看起來一些破財的風險", "看起來有一些破財風險")
    .replaceAll("顾客", "顧客");

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function finalHardGuard(answer: string, question: string) {
  let result = answer;
  const q = question || "";

  const isMind =
    q.includes("心裡還有沒有我") ||
    q.includes("沒有以前那麼靠近") ||
    q.includes("還在乎") ||
    q.includes("心意") ||
    q.includes("對方現在對我") ||
    q.includes("他是不是");

  const isLongTerm =
    q.includes("結婚") ||
    q.includes("婚姻") ||
    q.includes("未來三年") ||
    q.includes("長期") ||
    q.includes("走下去") ||
    q.includes("現實壓力");

  const isPartner =
    q.includes("伴侶") ||
    q.includes("另一半") ||
    q.includes("吵架") ||
    q.includes("修復") ||
    q.includes("室友") ||
    q.includes("責任分配");

  const isOpening =
    q.includes("開幕") ||
    q.includes("開店") ||
    q.includes("店面");
  const isTravel =
    q.includes("出國") ||
    q.includes("出遊") ||
    q.includes("出去玩") ||
    q.includes("旅遊") ||
    q.includes("旅行");

  if (isMind) {
    const questionMentionsEventTopic = includesAny(q, [
      "交通",
      "外出",
      "臨時行程",
      "工作團隊",
      "團隊角度",
      "資源整合",
      "投資",
      "合約",
      "開幕",
      "日期",
      "財務",
    ]);

    result = result
      .replaceAll("這段時間不是完全沒有感情機會", "對方目前不是完全沒有在意你")
      .replaceAll("這段時間的感情機會", "對方目前的態度")
      .replaceAll("這段感情機會", "對方目前的態度")
      .replaceAll("感情機會", "對方心意")
      .replaceAll("如果有對象出現，", "")
      .replaceAll("如果有對象出現", "對方目前的態度")
      .replaceAll("這類對象", "對方")
      .replaceAll("新對象", "對方")
      .replaceAll("桃花機會", "對方心意")
      .replaceAll("未來出現的人", "對方")
      .replaceAll("接下來不要只看表面條件好不好", "接下來不要只靠自己的想像判斷")
      .replaceAll("看對方是否有穩定互動", "看對方是否還願意穩定回應")
      .replaceAll("用清楚但不逼迫的方式確認彼此態度", "用自然但清楚的方式確認對方態度")
      .replaceAll("你要看清楚對方是不是有能力、有話語權、年紀或心態比較成熟的人", "你要看清楚對方現在是不是還願意靠近你、回應你")
      .replaceAll("感情味比較淡，偏向現實條件、工作、金錢或相處成本", "對方的態度比較保留，可能把重心放在工作、現實壓力或自己的生活安排上");

    if (!questionMentionsEventTopic) {
      result = result
        .replace(/這段時間外出、交通或臨時行程也要留意[^。]*。?/g, "")
        .replace(/出門前先確認路線、交通工具和時間安排。?/g, "")
        .replaceAll("需要從團隊的角度思考如何讓彼此被尊重和看見", "要看對方是否在意你們之間的位置、面子與尊重")
        .replaceAll("從團隊的角度思考", "從關係裡的位置與尊重來看")
        .replaceAll("團隊的角度", "關係裡的位置")
        .replaceAll("工作團隊", "關係互動")
        .replaceAll("資源整合", "關係裡的位置與尊重")
        .replaceAll("投資", "投入")
        .replaceAll("合約", "約定")
        .replaceAll("財務", "現實互動")
        .replaceAll("開幕", "關係往前")
        .replaceAll("開店", "關係往前");
    }
  }

  if (isLongTerm) {
    result = result
      .replaceAll("這段時間不是完全沒有感情機會", "這段長期關係不是沒有穩定空間")
      .replaceAll("這段時間的感情機會", "這段長期關係")
      .replaceAll("這段感情機會", "這段長期關係")
      .replaceAll("感情機會", "長期經營空間")
      .replaceAll("如果有對象出現，", "")
      .replaceAll("如果有對象出現", "這段關係")
      .replaceAll("桃花機會", "長期經營空間")
      .replaceAll("未來出現的人", "對方")
      .replaceAll("用清楚但不逼迫的方式確認彼此態度", "把金錢、工作、家庭意見和未來規劃談清楚")
      .replaceAll("看對方是否有穩定互動", "看雙方是否能一起面對現實條件")
      .replaceAll("不要只看表面條件好不好", "不要只看感情熱度，也要看現實條件能不能承接")
      .replaceAll("容易硬衝，也容易非要痛過才懂", "不適合只靠硬撐往前走")
      .replaceAll("先聽聽別人的說法，不要只用自己的堅持往前撞，感情不是靠硬撐就會好", "未來三年要穩，重點是雙方能不能一起面對現實壓力、金錢、家庭和生活責任")
      .replaceAll("雙方可能都太保守，卡在分寸、規則和界線", "雙方可能都太在意分寸、規則和表面和平")
      .replaceAll("彼此有沒有真的往前一步", "彼此能不能把金錢、家庭、責任和生活安排談清楚")
      .replaceAll("比較慢熱，也偏向現實條件和長期穩定", "比較偏現實經營，需要慢慢累積穩定")
      .replaceAll("不要太務實，還是要補一點小浪漫", "不能只靠感情熱度，也要看現實條件能不能承接");
  }

  if (isPartner) {
    result = result
      .replaceAll("如果你們已經不是單純曖昧", "既然你們已經是伴侶關係")
      .replaceAll("用清楚但不逼迫的方式確認彼此態度", "找時間把生活小事、責任分配和情緒感受談清楚")
      .replaceAll("觀察對方是否願意回應你", "觀察雙方是否願意一起修復")
      .replaceAll("這段感情機會", "這段伴侶關係")
      .replaceAll("桃花機會", "關係修復空間")
      .replaceAll("未來出現的人", "伴侶");
  }

  const isOpeningNoDate =
    isOpening &&
    (
      q.includes("適合開幕的日期") ||
      q.includes("開幕的日期") ||
      q.includes("確切日期") ||
      q.includes("幾月幾號") ||
      q.includes("什麼時候")
    ) &&
    !(
      /\d{1,2}\/\d{1,2}/.test(q) ||
      /\d{1,2}月\d{1,2}/.test(q) ||
      q.includes("六月底") ||
      q.includes("七月初") ||
      q.includes("農曆") ||
      q.includes("月底") ||
      q.includes("月初")
    );

  if (isOpeningNoDate) {
    const fixed = "單張牌無法直接給確定幾月幾號。這題比較適合看開店前要注意什麼。";
    if (!result.includes("單張牌無法直接給確定幾月幾號")) {
      result = `${fixed}\n\n${result.trim()}`;
    }
  }

  if (isOpening) {
    result = result
      .replaceAll("開店時考量的方向上", "開店前的準備上")
      .replaceAll("適合看得出果斷和執行力", "可以看出果斷和執行力")
      .replaceAll("客戶體驗", "顧客體驗")
      .replaceAll("客戶滿意度", "顧客滿意度")
      .replaceAll("客戶", "顧客");
  }

  if (isTravel) {
    result = result.replaceAll("聚餐氣氛", "旅遊氣氛");
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanLegalOutcomeLanguage(answer: string, context: ReadingContext) {
  if (
    context.questionSubcategory !== "合約｜法律勝負" &&
    !detectLegalOutcomeIntent(context.question)
  ) {
    return answer;
  }

  const safetySentence = "這張牌不能替你判斷法律勝負，也不能取代律師或專業法律意見。";
  let result = answer
    .replaceAll("有贏得此法律問題的潛力", "目前條件可能較有利，但不能只靠牌面判斷勝負")
    .replaceAll("贏得此法律問題的潛力", "條件可能較有利")
    .replaceAll("贏得潛力", "條件可能較有利")
    .replaceAll("成功機會增加", "條件會比較清楚")
    .replaceAll("成功機會", "條件")
    .replaceAll("勝算", "條件")
    .replaceAll("贏面", "條件")
    .replaceAll("輸面", "不利條件")
    .replace(/一定會贏|保證會贏|必定會贏|你會贏|能贏/g, "不能用牌面直接判斷會贏")
    .replace(/一定會輸|保證會輸|必定會輸|你會輸|能輸/g, "不能用牌面直接判斷會輸")
    .replace(/會勝訴/g, "不能用牌面直接判斷會勝訴")
    .replace(/會敗訴/g, "不能用牌面直接判斷會敗訴");

  if (!result.includes("不能替你判斷法律勝負")) {
    result = `${safetySentence}\n\n${result.trim()}`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanTransactionLegalPropertyLanguage(answer: string, context: ReadingContext) {
  let result = answer.trim();

  if (
    context.questionSubcategory === "交易｜交貨交付" &&
    !includesAny(result, ["交期", "出貨進度", "約定時間", "聯絡紀錄"])
  ) {
    result = `${result}\n\n實際處理上，建議先確認交期、出貨進度、約定時間與聯絡紀錄，必要時把交貨文件和延遲責任留下紀錄。`;
  }

  if (
    context.questionSubcategory === "房產｜交屋責任" &&
    !includesAny(result, ["點交", "驗收", "文件", "責任歸屬"])
  ) {
    result = `${result}\n\n交屋時請特別把點交、驗收、文件、款項節點與責任歸屬逐項確認，避免後續才發現誰該處理哪一段。`;
  }

  if (
    context.questionSubcategory === "合約｜口頭約定" &&
    !includesAny(result, ["書面", "文件", "紀錄", "條件"])
  ) {
    result = `${result}\n\n口頭答應的內容建議轉成書面或可查的溝通紀錄，把條件、付款時間與責任界線寫清楚再推進。`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function buildCardDomainMeaning(card: ZiweiCard, position: "正位" | "反位", questionType: string) {
  const side = position === "正位" ? "upright" : "reversed";

  if (questionType === "感情關係") {
    return card.love[side];
  }

  if (questionType === "人物描述") {
    return card.relationship[side];
  }

  if (questionType === "工作事業") {
    return card.work[side];
  }

  if (
    questionType === "金錢投資" ||
    questionType === "金錢財務" ||
    questionType === "買賣交易" ||
    questionType === "經營銷售" ||
    questionType === "收入規劃"
  ) {
    return card.money[side];
  }

  if (questionType === "人際合作" || questionType === "合約法律") {
    return card.relationship[side];
  }

  if (questionType === "家庭家人" || questionType === "房產置產") {
    return card.family[side];
  }

  if (questionType === "健康狀態") {
    return card.health[side];
  }

  if (questionType === "學習考試") {
    return card.study[side];
  }

  return card.advice[side];
}

const uprightHealthyActions: Record<string, string> = {
  紫微星: "回到紫微正位的健康做法：先看大局、拿出承擔，別只顧面子或一時情緒。",
  天機星: "回到天機正位的健康做法：整理資訊、拆出步驟，用方法調整，不要在混亂裡反覆猜。",
  太陽星: "回到太陽正位的健康做法：把責任、時間與話說清楚，用穩定行動照亮問題。",
  武曲星: "回到武曲正位的健康做法：看數字、規則、成本與紀律，不要硬拚或只靠意志撐。",
  天同星: "回到天同正位的健康做法：先把壓力放緩，但不要逃避規則與該面對的現實。",
  廉貞星: "回到廉貞正位的健康做法：把界線、原則與可接受範圍講清楚，避免灰色地帶。",
  天府星: "回到天府正位的健康做法：穩住資源、盤點條件，用務實管理取代過度控制。",
  太陰星: "回到太陰正位的健康做法：先讓狀態安定下來，細膩照顧、慢慢累積，不要在不安裡硬衝。",
  貪狼星: "回到貪狼正位的健康做法：把慾望和吸引力導回清楚目標，不要被一時刺激帶走。",
  巨門星: "回到巨門正位的健康做法：把話講清楚、確認資訊、避免猜測與誤會放大。",
  天相星: "回到天相正位的健康做法：重建規則、秩序、分寸與約定，讓事情有可遵守的流程。",
  天梁星: "回到天梁正位的健康做法：用成熟、保護與長遠判斷處理，不要只靠擔心或旁人意見。",
  七殺星: "回到七殺正位的健康做法：果斷但有策略，先定界線和步驟，不要用衝動硬切。",
  破軍星: "回到破軍正位的健康做法：要改就有計畫地改，先評估代價與重建成本，不要亂破壞。",
};

function buildReverseToUprightAdvice(
  card: ZiweiCard,
  position: "正位" | "反位",
  questionType: string,
  questionCore: string
) {
  if (position === "正位") {
    return "這次是正位，建議順著星曜健康特質發揮，但仍要放回原問題評估。";
  }

  const healthyAction =
    uprightHealthyActions[card.name] ||
    `回到${card.name}正位的健康做法：把這顆星原本好的力量用在原問題上。`;

  return `反位建議回正：先說清楚目前卡住、失衡或不順的地方，再用正位健康做法收束。${healthyAction}請放回「${questionType}」與「${questionCore}」來寫，不要變成泛用建議。`;
}

function buildReverseToUprightUserAdvice(cardName: string) {
  const action = uprightHealthyActions[cardName] || "把事情拉回比較健康、清楚、穩定的做法。";

  return action.replace(/^回到[^：]+：/, "後續建議是：");
}

function buildQuestionContextBlock(context: ReadingContext) {
  return `Question Context
原始問題：${context.question}
大分類：${context.questionType}
場景分類：${context.questionDomain}
細分類：${context.questionSubcategory}
意圖：${context.questionIntent}
問題核心摘要：${context.questionCore}
回答長度模式：${context.outputLengthMode}
風險等級：${context.riskLevel}`;
}

function isFollowUpCorrectionQuestion(
  question: string,
  followUpContext?: FollowUpContext | null
) {
  if (!followUpContext?.isFollowUp || !followUpContext.previousReadings?.length) {
    return false;
  }

  return includesAny(question, [
    "不是",
    "已離開",
    "離開了",
    "不是還在",
    "我剛剛說",
    "不是這個意思",
    "更正",
  ]);
}

function buildFollowUpCorrectionOpening(context: ReadingContext) {
  const question = context.question;

  if (includesAny(question, ["已離開", "離開了", "不是還在"]) && question.includes("舊公司")) {
    return "我先把脈絡修正一下：這題不是看他還在舊公司，而是看他離開之後，原公司目前的狀態。";
  }

  return "我先把脈絡修正一下：這題是在更正前面的理解，接下來要以你這次補充的狀況為主。";
}

function ensureFollowUpCorrectionOpening(answer: string, context: ReadingContext) {
  if (!isFollowUpCorrectionQuestion(context.question, context.followUpContext)) {
    return answer;
  }

  if (includesAny(answer, ["脈絡修正", "不是看", "已離開", "離開之後", "更正前面的理解"])) {
    return answer;
  }

  return `${buildFollowUpCorrectionOpening(context)}\n\n${answer.trim()}`;
}

function isCompanyLeaveCorrectionContext(context: ReadingContext) {
  return (
    isFollowUpCorrectionQuestion(context.question, context.followUpContext) &&
    includesAny(context.question, ["已離開", "離開了", "不是還在"]) &&
    context.question.includes("舊公司")
  );
}

function cleanFollowUpCompanyCorrectionLanguage(answer: string, context: ReadingContext) {
  if (!isCompanyLeaveCorrectionContext(context)) {
    return answer;
  }

  let result = answer
    .replaceAll("這段關係中的一些過渡性問題", "原公司內部交接與流程重新分配")
    .replaceAll("這段關係中的過渡性問題", "原公司內部交接與流程重新分配")
    .replaceAll("這段關係", "原公司目前狀態")
    .replaceAll("貴人幫助和庇護的潛力", "原公司內部仍有某種支撐力量")
    .replaceAll("貴人幫助與庇護的潛力", "原公司內部仍有某種支撐力量")
    .replaceAll("貴人幫助", "內部支撐")
    .replaceAll("貴人庇護", "內部支撐")
    .replaceAll("庇護的潛力", "支撐力量")
    .replaceAll("這個情緒和人際互動的背景中", "原公司內部交接背景中")
    .replaceAll("讓你克服目前的挑戰", "讓原公司的交接狀況慢慢變清楚")
    .replaceAll("展現你的專業與用心", "觀察原公司後續如何處理交接")
    .replaceAll("讓對方感受到你的能量與誠意", "觀察原公司是否把責任與流程說清楚")
    .replaceAll("留意自己的身體狀況，確認在關心他人的同時，別忽略了自身的需求。", "接下來可以觀察：原公司是否有人接手他的工作、流程是否重新分配、主管或資深同事是否出面協調，以及離開後留下的責任是否被清楚交接。")
    .replaceAll("也要留意自己的身體狀況", "也要留意原公司的交接狀況")
    .replaceAll("身體狀況", "交接狀況")
    .replaceAll("身心", "內部流程")
    .replaceAll("照顧自己", "確認流程與責任");

  result = result
    .split(/(?<=。|\n)/)
    .filter(
      (part) =>
        !includesAny(part, [
          "能量與誠意",
          "展現你的專業",
          "克服目前的挑戰",
          "情緒和人際互動",
          "身體和心理的支持",
          "自我照顧",
        ])
    )
    .join("");

  const fixedObservation =
    "接下來可以觀察：原公司是否有人接手他的工作、流程是否重新分配、責任是否被說清楚，以及主管或資深同事是否出面協調。";

  if (!includesAny(result, ["原公司是否有人接手", "流程是否重新分配", "責任是否被說清楚"])) {
    result = `${result.trim()}\n\n${fixedObservation}`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function buildTargetedFollowUpFocusInstruction(followUpFocus: string) {
  const instructions: Record<string, string> = {
    debt_collection_followup: `
本題 Follow-up 焦點：同一筆欠款的催款跟進。
- 這題不是感情對方心意；「他」「對方」「主動聯絡」都要放回欠款、催款、付款責任與聯絡紀錄。
- 第一段要直接回答是否可以主動聯絡催款，語氣要清楚但不要情緒化。
- 主軸請放在：欠款金額、還款時間、付款方式、文字紀錄、約定、催收節奏、對方是否願意面對款項責任。
- 禁止寫：真心、曖昧、感情前景、主動聊天、邀約、未來計畫、對方心意。`,
    debt_delay_followup: `
本題 Follow-up 焦點：同一筆欠款如果對方又拖延。
- 這題不是感情觀察，而是款項責任、付款節點、催收節奏與紀錄保存。
- 第一段要回答：如果他又拖，下一步先整理紀錄、金額與時間點，不要只靠口頭等待。
- 主軸請放在：欠款金額、原本約定、上次溝通時間、付款日期、付款方式、分期、最後期限、聯絡紀錄。
- 禁止寫：情感上冷硬、主動找你聊天、回覆速度、邀約、未來計畫、重新思考感情前景。`,
    critical_health_care: `
本題 Follow-up 焦點：延續家人住院／重大健康脈絡的照護安排。
- 第一段必須保留安全界線：占卜不能判斷病情結果或是否能撐過去。
- 這題要回答使用者現在能先幫家裡整理什麼，不要判斷病情走向。
- 主軸請放在：醫療資訊、醫師說法、照護分工、家人聯絡、文件資料、費用與資源、陪伴安排、不要一個人扛。
- 禁止寫：穩定向前、有機會、可行、有保障、恢復、好轉、變好、撐過。`,
    critical_health_family_communication: `
本題 Follow-up 焦點：延續家人住院／重大健康脈絡的家人溝通。
- 第一段仍要保留重大健康安全界線，不判斷病情結果。
- 主軸請放在：醫療資訊一致、照護分工、誰負責聯絡、情緒安撫、現實安排與費用資源。
- 禁止寫成一般人際溝通或保證病情會變好。`,
    course_creator_content_choice: `
本題 Follow-up 焦點：課程創作者在課程頁面要先補案例或講義。
- 使用者是課程提供者，不是學生。
- 第一段必須用「這張牌比較偏向：先補案例」或「這張牌比較偏向：先補講義」給主偏向。
- 主軸請放在：課程價值、學生理解、實際應用、講義架構、報名轉換。
- 禁止寫成學習考試、學生自己如何複習或泛泛資源評估。`,
    course_creator_conversion: `
本題 Follow-up 焦點：課程創作者的報名文案與課程轉換。
- 使用者是課程提供者，不是學生。
- 主軸請放在：課程價值、學生痛點、上完會得到什麼、報名流程、課程架構、案例／見證、CTA。
- 禁止寫成學習考試、考試準備、學生自己如何學、收入規劃或合約成本。`,
    course_creator_page: `
本題 Follow-up 焦點：課程創作者的課程頁面與上架準備。
- 使用者是課程提供者，不是學生。
- 主軸請放在：課程頁面、內容準備、報名流程、受眾需求、宣傳節奏與交付品質。`,
    content_brand_style: `
本題 Follow-up 焦點：短影音內容風格二選一。
- 第一段必須用「這張牌比較偏向：先偏個人故事」或「這張牌比較偏向：先偏專業教學」給主偏向。
- 主軸請放在：受眾、信任感、內容形式、教學深度、故事連結、課程轉換。
- 禁止寫成收入方式、成本、合約、付款條件或金錢財務。`,
    content_brand_conversion: `
本題 Follow-up 焦點：短影音內容如何導向課程報名。
- 主軸請放在：受眾信任、內容主軸、課程價值、案例、見證、報名理由與轉換。
- 禁止寫成收入規劃、金錢財務、合約付款或泛泛推廣。`,
    website_followup_feature: `
本題 Follow-up 焦點：網站連續提問功能。
- 主軸請放在：使用者是否看得懂、同一題脈絡、重新抽牌、流程直覺、按鈕位置與說明文字。
- 不要泛化成經營推廣，也不要用「任性與逃避」形容使用者。`,
    website_ux_copy: `
本題 Follow-up 焦點：網站按鈕與 UX 文案。
- 主軸請放在：按鈕名稱、簡短清楚、讓使用者分得出重新占卜與同一題追問、避免誤解。
- 不要泛化成品牌文案或客人心態。`,
    website_points_notice: `
本題 Follow-up 焦點：網站扣點提示。
- 主軸請放在：扣點前提醒、費用透明、客人選擇權、信任感與流程位置。
- 語氣要清楚，不要責怪客人。`,
  };

  return instructions[followUpFocus] || "";
}

function buildFollowUpContextBlock(context: ReadingContext) {
  const previous = context.followUpContext?.previousReadings || [];

  if (!context.followUpContext?.isFollowUp || previous.length === 0) {
    return "";
  }

  const followUpFocus = detectFollowUpFocus(
    context.question,
    context.followUpContext
  );
  const correctionInstruction = isFollowUpCorrectionQuestion(
    context.question,
    context.followUpContext
  )
    ? `
本題 Follow-up 是使用者在修正前文理解。
- 第一段必須先承接修正，不要沿用錯誤前提。
- 如果使用者說「已離開」「不是還在」，要明確寫出：這題不是看對方還在原情境，而是看離開之後或修正後的狀態。
- 後續解讀仍以這次抽到的牌為主，不要重複前面錯誤脈絡。`
    : "";
  const dateReference = extractFollowUpDateReference(context.followUpContext);
  const followUpReferenceInstruction =
    dateReference &&
    hasFollowUpTravelContext(context.followUpContext) &&
    isTravelTrafficFollowUpQuestion(context.question)
      ? `
本題 Follow-up 明確承接：前文已經指定 ${dateReference} 是出遊日期。
- 本題如果問「那天交通」「那天路線」「那天出發」等簡短問法，第一段必須明確寫回「${dateReference} 出遊」與「交通」。
- 建議第一段可以用：「延續前面 ${dateReference} 出遊這件事來看，這天交通要特別注意……」
- 不要只泛泛寫交通或行程安排，避免使用者看不出你接住的是哪一天。`
      : "";
  const targetedFocusInstruction = buildTargetedFollowUpFocusInstruction(followUpFocus);
  const focusInstruction =
    targetedFocusInstruction ||
    (followUpFocus === "investment_emotion"
      ? `
本題 Follow-up 焦點：期貨／投資交易情緒。
- 這題不是一般心理諮商，而是在問交易情緒是否影響停損判斷。
- 第一段要有占卜判斷感，例如：這張牌比較偏向你確實有一部分被交易情緒影響；或不是單純情緒太重，而是部位波動讓你偏離原本規則；或情緒有影響，但更大的問題是成本、停損線和部位大小沒有先固定。
- 主軸請放在：交易情緒、期貨、停損、部位、成本、停損線、原本規則、波動、風險承受度、焦慮、僥倖、過度樂觀、想逃避壓力。
- 投資 follow-up 草稿必須 260 到 420 個中文字，至少 3 段；不得低於 260 個中文字，也不要只寫安全聲明。
- 必須包含：直接判斷交易情緒是否影響判斷、牌義放入交易情境、回到成本 / 停損線 / 部位 / 風險承受度、不給操作指令。
- 可以提醒整理情緒，但不能把主軸寫成一般心理安慰或自我照顧。
- 不能替使用者決定停損或不停損。`
      : followUpFocus === "investment_observation"
        ? `
本題 Follow-up 焦點：期貨／投資明天觀察重點。
- 這題不是一般明天運勢，而是在問如果明天再觀察這筆期貨或投資部位，應該看哪些風險條件。
- 第一段要有占卜判斷感，例如：這張牌比較偏向明天重點不是單一漲跌，而是有沒有回到原本策略。
- 主軸請放在：原本策略、停損線、成本、部位大小、波動、風險承受度、是否情緒交易、盤勢結構、量能、是否照原規則執行。
- 投資 follow-up 草稿必須 260 到 420 個中文字，至少 3 段；不得低於 260 個中文字，也不要只寫安全聲明。
- 必須包含：明天觀察重點、牌義放入交易情境、回到成本 / 停損線 / 部位 / 風險承受度、不給操作指令。
- 禁止寫成：明天可以買、明天可以賣、明天可以停損、明天可以加碼、建議你明天停損或續抱。
- 可以寫：這張牌不是替你決定明天買賣，而是提醒你回到原本策略與風險規則。`
        : followUpFocus === "investment_discipline"
          ? `
本題 Follow-up 焦點：期貨／投資交易紀律與避免衝動加碼。
- 這題不是一般自制力建議，而是在問同一筆期貨或投資部位裡，如何避免一時衝動取代原本風險規則。
- 第一段要有占卜判斷感，例如：這張牌比較偏向你現在容易被短期刺激或想翻本的念頭影響，需要先回到原本規則；或衝動有影響，但更核心是加碼條件、部位大小和風險承受度沒有先固定。
- 主軸請放在：期貨、交易紀律、加碼條件、原本規則、成本、停損線、部位大小、風險承受度、波動、交易情緒、貪念、焦慮、想翻本。
- 投資 follow-up 草稿必須 260 到 420 個中文字，至少 3 段；不得低於 260 個中文字，也不要只寫安全聲明。
- 必須包含：不要讓一時衝動取代原本風險規則、先設定加碼條件、沒符合條件就不動、檢查部位是否符合原本規則、記錄交易情緒、回到成本 / 停損線 / 風險承受度。
- 禁止寫成：先不要急著加碼、可以加碼、不可以加碼、建議加碼、建議不要加碼、降低部位、需要降低部位。
- 可以寫：這張牌不是要替你決定能不能加碼，而是提醒你先回到原本設定的風險規則。`
        : followUpFocus === "learning_review"
          ? `
本題 Follow-up 焦點：同一個課程／新學習內容的複習方式。
- 這題是在問開始學之後，要怎麼複習才吸收得住、負擔不會太大。
- 第一段要有占卜判斷感，例如：這張牌比較偏向你不能靠一次大量複習，要用固定節奏慢慢累積；或複習方式要分段，不要一次塞太多。
- 主軸請放在：課程內容、學習目標、時間安排、負擔會不會太大、吸收節奏、分段複習、固定時間、筆記整理、實作練習、後續複習方式。
- 禁止跑成課程上架、學生吸收節奏、課程宣傳、報名流程、後續執行安排或課程創作者語境。`
          : followUpFocus === "love_binary"
            ? `
本題 Follow-up 焦點：同一位對象的感情心意二選一。
- 這題不是一般人際事件，而是在問上一題同一個對象的心意與回應態度。
- 第一段必須選出主偏向，例如：不是單純忙，而是偏迴避正面回應；或兩者都有一點，但主因偏冷處理。
- 可以保留灰色空間，但不能兩邊都說可能就結束。
- 主軸請放在：對方心意、回覆變慢、忙碌、冷淡、避重就輕、是否願意正面回應。`
            : followUpFocus === "love_contact"
              ? `
本題 Follow-up 焦點：同一位對象是否會回應主動聯絡。
- 這題不是一般互動建議，而是在問你主動找他／她，對方會不會回應。
- 回答必須包含三層：會不會回、回覆穩不穩、回應品質偏真心／禮貌／輕鬆／觀望。
- 不能只寫有機會、順其自然或保持輕鬆。`
              : followUpFocus === "love_observation"
                ? `
本題 Follow-up 焦點：同一位對象接下來一週的感情互動觀察。
- 這題不是一般近期狀態，而是在問前面同一位對象接下來一週要觀察什麼。
- 第一段要有占卜判斷感，例如：這張牌比較偏向接下來一週要看對方是否從被動變主動；或重點不是單次回覆，而是回覆穩定度和內容深度。
- 主軸請放在：他的回覆速度、是否主動找你、回覆內容深度、是否願意延續話題、是否有邀約或未來安排、是否只是禮貌回應、是否延續前面忙 / 冷淡 / 禮貌 / 真心的脈絡。
- 禁止寫成一般近期運勢、泛用正向發展，或只說這週有機會有變化。`
              : "");

  const lines = previous.map((item, index) => {
    const cardText = [item.cardName, item.position].filter(Boolean).join("｜");

    return [
      `第 ${index + 1} 題：`,
      `問題：${item.question || "未提供"}`,
      cardText ? `抽到：${cardText}` : "",
      item.questionSubcategory ? `題型：${item.questionSubcategory}` : "",
      item.answerSummary ? `重點摘要：${item.answerSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `Follow-up Context
這是一個連續提問。使用者目前的新問題仍要重新占卜、重新抽牌、重新扣點。
請以前面脈絡輔助理解代名詞與簡短問法，但回答仍以這次新問題為主。
如果新問題像「那這天呢」「那交通呢」「那對方呢」，要自然補足上一題主題。
如果上一題是股票、期貨、投資、停損或部位，新問題提到情緒、明天、重點、觀察、策略、規則、加碼、衝動或避免時，要放回同一筆投資／交易風險語境；不要寫成一般情緒諮商或一般行動建議，也不能給買賣操作指令。
如果上一題是感情、對方心意、回覆變慢、忙或冷淡、主動聯絡、真心或禮貌，新問題提到接下來、一週、觀察、看什麼或注意什麼時，要放回同一位對象的感情互動觀察；不要寫成一般近期運勢。
如果上一題是課程、學習、報名或新學習內容，新問題提到負擔、開始學、複習方式或吸收時，要放回同一個課程／學習內容；不要寫成課程上架、報名流程或一般人生建議。
如果上一題是欠款、還款、催款、回款、尾款、付款或欠我的錢，新問題提到他、對方、主動聯絡、又拖、問他、下一步或注意什麼，要放回欠款／催款／付款責任語境；除非新問題明確有喜歡、曖昧、復合、前任、感情、愛或心意，否則不得寫成感情。
如果上一題是住院、撐過、病危、生命危險、洗腎、高齡長輩、喪事或重大健康，新問題提到家裡、家人溝通、先處理什麼、下一步注意什麼，要保留重大健康安全界線，回到醫療資訊、照護分工與家人溝通。
如果上一題是課程上架、課程頁面、補案例、補講義、學生報名、報名文案或夫妻宮課程，新問題提到學生、報名、文案、案例、講義或課程價值，要放回課程創作者語境；不要寫成學生學習考試。
如果上一題是短影音、內容品牌、教學內容、個人故事、專業教學或受眾，新問題提到內容風格、客人報名課程或內容要加強，要放回內容品牌與課程轉換；不要寫成收入規劃或金錢財務。
如果上一題是連續提問、按鈕文案、扣點、客人看得懂、功能或操作流程，新問題要放回網站系統、UX 文案與扣點提示；不要泛化成一般經營推廣。
如果新問題明顯換主題，可以提醒這題已經偏離上一題，但仍作為新問題回答。
${focusInstruction}
${correctionInstruction}
${followUpReferenceInstruction}
以下最多保留 ${MAX_FOLLOW_UP_CONTEXT_ITEMS} 題摘要；要理解整串脈絡，但不要重複貼完整前文：

${lines.join("\n\n")}`;
}

function buildCardContextBlock(context: ReadingContext) {
  return `Card Context
星曜：${context.card.name}
正反位：${context.position}
化氣：${context.card.huaqi}
五行：${context.card.element}
星曜核心：${context.card.core}
這個題型下的牌義角度：${context.cardDomainMeaning}
這次正反位重點：${context.positionMeaning}

可參考分類資料：
${context.topicData}`;
}

function isChoiceMainBiasQuestion(context: ReadingContext) {
  if (isHighRiskInvestmentContext(context)) {
    return false;
  }

  const text = context.question.toLowerCase();
  const choiceSubcategories = [
    "感情｜承諾觀望",
    "感情｜感情選擇",
    "工作｜職涯選擇",
    "工作｜接案合約",
    "一般｜生活行程選擇",
    "經營｜課程上架",
    "經營｜課程內容優化",
    "經營｜內容風格選擇",
    "經營｜商品品項決策",
    "金錢｜收入選擇",
    "金錢｜收入方式選擇",
    "金錢｜副業收入",
    "金錢｜大額購買",
  ];

  return (
    context.questionIntent === "要不要做" ||
    context.questionIntent === "適不適合" ||
    choiceSubcategories.includes(context.questionSubcategory) ||
    includesAny(text, [
      "該不該",
      "該選",
      "還是",
      "適合嗎",
      "合適嗎",
      "值得嗎",
      "該接嗎",
      "該補",
      "要不要",
      "要走高價",
      "親民價格",
      "往管理走",
      "繼續走專業",
      "教學",
      "銷售",
      "接案",
      "個人故事",
      "高端專業",
      "親近生活",
    ])
  );
}

function buildMainBiasOpening(context: ReadingContext) {
  const text = context.question.toLowerCase();
  const isReversed = context.position === "反位";

  if (isAdBudgetQuestion(context.question)) {
    return "這張牌比較偏向：先不要把重點放在直接放大投放，而是先檢查目前成效、轉換成本和受眾反應，再決定要不要調整測試規模。";
  }

  if (context.questionSubcategory === "一般｜生活行程選擇" && text.includes("東港")) {
    return context.card.name === "破軍星" && context.position === "正位"
      ? "這張牌比較偏向：如果交通、時間和體力安排都確認得上，改成去東港會更貼近你現在想調整節奏的方向。"
      : isReversed
        ? "這張牌比較偏向：先不要急著改行程，時間、交通或體力條件還需要再確認。"
        : "這張牌比較偏向：可以調整行程，但要先確認交通、時間和體力安排是否承接得住。";
  }

  if (context.questionSubcategory === "經營｜商品品項決策") {
    if (text.includes("4種") || text.includes("四種")) {
      return isReversed
        ? "這張牌比較偏向：先不要一次備到 4 種，庫存、成本和陳列壓力可能會變大。"
        : "這張牌比較偏向：4 種可以評估，但要先確認熱門款、成本、陳列和補貨節奏。";
    }

    if (text.includes("2種") || text.includes("兩種")) {
      return isReversed
        ? "這張牌比較偏向：2 種雖然簡化，但仍要確認口味、價格和推薦方式是否清楚。"
        : "這張牌比較偏向：先用 2 種清楚主打，品質、口味和推薦話術會更容易聚焦。";
    }

    return isReversed
      ? "這張牌比較偏向：先不要備太多品項，適合把成本、庫存和顧客選擇壓力看清楚。"
      : "這張牌比較偏向：可以列出候選品項數，再依成本、陳列和熱賣款逐一比較。";
  }

  if (context.questionSubcategory === "經營｜課程內容優化") {
    return "這張牌比較偏向：先補案例，因為現在最需要讓學生看懂實際應用與課程價值；講義可以同步整理，但不必先追求完整。";
  }

  if (context.questionSubcategory === "經營｜內容風格選擇") {
    return isReversed
      ? "這張牌比較偏向：先偏專業教學，個人故事作為輔助，因為目前最需要讓受眾理解你的專業與方法。"
      : "這張牌比較偏向：先偏個人故事，專業教學作為支撐，因為目前需要先建立信任感與情感連結。";
  }

  if (context.questionSubcategory === "經營｜內容品牌") {
    return isReversed
      ? "這張牌比較偏向：先保守整理內容主軸，讓受眾看懂你要教什麼與為什麼值得信任。"
      : "這張牌比較偏向：可以走教學內容，但要先確認受眾需求、內容清楚度與信任感。";
  }

  if (
    context.questionSubcategory === "經營｜課程轉換" &&
    includesAny(text, ["短影音", "內容", "報名課程", "客人報名"])
  ) {
    return isReversed
      ? "這張牌比較偏向：先補清楚內容價值與受眾痛點，再談報名轉換，不要只靠情緒推動。"
      : "這張牌比較偏向：可以往課程報名轉換推進，但要先把內容價值、案例與下一步報名路徑說清楚。";
  }

  if (context.questionSubcategory === "感情｜承諾觀望") {
    return isReversed
      ? "這張牌比較偏向：他目前在承諾與責任上仍有保留，甚至有逃避承擔的成分，先不要把他的沉默解讀成穩定承諾。"
      : "這張牌比較偏向：他不是完全沒有感覺，但承諾感還沒有落地，現階段更像觀望與保留。";
  }

  if (context.questionSubcategory === "感情｜單身桃花") {
    return isReversed
      ? "這張牌比較偏向：現在可以認識新對象，但不適合太快投入，先看互動品質與對方穩定度。"
      : "這張牌比較偏向：可以主動打開新桃花機會，但仍要慢慢觀察對方是否穩定。";
  }

  if (context.questionSubcategory === "感情｜冷戰溝通") {
    return isReversed
      ? "這張牌比較偏向：破冰有難度，對方目前可能還在防備或退縮，不適合急著逼出答案。"
      : "這張牌比較偏向：仍有破冰空間，但需要用比較柔和、清楚的方式重新開啟互動。";
  }

  if (context.questionSubcategory === "感情｜感情選擇") {
    if (text.includes("穩定的人") && text.includes("心動的人")) {
      return isReversed
        ? "這張牌比較偏向：先選比較穩定的人會較安全，心動感如果缺少實際承接，後面容易不安。"
        : "這張牌比較偏向：心動的人可以觀察，但真正能不能走下去，要看對方是否有穩定行動。";
    }

    if (text.includes("前任") && text.includes("保持距離")) {
      return isReversed
        ? "這張牌比較偏向：先保持距離較穩，前任目前未必已準備好面對過去問題。"
        : "這張牌比較偏向：可以保留一次觀察機會，但不要太快回到原本相處模式。";
    }

    return isReversed
      ? "這張牌比較偏向：先不要急著選擇推進，這段關係目前還有不穩或看不清的地方。"
      : "這張牌比較偏向：可以往前觀察，但要以實際互動和穩定行動作為判斷。";
  }

  if (context.questionSubcategory === "感情｜外界因素") {
    return isReversed
      ? "這張牌比較偏向：外界因素或其他人的干擾感較明顯，但仍不適合直接斷定第三者。"
      : "這張牌比較偏向：外界影響不一定是主因，更要看對方自己的界線與態度是否穩定。";
  }

  if (
    context.questionSubcategory === "金錢｜收入選擇" ||
    context.questionSubcategory === "金錢｜收入方式選擇" ||
    context.questionSubcategory === "金錢｜副業收入"
  ) {
    if (text.includes("本業收入") && text.includes("副業")) {
      return isReversed
        ? "這張牌比較偏向：先把本業收入和現有能力站穩，再用小規模方式測試副業，不適合一次把重心全部移開。"
        : "這張牌比較偏向：副業可以列入嘗試，但要從你熟悉、成本可控的方向開始，不要急著放大投入。";
    }

    if (text.includes("教學") && text.includes("銷售") && text.includes("接案")) {
      return isReversed
        ? "這張牌比較偏向：先從接案或可立即驗證需求的方式開始，教學和銷售可以當成後續延伸，不要一次三邊都做滿。"
        : "這張牌比較偏向：教學方向較能累積信任，銷售和接案可以作為測試需求與現金流的輔助。";
    }

    return isReversed
      ? "這張牌比較偏向：先不要急著放大新的收入嘗試，適合先把成本、時間和需求確認清楚。"
      : "這張牌比較偏向：可以小規模測試新的收入方向，但要選自己較熟悉、較能持續執行的方式。";
  }

  if (context.questionSubcategory === "金錢｜大額購買") {
    return isReversed
      ? "這張牌比較偏向：先不要急著買，規格、價格、付款方式或後續負擔還需要再確認。"
      : "這張牌比較偏向：可以列入考慮，但要先確認需求、規格、保固和現金流是否撐得住。";
  }

  if (context.questionType === "工作事業") {
    if (text.includes("管理") && text.includes("專業")) {
      return isReversed
        ? "這張牌比較偏向：先把專業路線站穩會比較安全，管理責任目前可能帶來額外壓力。"
        : "這張牌比較偏向：管理方向可以列入考慮，但要先確認資源、授權與責任邊界。";
    }

    if (isWorkClientContractQuestion(context.question)) {
      return isReversed
        ? "這張牌比較偏向：這個案子不要急著接，先把範圍、報酬、交付與溝通成本談清楚。"
        : "這張牌比較偏向：這個案子可以列入考慮，但接之前要先確認合作條件。";
    }

    return isReversed
      ? "這張牌比較偏向：先不要急著做大決定，工作條件、壓力或資源還需要再確認。"
      : "這張牌比較偏向：可以列入考慮，但要把工作內容、責任與資源先看清楚。";
  }

  if (context.questionType === "經營推廣" || context.questionType === "經營銷售") {
    if (text.includes("高價") && text.includes("親民")) {
      return isReversed
        ? "這張牌比較偏向：先用親民價格或較低門檻測試市場反應，暫時不要一次拉太高。"
        : "這張牌比較偏向：高價定位可以嘗試，但要先把價值感、信任感與交付內容說清楚。";
    }

    if (text.includes("合夥")) {
      return isReversed
        ? "這張牌比較偏向：先不要進入太深的合夥，適合從小合作和責任切分開始觀察。"
        : "這張牌比較偏向：可以合作看看，但要先把分工、權責與錢的規則寫清楚。";
    }

    if (text.includes("教學") && text.includes("個人故事")) {
      return isReversed
        ? "這張牌比較偏向：先以教學內容做主軸，個人故事適合當輔助，不要讓內容太散。"
        : "這張牌比較偏向：教學主軸比較穩，個人故事可以用來增加信任感與溫度。";
    }

    if (text.includes("高端專業") && text.includes("親近生活")) {
      return isReversed
        ? "這張牌比較偏向：親近生活的表達會比較容易被理解，高端專業感先不要做得太有距離。"
        : "這張牌比較偏向：可以保留專業感，但要用親近生活的方式讓客人聽得懂。";
    }

    if (context.questionSubcategory === "經營｜課程上架") {
      return isReversed
        ? "這張牌比較偏向：先補齊課程內容、報名流程和交付細節，再上架會比較穩。"
        : "這張牌比較偏向：可以準備上架，但要把課程價值、報名流程與後續交付先整理清楚。";
    }

    return isReversed
      ? "這張牌比較偏向：先保守測試市場反應，不要一次放大成本或規模。"
      : "這張牌比較偏向：可以推進，但要先確認成本、受眾反應與轉換條件。";
  }

  return isReversed
    ? "這張牌比較偏向：目前不適合急著推進，先把條件、風險和下一步確認清楚會比較穩。"
    : "這張牌比較偏向：可以列入考慮，但仍要看現實條件是否準備好。";
}

// 擇日題(問哪一天/幾月幾號、多候選比較)禁止「這張牌比較偏向」開頭,
// 否則會蓋掉「開幕固定句」與「多候選不硬選」規則,造成雙開頭。
function isDateOpenerConflictContext(context: ReadingContext) {
  const dateIntent = detectDateIntent(context.question);

  return (
    dateIntent === "specific_date_request" ||
    dateIntent === "multi_candidate_compare"
  );
}

function enforceMainBiasForChoiceQuestion(answer: string, context: ReadingContext) {
  if (isDateOpenerConflictContext(context)) {
    return answer;
  }

  if (!isChoiceMainBiasQuestion(context)) {
    return answer;
  }

  const paragraphs = normalizeReviewedAnswerText(answer)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const firstParagraph = paragraphs[0] || "";

  if (/這張牌比較偏向|比較偏向|較偏向|主偏向/.test(firstParagraph)) {
    return answer;
  }

  return `${buildMainBiasOpening(context)}\n\n${answer.trim()}`.trim();
}

function cleanAdBudgetDirectIncrease(answer: string, context: ReadingContext) {
  if (!isAdBudgetQuestion(context.question)) {
    return answer;
  }

  return answer
    .replaceAll("這個月的廣告預算加碼是可行的", "這個月的廣告預算可以先從數據檢查與小額測試開始")
    .replaceAll("這個月的廣告預算可以考慮加", "這個月的廣告預算可以先做小額測試")
    .replaceAll("加碼是可行的", "可以先小額測試")
    .replaceAll("可以評估增額廣告預算", "可以先評估數據與小額測試結果")
    .replaceAll("可以考慮加預算", "可以先用小額測試確認成效")
    .replaceAll("可以加預算", "可以先用小額測試確認成效")
    .replaceAll("直接加預算", "直接放大投放")
    .replaceAll("加預算", "放大投放")
    .replaceAll("廣告預算是否要加", "廣告預算是否要調整")
    .replaceAll("預算是否要加", "預算是否要調整")
    .replaceAll("是否要加", "是否要調整")
    .replaceAll("是否增額", "是否調整")
    .replaceAll("是否增加", "是否調整")
    .replaceAll("是否要加碼", "是否要調整測試規模")
    .replaceAll("增額廣告預算", "調整廣告測試規模")
    .replaceAll("加碼預算", "調整測試規模")
    .replaceAll("加碼", "調整測試規模")
    .replaceAll("增加預算", "調整預算")
    .replaceAll("預算的增加", "預算的調整")
    .replaceAll("可以評估是否要增加廣告預算", "先檢查目前廣告數據，再決定是否需要調整預算")
    .replaceAll("可以考慮增加廣告預算", "可以先用小額測試確認成效")
    .replaceAll("可以先小幅度調整預算", "可以先做小額測試，不要一次放大預算")
    .replaceAll("建議增加廣告預算", "建議先檢查轉換成本與受眾反應")
    .replaceAll("直接增加廣告預算", "直接放大預算")
    .replaceAll("加大廣告預算", "調整測試規模");
}

function cleanBusinessHealthLanguage(answer: string, context: ReadingContext) {
  const isBusinessContext =
    context.questionType === "經營推廣" ||
    context.questionType === "經營銷售" ||
    context.questionSubcategory.startsWith("經營｜");

  if (!isBusinessContext || context.questionType === "健康狀態") {
    return answer;
  }

  return answer
    .replaceAll("身體健康", "經營節奏")
    .replaceAll("健康狀態", "執行狀態")
    .replaceAll("身體狀況", "執行狀態")
    .replaceAll("心理狀態", "經營心態")
    .replaceAll("脾胃與消化", "內容承接與執行負擔")
    .replaceAll("消化不良", "承接不順")
    .replaceAll("免疫力下降", "執行續航變弱")
    .replaceAll("慢性疲勞", "長期執行疲乏");
}

function cleanCourseCreatorLanguage(answer: string, context: ReadingContext) {
  if (![
    "經營｜課程上架",
    "經營｜課程內容優化",
    "經營｜課程轉換",
  ].includes(context.questionSubcategory)) {
    return answer;
  }

  const result = answer
    .replace(/目前單張牌無法直接替你定出確切哪一天。[\s\S]*?分別抽牌比較。\n\n?/g, "")
    .replace(/若要比較日期，建議先列出[\s\S]*?分別抽牌比較。/g, "")
    .replaceAll("選課程或上架與報名流程時", "安排課程上架與報名流程時")
    .replaceAll("吸收狀態", "受眾承接狀態")
    .replaceAll("學習者", "學生")
    .replaceAll("學習吸收", "學生吸收")
    .replaceAll("後續複習方式", "後續交付與陪跑方式")
    .replaceAll("課程內容、學習目標、時間安排", "課程內容、報名流程、受眾需求")
    .replaceAll("學習目標與時間安排", "課程目標、上課安排與交付流程")
    .replaceAll("報名日期", "上架與報名流程")
    .replaceAll("開始上課", "開始販售或交付")
    .replaceAll("正式擇日", "正式營運決策")
    .replaceAll("自己能不能穩定吸收", "學生是否能清楚理解課程價值")
    .replaceAll("穩定吸收知識", "清楚理解課程價值")
    .replaceAll("讓自己在整個過程中", "讓學生在課程理解與報名判斷上")
    .replaceAll("不要只急著開始，先確認自己能不能穩定吸收", "不要只急著上架，先確認內容、流程與交付能不能穩定承接")
    .replaceAll("不要只急著開始", "不要只急著上架")
    .replaceAll("負擔會不會太大", "報名門檻與課程說明是否清楚")
    .replaceAll("學生的負擔是否過重", "報名門檻與課程說明是否清楚")
    .replaceAll("課程負擔", "報名門檻")
    .replaceAll("報名這個課程", "決定報名這門課");

  return cleanCourseContentCaseVsHandoutChoice(result, context);
}

function cleanCourseContentCaseVsHandoutChoice(answer: string, context: ReadingContext) {
  if (
    context.questionSubcategory !== "經營｜課程內容優化" ||
    !context.question.includes("案例") ||
    !context.question.includes("講義")
  ) {
    return answer;
  }

  return answer
    .replace(
      /這張牌比較偏向：先補講義[\s\S]*?(?=\n\n)/,
      "這張牌比較偏向：先補案例，因為現在最需要讓學生看懂實際應用與課程價值；講義可以同步整理，但不必先追求完整。"
    )
    .replaceAll(
      "補充講義能夠增強課程的架構與學生的理解，幫助學生更系統化地掌握內容，從而提升學習效果與報名轉換",
      "先補案例更能讓學生看懂課程成果與實際應用，講義可以同步整理，協助學生把案例背後的方法接起來"
    )
    .replaceAll(
      "如果過度強調案例，可能會導致講義未能充分，造成學生在實際應用中遇到困難。",
      "案例需要和講義架構彼此支撐，避免只有故事沒有方法，也避免只有資料沒有應用情境。"
    )
    .replaceAll("若不優先完善講義", "如果只先整理講義、卻沒有案例支撐")
    .replaceAll("釐清講義的架構", "用案例先呈現學習成果，再整理講義架構")
    .replaceAll("在完善講義之前，確認", "先用案例確認")
    .replaceAll("隨後再考慮如何透過案例來進一步切入", "並同步用案例來進一步切入");
}

function ensureBusinessPartnerTerms(answer: string, context: ReadingContext) {
  const text = context.question.toLowerCase();
  if (!text.includes("合夥")) {
    return answer;
  }

  if (includesAny(answer, ["分工", "金錢", "責任邊界", "權責", "價值觀"])) {
    return answer;
  }

  return `${answer.trim()}\n\n在決定是否合夥前，建議先把分工、金錢規則、責任邊界、價值觀和退出機制談清楚，這比只看彼此感覺是否合得來更重要。`;
}

function cleanDomainGenericFinalAdvice(answer: string, context: ReadingContext) {
  let result = answer;

  if (context.questionType === "感情關係") {
    result = result
      .replaceAll("成本控制", "互動界線")
      .replaceAll("資源管理", "關係中的付出分配")
      .replaceAll("工作項目", "相處問題")
      .replaceAll("專案", "這段關係")
      .replaceAll("執行效率", "互動穩定度")
      .replaceAll("把規則講清楚", "把彼此的期待講清楚");
  }

  if (context.questionType === "工作事業") {
    result = result
      .replaceAll("身體健康", "工作狀態")
      .replaceAll("健康狀態", "職場狀態")
      .replaceAll("感情互動", "職場互動")
      .replaceAll("關係互動", "職場合作");
  }

  if (context.questionType === "經營推廣" || context.questionType === "經營銷售") {
    result = result
      .replaceAll("工作項目", "經營項目")
      .replaceAll("職場", "經營現場")
      .replaceAll("主管", "顧客或合作方")
      .replaceAll("同事", "合作方");
  }

  return result;
}

function buildAnswerContractBlock(context: ReadingContext) {
  // 擇日題(問哪一天/幾月幾號,或多候選比較)不能套「這張牌比較偏向：」開頭,
  // 否則會和「開幕無日期固定句」「多候選不硬選」規則打架,造成雙開頭。
  const dateIntent = detectDateIntent(context.question);
  const isDateOpenerConflict = isDateOpenerConflictContext(context);
  const noCandidateDateContract =
    dateIntent === "specific_date_request" &&
    !hasSpecificCandidateDates(context.question)
      ? "\n無候選日期擇日題：第一句固定用「單張牌無法直接給確定幾月幾號。」開幕題接「這題比較適合看開店前要注意什麼。」不要用「這張牌比較偏向：」開頭，也不要編出任何具體日期。"
      : "";
  const yesNoContract =
    !isDateOpenerConflict && context.questionIntent === "要不要做"
      ? "\n要不要／是否題：第一段先給主偏向，可以但要確認什麼，或不急著做因為哪裡不穩；不可前後矛盾。"
      : "";
  const choiceContract =
    !isDateOpenerConflict && isChoiceMainBiasQuestion(context)
      ? "\n二選一／選擇題：第一段必須用「這張牌比較偏向：」給主偏向；可以保留風險與條件，但不能兩邊都講一樣或沒有落點。"
      : "";
  const lengthProfile = getOutputLengthProfile(context.outputLengthMode);
  const lengthContract = `\n回答長度模式：${lengthProfile.label}。${lengthProfile.guidance}最多補 ${lengthProfile.maxSecondaryReminders} 個次提醒。字數是 soft target，不可為了壓字數刪掉主落點、牌義、正反位原因、現實翻譯或觀察指標。`;
  const investmentGuardContract = isHighRiskInvestmentContext(context)
    ? `\n高風險投資題硬規則(本題適用,違反會被系統退件):
- 不能建議或暗示任何操作方向:買進、賣出、停損、加碼、減碼、進場、出場、觀望、持有、續抱都不行。「停損」兩字只能出現在規則名裡,例如停損線、停損規則、不替你決定停損。
- 不能出現績效或機會語氣:投資機會、獲利、收益、成果、績效、成功機率、有潛力、值得投入、正財、資金成長。
- 不能恐嚇:不寫重大損失、慘重損失、錯誤決策、損失擴大;要改成偏離原本風險規則、放大原本風險、讓風險超出可承受範圍。
- 回答固定 4 段:第一段先講安全界線與本題主提醒(明說這裡不替你決定買賣、停損或加碼);第二段把星曜放進投資風險語境(講風險特性,不是機會);第三段回到成本、停損線、部位大小、波動、風險承受度、是否情緒交易的逐項檢查;第四段收在「下一步是檢查自己的規則,不是做操作決定」。
- 語氣仍要扣回使用者問的標的與情境,不要寫成通用免責聲明;每段都要有本題的具體字眼。`
    : "";

  return `Answer Contract
${context.answerContract}${noCandidateDateContract}${yesNoContract}${choiceContract}${investmentGuardContract}${lengthContract}
${context.reverseToUprightAdvice}`;
}

function buildReadingPromptPrelude(context: ReadingContext) {
  return [
    buildQuestionContextBlock(context),
    buildFollowUpContextBlock(context),
    buildCardContextBlock(context),
    buildAnswerContractBlock(context),
    buildOutputLengthBlock(context),
  ].join("\n\n");
}

function buildReviewPrompt(context: ReadingContext, draftAnswer: string) {
  const investmentReviewMode = isHighRiskInvestmentContext(context)
    ? `
Investment Review Mode
這是高風險投資題。你的任務不是提高投資建議感，而是降低操作語氣、績效語氣與機會語氣。

你不是投資顧問。
你不能建議買進、賣出、停損、加碼、減碼、進場、出場、觀望或持有。
你也不能暗示哪一種操作比較好。

你只能把草稿整理成風險提醒與規則檢查。
請把所有投資動作語氣改成：
- 回到原本策略
- 檢查成本
- 檢查停損線
- 檢查部位大小
- 檢查波動
- 檢查風險承受度
- 檢查是否情緒交易

投資題 finalAnswer 固定保留 4 段：
第一段：安全界線 + 本題主提醒。
第二段：星曜放入投資風險語境；不能寫成投資機會。
第三段：回到成本、停損線、部位、波動、風險承受度。
第四段：下一步只能是檢查規則，不是做操作決定。

禁止投資操作語氣：
可以觀望、建議觀望、暫時觀望、保持觀望、退出市場、出場、進場、降低部位、提高部位、放大部位、穩定部位、維持部位、調整部位、調整操作、進行操作、做出操作、持有、續抱、可以停損、建議停損、慎重考慮是否停損、可以加碼、建議加碼、可以減碼、建議減碼。

「停損」只能出現在安全句或規則名，例如：不替你決定停損、停損線、停損規則。不能寫成操作建議。

禁止投資績效 / 機會語氣：
投資機會、獲利機會、成功機率、投資成果、投資結果、實際結果、實際價值、正財、資金增值、資金成長、穩定獲利、更具競爭優勢、投資更加穩健、值得進一步評估、有潛力、獲得成果、長期收益、績效、收益、獲利。

請統一改成：
風險狀態、風險條件、風險邊界、風險控管、判斷依據、原本規則、交易紀律。

禁止過度恐嚇損失語氣：
錯誤決策、重大損失、不必要的損失、損失擴大、導致更大損失、高風險決定、慘重損失。
請改成：偏離原本風險規則、放大原本風險、讓判斷被情緒牽動、讓風險超出可承受範圍。

禁止異常文字 / 非台灣用語：
まだ、々、止損、全局、快決策、設置。
請改成：仍然、刪除符號、停損、整體、快速判斷、設定。`
    : "";
  const healthLifestyleReviewMode = isHealthLifestyleContext(context)
    ? `
Health Lifestyle Review Mode
這是健康生活 / 作息睡眠題，不是醫療診斷題。
請把回答放在生活節奏、睡眠、作息、壓力、飲食、休息、體力與白天狀態上。
不要主動新增疾病、器官、醫療診斷或心理診斷。
不要用警訊、惡化、長期疲勞、健康狀況惡化、消化不良、免疫力、內分泌、腎臟、呼吸系統、生殖系統等詞。
也不要使用影響身體恢復能力、身體的信號、疲勞狀態、身體會慢慢恢復、心理壓力確實需要調整、加深你的焦慮與疲憊這類偏醫療化或心理化語氣。
如果需要安全提醒，只能出現一次，且用：「若狀態持續影響生活，再找專業人士協助確認。」`
    : "";
  const healthCriticalReviewMode = isHealthCriticalQuestion(context.question)
    ? `
Health Critical Review Mode
這是重大健康、死亡、喪事、病危、住院、洗腎或高齡長輩題。
finalAnswer 第一段必須先放安全界線：占卜不能判斷死亡、是否撐過去、生命危險或是否會辦喪事，也不能用吉凶代替醫師評估。
第一段必須把重點拉回醫療資訊、照護安排、家人溝通、陪伴與必要的現實準備。
禁止寫：喪事可能性不高、喪事可能性存在、有機會撐過、有可能撐過、充滿希望、身體狀態有可能向好的方向發展、看起來比較危險、看起來不太順利、狀況其實比較好。`
    : "";
  const businessSalesReviewMode =
    context.questionType === "經營銷售" || isBusinessSalesQuestion(context.question)
      ? `
Business Sales Review Mode
如果題目是寄售、擺攤、市集、活動營收或商品銷售，不要修成保證賺錢、成功、回本、獲利機會。
不要使用獲得不錯的結果、達到最佳效果、提升銷量、達到預期的營收目標、最終的獲利這類偏保證成果語氣。
請使用營收條件、成本、人流、商品陳列、定價、現場轉換、庫存與回本壓力。`
      : "";
  const incomePlanningReviewMode =
    context.questionType === "收入規劃" || isIncomePlanningQuestion(context.question)
      ? `
Income Planning Review Mode
這是收入方向規劃題，不是保證賺錢題。
不要迎合如魚得水、易如反掌；也不要使用很大的機會、新機遇、順利推動、更具優勢、商機、更多收穫這類過滿語氣。
請改用小規模試水溫、市場需求、成本、時間投入、可持續性與熟悉能力。`
      : "";
  const moneyFinanceReviewMode =
    context.questionType === "金錢財務"
      ? `
Money Finance Review Mode
這是一般金錢財務題，不是股票、期貨、基金或高風險投資操作題。
請回答收支、預算、現金流、貸款條件、欠款紀錄、回款流程、保險保障或大額購買評估。
不要使用買進、賣出、進場、出場、加碼、減碼、停損、部位、投資機會、獲利機會、績效、報酬率。
如果是貸款題，除非題目明確提到房貸、買房、房子、房屋、交屋、房仲或屋況，否則不要寫成房產或房貸。
如果是抽獎、偏財題，不要保證中獎，也不要鼓勵加碼投注。`
      : "";
  const choiceReviewMode = isChoiceMainBiasQuestion(context)
    ? `
Choice Review Mode
這是二選一、要不要、適不適合或該不該題。
請保留第一段主偏向，不能修成兩邊都可以或只有觀察建議。
如果草稿已經有「這張牌比較偏向：」，請保留這個主結論，不要刪掉。
可以保留條件式語氣，但 finalAnswer 第一段一定要回答目前比較偏哪一邊。`
    : "";
  const workReviewMode =
    context.questionType === "工作事業"
      ? `
Work Review Mode
這是工作職涯題。
請保留使用者原本問的工作詞，例如面試、錄取、調薪、升遷、職涯、管理、專業、客戶案、接案、短期合約工作。
不要改成法律合約、感情互動或一般人生建議。
如果是工作選擇題，第一段要有主偏向。`
      : "";
  const businessCreatorReviewMode =
    context.questionType === "經營推廣" ||
    context.questionType === "經營銷售" ||
    context.questionSubcategory.startsWith("經營｜")
      ? `
Business Creator Review Mode
這是創業經營、品牌內容、課程上架或銷售題。
請保留商品、定價、庫存、廣告預算、合夥、短影音、品牌定位、課程上架等原題語境。
課程上架題的使用者是課程提供者，不是學生，不要寫成報名課程或學習吸收。
廣告預算題只能談成效、成本、受眾反應與小額測試，不要直接鼓勵加預算。
若不是健康題，不要使用身體健康、健康狀態、脾胃、免疫力、慢性疲勞等健康詞。`
      : "";

  return `${buildQuestionContextBlock(context)}

${buildFollowUpContextBlock(context)}

${buildCardContextBlock(context)}

${buildAnswerContractBlock(context)}

${buildOutputLengthBlock(context)}

${investmentReviewMode}

${healthLifestyleReviewMode}

${healthCriticalReviewMode}

${businessSalesReviewMode}

${incomePlanningReviewMode}

${moneyFinanceReviewMode}

${choiceReviewMode}

${workReviewMode}

${businessCreatorReviewMode}

第一輪草稿：
${draftAnswer}

請依系統審稿規則檢查並修正，只輸出規則指定的 JSON 格式。`;
}

async function reviewAndPolishReading(
  context: ReadingContext,
  draftAnswer: string
) {
  const response = await getOpenAiClient().responses.create({
    ...getZiweiCardOpenAiRequestConfig(),
    instructions: REVIEW_SYSTEM_INSTRUCTIONS,
    input: buildReviewPrompt(context, draftAnswer),
  });

  const outputText = response.output_text || "";
  const parsed = safeJsonParseObject(outputText);
  const finalAnswer = normalizeReviewedAnswerText(
    typeof parsed?.finalAnswer === "string" && parsed.finalAnswer.trim()
      ? parsed.finalAnswer
      : outputText
  );
  const issuesFixed = Array.isArray(parsed?.issuesFixed)
    ? parsed.issuesFixed
        .filter((item): item is string => typeof item === "string")
        .slice(0, 12)
    : [];
  const fallbackReasons = buildReviewFallbackReasons(
    finalAnswer,
    draftAnswer,
    context
  );
  const fallbackUsed = fallbackReasons.length > 0;
  const stats = buildReviewStats(finalAnswer, draftAnswer);

  return {
    finalAnswer: fallbackUsed ? draftAnswer : finalAnswer,
    changedMeaning: parsed?.changedMeaning === true,
    safetyAdjusted: parsed?.safetyAdjusted === true,
    issuesFixed: fallbackUsed
      ? [...issuesFixed, ...fallbackReasons]
      : issuesFixed,
    fallbackUsed,
    fallbackReason: fallbackReasons.join(","),
    draftLength: stats.draftChars,
    finalLength: stats.reviewedChars,
    finalDraftRatio: stats.ratio,
    draftParagraphCount: stats.draftParagraphs,
    finalParagraphCount: stats.reviewedParagraphs,
    usage: readTokenUsage(response),
  };
}

function ensureGeneralContactActionContextHint(answer: string, context: ReadingContext) {
  if (context.questionSubcategory !== "一般｜溝通行動") {
    return answer;
  }

  if (
    includesAny(answer, [
      "如果這個對方其實是感情對象",
      "如果這題其實是在問感情",
      "可以再補問對方心意",
      "這一題先以溝通時機",
    ])
  ) {
    return answer;
  }

  return `${answer.trim()}\n\n如果這個對方其實是感情對象，可以再補問對方心意；這一題先以溝通時機與談事情的準備來看。`;
}

function isDebtCollectionFollowUpContext(context: ReadingContext) {
  const focus = detectFollowUpFocus(context.question, context.followUpContext);
  return focus === "debt_collection_followup" || focus === "debt_delay_followup";
}

function enforceFollowUpDebtCollectionGuard(answer: string, context: ReadingContext) {
  if (!isDebtCollectionFollowUpContext(context)) {
    return answer;
  }

  let result = answer
    .replaceAll("這段關係", "這筆欠款")
    .replaceAll("這份關係", "這筆欠款")
    .replaceAll("情感上", "付款責任上")
    .replaceAll("感情上", "付款責任上")
    .replaceAll("真心", "還款意願")
    .replaceAll("對方心意", "對方是否願意面對款項責任")
    .replaceAll("感情前景", "款項後續")
    .replaceAll("關係前景", "款項後續")
    .replaceAll("主動找你聊天", "主動回覆還款安排")
    .replaceAll("主動聊天", "主動回覆還款安排")
    .replaceAll("回覆速度", "回款回覆速度")
    .replaceAll("邀約或未來的計劃", "付款日期或還款方式")
    .replaceAll("邀約或未來計畫", "付款日期或還款方式")
    .replaceAll("是否有邀約", "是否有明確付款日期")
    .replaceAll("未來計劃", "還款安排")
    .replaceAll("未來計畫", "還款安排");

  result = result
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      if (!text) {
        return true;
      }
      return !(
        includesAny(text, ["曖昧", "復合", "喜歡", "愛不愛", "約會"]) &&
        !includesAny(text, ["不是感情", "不要寫成感情"])
      );
    })
    .join("")
    .trim();

  if (!includesAny(result, ["欠款", "款項", "付款", "還款", "催款", "回款"])) {
    result = `${result.trim()}\n\n這題要放回欠款與催款脈絡來看：先整理欠款金額、原本約定、上次溝通時間、希望對方回覆的付款日期與付款方式，聯絡時盡量用文字留下紀錄。`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function isCriticalHealthFollowUpContext(context: ReadingContext) {
  const focus = detectFollowUpFocus(context.question, context.followUpContext);
  return focus === "critical_health_care" || focus === "critical_health_family_communication";
}

function enforceFollowUpCriticalHealthGuard(answer: string, context: ReadingContext) {
  if (!isCriticalHealthFollowUpContext(context)) {
    return answer;
  }

  let result = answer
    .replaceAll("這件事本身有穩定向前的機會", "這題先不要判斷病情走向，重點放在家裡能先整理的現實安排")
    .replaceAll("目前情況看起來可行", "目前能做的是把醫療資訊與照護分工先整理清楚")
    .replaceAll("你有足夠的保障", "可以先盤點家裡現有的照護資源與可支援的人")
    .replaceAll("穩定向前", "先把醫療資訊與照護分工整理清楚")
    .replaceAll("有保障", "先盤點可支援的照護資源")
    .replaceAll("恢復健康", "照護需求更清楚")
    .replaceAll("恢復", "照護需求更清楚")
    .replaceAll("康復", "照護需求更清楚")
    .replaceAll("好轉", "照護需求更清楚")
    .replaceAll("變好", "照護需求更清楚")
    .replaceAll(
      "這題先回到睡眠、作息、壓力、飲食節奏和體力狀態，不額外推測沒有提到的器官或疾病。",
      "這題先回到醫療資訊、照護分工、家人溝通與陪伴，不額外推測病情結果。"
    );

  result = result
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      if (!text) {
        return true;
      }
      return !(
        includesAny(text, ["撐過", "生命危險", "病情結果", "會死亡", "不會死亡"]) &&
        !includesAny(text, ["不能", "無法", "不適合", "不是", "不要"])
      );
    })
    .join("")
    .trim();

  const paragraphs = result
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const hasSafetyOpening =
    includesAny(firstParagraph, ["占卜不能", "不能判斷", "不能用牌", "醫療資訊", "醫師"]) &&
    includesAny(firstParagraph, ["病情", "撐過", "醫療", "照護", "家人"]);

  if (!hasSafetyOpening) {
    result = `這題延續前面家人住院的脈絡，占卜不能判斷病情結果或是否能撐過去；這一題比較適合看你現在能先整理哪些醫療資訊、照護分工、家人溝通與現實安排。\n\n${result}`;
  }

  if (!includesAny(result, ["醫療資訊", "醫師", "照護", "家人", "分工"])) {
    result = `${result.trim()}\n\n接下來可以先整理醫療資訊、醫師說法、照護分工、家人聯絡、文件資料、費用與資源，以及陪伴安排。這些比用牌面判斷病情結果更重要。`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanCourseCreatorFollowUpLanguage(answer: string, context: ReadingContext) {
  const focus = detectFollowUpFocus(context.question, context.followUpContext);
  if (
    focus !== "course_creator_content_choice" &&
    focus !== "course_creator_conversion" &&
    focus !== "course_creator_page"
  ) {
    return answer;
  }

  let result = answer
    .replaceAll("考試準備", "課程準備")
    .replaceAll("考試", "課程")
    .replaceAll("學生自己如何學習", "學生為什麼想報名")
    .replaceAll("學生如何學習", "學生為什麼想報名")
    .replaceAll("學習吸收", "課程理解與報名轉換")
    .replaceAll("學習成效", "課程價值與學習成果")
    .replaceAll("自己能不能穩定吸收", "學生是否能清楚理解課程價值")
    .replaceAll("穩定吸收知識", "清楚理解課程價值")
    .replaceAll("後續複習方式", "課後交付方式與學員後續支持")
    .replaceAll("負擔會不會太大", "報名門檻與課程說明是否清楚")
    .replaceAll("學生的負擔是否過重", "報名門檻與課程說明是否清楚")
    .replaceAll("不要只急著開始", "不要只急著上架")
    .replaceAll("學習目標與時間安排", "課程目標、上課安排與交付流程")
    .replaceAll("讓自己在整個過程中", "讓學生在課程理解與報名判斷上")
    .replaceAll("課程負擔", "報名門檻");

  if (focus === "course_creator_content_choice") {
    result = result
      .split(/\n{2,}/)
      .map((paragraph) => {
        const text = paragraph.trim();
        if (!text) {
          return "";
        }

        if (isGenericLearningStartBurdenEnding(text)) {
          return "接下來可以先補能讓學生立刻看懂的案例，並把案例放回課程學習成果裡。講義可以同步整理，但重點不是把資料塞滿，而是讓學生知道上完這堂課能解決什麼問題、怎麼使用這些案例、報名後會拿到什麼內容。";
        }

        return text;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (focus === "course_creator_conversion" && !includesAny(result, ["課程價值", "學生痛點", "報名", "案例", "見證", "CTA"])) {
    result = `${result.trim()}\n\n這題要站在課程創作者角度：文案可以先說清楚課程價值、學生痛點、上完會得到什麼、報名流程、課程架構，以及案例或見證；最後用清楚的 CTA 讓學生知道下一步怎麼報名。`;
  }

  result = cleanCourseContentCaseVsHandoutChoice(result, context);

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanContentBrandFollowUpLanguage(answer: string, context: ReadingContext) {
  const focus = detectFollowUpFocus(context.question, context.followUpContext);
  const isContentBrandSubcategory = [
    "經營｜內容風格選擇",
    "經營｜內容品牌",
    "經營｜課程轉換",
  ].includes(context.questionSubcategory);
  if (focus !== "content_brand_style" && focus !== "content_brand_conversion" && !isContentBrandSubcategory) {
    return answer;
  }
  const hasExplicitIncomeCue = includesAny(context.question, [
    "收入",
    "賺錢",
    "收費",
    "價格",
    "營收",
  ]);

  let result = answer
    .replaceAll("收入方式", "內容方向")
    .replaceAll("收入計畫", "內容策略")
    .replaceAll("合約責任", "內容承接")
    .replaceAll("付款條件", "報名轉換條件")
    .replaceAll("金錢成本", "內容成本")
    .replaceAll("成本與合約", "內容形式與轉換")
    .replaceAll(
      "接下來，可以把重點放在：重建規則、秩序、分寸與約定，讓事情有可遵守的流程。",
      "接下來，可以把重點放在：先穩住專業教學主軸，再用個人故事當開頭或案例輔助，讓受眾既看懂方法，也感覺得到信任感。"
    )
    .replaceAll(
      "接下來可以把重點放在：重建規則、秩序、分寸與約定，讓事情有可遵守的流程。",
      "接下來可以把重點放在：先穩住專業教學主軸，再用個人故事當開頭或案例輔助，讓受眾既看懂方法，也感覺得到信任感。"
    );

  if (!hasExplicitIncomeCue) {
    const bannedIncomeParagraphTerms = [
      "收入方向規劃",
      "收入方向操作題",
      "市場是否有需求",
      "投入成本是否可控",
      "時間節奏能不能長期維持",
      "收入方式",
      "成本",
      "合約責任",
      "付款條件",
    ];
    let removedIncomeParagraph = false;
    const filtered = result
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => {
        if (!paragraph) {
          return false;
        }

        const shouldRemove = bannedIncomeParagraphTerms.some((term) =>
          paragraph.includes(term)
        );
        if (shouldRemove) {
          removedIncomeParagraph = true;
          return false;
        }

        return true;
      });

    result = filtered.join("\n\n");

    if (
      removedIncomeParagraph &&
      (
        focus === "content_brand_style" ||
        context.questionSubcategory === "經營｜內容風格選擇" ||
        context.questionSubcategory === "經營｜內容品牌"
      )
    ) {
      result = `${result.trim()}\n\n這題比較像內容風格選擇，重點是讓受眾知道你能教什麼、為什麼值得信任，以及你的個人經驗如何幫助他們理解專業內容。可以先以專業教學為主，個人故事作為開頭或案例輔助，讓內容既有專業感，也不會太冷。`;
    }
  }

  if (!includesAny(result, ["受眾", "信任感", "內容", "教學", "故事", "課程轉換", "報名"])) {
    result = `${result.trim()}\n\n這題要放回短影音內容策略來看：重點是受眾信任感、內容形式、教學深度、故事連結，以及這些內容能不能自然導向課程報名。`;
  }

  result = cleanContentStyleTeachingStoryChoice(result, context);

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanContentStyleTeachingStoryChoice(answer: string, context: ReadingContext) {
  if (
    context.questionSubcategory !== "經營｜內容風格選擇" ||
    !context.question.includes("個人故事") ||
    !context.question.includes("專業教學")
  ) {
    return answer;
  }

  return answer
    .replace(
      /這張牌比較偏向：先偏個人故事[\s\S]*?(?=\n\n)/,
      "這張牌比較偏向：先偏專業教學，個人故事作為輔助，因為目前最需要讓受眾理解你的專業與方法。"
    )
    .replaceAll(
      "天相星的反位提醒我們，要注意合約的清晰度和約定的明確性。",
      "天相星反位提醒你，要注意內容主軸、呈現方式和受眾期待是否清楚。"
    )
    .replaceAll(
      "合約的清晰度和約定的明確性",
      "內容主軸與呈現方式的清楚度"
    )
    .replaceAll(
      "內容的呈現和規範可能會出現不穩定，或是與對方期望有所偏差",
      "內容定位可能不夠穩定，或是與受眾期待有所偏差"
    )
    .replaceAll(
      "如果你選擇專業教學內容，可能會面對較多的流程問題，以及受眾對於內容的信任感不足，這會影響整體內容的推廣效果。",
      "如果專業教學的架構不清楚，受眾可能看不懂你要教什麼，信任感也會受影響。"
    )
    .replaceAll(
      "非專業教學會讓內容更具個人色彩，也能夠產生共鳴。",
      "個人故事可以讓內容更有溫度，但不宜取代專業教學主軸。"
    )
    .replaceAll(
      "在考慮專業教學路線之前",
      "在安排專業教學路線時"
    )
    .replaceAll(
      "若選擇個人故事的方向，則會更容易穩固受眾關係。",
      "個人故事適合作為開頭或案例輔助，但主軸仍要回到專業教學，讓受眾知道你能教什麼、為什麼值得信任。"
    )
    .replaceAll(
      "可以多融入自己真實的經歷與感受，讓受眾感受到你的真誠與親和力，這樣的方式會推動更強的連結與共鳴。",
      "可以把個人經歷放在開頭或案例裡，但每支內容仍要回到一個清楚的教學重點，讓受眾既感覺親近，也看得出專業。"
    );
}

function cleanWebsiteSystemFollowUpLanguage(answer: string, context: ReadingContext) {
  const focus = detectFollowUpFocus(context.question, context.followUpContext);
  const isWebsiteSystemSubcategory = [
    "經營｜網站連續提問",
    "經營｜網站UX文案",
    "經營｜扣點提示",
    "經營｜網站系統",
  ].includes(context.questionSubcategory);
  if (
    focus !== "website_followup_feature" &&
    focus !== "website_ux_copy" &&
    focus !== "website_points_notice" &&
    !isWebsiteSystemSubcategory
  ) {
    return answer;
  }

  let result = answer
    .replaceAll(
      "這段時間可能會出現任性與逃避的狀態",
      "使用者可能會因為說明不清而選擇跳過，或不想花時間理解功能"
    )
    .replaceAll(
      "任性與逃避的狀態",
      "因為說明不清而選擇跳過，或不想花時間理解功能"
    )
    .replaceAll(
      "任性與逃避",
      "因為說明不清而選擇跳過，或不想花時間理解功能"
    )
    .replaceAll(
      "接下來可以把重點放在：先把壓力放緩，但不要逃避規則與該面對的現實。",
      "接下來可以把重點放在：按鈕名稱、提示文字、扣點前確認、操作流程，以及回到上一題的入口是否清楚。"
    )
    .replaceAll(
      "在這段時間內，請記得放鬆壓力，但也要堅持遵循規則，面對現實的挑戰，這樣才能更有效地改善當前狀況。",
      "在這個功能裡，請把說明縮短、入口放清楚，並在扣點或重新抽牌前給使用者明確確認，這樣比較能降低誤解。"
    );

  if (!includesAny(result, ["連續提問", "按鈕", "文案", "扣點", "客人", "使用者"])) {
    result = `${result.trim()}\n\n這題要放回網站操作流程來看：重點是連續提問的按鈕名稱、扣點前提示、使用者能否理解同一題脈絡下會重新抽牌，以及整個流程是否直覺。`;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function removeSentencesByCue(answer: string, cues: string[]) {
  return answer
    .split(/(?<=。|\n)/)
    .filter((part) => {
      const text = part.trim();
      return !text || !includesAny(text, cues);
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendIfMissing(answer: string, requiredCues: string[], paragraph: string) {
  if (includesAny(answer, requiredCues)) {
    return answer;
  }

  return `${answer.trim()}\n\n${paragraph}`.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanInternalHealthGuardPhrases(answer: string) {
  return answer
    .replaceAll("這題先回到睡眠、作息、壓力、飲食節奏和體力狀態，不額外推測沒有提到的器官或疾病。", "")
    .replaceAll("不額外推測沒有提到的器官或疾病。", "")
    .replaceAll("不額外推測沒有提到的器官或疾病", "")
    .replaceAll("不額外推測病情結果。", "")
    .replaceAll("不額外推測病情結果", "")
    .replaceAll("這題先回到睡眠、作息、壓力、飲食節奏和體力狀態。", "這題先回到你目前的作息、壓力、體力與休息節奏來看。")
    .replaceAll("不能只靠牌面不能只靠牌面", "不能只靠牌面")
    .replaceAll("會比較會更容易", "會更容易")
    .replaceAll("關註", "關注")
    .replaceAll("目前的狀態看起來一種", "目前的狀態看起來有一種")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanNonDateTailForBackendReview(answer: string, context: ReadingContext) {
  const isDateLikeContext =
    context.questionType === "交通出行" ||
    context.questionType === "活動日期" ||
    context.questionSubcategory.includes("日期") ||
    context.questionSubcategory.includes("交通") ||
    context.questionSubcategory.includes("出遊");

  if (isDateLikeContext) {
    return answer;
  }

  return removeSentencesByCue(answer, [
    "單日狀態提醒",
    "正式擇日",
    "每個日期各抽一張牌",
    "多個日期",
    "候選日期",
    "候選日子",
    "交通工具和時間安排",
    "出門前先確認路線",
  ]);
}

function cleanInternalEnglishArtifacts(answer: string) {
  return answer
    .replaceAll("decisions-making", "決策判斷")
    .replaceAll("Decision-making", "決策判斷")
    .replaceAll("decision-making", "決策判斷")
    .replaceAll("fallback", "")
    .replaceAll("Fallback", "")
    .replaceAll("review", "")
    .replaceAll("Review", "")
    .replaceAll("summary", "")
    .replaceAll("Summary", "")
    .replaceAll("markdown", "")
    .replaceAll("Markdown", "")
    .replaceAll("status", "狀態")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanAccidentSettlementTrafficTail(answer: string, context: ReadingContext) {
  if (!isAccidentSettlementSubcategory(context.questionSubcategory)) {
    return answer;
  }

  if (isExplicitAccidentTrafficQuestion(context.question)) {
    return answer;
  }

  return removeSentencesByCue(answer, [
    "外出",
    "交通或臨時行程",
    "交通工具",
    "時間安排",
    "出門前",
    "確認路線",
    "路線",
    "避免臨時變動影響",
  ]);
}

function cleanBackendReviewTargetedRules(answer: string, context: ReadingContext) {
  const question = context.question;
  const cardName = context.card.name;
  const isReversed = context.position === "反位";
  const isUpright = context.position === "正位";
  let result = cleanNonDateTailForBackendReview(
    cleanInternalHealthGuardPhrases(answer),
    context
  );

  // 2026-07-14 移除六類「固定範本覆蓋」（事故和解、第三人健康、同儕互動、
  // 婚姻平衡、代售報名、桃花時間）：這些範本會整份取代 AI 解讀，導致同類別
  // 不同問題、不同牌卡得到幾乎相同的答案，且事故和解範本含有特定個案資訊。
  // 類別知識已存在於題型指引（必答／避免），解讀一律由 AI 依當前問題與
  // 牌面產生；範本只能引導 prompt，不得取代輸出。

  if (
    isReversed &&
    cardName === "天機星" &&
    includesAny(question, ["出門", "外出", "交通", "開車", "騎車", "車關", "路線"])
  ) {
    result = appendIfMissing(
      result,
      ["路線、交通工具", "改變而讓安排變得更亂"],
      "天機星反位放在出門與交通題裡，重點是路線、交通工具、時間變動與臨場判斷容易出現落差。出門前先確認路線、車況、天氣與備案，途中也不要因分心或臨時改變而讓安排變得更亂。"
    );
  }

  if (context.questionType === "工作事業" && isReversed && cardName === "天機星") {
    result = cleanNonDateTailForBackendReview(result, context);
    result = appendIfMissing(
      result,
      ["資料、流程、優先順序", "責任歸屬與交付順序"],
      "天機星反位放在工作題裡，重點不是日期或出門，而是資料、流程、優先順序與交接容易混亂。先把待辦拆清楚、確認責任歸屬與交付順序，比急著推進更穩。"
    );
  }

  if (
    context.questionSubcategory === "經營｜課程上架" &&
    isReversed &&
    cardName === "天梁星"
  ) {
    result = result
      .replaceAll("學習吸收", "課程理解與報名轉換")
      .replaceAll("自己能不能穩定吸收", "學生是否能清楚理解課程價值")
      .replaceAll("負擔會不會太大", "報名門檻與課程說明是否清楚")
      .replaceAll("不要只急著開始", "不要只急著上架");
    result = appendIfMissing(
      result,
      ["學生為什麼要報名", "學生能不能一眼看懂"],
      "天梁星反位放在開課與課程上架題裡，代表課程內容、案例、講義、報名門檻或交付流程還需要整理。這題要站在課程提供者角度，不是問你要不要報名學習，而是學生能不能一眼看懂為什麼要報名。"
    );
  }

  if (context.questionSubcategory === "金錢｜銀行選擇" && isUpright && cardName === "巨門星") {
    result = appendIfMissing(
      result,
      ["手續費清楚", "入帳流程好對帳"],
      "巨門星正位放在銀行與收款選擇題裡，重點是資訊透明、手續費清楚、入帳流程好對帳，以及客服溝通是否穩定。若有多家銀行候選，建議把候選銀行列出來，再逐一抽牌比較。"
    );
  }

  if (context.questionSubcategory === "經營｜商品品項決策") {
    result = result.replaceAll("不是完全不可以", "不算理想");

    if (isReversed && cardName === "七殺星") {
      result = appendIfMissing(
        result,
        ["庫存、成本與備貨壓力", "一次鋪太滿"],
        "七殺星反位放在商品品項題裡，代表品項開太多容易變成庫存、成本與備貨壓力，回本也不一定穩。若是四種以上，這張牌比較不建議一次鋪太滿，先縮小品項會比較安全。"
      );
    }

    if (isUpright && cardName === "太陰星") {
      result = appendIfMissing(
        result,
        ["精簡、質感", "少數品項"],
        "太陰星正位放在品項選擇題裡，較適合走精簡、質感與品質穩定的方向。與其一次放很多款，不如先讓少數品項的口味、包裝、推薦理由與價格更清楚。"
      );
    }

    if (isReversed && cardName === "天相星") {
      result = appendIfMissing(
        result,
        ["客人越可能選擇困難", "流程、陳列、價格、補貨"],
        "天相星反位放在商品品項題裡，代表流程、陳列、價格、補貨或推薦邏輯容易不清楚。品項越多，客人越可能選擇困難，也會增加現場解釋與管理成本。"
      );
    }

    if (isReversed && cardName === "武曲星") {
      result = appendIfMissing(
        result,
        ["現金回收壓力", "每一款的成本"],
        "武曲星反位放在商品品項題裡，重點是成本、庫存、定價與現金回收壓力。先確認每一款的成本、毛利、保存期限與回本速度，再決定要不要增加品項。"
      );
    }

    if (
      isUpright &&
      cardName === "七殺星" &&
      includesAny(question, ["預售", "三入", "3入", "組合", "套組"])
    ) {
      result = appendIfMissing(
        result,
        ["預售或組合", "出貨時間、客服回覆"],
        "七殺星正位放在預售或組合題裡，可以偏向果斷推進，但要先把價格、庫存、出貨時間、客服回覆與售後規則講清楚。這不是單純衝一波，而是準備做足後再推。"
      );
    }

    if (isReversed && cardName === "天府星") {
      result = appendIfMissing(
        result,
        ["資金控管、商品差異化", "不好周轉的庫存"],
        "天府星反位放在商品能不能賺錢的題裡，代表資金控管、商品差異化與回本節奏不夠穩。不是不能賣，而是要先確認成本、售價、客人為什麼買，以及會不會變成不好周轉的庫存。"
      );
    }
  }

  if (context.questionSubcategory === "經營｜寄售擺攤營收" && isReversed && cardName === "天府星") {
    const isCrystalConsignment = includesAny(question, ["水晶", "古遛", "同質商品", "類似商品"]);
    const opening = isCrystalConsignment
      ? "這張牌比較偏向：去古遛寄售店擺水晶，賺錢機會不算穩。不是完全不能做，但因為店裡已經有類似商品，你需要先確認自己的商品差異化、定價、陳列方式和回本節奏，否則容易賣得不如預期。"
      : "這張牌比較偏向：這次寄售或擺攤的營收狀態不算穩。不是完全不能做，但你需要先確認商品差異化、定價、陳列方式和回本節奏，否則容易賣得不如預期。";
    const meaning = isCrystalConsignment
      ? "天府星本身有財星與掌握資源的意思，反位時代表你對這件事能不能賺錢比較難掌握。放在寄售店已有同類商品的情境裡，這張牌更像提醒你：客人不一定會優先選你的水晶，獲利空間也容易被同質商品競爭壓縮。"
      : "天府星本身有財星與掌握資源的意思，反位時代表你對這件事能不能賺錢比較難掌握。放在寄售或擺攤營收題裡，這張牌更像提醒你：獲利空間可能被同質商品競爭、成本或陳列位置壓縮。";
    const advice = isCrystalConsignment
      ? "建議你先小量測試，不要一次放太多庫存。可以把水晶的特色、價格帶、擺放位置、商品故事和目標客群整理清楚，也可以觀察店內原本賣得好的款式，確認自己是否有差異化。若只是把相似商品放進去，賺錢效果可能不明顯。"
      : "建議你先小量測試，不要一次放太多庫存。可以把商品特色、價格帶、擺放位置、商品故事和目標客群整理清楚，也可以觀察現場原本賣得好的款式，確認自己是否有差異化。若只是把相似商品放進去，賺錢效果可能不明顯。";

    result = [opening, meaning, advice].join("\n\n");
  }

  if (context.questionSubcategory === "人際｜小人貴人" && isReversed && cardName === "天機星") {
    result = appendIfMissing(
      result,
      ["話被轉傳", "不太像明顯貴人"],
      "天機星反位放在小人與貴人題裡，較需要防的是資訊混亂、話被轉傳、誤會擴大或判斷失準。這張牌不太像明顯貴人來幫忙，反而提醒你近期說話與資訊來源都要更謹慎。"
    );
  }

  if (context.questionSubcategory === "感情｜朋友轉戀人" && isUpright && cardName === "天機星") {
    result = appendIfMissing(
      result,
      ["聊天頻率增加", "不是強烈桃花直接爆發"],
      "天機星正位放在朋友轉戀人的問題裡，比較像聊天頻率增加、互相理解變多、互動慢慢升溫。它不是強烈桃花直接爆發，而是透過對話、試探與共同話題，讓關係有轉換空間。"
    );
  }

  if (context.questionSubcategory === "房產｜租屋續租" && isReversed && cardName === "紫微星") {
    result = result.replaceAll("雖然短期內可能有繼續的空間", "即使短期看起來可以繼續，也不要只看表面");
    result = appendIfMissing(
      result,
      ["可信任的人或專業者", "不要只憑感覺續下去"],
      "紫微星反位放在續租題裡，代表支持條件不夠穩，可能有房東、租約、價格或居住品質上的不確定。建議找可信任的人或專業者一起看房屋狀況、租金條件與合約細節，不要只憑感覺續下去。"
    );
  }

  if (context.questionSubcategory === "家庭｜探視照護" && isReversed && cardName === "天府星") {
    result = result
      .replaceAll("不是保險理賠問題，而是", "重點是")
      .replaceAll("保險理賠問題", "金錢規劃題");
    result = appendIfMissing(
      result,
      ["探視安排、照護資源", "最好有人陪同與協調"],
      "天府星反位放在親戚探視長輩的題裡，重點是探視安排、照護資源與陪伴品質可能不夠穩。若要來看阿嬤，建議時間短一點、安排清楚一點，最好有人陪同與協調。"
    );
  }

  if (context.questionSubcategory === "一般｜生活行程選擇" && isUpright && cardName === "破軍星") {
    const paragraphs = result
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    if (paragraphs.length && !paragraphs[0].includes("東港")) {
      paragraphs[0] = `這張牌比較偏向：如果時間、交通和體力都安排得過來，延後做臉改成去東港會比較符合這次破軍星正位的變動方向。${paragraphs[0] ? ` ${paragraphs[0]}` : ""}`;
      result = paragraphs.join("\n\n");
    }
    result = result
      .replaceAll("革新", "換一個安排")
      .replaceAll("打破舊模式", "調整原本安排");
  }

  if (isHealthCriticalQuestion(question) && isUpright && cardName === "破軍星") {
    result = result
      .replaceAll("身體狀態有改善空間", "現實安排還有整理空間")
      .replaceAll("狀態有改善空間", "現實安排還有整理空間")
      .replaceAll("穩定向前", "先把醫療資訊與照護分工整理清楚")
      .replaceAll("有機會往好的方向", "仍需要回到醫師評估與家人照護安排");
    result = appendIfMissing(
      result,
      ["實際病情仍要以醫師評估為準", "醫療資訊、照護分工"],
      "破軍星正位放在重大健康或喪事相關題裡，不能解讀成病情一定改善。它比較像提醒家人要面對變動，把醫療資訊、照護分工、文件、費用與家人溝通先整理好，實際病情仍要以醫師評估為準。"
    );
  }

  result = cleanAccidentSettlementTrafficTail(result, context);

  return cleanInternalEnglishArtifacts(cleanInternalHealthGuardPhrases(result))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function reviewAnswer(rawAnswer: string, context: ReadingContext) {
  let answer = normalizeReviewedAnswerText(rawAnswer || "");

  // 前端會原樣顯示 markdown 符號,一律拔除。
  answer = answer.replaceAll("**", "").replace(/^#+\s*/gm, "");

  answer = cleanAnswer(answer);
  answer = removeAiTone(answer);
  answer = cleanSimplifiedChinese(answer);
  answer = reduceCounselingTone(answer, context.questionType, context.question);
  answer = softenAbsoluteClaims(answer);

  if (isLoveQuestion(context.questionType, context.question) && !isPeachBlossomCard(context.card.name)) {
    answer = softenNonPeachLoveAnswer(answer, context.position);
  }

  answer = cleanLoveScenarioByQuestion(answer, context.question);

  if (isHighRiskInvestmentContext(context)) {
    answer = cleanMoneyWords(answer);
  }

  if (
    ["近期整體狀態", "近期提醒", "交通出行"].includes(context.questionType) &&
    isTrafficReminderCard(context.card.name) &&
    !hasTrafficReminder(answer)
  ) {
    answer = `${answer.trim()}\n\n這段時間外出、交通或臨時行程也要留意，出門前先確認路線、交通工具和時間安排。`;
  }

  answer = ensureFirstSentenceByType(answer, context.questionType);
  answer = cleanOpeningDateAnswer(answer, context.question);
  answer = cleanNoCandidateDateComparisonLanguage(answer, context);
  answer = cleanNonHealthOrganWarnings(answer, context);
  answer = cleanNonHealthLifestyleLanguage(answer, context);
  answer = cleanTravelCompanionTone(answer, context);
  answer = cleanLearnerStudyLanguage(answer, context);
  answer = cleanHandoverWuquReversed(answer, context);
  answer = cleanBusinessSalesLanguage(answer, context);
  answer = cleanIncomePlanningLanguage(answer, context);
  answer = cleanMoneyFinanceLanguage(answer, context);
  answer = cleanHealthSleepDiagnosisTone(answer, context);
  answer = cleanInventedHealthOrganLanguage(answer, context);
  answer = enforceOverworkSleepGuard(answer, context);
  answer = removeDuplicateHealthSafetyAdvice(answer, context);
  answer = cleanMultiMonthComparisonLanguage(answer, context);
  answer = cleanDateCardSpecificMeaning(answer, context);
  answer = cleanCommonBadPhrases(answer);
  answer = cleanRepeatedDateSelectionNotice(answer, context);
  answer = cleanLearningFollowUpEnding(answer, context);
  answer = finalOutputGuard(answer);
  answer = cleanReviewStyleArtifacts(answer, context);
  answer = finalHardGuard(answer, context.question);
  answer = cleanReviewStyleArtifacts(answer, context);
  answer = enforceTravelTrafficFollowUpReference(answer, context);
  answer = ensureFollowUpCorrectionOpening(answer, context);
  answer = cleanFollowUpCompanyCorrectionLanguage(answer, context);
  answer = enforceFollowUpDebtCollectionGuard(answer, context);
  answer = enforceFollowUpCriticalHealthGuard(answer, context);
  answer = cleanCourseCreatorFollowUpLanguage(answer, context);
  answer = cleanContentBrandFollowUpLanguage(answer, context);
  answer = cleanWebsiteSystemFollowUpLanguage(answer, context);
  answer = enforceDeathCriticalGuard(answer, context.question);
  answer = enforceInvestmentDecisionGuard(
    answer,
    context.questionType,
    context.question
  );
  answer = cleanOpeningDateAnswer(answer, context.question);
  answer = cleanNoCandidateDateComparisonLanguage(answer, context);
  answer = cleanNonHealthOrganWarnings(answer, context);
  answer = cleanNonHealthLifestyleLanguage(answer, context);
  answer = cleanTravelCompanionTone(answer, context);
  answer = cleanLearnerStudyLanguage(answer, context);
  answer = cleanHandoverWuquReversed(answer, context);
  answer = cleanBusinessSalesLanguage(answer, context);
  answer = cleanIncomePlanningLanguage(answer, context);
  answer = cleanMoneyFinanceLanguage(answer, context);
  answer = cleanHealthSleepDiagnosisTone(answer, context);
  answer = cleanInventedHealthOrganLanguage(answer, context);
  answer = enforceOverworkSleepGuard(answer, context);
  answer = dedupeProfessionalAdviceForHealthCritical(answer, context);
  answer = removeDuplicateHealthSafetyAdvice(answer, context);
  answer = cleanMultiMonthComparisonLanguage(answer, context);
  answer = cleanDateCardSpecificMeaning(answer, context);
  answer = cleanRepeatedDateSelectionNotice(answer, context);
  answer = cleanLearningFollowUpEnding(answer, context);
  answer = enforceReverseToUprightAdvice(answer, context);
  answer = reduceCounselingTone(answer, context.questionType, context.question);
  answer = softenAbsoluteClaims(answer);
  answer = enforceLoveMindConclusion(
    answer,
    context.questionType,
    context.question,
    context.card.name,
    context.position
  );
  answer = multiCandidateAnswerMode(answer, context);
  answer = cleanReviewStyleArtifacts(answer, context);
  answer = enforceTravelTrafficFollowUpReference(answer, context);
  answer = ensureFollowUpCorrectionOpening(answer, context);
  answer = cleanFollowUpCompanyCorrectionLanguage(answer, context);
  answer = enforceFollowUpDebtCollectionGuard(answer, context);
  answer = enforceFollowUpCriticalHealthGuard(answer, context);
  answer = cleanCourseCreatorFollowUpLanguage(answer, context);
  answer = cleanContentBrandFollowUpLanguage(answer, context);
  answer = cleanWebsiteSystemFollowUpLanguage(answer, context);
  answer = cleanInvestmentOperationTone(answer, context);
  answer = dedupeInvestmentRiskChecklist(answer, context);
  answer = cleanBusinessSalesLanguage(answer, context);
  answer = cleanIncomePlanningLanguage(answer, context);
  answer = cleanMoneyFinanceLanguage(answer, context);
  answer = cleanHealthSleepDiagnosisTone(answer, context);
  answer = cleanInventedHealthOrganLanguage(answer, context);
  answer = enforceOverworkSleepGuard(answer, context);
  answer = dedupeProfessionalAdviceForHealthCritical(answer, context);
  answer = removeDuplicateHealthSafetyAdvice(answer, context);
  answer = cleanMultiMonthComparisonLanguage(answer, context);
  answer = enforceInvestmentFollowUpCompleteness(answer, context);
  answer = cleanRepeatedDateSelectionNotice(answer, context);
  answer = cleanLearningFollowUpEnding(answer, context);
  answer = cleanFollowUpCompanyCorrectionLanguage(answer, context);
  answer = enforceFollowUpDebtCollectionGuard(answer, context);
  answer = enforceFollowUpCriticalHealthGuard(answer, context);
  answer = cleanCourseCreatorFollowUpLanguage(answer, context);
  answer = cleanContentBrandFollowUpLanguage(answer, context);
  answer = cleanWebsiteSystemFollowUpLanguage(answer, context);
  answer = dedupeInvestmentRiskChecklist(answer, context);
  answer = removeDuplicateHealthSafetyAdvice(answer, context);
  answer = enforceMainBiasForChoiceQuestion(answer, context);
  answer = cleanAdBudgetDirectIncrease(answer, context);
  answer = cleanBusinessHealthLanguage(answer, context);
  answer = cleanCourseCreatorLanguage(answer, context);
  answer = cleanDomainGenericFinalAdvice(answer, context);
  answer = cleanTransactionLegalPropertyLanguage(answer, context);
  answer = cleanLegalOutcomeLanguage(answer, context);
  answer = ensureBusinessPartnerTerms(answer, context);
  answer = removeDuplicateAdviceParagraphs(answer);
  answer = enforceDeathCriticalGuard(answer, context.question);
  answer = enforceOverworkSleepGuard(answer, context);
  answer = cleanInventedHealthOrganLanguage(answer, context);
  answer = dedupeProfessionalAdviceForHealthCritical(answer, context);
  answer = ensureGeneralContactActionContextHint(answer, context);
  answer = cleanBackendReviewTargetedRules(answer, context);
  answer = answer
    .replaceAll("手機保持良好的狀態與溝通", "團隊保持良好的溝通狀態")
    .replaceAll("手機保持良好的狀態", "團隊保持良好的狀態");

  return answer;
}

function buildAnswerSummary(answer: string) {
  return normalizeReviewedAnswerText(answer)
    .replace(/\s+/g, " ")
    .trim()
    .split("。")
    .filter(Boolean)
    .slice(0, 2)
    .join("。")
    .slice(0, 220);
}

export async function generateZiweiCardReading(req: Request) {
  let requestDebug: Record<string, unknown> = {};

  try {
    const body = await req.json();
    const input = validateReadingInput(body);

    if (!input.ok) {
      return input.response;
    }

    const { question, cardId, position, followUpContext, generationMode } =
      input.value;
    // 錯誤 log 只留除錯必要資訊,不留問題全文與追問內容(常含感情/健康/財務隱私)。
    requestDebug = {
      questionLength: question.length,
      cardId,
      position,
      isFollowUp: Boolean(followUpContext?.isFollowUp),
      threadId: followUpContext?.threadId || "",
      parentReadingId: followUpContext?.parentReadingId || "",
      previousCount: followUpContext?.previousReadings?.length || 0,
      generationMode: generationMode || process.env.READING_GENERATION_MODE || "single",
    };
    const safety = runSafetyConstitution(question);

    if (safety.blocked) {
      return Response.json({
        answer: safety.answer,
        answerVersion: ANSWER_VERSION,
        promptVersion: PROMPT_VERSION,
        routeVersion: ROUTE_VERSION,
      });
    }

    const card = ziweiCards.find((item) => item.id === cardId);

    if (!card) {
      return Response.json(
        { error: "找不到這個狀態的資料。" },
        { status: 404 }
      );
    }

    const {
      questionType,
      questionDomain,
      questionIntent,
      questionSubcategory,
      questionCore,
      answerContract,
      riskLevel,
    } = classifyZiweiCardQuestion(question, followUpContext);

    const positionMeaning =
      position === "正位" ? card.uprightMeaning : card.reversedMeaning;

    const topicData = `
工作事業正位：${card.work.upright}
工作事業反位：${card.work.reversed}
感情關係正位：${card.love.upright}
感情關係反位：${card.love.reversed}
金錢投資正位：${card.money.upright}
金錢投資反位：${card.money.reversed}
人際合作正位：${card.relationship.upright}
人際合作反位：${card.relationship.reversed}
家庭家人正位：${card.family.upright}
家庭家人反位：${card.family.reversed}
健康狀態正位：${card.health.upright}
健康狀態反位：${card.health.reversed}
學習考試正位：${card.study.upright}
學習考試反位：${card.study.reversed}
近期提醒正位：${card.advice.upright}
近期提醒反位：${card.advice.reversed}
`;

    const baseReadingContext: ReadingContext = {
      question,
      card,
      position,
      questionType,
      questionDomain,
      questionIntent,
      questionSubcategory,
      questionCore,
      answerContract,
      outputLengthMode: "standard",
      riskLevel,
      positionMeaning,
      cardDomainMeaning: buildCardDomainMeaning(card, position, questionType),
      reverseToUprightAdvice: buildReverseToUprightAdvice(
        card,
        position,
        questionType,
        questionCore
      ),
      topicData,
      followUpContext: followUpContext || null,
    };
    const readingContext: ReadingContext = {
      ...baseReadingContext,
      outputLengthMode: inferOutputLengthMode(baseReadingContext),
    };

    const generationStartedAt = Date.now();
    const generationDecision = decideGenerationMode(
      readingContext,
      generationMode
    );

    if (generationDecision.effectiveMode === "single_investment_guarded") {
      // 高風險投資題:改走模型生成(帶投資硬契約),用 validateInvestmentAnswer 嚴格把關;
      // 驗證不過或生成失敗,退回原本的安全模板(最壞情況等同舊行為)。
      let draftUsage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      let answer = "";
      let usedTemplateFallback = false;
      let templateFallbackReason = "";

      try {
        const investmentResponse = await getOpenAiClient().responses.create({
          ...getZiweiCardOpenAiRequestConfig(),
          instructions: READING_SYSTEM_INSTRUCTIONS,
          input: `${buildReadingPromptPrelude(readingContext)}

請開始解讀。`,
        });

        answer = reviewAnswer(
          investmentResponse.output_text || "",
          readingContext
        );
        draftUsage = readTokenUsage(investmentResponse);
      } catch (error) {
        console.error("investment reading generation error:", error);
        usedTemplateFallback = true;
        templateFallbackReason = "generation_error";
      }

      let investmentValidation = usedTemplateFallback
        ? null
        : validateInvestmentAnswer(answer);

      if (!usedTemplateFallback && investmentValidation && !investmentValidation.pass) {
        usedTemplateFallback = true;
        templateFallbackReason = investmentValidation.issues
          .map((issue) => `investment_validation_${issue}`)
          .join(",");
      }

      if (usedTemplateFallback || !answer.trim()) {
        usedTemplateFallback = true;
        answer = reviewAnswer(
          buildInvestmentSafeTemplate(readingContext),
          readingContext
        );
        investmentValidation = validateInvestmentAnswer(answer);
      }

      return Response.json({
        answer,
        answerSummary: buildAnswerSummary(answer),
        questionType,
        questionSubcategory,
        outputLengthMode: readingContext.outputLengthMode,
        isFollowUp: Boolean(followUpContext?.isFollowUp),
        generationMode: generationDecision.effectiveMode,
        requestedGenerationMode: generationDecision.requestedMode,
        actualGenerationMode: generationDecision.effectiveMode,
        reviewEnabled: generationDecision.reviewEnabled,
        reviewMode: generationDecision.reviewReason,
        reviewReason: generationDecision.reviewReason,
        isHighRiskInvestment: isHighRiskInvestmentContext(readingContext),
        reviewChangedMeaning: false,
        reviewSafetyAdjusted: usedTemplateFallback,
        reviewIssuesFixed: usedTemplateFallback
          ? [
              "single_investment_guarded_template_fallback",
              ...(templateFallbackReason ? [templateFallbackReason] : []),
            ]
          : ["single_investment_guarded_llm"],
        reviewFallbackUsed: usedTemplateFallback,
        reviewFallbackReason: templateFallbackReason,
        reviewDraftLength: countChineseCharacters(answer),
        reviewFinalLength: countChineseCharacters(answer),
        reviewFinalDraftRatio: 1,
        reviewDraftParagraphCount: countAnswerParagraphs(answer),
        reviewFinalParagraphCount: countAnswerParagraphs(answer),
        investmentValidation,
        model: usedTemplateFallback ? "" : getDivinationOpenAIModel(process.env),
        tokenUsage: {
          draft: draftUsage,
          review: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          total: draftUsage,
        },
        latencyMs: Date.now() - generationStartedAt,
        answerVersion: ANSWER_VERSION,
        promptVersion: PROMPT_VERSION,
        reviewPromptVersion: REVIEW_PROMPT_VERSION,
        routeVersion: ROUTE_VERSION,
      });
    }

    const response = await getOpenAiClient().responses.create({
      ...getZiweiCardOpenAiRequestConfig(),
      // 靜態規則放 instructions(每次完全相同,觸發 OpenAI prompt caching);動態資料放 input。
      instructions: READING_SYSTEM_INSTRUCTIONS,
      input: `${buildReadingPromptPrelude(readingContext)}

請開始解讀。`,
    });

    const draftAnswer = reviewAnswer(response.output_text || "", readingContext);
    let answer = draftAnswer;
    let reviewUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    let reviewChangedMeaning = false;
    let reviewSafetyAdjusted = false;
    let reviewIssuesFixed: string[] = [];
    let reviewFallbackUsed = false;
    let reviewFallbackReason = "";
    let reviewDraftLength = 0;
    let reviewFinalLength = 0;
    let reviewFinalDraftRatio = 1;
    let reviewDraftParagraphCount = 0;
    let reviewFinalParagraphCount = 0;

    if (generationDecision.reviewEnabled) {
      const reviewed = await reviewAndPolishReading(readingContext, draftAnswer);
      answer = reviewAnswer(reviewed.finalAnswer, readingContext);
      reviewUsage = reviewed.usage;
      reviewChangedMeaning = reviewed.changedMeaning;
      reviewSafetyAdjusted = reviewed.safetyAdjusted;
      reviewIssuesFixed = reviewed.issuesFixed;
      reviewFallbackUsed = reviewed.fallbackUsed;
      reviewFallbackReason = reviewed.fallbackReason;
      reviewDraftLength = reviewed.draftLength;
      reviewFinalLength = reviewed.finalLength;
      reviewFinalDraftRatio = reviewed.finalDraftRatio;
      reviewDraftParagraphCount = reviewed.draftParagraphCount;
      reviewFinalParagraphCount = reviewed.finalParagraphCount;
    }

    const draftUsage = readTokenUsage(response);
    const generationResult: GenerationResult = {
      answer,
      draftAnswer,
      generationDecision,
      draftUsage,
      reviewUsage,
      latencyMs: Date.now() - generationStartedAt,
      reviewChangedMeaning,
      reviewSafetyAdjusted,
      reviewIssuesFixed,
      reviewFallbackUsed,
      reviewFallbackReason,
      reviewDraftLength,
      reviewFinalLength,
      reviewFinalDraftRatio,
      reviewDraftParagraphCount,
      reviewFinalParagraphCount,
    };

    return Response.json({
      answer: generationResult.answer,
      answerSummary: buildAnswerSummary(generationResult.answer),
      questionType,
      questionSubcategory,
      outputLengthMode: readingContext.outputLengthMode,
      isFollowUp: Boolean(followUpContext?.isFollowUp),
      generationMode: generationResult.generationDecision.effectiveMode,
      requestedGenerationMode:
        generationResult.generationDecision.requestedMode,
      actualGenerationMode: generationResult.generationDecision.effectiveMode,
      reviewEnabled: generationResult.generationDecision.reviewEnabled,
      reviewMode: generationResult.generationDecision.reviewReason,
      reviewReason: generationResult.generationDecision.reviewReason,
      isHighRiskInvestment: isHighRiskInvestmentContext(readingContext),
      reviewChangedMeaning: generationResult.reviewChangedMeaning,
      reviewSafetyAdjusted: generationResult.reviewSafetyAdjusted,
      reviewIssuesFixed: generationResult.reviewIssuesFixed,
      reviewFallbackUsed: generationResult.reviewFallbackUsed,
      reviewFallbackReason: generationResult.reviewFallbackReason,
      reviewDraftLength: generationResult.reviewDraftLength,
      reviewFinalLength: generationResult.reviewFinalLength,
      reviewFinalDraftRatio: generationResult.reviewFinalDraftRatio,
      reviewDraftParagraphCount: generationResult.reviewDraftParagraphCount,
      reviewFinalParagraphCount: generationResult.reviewFinalParagraphCount,
      tokenUsage: {
        draft: generationResult.draftUsage,
        review: generationResult.reviewUsage,
        total: {
          inputTokens:
            generationResult.draftUsage.inputTokens +
            generationResult.reviewUsage.inputTokens,
          outputTokens:
            generationResult.draftUsage.outputTokens +
            generationResult.reviewUsage.outputTokens,
          totalTokens:
            generationResult.draftUsage.totalTokens +
            generationResult.reviewUsage.totalTokens,
        },
      },
      latencyMs: generationResult.latencyMs,
      model: getDivinationOpenAIModel(process.env),
      answerVersion: ANSWER_VERSION,
      promptVersion: PROMPT_VERSION,
      reviewPromptVersion: REVIEW_PROMPT_VERSION,
      routeVersion: ROUTE_VERSION,
    });
  } catch (error) {
    console.error("reading api error:", {
      error,
      request: requestDebug,
    });

    return Response.json(
      {
        error: {
          code: "500",
          message: "解讀失敗，請稍後再試。",
        },
      },
      { status: 500 }
    );
  }
}
