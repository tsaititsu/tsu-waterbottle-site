import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import {
  buildLegacyDraftPrompt,
  buildLegacyReadingContext,
  buildLegacyReviewPrompt,
  buildLegacyStructuredInterpretation,
  parseLegacyReviewResult,
  reviewAnswer,
} from "@/lib/divination/legacyReadingEngine"
import {
  consumeLocalDivinationEntitlement,
  READING_COST_TWD,
  releaseLocalDivinationEntitlement,
  reserveLocalDivinationEntitlement,
} from "@/lib/divination/localEntitlement"
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
const fallbackOpenAiModel = "gpt-4.1-mini"

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
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
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      ok: false as const,
      status: 500,
      error: "OPENAI_API_KEY_MISSING",
      message: "尚未設定 OpenAI API Key。",
    }
  }

  const model = process.env.OPENAI_MODEL || fallbackOpenAiModel
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

  const openAiResult = await createOpenAiInterpretation({
    question,
    drawMode: safeDrawMode,
    card: selectedCard,
    position: safePosition,
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

  const card = {
    id: selectedCard.id,
    name: selectedCard.name,
    image: selectedCard.image,
    reversedImage: selectedCard.reversedImage,
    huaqi: selectedCard.huaqi,
    element: selectedCard.element,
    core: selectedCard.core,
  } satisfies DivinationCardSummary
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
