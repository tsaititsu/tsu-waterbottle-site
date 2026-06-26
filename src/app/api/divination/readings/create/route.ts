import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import { reserveLocalDivinationEntitlement } from "@/lib/divination/localEntitlement"
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
  const localUserId = getTrimmedString(body.localUserId)
  const mockPaid = body.mockPaid === true
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
  const mockPaymentId = `mock_pay_${readingId}`
  const reading = {
    id: readingId,
    question,
    drawMode: drawMode as DivinationDrawMode,
    cardId: selectedCard.id,
    cardName: selectedCard.name,
    position: position as DivinationPosition,
    status: "waiting_draw",
    createdAt: new Date().toISOString(),
  } satisfies DivinationReadingPreview
  const mockPaymentGate = {
    mode: "mock",
    paymentId: mockPaymentId,
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
    reading,
    entitlement: {
      type: entitlement.type,
      amountTwd: entitlement.amountTwd,
      localUserId: entitlement.localUserId,
      taiwanDate: entitlement.taiwanDate,
      entitlementToken: entitlement.entitlementToken,
    },
    mockPaymentGate,
  } satisfies CreateDivinationReadingResponse

  // Local development entitlement gate only. 正式版必須改為查正式 entitlement / payments。
  return NextResponse.json(response)
}
