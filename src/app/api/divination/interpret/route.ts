import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import {
  buildFollowUpSafetyCheckText,
  runPreOpenAISafetyCheck,
} from "@/lib/divination/legacyReadingEngine"
import { generateZiweiCardReading } from "@/lib/divination/ziweiCardReadingEngine"
import { DIVINATION_READING_PAYMENT_MESSAGE } from "@/lib/divination/pricing"
import {
  consumeLocalDivinationEntitlement,
  READING_COST_TWD,
  releaseLocalDivinationEntitlement,
  reserveLocalDivinationEntitlement,
} from "@/lib/divination/localEntitlement"
import {
  decideDivinationInterpretationStart,
  getDivinationReadingForInterpretation,
  markDivinationReadingCompleted,
  markDivinationReadingFailed,
  markDivinationReadingInterpreting,
  updateDivinationReadingDrawSelection,
} from "@/lib/supabase/divinationReadings"
import {
  defaultResumePersistedDivinationReadingDeps,
  resumePersistedDivinationReadingFromDb,
} from "./resume"
import type {
  DivinationCardSummary,
  DivinationDrawMode,
  DivinationInterpretRequest,
  DivinationInterpretResponse,
  DivinationInterpretation,
  DivinationMockPaymentGate,
  DivinationPosition,
} from "@/lib/divination/types"

type RequestBody = Partial<Record<keyof DivinationInterpretRequest, unknown>>

const drawModes = new Set<DivinationDrawMode>(["manual", "auto"])
const positions = new Set<DivinationPosition>(["upright", "reversed"])

export const maxDuration = 300

const openAiServiceUnavailableMessage = "AI 解讀服務暫時維護中，請稍後再試。"
const paidOpenAiServiceUnavailableMessage = "付款已完成，但 AI 解讀暫時無法產生，請聯繫客服。"

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function paymentRequiredResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "PAYMENT_REQUIRED",
      message: DIVINATION_READING_PAYMENT_MESSAGE,
      requiresPayment: true,
      amountTwd: READING_COST_TWD,
    },
    { status: 402 }
  )
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isPersistedDivinationReadingsEnabled() {
  return process.env.ENABLE_DIVINATION_DB_READINGS === "true"
}

function buildStructuredInterpretation(finalAnswer: string): DivinationInterpretation {
  const normalized = finalAnswer.trim().replace(/\r\n/g, "\n")
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const summary = normalized
    .replace(/\s+/g, " ")
    .split("。")
    .filter(Boolean)
    .slice(0, 2)
    .join("。")
    .slice(0, 220)

  return {
    finalAnswer: normalized,
    summary: summary || paragraphs[0] || normalized,
    cardMessage: paragraphs[1] || paragraphs[0] || normalized,
    situationAnalysis: paragraphs[0] || normalized,
    advice: paragraphs[2] || paragraphs.at(-1) || normalized,
    reminder: paragraphs[3] || "占卜是提醒，不是保證；重要決定仍要回到現實條件與專業判斷。",
  }
}

async function createOpenAiInterpretation(input: {
  question: string
  drawMode: DivinationDrawMode
  card: (typeof ziweiCards)[number]
  position: DivinationPosition
  followUpContext?: unknown
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      ok: false as const,
      status: 500,
      error: "OPENAI_API_KEY_MISSING",
      message: openAiServiceUnavailableMessage,
    }
  }

  let engineResponse: Response

  try {
    engineResponse = await generateZiweiCardReading(
      new Request("http://localhost/internal/divination-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input.question,
          cardId: input.card.id,
          position: input.position === "upright" ? "正位" : "反位",
          followUpContext: input.followUpContext,
        }),
      }),
    )
  } catch (error) {
    console.error("Ziwei-card divination engine failed:", error)
    return {
      ok: false as const,
      status: 502,
      error: "OPENAI_REQUEST_FAILED",
      message: "解讀產生失敗，請稍後再試。",
    }
  }

  const engineData = (await engineResponse.json()) as {
    answer?: unknown
    error?: unknown
  }
  const finalAnswer = typeof engineData.answer === "string" ? engineData.answer.trim() : ""

  if (!engineResponse.ok || !finalAnswer) {
    console.error("Ziwei-card divination engine returned an invalid response:", {
      status: engineResponse.status,
      error: typeof engineData.error === "string" ? engineData.error : "invalid_response",
    })
    return {
      ok: false as const,
      status: engineResponse.status >= 500 ? 502 : engineResponse.status,
      error: "OPENAI_RESPONSE_INVALID",
      message: "解讀格式異常，請稍後再試。",
    }
  }

  const interpretation = buildStructuredInterpretation(finalAnswer)

  return {
    ok: true as const,
    interpretation,
  }
}

