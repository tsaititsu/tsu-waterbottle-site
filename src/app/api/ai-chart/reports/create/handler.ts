import { NextResponse } from 'next/server'
import {
  AI_CHART_REPORT_DEFAULT_AMOUNT_TWD,
  createPendingAiChartReport,
  type CreatePendingAiChartReportResult,
} from '../../../../../lib/supabase/aiChartReports'

export type CreateAiChartReportRequest = {
  title?: unknown
  productName?: unknown
  amountTwd?: unknown
}

type CreatePendingAiChartReportDependency = typeof createPendingAiChartReport

const DEFAULT_AI_CHART_REPORT_TITLE = 'AI 命盤分析'
const DEFAULT_AI_CHART_REPORT_PRODUCT_NAME = 'AI 命盤分析'
const MAX_AI_CHART_REPORT_TEXT_LENGTH = 120

function parseOptionalText(value: unknown, fallback: string) {
  if (value === undefined || value === null) {
    return fallback
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_AI_CHART_REPORT_TEXT_LENGTH) {
    return null
  }

  return trimmed
}

function parseAmountTwd(value: unknown) {
  if (value === undefined || value === null) {
    return AI_CHART_REPORT_DEFAULT_AMOUNT_TWD
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }

  return value
}

function createReportSuccessResponse(report: CreatePendingAiChartReportResult) {
  return NextResponse.json({
    ok: true,
    reportId: report.id,
    paymentStatus: report.paymentStatus,
    amountTwd: AI_CHART_REPORT_DEFAULT_AMOUNT_TWD,
  })
}

function createReportFailedResponse(error: unknown) {
  console.error('建立 AI 命盤 pending report 失敗', {
    error: error instanceof Error ? error.message : 'unknown_error',
  })

  return NextResponse.json(
    {
      ok: false,
      error: 'ai_chart_report_create_failed',
    },
    { status: 500 },
  )
}

export async function handleCreateAiChartReportRequest(
  body: CreateAiChartReportRequest | null,
  deps: {
    createPendingAiChartReport?: CreatePendingAiChartReportDependency
  } = {},
): Promise<Response> {
  if (!body) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_ai_chart_report_input',
      },
      { status: 400 },
    )
  }

  const title = parseOptionalText(body.title, DEFAULT_AI_CHART_REPORT_TITLE)
  const productName = parseOptionalText(body.productName, DEFAULT_AI_CHART_REPORT_PRODUCT_NAME)

  if (!title || !productName) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_ai_chart_report_input',
      },
      { status: 400 },
    )
  }

  const amountTwd = parseAmountTwd(body.amountTwd)
  if (amountTwd !== AI_CHART_REPORT_DEFAULT_AMOUNT_TWD) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_ai_chart_amount',
      },
      { status: 400 },
    )
  }

  try {
    const createReport = deps.createPendingAiChartReport ?? createPendingAiChartReport
    const report = await createReport({
      userId: null,
      chartProfileId: null,
      title,
      productName,
      amountTwd: AI_CHART_REPORT_DEFAULT_AMOUNT_TWD,
      reportContent: null,
    })

    return createReportSuccessResponse(report)
  } catch (error) {
    return createReportFailedResponse(error)
  }
}
