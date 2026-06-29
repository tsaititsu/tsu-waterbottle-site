import type {
  DivinationFollowUpContext,
  DivinationFollowUpDraft,
  DivinationPosition,
  DivinationPreviousReadingSummary,
} from "@/lib/divination/types"

export const DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY = "divination_follow_up_draft"
export const DIVINATION_FOLLOW_UP_MAX_PREVIOUS_READINGS = 3

const answerSummaryMaxLength = 300
const finalAnswerMaxLength = 360

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeText(value)

  if (normalized.length <= maxLength) return normalized

  return `${normalized.slice(0, maxLength).trim()}...`
}

function trimPreviousReadings(readings: DivinationPreviousReadingSummary[]) {
  if (readings.length <= DIVINATION_FOLLOW_UP_MAX_PREVIOUS_READINGS) return readings

  const root = readings[0]
  const recent = readings.slice(-2)

  return root ? [root, ...recent.filter((item) => item.readingId !== root.readingId)] : recent
}

export function createAnswerSummary(finalAnswer: string): string {
  return truncateText(finalAnswer, answerSummaryMaxLength)
}

export function buildDivinationFollowUpDraft(input: {
  readingId?: string
  question?: string
  cardId?: string
  cardName?: string
  position?: DivinationPosition
  finalAnswer?: string
  questionType?: string
  questionSubcategory?: string
  existingFollowUpContext?: DivinationFollowUpContext
}): DivinationFollowUpDraft | null {
  const readingId = input.readingId?.trim()
  const question = input.question?.trim()
  const finalAnswer = input.finalAnswer?.trim()

  if (!readingId || !question || !finalAnswer) return null

  const createdAt = new Date().toISOString()
  const currentReading: DivinationPreviousReadingSummary = {
    readingId,
    question,
    cardId: input.cardId,
    cardName: input.cardName,
    position: input.position,
    answerSummary: createAnswerSummary(finalAnswer),
    finalAnswer: truncateText(finalAnswer, finalAnswerMaxLength),
    questionType: input.questionType,
    questionSubcategory: input.questionSubcategory,
    createdAt,
  }
  const previousReadings = input.existingFollowUpContext?.previousReadings ?? []
  const threadId = input.existingFollowUpContext?.threadId || `thread-${readingId}`

  return {
    threadId,
    parentReadingId: readingId,
    previousReadings: trimPreviousReadings([...previousReadings, currentReading]),
    createdAt,
  }
}

export function saveDivinationFollowUpDraft(draft: DivinationFollowUpDraft): void {
  if (typeof window === "undefined") return

  window.sessionStorage.setItem(DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function loadDivinationFollowUpDraft(): DivinationFollowUpDraft | null {
  if (typeof window === "undefined") return null

  const rawDraft = window.sessionStorage.getItem(DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY)
  if (!rawDraft) return null

  try {
    return JSON.parse(rawDraft) as DivinationFollowUpDraft
  } catch {
    return null
  }
}

export function clearDivinationFollowUpDraft(): void {
  if (typeof window === "undefined") return

  window.sessionStorage.removeItem(DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY)
}
