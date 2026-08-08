export type DivinationQuestionAdvisoryReason =
  | "precise_time"
  | "multiple_options"
  | "repeat_question"

export type DivinationRecentQuestion = {
  question: string
  createdAt: string
}

export type DivinationQuestionAdvisory = {
  needsConfirmation: boolean
  reasons: DivinationQuestionAdvisoryReason[]
  title: string
  message: string
  suggestions: string[]
}

type EvaluateDivinationQuestionInput = {
  question: string
  recentQuestions?: DivinationRecentQuestion[]
  now?: Date
}

const preciseTimeRequestPattern = /什麼時候|何時|多久|幾月|哪一天|哪天|幾號|哪一年|幾年/
const specificTimeRangePattern =
  /(?:\d{1,4}[年/-])?\d{1,2}月|[一二三四五六七八九十冬臘]+月|今天|明天|本週|這週|下週|這個月|本月|下個月|今年|明年|月底|年底|日前|之前|以後|\d+\s*(?:天|週|個月|年)內/
const monthCandidatePattern = /(?:\d{1,2}|[一二三四五六七八九十冬臘]+)月/g
const explicitOptionPattern = /哪個|哪一個|哪項|哪一項|何者|孰|還是/
const latinOptionPairPattern = /(?:^|\s|[：:，,、（(])A(?:\s|[：:，,、）)]|$)[\s\S]*(?:^|\s|[：:，,、（(])B(?:\s|[：:，,、）)]|$)/i
const completedChangePattern =
  /(?:昨天|前天|剛剛|剛才|後來|最近已經|這次已經|突然|重新|終於|已經)[^。！？!?]*(?:聯絡|回覆|告白|見面|約我|分手|復合|道歉|拒絕|錄取|離職|轉職|簽約|解約|搬家|合作|吵架|和好|出現|發生|改變)|(?:聯絡|回覆|告白|見面|約我|分手|復合|道歉|拒絕|錄取|離職|轉職|簽約|解約|搬家|合作|吵架|和好)[^。！？!?]*(?:了|過後|之後)|有(?:新的|新一波|進一步的?)(?:消息|變化|進展|互動|聯絡|邀約|條件)/

function normalizeQuestion(question: string) {
  return question
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"「」『』（）()【】\[\]]+/g, "")
    .trim()
}

function questionIntentKey(question: string) {
  const text = normalizeQuestion(question)

  if (/喜歡我|愛我|在乎我|對我有(?:沒有)?心|對我是否有心|心裡(?:還)?有我/.test(text)) {
    return "love_interest"
  }

  if (/主動(?:聯絡|找|傳訊息)|會不會(?:聯絡|找|回覆)|還會(?:聯絡|找|回覆)/.test(text)) {
    return "love_contact"
  }

  if (/適不適合(?:離職|換工作|轉職)|該不該(?:離職|換工作|轉職)|離職(?:換工作)?好不好/.test(text)) {
    return "work_change"
  }

  if (/適不適合(?:合夥|一起開店)|合夥(?:開店)?好不好|能不能(?:合夥|一起開店)/.test(text)) {
    return "business_partnership"
  }

  return text
    .replace(/有沒有|是否|會不會|能不能|適不適合|好不好|可以嗎|嗎|呢|請問/g, "")
    .replace(/他|她|對方/g, "對方")
}

function hasNewKeyChange(question: string) {
  return completedChangePattern.test(question)
}

function isRecent(createdAt: string, now: Date) {
  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return false

  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3)

  return createdDate >= cutoff && createdDate <= now
}

function isRepeatQuestion(
  question: string,
  recentQuestions: DivinationRecentQuestion[],
  now: Date,
) {
  if (hasNewKeyChange(question)) return false

  const currentIntent = questionIntentKey(question)
  if (!currentIntent) return false

  return recentQuestions.some((recent) => {
    if (!isRecent(recent.createdAt, now)) return false
    return questionIntentKey(recent.question) === currentIntent
  })
}

function hasMultipleMonthCandidates(question: string) {
  return new Set(question.match(monthCandidatePattern) ?? []).size >= 2
}

function asksForPreciseTime(question: string) {
  const asksOpenTime = preciseTimeRequestPattern.test(question)
  const suppliedSingleRange = specificTimeRangePattern.test(question)

  return (asksOpenTime && !suppliedSingleRange) || hasMultipleMonthCandidates(question)
}

function asksToRankMultipleOptions(question: string) {
  if (explicitOptionPattern.test(question) || latinOptionPairPattern.test(question)) {
    return true
  }

  return hasMultipleMonthCandidates(question) && /比較|容易|適合|好/.test(question)
}

function buildMessage(reasons: DivinationQuestionAdvisoryReason[]) {
  const paragraphs: string[] = []

  if (reasons.includes("precise_time") && reasons.includes("multiple_options")) {
    paragraphs.push(
      "目前這組牌卡無法直接判斷精確時間，也無法用一張牌替多個選項排序。請將每個日期或選項拆成獨立問題，再依序分別抽牌。",
    )
  } else if (reasons.includes("precise_time")) {
    paragraphs.push(
      "目前這組牌卡無法直接判斷精確時間。請改成一個明確日期範圍，例如：「我在八月底前能找到工作嗎？」",
    )
  } else if (reasons.includes("multiple_options")) {
    paragraphs.push(
      "目前這組牌卡無法用一張牌替多個選項排序。請把每個選項拆成獨立問題，再依序分別抽牌。",
    )
  }

  if (reasons.includes("repeat_question")) {
    paragraphs.push(
      "三個月內不建議重複詢問相同問題。事情沒有新的關鍵變化前，重複抽牌通常不會產生新的有效訊息，也可能讓判斷變得混亂。",
    )
  }

  if (paragraphs.length > 0) {
    paragraphs.push("目前尚未抽牌，也不會收取費用。你可以修改問題，或仍然繼續抽牌。")
  }

  return paragraphs.join("\n\n")
}

function buildSuggestions(reasons: DivinationQuestionAdvisoryReason[]) {
  const suggestions: string[] = []

  if (reasons.includes("precise_time")) {
    suggestions.push("改成一個明確日期範圍，例如：我在八月底前能找到工作嗎？")
  }

  if (reasons.includes("multiple_options")) {
    suggestions.push("把每個日期或選項拆成獨立問題，再分別抽牌。")
  }

  if (reasons.includes("repeat_question")) {
    suggestions.push("先參考上次解讀，或等事情出現新的關鍵變化後再詢問。")
  }

  return suggestions
}

export function evaluateDivinationQuestion({
  question,
  recentQuestions = [],
  now = new Date(),
}: EvaluateDivinationQuestionInput): DivinationQuestionAdvisory {
  const trimmedQuestion = question.trim()
  const reasons: DivinationQuestionAdvisoryReason[] = []

  if (asksForPreciseTime(trimmedQuestion)) {
    reasons.push("precise_time")
  }

  if (asksToRankMultipleOptions(trimmedQuestion)) {
    reasons.push("multiple_options")
  }

  if (isRepeatQuestion(trimmedQuestion, recentQuestions, now)) {
    reasons.push("repeat_question")
  }

  return {
    needsConfirmation: reasons.length > 0,
    reasons,
    title: reasons.includes("repeat_question")
      ? "三個月內不建議重複詢問相同問題"
      : reasons.length > 0
        ? "這個問題可能無法得到精確答案"
        : "",
    message: buildMessage(reasons),
    suggestions: buildSuggestions(reasons),
  }
}
