import { generateAiChartD1ReportContentFromSnapshot } from './reportGenerationPipeline'

export type AiChartReportGenerationInput = {
  reportId?: string | null
  name?: string | null
  gender?: string | null
  solarDate?: string | null
  birthTime?: string | null
  birthPlace?: string | null
  chartSnapshot?: unknown
  chartSnapshotSha256?: string | null
  chartSummary?: {
    mainStar?: string | null
    bodyPalace?: string | null
    lifePalace?: string | null
    notes?: string[] | null
  } | null
}

const FALLBACK_TEXT = '未提供'
const INSUFFICIENT_DATA_TEXT = '資料不足，建議補充出生資訊後重新分析'

const UNSAFE_OUTPUT_PATTERNS = [
  /TradeInfo/gi,
  /TradeSha/gi,
  /HashKey/gi,
  /HashIV/gi,
  /payment_id/gi,
  /paymentId/g,
  /merchant_order_no/gi,
  /merchantOrderNo/g,
  /credit\s*card/gi,
  /信用卡資料/g,
  /信用卡/g,
  /cardNumber/gi,
  /raw_payload/gi,
  /raw\s*payload/gi,
  /完整付款表單/g,
  /OpenAI\s*prompt/gi,
  /OpenAI\s*request/gi,
  /OpenAI\s*response/gi,
]

function redactUnsafeText(value: string) {
  return UNSAFE_OUTPUT_PATTERNS.reduce((result, pattern) => result.replace(pattern, '[已省略]'), value)
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return FALLBACK_TEXT
  }

  const trimmed = value.trim()
  return trimmed ? redactUnsafeText(trimmed) : FALLBACK_TEXT
}

function normalizeNotes(notes: string[] | null | undefined) {
  if (!Array.isArray(notes)) {
    return []
  }

  return notes
    .map((note) => (typeof note === 'string' ? redactUnsafeText(note.trim()) : ''))
    .filter((note) => note.length > 0)
}

function hasMissingCoreData(input: AiChartReportGenerationInput) {
  return !input.solarDate?.trim() || !input.birthTime?.trim() || !input.birthPlace?.trim()
}

function renderBulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

export function generateAiChartReportContent(input: AiChartReportGenerationInput): string {
  if (input.chartSnapshot) {
    return generateAiChartD1ReportContentFromSnapshot({
      reportId: input.reportId ?? 'report:unknown',
      chartSnapshot: input.chartSnapshot,
    })
  }

  const name = normalizeOptionalText(input.name)
  const gender = normalizeOptionalText(input.gender)
  const solarDate = normalizeOptionalText(input.solarDate)
  const birthTime = normalizeOptionalText(input.birthTime)
  const birthPlace = normalizeOptionalText(input.birthPlace)
  const mainStar = normalizeOptionalText(input.chartSummary?.mainStar)
  const bodyPalace = normalizeOptionalText(input.chartSummary?.bodyPalace)
  const lifePalace = normalizeOptionalText(input.chartSummary?.lifePalace)
  const notes = normalizeNotes(input.chartSummary?.notes)
  const conservativeNote = hasMissingCoreData(input) ? `\n\n${INSUFFICIENT_DATA_TEXT}。` : ''

  const chartHighlights = [
    `主星：${mainStar}`,
    `身宮：${bodyPalace}`,
    `命宮：${lifePalace}`,
    ...notes.map((note) => `補充觀察：${note}`),
  ]

  return [
    '## 1. 標題',
    'AI 命盤分析｜AI 版初步分析報告',
    '這份內容是依據目前提供的資料產生的 AI 版初步分析，適合用來整理方向與提問，不等同於老師正式完整命盤稿。',
    '',
    '## 2. 基本資料摘要',
    renderBulletList([
      `姓名：${name}`,
      `性別：${gender}`,
      `國曆生日：${solarDate}`,
      `出生時間：${birthTime}`,
      `出生地：${birthPlace}`,
    ]) + conservativeNote,
    '',
    '## 3. 命盤重點',
    renderBulletList(chartHighlights),
    '',
    '## 4. 個性與行動模式',
    `從目前資料來看，${mainStar === FALLBACK_TEXT ? '尚無明確主星資訊，因此以保守方式判讀' : `主星「${mainStar}」可作為性格觀察起點`}。你適合先確認核心目標，再把行動拆成小步驟；當資料越完整，個性輪廓也能更細緻。`,
    '',
    '## 5. 工作與發展方向',
    `工作規劃上，建議把「穩定累積」放在短期主軸。若命宮或身宮資訊仍不足，先避免做過度絕對的判斷，改以能力盤點、資源整合與節奏管理作為發展方向。`,
    '',
    '## 6. 感情與人際提醒',
    `人際互動適合採取清楚表達與穩定回應的方式。遇到關係壓力時，先分辨是情緒反應、溝通落差，還是期待不同，能幫助你減少誤判。`,
    '',
    '## 7. 近期建議',
    renderBulletList([
      '先整理一個最想改善的生活主題，避免一次處理太多問題。',
      '若出生時間、出生地或命盤摘要不足，建議補齊資料後重新分析。',
      notes.length > 0 ? `可優先追蹤補充觀察中的重點：${notes[0]}` : '可先記錄近期重複出現的情緒與事件，作為後續分析依據。',
    ]),
    '',
    '## 8. 結語',
    '這份 AI 版初步分析提供的是整理方向，不是固定命運。真正有價值的部分，是把命盤提示轉化成可觀察、可調整、可實踐的日常選擇。',
  ].join('\n')
}
