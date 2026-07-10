import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import {
  buildLegacyDraftPrompt,
  buildLegacyReadingContext,
  buildLegacyReviewPrompt,
  buildLegacyStructuredInterpretation,
  buildFollowUpSafetyCheckText,
  parseLegacyReviewResult,
  reviewAnswer,
  runPreOpenAISafetyCheck,
} from "@/lib/divination/legacyReadingEngine"
import {
  consumeLocalDivinationEntitlement,
  READING_COST_TWD,
  releaseLocalDivinationEntitlement,
  reserveLocalDivinationEntitlement,
} from "@/lib/divination/localEntitlement"
import {
  decideDivinationInterpretationStart,
  getDivinationReadingForInterpretation,
  getDivinationReadingResumeContextForUser,
  markDivinationReadingCompleted,
  markDivinationReadingFailed,
  markDivinationReadingInterpreting,
  startDivinationReadingInterpretationIfPaid,
  updateDivinationReadingDrawSelection,
} from "@/lib/supabase/divinationReadings"
import { getUserIdFromRequest } from "@/lib/supabase/auth"
import { getDivinationOpenAIModel } from "@/lib/openai/divinationModel"
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

const openAiResponsesUrl = "https://api.openai.com/v1/responses"
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
      message: "本次 AI 占卜解讀需 NT$50。",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isValidInterpretation(value: unknown): value is DivinationInterpretation {
  if (!isRecord(value)) return false

  return (
    typeof value.summary === "string" &&
    value.summary.trim().length > 0 &&
    typeof value.cardMessage === "string" &&
    value.cardMessage.trim().length > 0 &&
    typeof value.situationAnalysis === "string" &&
    value.situationAnalysis.trim().length > 0 &&
    typeof value.advice === "string" &&
    value.advice.trim().length > 0 &&
    typeof value.reminder === "string" &&
    value.reminder.trim().length > 0
  )
}

function normalizeInterpretation(value: DivinationInterpretation): DivinationInterpretation {
  return {
    summary: value.summary.trim(),
    cardMessage: value.cardMessage.trim(),
    situationAnalysis: value.situationAnalysis.trim(),
    advice: value.advice.trim(),
    reminder: value.reminder.trim(),
  }
}

function extractResponseText(value: unknown) {
  if (!isRecord(value)) return ""

  if (typeof value.output_text === "string") {
    return value.output_text.trim()
  }

  const output = Array.isArray(value.output) ? value.output : []
  const textParts: string[] = []

  for (const item of output) {
    if (!isRecord(item)) continue
    const content = Array.isArray(item.content) ? item.content : []

    for (const contentItem of content) {
      if (!isRecord(contentItem)) continue

      if (typeof contentItem.text === "string") {
        textParts.push(contentItem.text)
      }
    }
  }

  return textParts.join("\n").trim()
}

function parseOpenAiInterpretation(text: string) {
  try {
    const parsed = JSON.parse(text)

    if (!isValidInterpretation(parsed)) {
      return null
    }

    return normalizeInterpretation(parsed)
  } catch {
    return null
  }
}

