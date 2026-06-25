import { NextResponse } from "next/server"
import { ziweiCards } from "@/lib/divination/cards"

type DrawMode = "manual" | "auto"
type Position = "upright" | "reversed"

type RequestBody = {
  question?: unknown
  drawMode?: unknown
  cardId?: unknown
  position?: unknown
}

const drawModes = new Set<DrawMode>(["manual", "auto"])
const positions = new Set<Position>(["upright", "reversed"])

const positionLabels: Record<Position, string> = {
  upright: "正位",
  reversed: "反位",
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
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

  if (!drawModes.has(drawMode as DrawMode)) {
    return jsonError("抽牌方式不正確。")
  }

  if (!cardId) {
    return jsonError("缺少牌卡資料。")
  }

  if (!positions.has(position as Position)) {
    return jsonError("正反位資料不正確。")
  }

  const selectedCard = ziweiCards.find((card) => card.id === cardId)

  if (!selectedCard) {
    return jsonError("找不到這張紫微牌卡。")
  }

  const safeDrawMode = drawMode as DrawMode
  const safePosition = position as Position
  const meaning =
    safePosition === "reversed" ? selectedCard.reversedMeaning : selectedCard.uprightMeaning
  const advice =
    safePosition === "reversed" ? selectedCard.advice.reversed : selectedCard.advice.upright
  const positionLabel = positionLabels[safePosition]

  return NextResponse.json({
    ok: true,
    interpretation: {
      summary: `${selectedCard.name}${positionLabel}代表此問題的核心訊號是：${selectedCard.core}`,
      cardMessage: meaning,
      situationAnalysis: `你詢問的是「${question}」。目前此版本先依牌卡基礎牌義整理，不代表正式 AI 深度解讀。`,
      advice,
      reminder: "此為牌義預覽版，尚未接入正式 AI 深度解讀。",
    },
    card: {
      id: selectedCard.id,
      name: selectedCard.name,
      image: selectedCard.image,
      reversedImage: selectedCard.reversedImage,
      huaqi: selectedCard.huaqi,
      element: selectedCard.element,
      core: selectedCard.core,
    },
    position: safePosition,
    drawMode: safeDrawMode,
  })
}
