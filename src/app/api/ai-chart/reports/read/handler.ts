import { NextResponse } from 'next/server'
import {
  AI_CHART_REPORT_DEFAULT_AMOUNT_TWD,
  decideAiChartReportResultAccess,
  getAiChartReportForUser,
  type AiChartReportResultContext,
} from '../../../../../lib/supabase/aiChartReports'

type GetAiChartReportForUserDependency = typeof getAiChartReportForUser

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function buildSafeReportSummary(report: AiChartReportResultContext) {
  return {
    id: report.id,
    title: report.title,
    productName: report.productName,
    amountTwd: report.amountTwd,
    paymentStatus: report.paymentStatus,
    paidAt: report.paidAt,
  }
}

function buildPaidMissingContentResponse(report: AiChartReportResultContext) {
  return NextResponse.json({
    ok: true,
    status: 'paid_missing_content',
    message: '付款已完成，分析內容準備中。',
    report: buildSafeReportSummary(report),
  })
}

function buildReadyResponse(report: AiChartReportResultContext, reportContent: string) {
  return NextResponse.json({
    ok: true,
    status: 'ready',
    report: {
      ...buildSafeReportSummary(report),
      reportContent,
      completedAt: report.completedAt,
    },
  })
}

function buildReadFailedResponse() {
  console.error('讀取 AI 命盤 report 失敗')

  return NextResponse.json(
    {
      ok: false,
      error: 'ai_chart_report_read_failed',
    },
    { status: 500 },
  )
}

export async function handleReadAiChartReportRequest(
  request: Request,
  deps: {
    getUserIdFromRequest: (request: Request) => Promise<string | null>
    getAiChartReportForUser?: GetAiChartReportForUserDependency
  },
): Promise<Response> {
  const userId = await deps.getUserIdFromRequest(request).catch(() => null)
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unauthorized',
      },
      { status: 401 },
    )
  }

  const searchParams = new URL(request.url).searchParams
  const reportId = searchParams.get('reportId')?.trim()

  if (!reportId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'ai_chart_report_id_required',
      },
      { status: 400 },
    )
  }

  if (!isUuid(reportId)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_ai_chart_report_id',
      },
      { status: 400 },
    )
  }

  try {
    const getReport = deps.getAiChartReportForUser ?? getAiChartReportForUser
    const report = await getReport(reportId, userId)
    const decision = decideAiChartReportResultAccess(report)

    if (decision.result === 'not_found') {
      return NextResponse.json(
        {
          ok: false,
          error: 'ai_chart_report_not_found',
        },
        { status: 404 },
      )
    }

    if (!report) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ai_chart_report_not_found',
        },
        { status: 404 },
      )
    }

    if (decision.result === 'payment_required') {
      return NextResponse.json(
        {
          ok: false,
          error: 'PAYMENT_REQUIRED',
          requiresPayment: true,
          amountTwd: report?.amountTwd ?? AI_CHART_REPORT_DEFAULT_AMOUNT_TWD,
        },
        { status: 402 },
      )
    }

    if (decision.result === 'paid_missing_content') {
      return buildPaidMissingContentResponse(report)
    }

    if (decision.result === 'ready') {
      return buildReadyResponse(report, decision.reportContent)
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'AI_CHART_REPORT_INVALID_STATE',
        paymentStatus: decision.paymentStatus,
      },
      { status: 409 },
    )
  } catch {
    return buildReadFailedResponse()
  }
}
