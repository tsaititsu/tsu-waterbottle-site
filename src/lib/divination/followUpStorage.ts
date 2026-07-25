import type {
  DivinationFollowUpContext,
  DivinationFollowUpDraft,
  DivinationFollowUpDisplayThread,
  DivinationPosition,
  DivinationPreviousReadingSummary,
} from "@/lib/divination/types"

export const DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY = "divination_follow_up_draft"
export const DIVINATION_FOLLOW_UP_ACTIVE_THREAD_ID_STORAGE_KEY = "divination_follow_up_active_thread_id"
export const DIVINATION_FOLLOW_UP_MAX_PREVIOUS_READINGS = 3

const displayThreadMaxReadings = 5

const answerSummaryMaxLength = 300
let activeThreadId = ""
let currentDraft: DivinationFollowUpDraft | null = null
const displayThreads = new Map<string, DivinationFollowUpDisplayThread>()

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

function trimDisplayReadings(readings: DivinationFollowUpDisplayThread["readings"]) {
  return readings.slice(-displayThreadMaxReadings)
}

export function getDivinationFollowUpThreadStorageKey(threadId: string): string {
  return `divination_follow_up_thread:${threadId}`
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
    finalAnswer,
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

export function toDivinationFollowUpContext(
  draft: DivinationFollowUpDraft | null
): DivinationFollowUpContext | undefined {
  if (!draft?.threadId || !draft.parentReadingId || !Array.isArray(draft.previousReadings)) {
    return undefined
  }

  const previousReadings = trimPreviousReadings(
    draft.previousReadings.filter((reading) => reading.readingId && reading.question)
  )

  if (previousReadings.length === 0) return undefined

  return {
    isFollowUp: true,
    threadId: draft.threadId,
    parentReadingId: draft.parentReadingId,
    previousReadings,
  }
}

export function saveDivinationFollowUpDraft(draft: DivinationFollowUpDraft): void {
  currentDraft = structuredClone(draft)
}

export function saveDivinationFollowUpDisplayReading(input: {
  readingId?: string
  question?: string
  cardId?: string
  cardName?: string
  position?: DivinationPosition
  finalAnswer?: string
  answerSummary?: string
  existingFollowUpContext?: DivinationFollowUpContext
}): void {
  const readingId = input.readingId?.trim()
  const question = input.question?.trim()
  const finalAnswer = input.finalAnswer?.trim()

  if (!readingId || !question || !finalAnswer) return

  const threadId = input.existingFollowUpContext?.threadId || `thread-${readingId}`
  const existingThread = loadDivinationFollowUpDisplayThread(threadId)
  const createdAt = new Date().toISOString()
  const reading = {
    readingId,
    question,
    cardId: input.cardId,
    cardName: input.cardName,
    position: input.position,
    finalAnswer,
    answerSummary: input.answerSummary || createAnswerSummary(finalAnswer),
    createdAt,
  }
  const withoutDuplicate = (existingThread?.readings || []).filter((item) => item.readingId !== readingId)
  const thread: DivinationFollowUpDisplayThread = {
    threadId,
    readings: trimDisplayReadings([...withoutDuplicate, reading]),
    updatedAt: createdAt,
  }

  displayThreads.set(threadId, structuredClone(thread))
  activeThreadId = threadId
}

export function loadDivinationFollowUpDraft(): DivinationFollowUpDraft | null {
  return currentDraft ? structuredClone(currentDraft) : null
}

export function loadDivinationFollowUpDisplayThread(threadId?: string): DivinationFollowUpDisplayThread | null {
  const safeThreadId = threadId?.trim() || activeThreadId
  if (!safeThreadId) return null

  const thread = displayThreads.get(safeThreadId)
  return thread ? structuredClone(thread) : null
}

export function clearDivinationFollowUpDraft(): void {
  currentDraft = null
}

export function clearDivinationFollowUpDisplayThread(threadId?: string): void {
  const safeThreadId = threadId?.trim()
  if (safeThreadId) {
    displayThreads.delete(safeThreadId)
  } else {
    displayThreads.clear()
  }

  activeThreadId = ""
}

export function clearDivinationFollowUpMemory(): void {
  activeThreadId = ""
  currentDraft = null
  displayThreads.clear()
}
