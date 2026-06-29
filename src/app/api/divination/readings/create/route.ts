import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"
import { runPreOpenAISafetyCheck } from "@/lib/divination/legacyReadingEngine"
import type {
  CreateDivinationReadingRequest,
  CreateDivinationReadingResponse,
  DivinationDrawMode,
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

  const safetyResult = runPreOpenAISafetyCheck(question)

  if (safetyResult.blocked) {
    return NextResponse.json({
      ok: true,
      safetyBlocked: true,
      safetyReason: safetyResult.reason,
      interpretation: safetyResult.interpretation,
    } satisfies CreateDivinationReadingResponse)
  }

  const readingId = createMockReadingId()
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
  } satisfies CreateDivinationReadingResponse

  // Local development only. Gate is checked when the user starts interpretation.
  return NextResponse.json(response)
}
