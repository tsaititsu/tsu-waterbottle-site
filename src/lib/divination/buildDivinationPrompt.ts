import type { ZiweiCard } from "@/lib/divination/cards"
import type { DivinationDrawMode, DivinationPosition } from "@/lib/divination/types"

export type BuildDivinationPromptInput = {
  question: string
  drawMode: DivinationDrawMode
  card: Pick<
    ZiweiCard,
    | "id"
    | "name"
    | "huaqi"
    | "element"
    | "core"
    | "uprightMeaning"
    | "reversedMeaning"
    | "advice"
  >
  position: DivinationPosition
}

const drawModeLabels: Record<DivinationDrawMode, string> = {
  manual: "手動抽牌",
  auto: "自動抽牌",
}

const positionLabels: Record<DivinationPosition, string> = {
  upright: "正位",
  reversed: "反位",
}

export function buildDivinationPrompt(input: BuildDivinationPromptInput): {
  instructions: string
  input: string
} {
  const positionMeaning =
    input.position === "reversed" ? input.card.reversedMeaning : input.card.uprightMeaning
  const positionAdvice =
    input.position === "reversed" ? input.card.advice.reversed : input.card.advice.upright

  return {
    instructions: [
      "你是水瓶先生網站的紫微牌卡占卜解讀助手。",
      "請以正式、溫和、清楚、可執行的繁體中文回覆。",
      "請先回應使用者問題，再依照抽到的紫微牌卡、正反位與牌義進行分析。",
      "語氣要有紫微牌卡占卜的儀式感，但不要過度玄虛。",
      "不要恐嚇，不要絕對化，不要保證事情一定發生。",
      "不要提供醫療、法律、投資保證；遇到健康、法律、財務、危險情境，請提醒使用者尋求專業協助。",
      "不要提到 mock、payment gate、readingId、API、模型或自己是 AI。",
      "請只輸出 JSON，不要輸出 Markdown，不要包 code fence。",
    ].join("\n"),
    input: [
      `使用者問題：${input.question}`,
      `抽牌方式：${drawModeLabels[input.drawMode]}`,
      `抽到牌卡：${input.card.name}`,
      `正反位：${positionLabels[input.position]}`,
      `化氣：${input.card.huaqi}`,
      `五行：${input.card.element}`,
      `牌卡核心：${input.card.core}`,
      `本次位置牌義：${positionMeaning}`,
      `本次位置建議：${positionAdvice}`,
      "",
      "請依照下列 JSON 結構回覆：",
      "{",
      '  "summary": "一句話總結，不要太長。",',
      '  "cardMessage": "說明這張牌與正反位帶來的核心訊息。",',
      '  "situationAnalysis": "針對使用者問題分析目前狀態。",',
      '  "advice": "給具體建議，至少 2～4 點，可以用自然段或條列。",',
      '  "reminder": "溫和提醒，不恐嚇、不絕對化。"',
      "}",
    ].join("\n"),
  }
}
