import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import { decideDivinationQuestionSubmission } from "./handler"
import {
  buildFollowUpSafetyCheckText,
  runPreOpenAISafetyCheck,
} from "@/lib/divination/legacyReadingEngine"
import type {
  CreateDivinationReadingRequest,
  CreateDivinationReadingResponse,
  DivinationDrawMode,
  DivinationPosition,
  DivinationReadingPreview,
} from "@/lib/divination/types"
import { getUserIdFromRequest } from "@/lib/supabase/auth"
import {
  createPendingDivinationReading,
  listRecentDivinationQuestionsForUser,
} from "@/lib/supabase/divinationReadings"

type RequestBody = Partial<Record<keyof CreateDivinationReadingRequest, unknown>>

const drawModes = new Set<DivinationDrawMode>(["manual", "auto"])
const positions = new Set<DivinationPosition>(["upright", "reversed"])

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function createMockReadingId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `mock_${Date.now()}`
}

function shouldPersistDivinationReading() {
  return process.env.ENABLE_DIVINATION_DB_READINGS === "true"
}

function threeMonthsAgoIso(now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3)
  return cutoff.toISOString()
}

export async function POST(request: Request) {
  let body: RequestBody

  try {
    body = await request.json()
  } catch {
    return jsonError("請提供正確的 JSON 資料。")
  }

  const question = getTrimmedString(body.question)
  const cardId = getTrimmedString(body.cardId)
  const localUserId = getTrimmedString(body.localUserId)
  const drawMode = body.drawMode
  const position = body.position

  if (!question) {
    return jsonError("請先填寫占卜問題。")
  }

  if (!drawModes.has(drawMode as DivinationDrawMode)) {
    return jsonError("抽牌方式不正確。")
  }

  if (position && !positions.has(position as DivinationPosition)) {
    return jsonError("正反位資料不正確。")
  }

  const selectedCard = cardId ? ziweiCards.find((card) => card.id === cardId) : null

  if (cardId && !selectedCard) {
    return jsonError("找不到這張紫微牌卡。")
  }

  // 先判斷、再收費：付款單必須綁定這裡建立的紀錄，
  // 因此在建立紀錄前用「本次問題＋追問前文」做安全檢查（與 interpret 相同輸入），
  // 被攔下的問題不會產生紀錄，也就不會進入任何付款流程。
  const safetyCheckText = buildFollowUpSafetyCheckText(question, body.followUpContext)
  const safetyResult = runPreOpenAISafetyCheck(safetyCheckText)

  if (safetyResult.blocked) {
    return NextResponse.json({
      ok: true,
      safetyBlocked: true,
      safetyReason: safetyResult.reason,
      interpretation: safetyResult.interpretation,
    } satisfies CreateDivinationReadingResponse)
  }

  const initialQuestionDecision = decideDivinationQuestionSubmission({
    question,
    proceedDespiteQuestionAdvisory: body.proceedDespiteQuestionAdvisory === true,
    followUpContext: body.followUpContext,
  })

  if (initialQuestionDecision.action === "show_advisory") {
    return NextResponse.json({
      ok: true,
      questionAdvisory: initialQuestionDecision.advisory,
    } satisfies CreateDivinationReadingResponse)
  }

  let authenticatedUserId: string | null = null
  let recentQuestions: Awaited<ReturnType<typeof listRecentDivinationQuestionsForUser>> = []

  if (shouldPersistDivinationReading()) {
    try {
      authenticatedUserId = await getUserIdFromRequest(request)
    } catch {
      return jsonError("divination_reading_create_failed", 500)
    }

    if (authenticatedUserId) {
      try {
        recentQuestions = await listRecentDivinationQuestionsForUser(
          authenticatedUserId,
          threeMonthsAgoIso(),
        )
      } catch {
        // 重複題提醒是知情提醒，不應因唯讀歷史查詢暫時失敗而阻斷原有抽牌流程。
        recentQuestions = []
      }
    }
  }

  const questionDecision = decideDivinationQuestionSubmission({
    question,
    proceedDespiteQuestionAdvisory: body.proceedDespiteQuestionAdvisory === true,
    followUpContext: body.followUpContext,
    recentQuestions,
  })

  if (questionDecision.action === "show_advisory") {
    return NextResponse.json({
      ok: true,
      questionAdvisory: questionDecision.advisory,
    } satisfies CreateDivinationReadingResponse)
  }

  const questionAdvisoryAcknowledgedReasons = questionDecision.acknowledgedReasons

  const localReadingId = createMockReadingId()
  let readingId = localReadingId
  let persisted = false

  if (shouldPersistDivinationReading()) {
    try {
      const persistedReading = await createPendingDivinationReading({
        userId: authenticatedUserId,
        externalReadingId: localReadingId,
        question,
        drawMode: drawMode as DivinationDrawMode,
        cardId: selectedCard?.id ?? null,
        cardName: selectedCard?.name ?? null,
        position: positions.has(position as DivinationPosition) ? (position as DivinationPosition) : null,
        source: "ai_divination",
        rawPayload: {
          source: "ai_divination",
          flow: "readings_create",
          localReadingId,
          drawMode: drawMode as DivinationDrawMode,
          cardId: selectedCard?.id ?? null,
          position: positions.has(position as DivinationPosition) ? (position as DivinationPosition) : null,
          questionAdvisoryAcknowledgedReasons,
        },
      })

      readingId = persistedReading.id
      persisted = true
    } catch {
      return jsonError("divination_reading_create_failed", 500)
    }
  }

  const reading = {
    id: readingId,
    question,
    drawMode: drawMode as DivinationDrawMode,
    localUserId,
    cardId: selectedCard?.id ?? null,
    cardName: selectedCard?.name ?? null,
    position: positions.has(position as DivinationPosition) ? (position as DivinationPosition) : null,
    status: "waiting_draw",
    createdAt: new Date().toISOString(),
  } satisfies DivinationReadingPreview
  const response = {
    ok: true,
    reading,
    persisted,
    questionAdvisoryAcknowledgedReasons,
  } as CreateDivinationReadingResponse & { persisted: boolean }

  // Local development only. Gate is checked when the user starts interpretation.
  return NextResponse.json(response)
}
