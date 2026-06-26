import { NextResponse } from "next/server"
import { buildDivinationPrompt } from "@/lib/divination/buildDivinationPrompt"
import { ziweiCards } from "@/lib/divination/cards"
import {
  consumeLocalDivinationEntitlement,
  getLocalDivinationEntitlementStatus,
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

type MockPaymentGate = {
  mode?: unknown
  paymentId?: unknown
  provider?: unknown
  status?: unknown
  itemType?: unknown
  amountTwd?: unknown
  currency?: unknown
  entitlementToken?: unknown
}

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

function getMockPaymentGate(value: unknown): MockPaymentGate | null {
  return isRecord(value) ? value : null
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

function isValidMockPaymentGate(value: unknown) {
  const gate = getMockPaymentGate(value)

  return Boolean(
    gate &&
      gate.mode === "mock" &&
      (gate.provider === undefined || gate.provider === "mock") &&
      (gate.status === "daily_free" || gate.status === "mock_paid") &&
      gate.itemType === "ai_divination" &&
      (gate.amountTwd === 0 || gate.amountTwd === 50) &&
      gate.currency === "TWD" &&
      typeof gate.paymentId === "string" &&
      gate.paymentId.trim() &&
      typeof gate.entitlementToken === "string" &&
      gate.entitlementToken.trim()
  )
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
  const prompt = buildDivinationPrompt(input)
  const response = await fetch(openAiResponsesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: prompt.instructions,
        },
        {
          role: "user",
          content: prompt.input,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "divination_interpretation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "cardMessage", "situationAnalysis", "advice", "reminder"],
            properties: {
              summary: {
                type: "string",
                description: "一句話總結，不要太長。",
              },
              cardMessage: {
                type: "string",
                description: "說明這張牌與正反位帶來的核心訊息。",
              },
              situationAnalysis: {
                type: "string",
                description: "針對使用者問題分析目前狀態。",
              },
              advice: {
                type: "string",
                description: "給具體建議，至少 2～4 點，可以用自然段或條列。",
              },
              reminder: {
                type: "string",
                description: "溫和提醒，不恐嚇、不絕對化。",
              },
            },
          },
        },
      },
    }),
  })

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
  const interpretation = parseOpenAiInterpretation(extractResponseText(data))

  if (!interpretation) {
    return {
      ok: false as const,
      status: 502,
      error: "OPENAI_RESPONSE_INVALID",
      message: "解讀格式異常，請稍後再試。",
    }
  }

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
  const mockPaymentGate = getMockPaymentGate(body.mockPaymentGate)
  const readingId = getTrimmedString(body.readingId)
  const entitlementToken = getTrimmedString(mockPaymentGate?.entitlementToken)

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

  if (!isValidMockPaymentGate(mockPaymentGate)) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENTITLEMENT_REQUIRED",
        message: "請先使用每日免費次數或完成 NT$50 單次占卜。",
      },
      { status: 402 }
    )
  }

  const entitlement = getLocalDivinationEntitlementStatus(readingId, entitlementToken)

  if (!entitlement || entitlement.status !== "reserved") {
    return NextResponse.json(
      {
        ok: false,
        error: "ENTITLEMENT_REQUIRED",
        message: "請先使用每日免費次數或完成 NT$50 單次占卜。",
      },
      { status: 402 }
    )
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
  const openAiResult = await createOpenAiInterpretation({
    question,
    drawMode: safeDrawMode,
    card: selectedCard,
    position: safePosition,
  })

  if (!openAiResult.ok) {
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
    paymentId: getTrimmedString(mockPaymentGate?.paymentId),
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

  consumeLocalDivinationEntitlement(readingId, entitlementToken)

  return NextResponse.json(response)
}
