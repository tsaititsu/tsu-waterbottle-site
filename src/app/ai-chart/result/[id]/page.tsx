'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'

type AiChartReportReadResponse =
  | {
      ok: true
      status: 'paid_missing_content'
      message: string
      report: {
        id: string
        title: string | null
        productName: string | null
        amountTwd: number | null
        paymentStatus: 'paid'
        paidAt: string | null
      }
    }
  | {
      ok: true
      status: 'ready'
      report: {
        id: string
        title: string | null
        productName: string | null
        amountTwd: number | null
        paymentStatus: 'paid'
        reportContent: string
        paidAt: string | null
        completedAt: string | null
      }
    }
  | {
      ok: false
      error:
        | 'PAYMENT_REQUIRED'
        | 'ai_chart_report_not_found'
        | 'AI_CHART_REPORT_INVALID_STATE'
        | 'ai_chart_report_id_required'
        | 'invalid_ai_chart_report_id'
        | 'ai_chart_report_read_failed'
        | 'unauthorized'
        | 'forbidden'
      requiresPayment?: boolean
      amountTwd?: number
      paymentStatus?: 'failed' | 'canceled' | 'refunded' | null
    }

type DbReportState =
  | { status: 'loading' }
  | { status: 'invalid_id' }
  | { status: 'unauthorized' }
  | { status: 'not_found' }
  | { status: 'ready'; report: Extract<AiChartReportReadResponse, { ok: true; status: 'ready' }>['report'] }
  | {
      status: 'paid_missing_content'
      message: string
      report: Extract<AiChartReportReadResponse, { ok: true; status: 'paid_missing_content' }>['report']
    }
  | { status: 'payment_required'; amountTwd: number }
  | { status: 'invalid_state' }
  | { status: 'error' }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-TW') : null
}

function DbReportStatusCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[28px] border border-borderSoft bg-white p-6 shadow-soft md:p-8">
      <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-textMuted">{body}</p>
    </article>
  )
}

export default function AiChartResultPage() {
  const params = useParams<{ id: string }>()
  const resultId = params.id
  const [dbReportState, setDbReportState] = useState<DbReportState>(() =>
    isUuid(resultId) ? { status: 'loading' } : { status: 'invalid_id' },
  )
  const readyDbReport = dbReportState.status === 'ready' ? dbReportState.report : null

  useEffect(() => {
    if (!isUuid(resultId)) {
      setDbReportState({ status: 'invalid_id' })
      return
    }

    let canceled = false

    async function loadDbReport() {
      setDbReportState({ status: 'loading' })

      try {
        const response = await fetch(`/api/ai-chart/reports/read?reportId=${encodeURIComponent(resultId)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })
        const data = (await response.json().catch(() => null)) as AiChartReportReadResponse | null

        if (canceled) return

        if (response.status === 401) {
          setDbReportState({ status: 'unauthorized' })
          return
        }

        if (response.status === 403 || response.status === 404) {
          setDbReportState({ status: 'not_found' })
          return
        }

        if (!data) {
          setDbReportState({ status: 'error' })
          return
        }

        if (!data.ok && data.error === 'unauthorized') {
          setDbReportState({ status: 'unauthorized' })
          return
        }

        if (!data.ok && data.error === 'forbidden') {
          setDbReportState({ status: 'not_found' })
          return
        }

        if (data.ok && data.status === 'ready') {
          setDbReportState({
            status: 'ready',
            report: data.report,
          })
          return
        }

        if (data.ok && data.status === 'paid_missing_content') {
          setDbReportState({
            status: 'paid_missing_content',
            message: data.message,
            report: data.report,
          })
          return
        }

        if (!data.ok && data.error === 'PAYMENT_REQUIRED') {
          setDbReportState({
            status: 'payment_required',
            amountTwd: data.amountTwd ?? 100,
          })
          return
        }

        if (!data.ok && data.error === 'AI_CHART_REPORT_INVALID_STATE') {
          setDbReportState({ status: 'invalid_state' })
          return
        }

        if (!data.ok && data.error === 'ai_chart_report_not_found') {
          setDbReportState({ status: 'not_found' })
          return
        }

        setDbReportState({ status: 'error' })
      } catch {
        if (!canceled) {
          setDbReportState({ status: 'error' })
        }
      }
    }

    void loadDbReport()

    return () => {
      canceled = true
    }
  }, [resultId])

  const downloadReport = () => {
    if (!readyDbReport) return

    const content = [
      readyDbReport.title ?? 'AI 命盤分析',
      '',
      readyDbReport.reportContent,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${readyDbReport.title ?? 'ziwei-chart-report'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="section-shell grid max-w-5xl gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-darkGold">紫微命盤分析結果</p>
            <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple md:text-4xl">
              {readyDbReport?.title ?? 'AI 命盤分析'}
            </h1>
            <p className="mt-3 text-textMuted">
              {formatDateTime(readyDbReport?.completedAt ?? readyDbReport?.paidAt) ?? '請確認報告連結與狀態'}
            </p>
          </div>
          {readyDbReport && (
            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-gold bg-white px-5 py-3 font-semibold text-darkGold" onClick={downloadReport} type="button">
              <Download size={18} />
              下載命盤報告
            </button>
          )}
        </div>

        {dbReportState.status === 'loading' && (
          <DbReportStatusCard title="正在讀取報告" body="正在確認這份 AI 命盤分析的付款與報告狀態。" />
        )}

        {dbReportState.status === 'invalid_id' && (
          <DbReportStatusCard title="找不到報告" body="這份 AI 命盤分析連結無效，請回到會員中心查看正式報告。" />
        )}

        {dbReportState.status === 'unauthorized' && (
          <DbReportStatusCard title="請先登入" body="請先登入原購買帳號，再查看這份 AI 命盤分析。" />
        )}

        {dbReportState.status === 'not_found' && (
          <DbReportStatusCard title="找不到報告" body="找不到這份 AI 命盤分析，或你沒有查看權限。" />
        )}

        {dbReportState.status === 'paid_missing_content' && (
          <DbReportStatusCard
            title="分析內容準備中"
            body="付款已完成，AI 命盤分析內容準備中。請稍後重新整理，或聯繫客服協助。"
          />
        )}

        {dbReportState.status === 'payment_required' && (
          <DbReportStatusCard
            title="付款尚未完成"
            body={`這份 AI 命盤分析尚未完成付款。請回到付款流程完成 NT$${dbReportState.amountTwd} 付款。`}
          />
        )}

        {dbReportState.status === 'invalid_state' && (
          <DbReportStatusCard title="目前無法查看" body="這份 AI 命盤分析目前無法查看，請聯繫客服協助。" />
        )}

        {dbReportState.status === 'error' && (
          <DbReportStatusCard title="報告讀取失敗" body="這份 AI 命盤分析暫時無法讀取，請稍後再試或聯繫客服協助。" />
        )}

        {readyDbReport && (
          <article className="rounded-[28px] border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <p className="text-sm font-semibold text-darkGold">{readyDbReport.productName ?? 'AI 命盤分析'}</p>
            <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">正式分析報告</h2>
            <div className="mt-5 whitespace-pre-wrap text-lg leading-8 text-textMuted">{readyDbReport.reportContent}</div>
          </article>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="focus-ring rounded-lg bg-deepPurple px-5 py-3 text-center font-semibold text-white" href="/account">
            回會員中心查看紀錄
          </Link>
          <Link className="focus-ring rounded-lg border border-borderSoft px-5 py-3 text-center font-semibold text-deepPurple" href="/ai-chart">
            新增另一張命盤
          </Link>
        </div>
      </div>
    </section>
  )
}