async function interpretPersistedDivinationReading(input: {
  readingId: string
  question: string
  drawMode: DivinationDrawMode
  card: (typeof ziweiCards)[number]
  cardSummary: DivinationCardSummary
  position: DivinationPosition
  followUpContext?: unknown
}) {
  try {
    const drawUpdate = await updateDivinationReadingDrawSelection({
      readingId: input.readingId,
      cardId: input.card.id,
      cardName: input.card.name,
      position: input.position,
    })

    if (drawUpdate.result === "not_found") {
      return NextResponse.json(
        { ok: false, error: "DIVINATION_READING_NOT_FOUND", message: "找不到占卜紀錄。" },
        { status: 404 }
      )
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_DRAW_SELECTION_UPDATE_FAILED",
        message: "抽牌資料保存失敗，請稍後再試。",
      },
      { status: 500 }
    )
  }

  let reading

  try {
    reading = await getDivinationReadingForInterpretation(input.readingId)
  } catch {
    console.warn("Divination reading lookup failed")

    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_LOOKUP_FAILED",
        message: "占卜紀錄讀取失敗，請稍後再試。",
      },
      { status: 500 }
    )
  }

  const decision = decideDivinationInterpretationStart(reading)

  if (decision.result === "not_found") {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_NOT_FOUND",
        message: "找不到占卜紀錄。",
      },
      { status: 404 }
    )
  }

  if (decision.result === "payment_required") {
    return paymentRequiredResponse()
  }

  if (decision.result === "already_interpreting") {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_INTERPRETING",
        message: "這筆占卜正在產生解讀，請稍後再試。",
      },
      { status: 409 }
    )
  }

  if (decision.result === "already_completed") {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_ALREADY_COMPLETED",
        message: "這筆占卜已完成解讀。",
      },
      { status: 409 }
    )
  }

  if (decision.result === "invalid_state") {
    const error =
      decision.status === "failed"
        ? "DIVINATION_READING_FAILED"
        : decision.status === "canceled"
          ? "DIVINATION_READING_CANCELED"
          : "DIVINATION_READING_INVALID_STATE"

    return NextResponse.json(
      {
        ok: false,
        error,
        message: "這筆占卜目前不能產生解讀。",
      },
      { status: 409 }
    )
  }

  try {
    const interpretingResult = await markDivinationReadingInterpreting(input.readingId)

    if (interpretingResult.result === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          error: "DIVINATION_READING_NOT_FOUND",
          message: "找不到占卜紀錄。",
        },
        { status: 404 }
      )
    }
  } catch {
    console.warn("Divination reading interpreting update failed")

    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_UPDATE_FAILED",
        message: "占卜紀錄更新失敗，請稍後再試。",
      },
      { status: 500 }
    )
  }

  const openAiResult = await createOpenAiInterpretation({
    question: input.question,
    drawMode: input.drawMode,
    card: input.card,
    position: input.position,
    followUpContext: input.followUpContext,
  })

  if (!openAiResult.ok) {
    try {
      await markDivinationReadingFailed({
        readingId: input.readingId,
        errorMessage: openAiResult.error,
      })
    } catch {
      console.warn("Divination reading failed update failed:", {
        errorCode: openAiResult.error,
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: openAiResult.error,
        message: paidOpenAiServiceUnavailableMessage,
      },
      { status: openAiResult.status }
    )
  }

  try {
    const completedResult = await markDivinationReadingCompleted({
      readingId: input.readingId,
      interpretation: openAiResult.interpretation,
      resultSummary: openAiResult.interpretation.finalAnswer ?? openAiResult.interpretation.summary,
    })

    if (completedResult.result === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          error: "DIVINATION_READING_NOT_FOUND",
          message: "找不到占卜紀錄。",
        },
        { status: 404 }
      )
    }
  } catch {
    console.warn("Divination reading completed update failed")

    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_COMPLETE_FAILED",
        message: "占卜解讀保存失敗，請稍後再試。",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    interpretation: openAiResult.interpretation,
    card: input.cardSummary,
    position: input.position,
    drawMode: input.drawMode,
    paymentGate: {
      mode: "db_paid",
      status: "paid",
      amountTwd: READING_COST_TWD,
    },
  })
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
  const drawMode = body.drawMode
  const position = body.position
  const readingId = getTrimmedString(body.readingId)
  const localUserId = getTrimmedString(body.localUserId)
  const mockPaid = body.mockPaid === true
  const resumeFromDb = body.resumeFromDb === true
  const followUpContext = body.followUpContext

  if (isPersistedDivinationReadingsEnabled() && resumeFromDb) {
    if (!readingId) {
      return jsonError("缺少占卜紀錄。")
    }

    return resumePersistedDivinationReadingFromDb(
      {
        request,
        readingId,
        followUpContext,
      },
      {
        ...defaultResumePersistedDivinationReadingDeps,
        createInterpretation: createOpenAiInterpretation,
      },
    )
  }

  if (!question) {
    return jsonError("請先填寫占卜問題。")
  }

  if (!drawModes.has(drawMode as DivinationDrawMode)) {
    return jsonError("抽牌方式不正確。")
  }

  if (!cardId) {
    return jsonError("缺少牌卡資料。")
  }

  if (!positions.has(position as DivinationPosition)) {
    return jsonError("正反位資料不正確。")
  }

  if (!readingId) {
    return jsonError("缺少占卜紀錄。")
  }

  const selectedCard = ziweiCards.find((card) => card.id === cardId)

  if (!selectedCard) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_CARD",
        message: "找不到這張紫微牌卡。",
      },
      { status: 400 }
    )
  }

  const safeDrawMode = drawMode as DivinationDrawMode
  const safePosition = position as DivinationPosition
  const card = {
    id: selectedCard.id,
    name: selectedCard.name,
    image: selectedCard.image,
    reversedImage: selectedCard.reversedImage,
    huaqi: selectedCard.huaqi,
    element: selectedCard.element,
    core: selectedCard.core,
  } satisfies DivinationCardSummary
  const safetyCheckText = buildFollowUpSafetyCheckText(question, followUpContext)
  const safetyResult = runPreOpenAISafetyCheck(safetyCheckText)

  if (safetyResult.blocked) {
    return NextResponse.json({
      ok: true,
      interpretation: safetyResult.interpretation,
      card,
      position: safePosition,
      drawMode: safeDrawMode,
      safetyBlocked: true,
      safetyReason: safetyResult.reason,
    })
  }

  if (isPersistedDivinationReadingsEnabled()) {
    return interpretPersistedDivinationReading({
      readingId,
      question,
      drawMode: safeDrawMode,
      card: selectedCard,
      cardSummary: card,
      position: safePosition,
      followUpContext,
    })
  }

  const entitlementResult = reserveLocalDivinationEntitlement({
    readingId,
    localUserId,
    mockPaid,
  })

  if (!entitlementResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: entitlementResult.error,
        message: entitlementResult.message,
        requiresPayment: entitlementResult.requiresPayment,
        amountTwd: entitlementResult.amountTwd,
      },
      { status: 402 }
    )
  }

  const { entitlement } = entitlementResult

  if (entitlement.type !== "mock_paid") {
    return paymentRequiredResponse()
  }

  const openAiResult = await createOpenAiInterpretation({
    question,
    drawMode: safeDrawMode,
    card: selectedCard,
    position: safePosition,
    followUpContext,
  })

  if (!openAiResult.ok) {
    if (
      openAiResult.error === "OPENAI_API_KEY_MISSING" ||
      openAiResult.error === "OPENAI_REQUEST_FAILED" ||
      openAiResult.error === "OPENAI_RESPONSE_INVALID"
    ) {
      releaseLocalDivinationEntitlement(readingId)
    }

    return NextResponse.json(
      {
        ok: false,
        error: openAiResult.error,
        message: openAiResult.message,
      },
      { status: openAiResult.status }
    )
  }

  const paymentGate = {
    mode: "mock",
    paymentId: `mock_pay_${readingId}`,
    provider: "mock",
    status: entitlement.type,
    itemType: "ai_divination",
    itemName: "紫微牌卡 AI 深度解讀",
    amountTwd: entitlement.amountTwd,
    currency: "TWD",
    entitlementToken: entitlement.entitlementToken,
  } satisfies DivinationMockPaymentGate
  const response = {
    ok: true,
    interpretation: openAiResult.interpretation,
    card,
    position: safePosition,
    drawMode: safeDrawMode,
    paymentGate,
  } satisfies DivinationInterpretResponse

  consumeLocalDivinationEntitlement(readingId, entitlement.entitlementToken)

  return NextResponse.json(response)
}
