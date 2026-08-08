import {
  evaluateDivinationQuestion,
  type DivinationQuestionAdvisoryReason,
  type DivinationRecentQuestion,
} from "@/lib/divination/questionAdvisory"

type DecideDivinationQuestionSubmissionInput = {
  question: string
  proceedDespiteQuestionAdvisory?: boolean
  followUpContext?: unknown
  recentQuestions?: DivinationRecentQuestion[]
  now?: Date
}

type DivinationQuestionSubmissionDecision =
  | {
      action: "show_advisory"
      advisory: ReturnType<typeof evaluateDivinationQuestion>
    }
  | {
      action: "proceed"
      acknowledgedReasons: DivinationQuestionAdvisoryReason[]
    }

function recentQuestionsFromFollowUpContext(value: unknown): DivinationRecentQuestion[] {
  if (!value || typeof value !== "object") return []

  const previousReadings = (value as { previousReadings?: unknown }).previousReadings
  if (!Array.isArray(previousReadings)) return []

  return previousReadings
    .slice(-20)
    .map((reading): DivinationRecentQuestion | null => {
      if (!reading || typeof reading !== "object") return null

      const question = (reading as { question?: unknown }).question
      const createdAt = (reading as { createdAt?: unknown }).createdAt

      if (typeof question !== "string" || typeof createdAt !== "string") return null

      const normalizedQuestion = question.trim().slice(0, 500)
      const normalizedCreatedAt = createdAt.trim()
      if (!normalizedQuestion || !normalizedCreatedAt) return null

      return {
        question: normalizedQuestion,
        createdAt: normalizedCreatedAt,
      }
    })
    .filter((reading): reading is DivinationRecentQuestion => Boolean(reading))
}

export function decideDivinationQuestionSubmission({
  question,
  proceedDespiteQuestionAdvisory = false,
  followUpContext,
  recentQuestions = [],
  now = new Date(),
}: DecideDivinationQuestionSubmissionInput): DivinationQuestionSubmissionDecision {
  const advisory = evaluateDivinationQuestion({
    question,
    recentQuestions: [
      ...recentQuestions,
      ...recentQuestionsFromFollowUpContext(followUpContext),
    ],
    now,
  })

  if (advisory.needsConfirmation && !proceedDespiteQuestionAdvisory) {
    return {
      action: "show_advisory",
      advisory,
    }
  }

  return {
    action: "proceed",
    acknowledgedReasons: proceedDespiteQuestionAdvisory ? advisory.reasons : [],
  }
}
