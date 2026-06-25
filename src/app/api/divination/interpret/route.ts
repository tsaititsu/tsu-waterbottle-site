import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
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
}

const drawModes = new Set<DivinationDrawMode>(["manual", "auto"])
const positions = new Set<DivinationPosition>(["upright", "reversed"])

const positionLabels: Record<DivinationPosition, string> = {
  upright: "正位",
  reversed: "反位",
}

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

function isValidMockPaymentGate(value: unknown) {
  const gate = getMockPaymentGate(value)

  return Boolean(
    gate &&
      gate.mode === "mock" &&
      gate.provider === "mock" &&
      gate.status === "mock_paid" &&
      gate.itemType === "ai_divination" &&
      gate.amountTwd === 50 &&
      gate.currency === "TWD" &&
      typeof gate.paymentId === "string" &&
      gate.paymentId.trim()
  )
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
    return jsonError("尚未通過付款 Gate，無法產生解讀。", 402)
  }

  const selectedCard = ziweiCards.find((card) => card.id === cardId)

  if (!selectedCard) {
    return jsonError("找不到這張紫微牌卡。")
  }

  const safeDrawMode = drawMode as DivinationDrawMode
  const safePosition = position as DivinationPosition
  const meaning =
    safePosition === "reversed" ? selectedCard.reversedMeaning : selectedCard.uprightMeaning
  const advice =
    safePosition === "reversed" ? selectedCard.advice.reversed : selectedCard.advice.upright
  const positionLabel = positionLabels[safePosition]
  const interpretation = {
    summary: `${selectedCard.name}${positionLabel}代表此問題的核心訊號是：${selectedCard.core}`,
    cardMessage: meaning,
    situationAnalysis: `你詢問的是「${question}」。目前此版本先依牌卡基礎牌義整理，不代表正式 AI 深度解讀。`,
    advice,
    reminder: "此為牌義預覽版，尚未接入正式 AI 深度解讀。",
  } satisfies DivinationInterpretation
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
    status: "mock_paid",
    itemType: "ai_divination",
    amountTwd: 50,
    currency: "TWD",
  } satisfies DivinationMockPaymentGate
  const response = {
    ok: true,
    interpretation,
    card,
    position: safePosition,
    drawMode: safeDrawMode,
    paymentGate,
  } satisfies DivinationInterpretResponse

  return NextResponse.json(response)
}
