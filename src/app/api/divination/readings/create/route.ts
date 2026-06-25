import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import type {
  CreateDivinationReadingRequest,
  CreateDivinationReadingResponse,
  DivinationDrawMode,
  DivinationMockPaymentGate,
  DivinationPosition,
  DivinationReadingPreview,
} from "@/lib/divination/types"

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

  const selectedCard = ziweiCards.find((card) => card.id === cardId)

  if (!selectedCard) {
    return jsonError("找不到這張紫微牌卡。")
  }

  const readingId = createMockReadingId()
  const mockPaymentId = `mock_pay_${readingId}`
  const reading = {
    id: readingId,
    question,
    drawMode: drawMode as DivinationDrawMode,
    cardId: selectedCard.id,
    cardName: selectedCard.name,
    position: position as DivinationPosition,
    status: "mock_created",
    createdAt: new Date().toISOString(),
  } satisfies DivinationReadingPreview
  const mockPaymentGate = {
    mode: "mock",
    paymentId: mockPaymentId,
    provider: "mock",
    status: "mock_paid",
    itemType: "ai_divination",
    itemName: "紫微牌卡 AI 深度解讀",
    amountTwd: 50,
    currency: "TWD",
  } satisfies DivinationMockPaymentGate
  const response = {
    ok: true,
    reading,
    mockPaymentGate,
  } satisfies CreateDivinationReadingResponse

  // Mock payment gate only. 正式版必須改為查 payments + divination_readings。
  return NextResponse.json(response)
}