async function requestOpenAiText(input: {
  apiKey: string
  model: string
  prompt: string
  textFormat?: Record<string, unknown>
}) {
  let response: Response

  try {
    response = await fetch(openAiResponsesUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          {
            role: "user",
            content: input.prompt,
          },
        ],
        ...(input.textFormat ? { text: { format: input.textFormat } } : {}),
      }),
    })
  } catch (error) {
    console.error("OpenAI divination request failed:", error)

    return {
      ok: false as const,
      status: 502,
      error: "OPENAI_REQUEST_FAILED",
      message: "解讀產生失敗，請稍後再試。",
    }
  }

  if (!response.ok) {
    console.error("OpenAI divination request failed:", {
      status: response.status,
      statusText: response.statusText,
    })

    return {
      ok: false as const,
      status: 502,
      error: "OPENAI_REQUEST_FAILED",
      message: "解讀產生失敗，請稍後再試。",
    }
  }

  const data = (await response.json()) as unknown
  const text = extractResponseText(data)

  if (!text) {
    return {
      ok: false as const,
      status: 502,
      error: "OPENAI_RESPONSE_INVALID",
      message: "解讀格式異常，請稍後再試。",
    }
  }

  return {
    ok: true as const,
    text,
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

  const model = getDivinationOpenAIModel(process.env)
  const legacyContext = buildLegacyReadingContext(input)
  const draftResult = await requestOpenAiText({
    apiKey,
    model,
    prompt: buildLegacyDraftPrompt(legacyContext),
  })

  if (!draftResult.ok) {
    return draftResult
  }

  const draftAnswer = reviewAnswer(draftResult.text, legacyContext)
  const reviewResult = await requestOpenAiText({
    apiKey,
    model,
    prompt: buildLegacyReviewPrompt(legacyContext, draftAnswer),
    textFormat: {
      type: "json_schema",
      name: "divination_review",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["finalAnswer", "changedMeaning", "safetyAdjusted", "issuesFixed"],
        properties: {
          finalAnswer: {
            type: "string",
            description: "整理後給使用者看的完整最終解讀。",
          },
          changedMeaning: {
            type: "boolean",
            description: "是否改動原本命理主結論。",
          },
          safetyAdjusted: {
            type: "boolean",
            description: "是否因安全規則調整語氣或內容。",
          },
          issuesFixed: {
            type: "array",
            items: { type: "string" },
            description: "簡短列出有修正的問題。",
          },
        },
      },
    },
  })
  const reviewedAnswer =
    reviewResult.ok && parseLegacyReviewResult(reviewResult.text)?.finalAnswer
      ? parseLegacyReviewResult(reviewResult.text)?.finalAnswer
      : draftAnswer
  const finalAnswer = reviewAnswer(reviewedAnswer || draftAnswer, legacyContext)
  const interpretation = buildLegacyStructuredInterpretation(finalAnswer, legacyContext)

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
  } catch (error) {
    console.warn("Divination reading lookup failed:", {
      readingId: input.readingId,
      error: error instanceof Error ? error.message : "unknown_error",
    })

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
  } catch (error) {
    console.warn("Divination reading interpreting update failed:", {
      readingId: input.readingId,
      error: error instanceof Error ? error.message : "unknown_error",
    })

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
    } catch (error) {
      console.warn("Divination reading failed update failed:", {
        readingId: input.readingId,
        errorCode: openAiResult.error,
        error: error instanceof Error ? error.message : "unknown_error",
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
  } catch (error) {
    console.warn("Divination reading completed update failed:", {
      readingId: input.readingId,
      error: error instanceof Error ? error.message : "unknown_error",
    })

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

function buildCardSummary(card: (typeof ziweiCards)[number]): DivinationCardSummary {
  return {
    id: card.id,
    name: card.name,
    image: card.image,
    reversedImage: card.reversedImage,
    huaqi: card.huaqi,
    element: card.element,
    core: card.core,
  }
}

async function resumePersistedDivinationReadingFromDb(input: {
  request: Request
  readingId: string
  followUpContext?: unknown
}) {
  const userId = await getUserIdFromRequest(input.request).catch(() => null)

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTHORIZED",
        message: "請先登入後再查看占卜結果。",
      },
      { status: 401 }
    )
  }

  let reading

  try {
    reading = await getDivinationReadingResumeContextForUser(input.readingId, userId)
  } catch (error) {
    console.warn("Divination reading resume lookup failed:", {
      readingId: input.readingId,
      error: error instanceof Error ? error.message : "unknown_error",
    })

    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_LOOKUP_FAILED",
        message: "占卜紀錄讀取失敗，請稍後再試。",
      },
      { status: 500 }
    )
  }

  if (!reading) {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_NOT_FOUND",
        message: "找不到占卜紀錄。",
      },
      { status: 404 }
    )
  }

  const selectedCard = reading.cardId ? ziweiCards.find((card) => card.id === reading.cardId) : null
  const safeDrawMode = drawModes.has(reading.drawMode as DivinationDrawMode)
    ? (reading.drawMode as DivinationDrawMode)
    : null
  const safePosition = positions.has(reading.position as DivinationPosition)
    ? (reading.position as DivinationPosition)
    : null

  if (!selectedCard || !safeDrawMode || !safePosition) {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_DRAW_DATA_MISSING",
        message: "這筆占卜缺少抽牌資料，請聯繫客服協助。",
      },
      { status: 409 }
    )
  }

  const card = buildCardSummary(selectedCard)
  const decision = decideDivinationInterpretationStart(reading)

  if (decision.result === "payment_required") {
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENT_PENDING",
        message: "正在確認付款結果，請稍後重新整理。",
        requiresPayment: true,
        amountTwd: READING_COST_TWD,
      },
      { status: 402 }
    )
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
    if (!isValidInterpretation(decision.interpretation)) {
      return NextResponse.json(
        {
          ok: false,
          error: "DIVINATION_READING_INTERPRETATION_INVALID",
          message: "解讀內容格式無法顯示，請聯繫客服協助。",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      interpretation: normalizeInterpretation(decision.interpretation),
      card,
      position: safePosition,
      drawMode: safeDrawMode,
      paymentGate: {
        mode: "mock",
        paymentId: `paid_${reading.id}`,
        provider: "mock",
        status: "mock_paid",
        itemType: "ai_divination",
        itemName: "紫微牌卡 AI 深度解讀",
        amountTwd: READING_COST_TWD,
        currency: "TWD",
      },
    } satisfies DivinationInterpretResponse)
  }

  if (decision.result !== "should_interpret" || !reading.paymentId) {
    return NextResponse.json(
      {
        ok: false,
        error: "DIVINATION_READING_INVALID_STATE",
        message: "這筆占卜目前不能產生解讀。",
      },
      { status: 409 }
    )
  }

  const safetyCheckText = buildFollowUpSafetyCheckText(reading.question, input.followUpContext)
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

  try {
    const interpretingResult = await startDivinationReadingInterpretationIfPaid(reading.id)

    if (interpretingResult.result !== "updated") {
      return NextResponse.json(
        {
          ok: false,
          error: "DIVINATION_READING_INTERPRETING",
          message: "這筆占卜正在產生解讀，請稍後再試。",
        },
        { status: 409 }
      )
    }
  } catch (error) {
    console.warn("Divination reading resume interpreting update failed:", {
      readingId: reading.id,
      error: error instanceof Error ? error.message : "unknown_error",
    })

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
    question: reading.question,
    drawMode: safeDrawMode,
    card: selectedCard,
    position: safePosition,
    followUpContext: input.followUpContext,
  })

  if (!openAiResult.ok) {
    try {
      await markDivinationReadingFailed({
        readingId: reading.id,
        errorMessage: openAiResult.error,
      })
    } catch (error) {
      console.warn("Divination reading failed update failed:", {
        readingId: reading.id,
        errorCode: openAiResult.error,
        error: error instanceof Error ? error.message : "unknown_error",
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
    await markDivinationReadingCompleted({
      readingId: reading.id,
      interpretation: openAiResult.interpretation,
      resultSummary: openAiResult.interpretation.finalAnswer ?? openAiResult.interpretation.summary,
    })
  } catch (error) {
    console.warn("Divination reading completed update failed:", {
      readingId: reading.id,
      error: error instanceof Error ? error.message : "unknown_error",
    })

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
    card,
    position: safePosition,
    drawMode: safeDrawMode,
    paymentGate: {
      mode: "mock",
      paymentId: `paid_${reading.id}`,
      provider: "mock",
      status: "mock_paid",
      itemType: "ai_divination",
      itemName: "紫微牌卡 AI 深度解讀",
      amountTwd: READING_COST_TWD,
      currency: "TWD",
    },
  } satisfies DivinationInterpretResponse)
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

    return resumePersistedDivinationReadingFromDb({
      request,
      readingId,
      followUpContext,
    })
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
