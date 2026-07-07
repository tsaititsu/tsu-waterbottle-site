'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ActionButton } from './ActionButton'
import { saveAiChartPaymentSession } from '@/lib/ai-chart/paymentSession'
import { savePendingChartInput } from '@/lib/mockPayment'
import { createZiweiGptPayload, type ChartInput, type ZiweiGptPayload } from '@/features/ziwei-chart/package'
import { OriginalZiweiChartView } from '@/features/ziwei-chart/components/OriginalZiweiChartView'

const CHART_SESSION_STORAGE_KEY = 'waterbottle-chart-current-session'
const CHART_NOTES_STORAGE_KEY = 'waterbottle-chart-notes'
const TIME_OPTION_COUNT = 13

const selectedPlan = {
  title: '紫微命盤完整分析｜完整解析命盤個性分析',
  amount: 100
}
const AI_CHART_REPORT_TITLE = 'AI 命盤分析'
const AI_CHART_REPORT_PRODUCT_NAME = 'AI 命盤分析'
const isNewebPayCheckoutEnabled = process.env.NEXT_PUBLIC_ENABLE_NEWEBPAY === 'true'

type ChartSession = {
  input: ChartInput
  chartId: string
  selectedCategory: string
  birthOrder?: string
}

type CreateAiChartReportResponse =
  | {
      ok: true
      reportId: string
      paymentStatus: 'pending'
      amountTwd: number
    }
  | {
      ok: false
      error: string
    }

function chartId(input: ChartInput) {
  return `${input.name || '未命名'}-${input.solarDate}-${input.timeIndex}-${input.gender}`
}

function adjustSolarDate(solarDate: string, offsetDays: number) {
  const [year, month, day] = solarDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseChartSession(raw: string | null): ChartSession | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<ChartSession>
    if (!parsed.input || typeof parsed.input.solarDate !== 'string') return null
    if (typeof parsed.input.timeIndex !== 'number') return null
    if (parsed.input.gender !== 'male' && parsed.input.gender !== 'female') return null

    return {
      input: parsed.input,
      chartId: parsed.chartId || chartId(parsed.input),
      selectedCategory: parsed.selectedCategory || '自己',
      birthOrder: parsed.birthOrder || ''
    }
  } catch {
    return null
  }
}

export function ChartResultSessionView() {
  const router = useRouter()
  const [session, setSession] = useState<ChartSession | null>(null)
  const [chartInput, setChartInput] = useState<ChartInput | null>(null)
  const [chartPayload, setChartPayload] = useState<ZiweiGptPayload | null>(null)
  const [notesByChartId, setNotesByChartId] = useState<Record<string, string>>({})
  const [hasLoadedChartNotes, setHasLoadedChartNotes] = useState(false)
  const [hasAcceptedPaidNotice, setHasAcceptedPaidNotice] = useState(false)
  const [formError, setFormError] = useState('')
  const [paymentSetupMessage, setPaymentSetupMessage] = useState('')
  const [isCreatingPendingReport, setIsCreatingPendingReport] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const nextSession = parseChartSession(window.sessionStorage.getItem(CHART_SESSION_STORAGE_KEY))
    if (!nextSession) {
      setLoadError('尚未產生命盤，請先回到新增命盤頁。')
      return
    }

    try {
      setSession(nextSession)
      setChartInput(nextSession.input)
      setChartPayload(createZiweiGptPayload(nextSession.input))
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? `命盤產生失敗：${error.message}` : '命盤產生失敗，請重新新增命盤。')
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHART_NOTES_STORAGE_KEY)
      if (raw) setNotesByChartId(JSON.parse(raw) as Record<string, string>)
    } catch {
      window.localStorage.removeItem(CHART_NOTES_STORAGE_KEY)
    } finally {
      setHasLoadedChartNotes(true)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedChartNotes) return
    window.localStorage.setItem(CHART_NOTES_STORAGE_KEY, JSON.stringify(notesByChartId))
  }, [hasLoadedChartNotes, notesByChartId])

  const persistSession = (nextInput: ChartInput) => {
    const nextSession: ChartSession = {
      input: nextInput,
      chartId: chartId(nextInput),
      selectedCategory: session?.selectedCategory || '自己',
      birthOrder: session?.birthOrder || ''
    }
    window.sessionStorage.setItem(CHART_SESSION_STORAGE_KEY, JSON.stringify(nextSession))
    setSession(nextSession)
  }

  const shiftChartTime = (direction: -1 | 1) => {
    if (!chartInput) return

    const baseTimeIndex = chartInput.timeIndex
    const nextTimeIndex = (baseTimeIndex + direction + TIME_OPTION_COUNT) % TIME_OPTION_COUNT
    const nextSolarDate = direction === -1 && baseTimeIndex === 0
      ? adjustSolarDate(chartInput.solarDate, -1)
      : direction === 1 && baseTimeIndex === TIME_OPTION_COUNT - 1
        ? adjustSolarDate(chartInput.solarDate, 1)
        : chartInput.solarDate
    const nextInput: ChartInput = {
      ...chartInput,
      solarDate: nextSolarDate,
      timeIndex: nextTimeIndex
    }

    try {
      setChartPayload(createZiweiGptPayload(nextInput))
      setChartInput(nextInput)
      persistSession(nextInput)
      setFormError('')
      setPaymentSetupMessage('')
    } catch (error) {
      setFormError(error instanceof Error ? `命盤產生失敗：${error.message}` : '命盤產生失敗，請確認資料後再試一次。')
    }
  }

  const currentChartId = chartInput ? chartId(chartInput) : ''
  const currentChartNotes = currentChartId ? notesByChartId[currentChartId] ?? '' : undefined

  const saveChartNotes = (text: string) => {
    if (!currentChartId) return
    const value = text.trim()
    setNotesByChartId((current) => {
      const next = { ...current }
      if (value) next[currentChartId] = value
      else delete next[currentChartId]
      return next
    })
  }

  const validatePaidInterpretationReadiness = () => {
    if (!chartInput || !chartPayload || !session) {
      setFormError('請先回到新增命盤頁產生命盤，再進行付款。')
      setPaymentSetupMessage('')
      return false
    }
    if (!hasAcceptedPaidNotice) {
      setFormError('請先閱讀並勾選同意 AI 命盤分析服務說明、付款與退款規則及服務條款。')
      setPaymentSetupMessage('')
      return false
    }

    return true
  }

  const preparePaidInterpretation = () => {
    if (!validatePaidInterpretationReadiness() || !chartInput || !session) {
      return false
    }

    savePendingChartInput({
      ...chartInput,
      category: session.selectedCategory,
      birthOrder: session.birthOrder,
      analysisTitle: selectedPlan.title
    })
    setPaymentSetupMessage('')
    setFormError('')
    return true
  }

  const createPendingReportForCheckout = async () => {
    if (!validatePaidInterpretationReadiness()) {
      return
    }

    setIsCreatingPendingReport(true)
    setFormError('')
    setPaymentSetupMessage('')

    try {
      const response = await fetch('/api/ai-chart/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: AI_CHART_REPORT_TITLE,
          productName: AI_CHART_REPORT_PRODUCT_NAME,
          amountTwd: selectedPlan.amount
        })
      })
      const data = (await response.json().catch(() => null)) as CreateAiChartReportResponse | null

      if (!response.ok || !data?.ok || data.paymentStatus !== 'pending' || data.amountTwd !== selectedPlan.amount) {
        throw new Error(data && !data.ok ? data.error : 'ai_chart_report_create_failed')
      }

      saveAiChartPaymentSession({
        reportId: data.reportId,
        amountTwd: selectedPlan.amount,
        returnPath: `/ai-chart/result/${data.reportId}`
      })
      setPaymentSetupMessage('付款資料已建立，下一步將前往線上付款。')
      setFormError('')
    } catch {
      setFormError('付款資料建立失敗，請稍後再試。')
      setPaymentSetupMessage('')
    } finally {
      setIsCreatingPendingReport(false)
    }
  }

  const goBackToForm = () => {
    router.push(`/ai-chart?reset=${Date.now()}`)
  }

  if (loadError || !chartPayload) {
    return (
      <div className="rounded-2xl border border-borderSoft bg-white p-6 text-center shadow-soft">
        <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">尚未產生命盤</h2>
        <p className="mt-3 text-textMuted">{loadError || '請先回到新增命盤頁。'}</p>
        <Link className="focus-ring mt-5 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white" href="/ai-chart?reset=1">
          回到新增命盤頁
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="chart-workspace grid gap-4 rounded-[24px] border border-borderSoft bg-softPurple p-3 shadow-soft md:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">完整命盤</h2>
            <p className="mt-1 text-sm text-textMuted">命盤已產生，可以先確認命盤，再決定是否購買完整分析。</p>
          </div>
          <div className="flex flex-col gap-2 text-sm font-semibold text-darkGold md:items-end">
            <p>陽曆 {chartPayload.chart.birthInfo.solarDate}</p>
            <button className="focus-ring rounded-lg border border-lightGold bg-white px-4 py-2 text-deepPurple" onClick={goBackToForm} type="button">
              返回新增命盤
            </button>
          </div>
        </div>

        <div className="rounded-[18px] border border-white/70 bg-white/70 p-1 md:p-2">
          <OriginalZiweiChartView
            chart={chartPayload.chart}
            chartId={currentChartId}
            notes={currentChartNotes}
            onSaveNotes={saveChartNotes}
            onNextTime={() => shiftChartTime(1)}
            onPrevTime={() => shiftChartTime(-1)}
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-borderSoft bg-softPurple/55 p-4">
        <div>
          <p className="font-serifTC text-lg font-semibold text-deepPurple">AI 命盤分析同意確認</p>
          <p className="mt-1 text-sm text-textMuted">紫微命盤完整分析｜NT${selectedPlan.amount} / 份</p>
        </div>

        <details className="group rounded-xl border border-borderSoft bg-white p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-start gap-3 text-sm leading-7 text-textMuted">
              <input
                checked={hasAcceptedPaidNotice}
                className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
                onChange={(event) => {
                  setHasAcceptedPaidNotice(event.target.checked)
                  if (event.target.checked) setFormError('')
                  setPaymentSetupMessage('')
                }}
                onClick={(event) => event.stopPropagation()}
                type="checkbox"
              />
              <span>
                我已詳細閱讀並同意《AI 命盤分析服務說明》、《付款與退款規則》及《服務條款》，並了解此服務為付款後產生命盤分析結果之數位內容服務。
                <span className="ml-1 font-semibold text-darkGold underline underline-offset-4 group-open:hidden">點我查看</span>
                <span className="ml-1 hidden font-semibold text-darkGold underline underline-offset-4 group-open:inline">收合內容</span>
              </span>
            </div>
          </summary>

          <div className="mt-4 max-h-72 space-y-5 overflow-y-auto rounded-lg bg-softPurple/60 p-4 text-sm leading-7 text-textMuted">
            <div>
              <p className="font-semibold text-deepPurple">AI 命盤分析服務說明</p>
              <ul className="mt-2 grid gap-1">
                <li>服務名稱：紫微命盤完整分析</li>
                <li>價格：NT$100 / 份</li>
                <li>服務內容：完整解析命盤個性分析</li>
                <li>交付方式：付款後於網站產生命盤分析結果</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-deepPurple">付款與退款規則</p>
              <ul className="mt-2 grid gap-2">
                <li>本服務為數位內容服務。</li>
                <li>使用者完成付款後，系統會依照使用者填寫的出生資料產生命盤分析結果。</li>
                <li>付款完成並產生分析結果後，因服務已開始提供，原則上不接受取消或退款。</li>
                <li>若因系統異常導致付款成功但沒有產生分析結果，可聯繫水瓶先生官方 LINE 協助處理。</li>
                <li>若使用者填錯出生資料、日期、時間、性別或其他欄位，導致分析結果不符合期待，恕不提供退款。</li>
                <li>使用者送出付款前，應自行確認填寫資料正確。</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-deepPurple">服務條款</p>
              <ul className="mt-2 grid gap-2">
                <li>AI 命盤分析內容僅供命理參考，不作為醫療、法律、投資、重大人生決策之唯一依據。</li>
                <li>使用者應自行判斷與承擔實際行動結果。</li>
                <li>若有命盤資料、付款或系統問題，可聯繫水瓶先生官方 LINE。</li>
              </ul>
            </div>
          </div>
        </details>

        {formError && <p className="text-sm font-semibold text-deepPurple">{formError}</p>}
        {paymentSetupMessage && <p className="text-sm font-semibold text-darkGold">{paymentSetupMessage}</p>}

        {isNewebPayCheckoutEnabled ? (
          <button
            className="focus-ring inline-flex w-full justify-center rounded-xl bg-deepPurple px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            disabled={isCreatingPendingReport}
            onClick={() => void createPendingReportForCheckout()}
            type="button"
          >
            {isCreatingPendingReport ? '建立付款資料中...' : `前往付款 NT$${selectedPlan.amount}`}
          </button>
        ) : (
          <ActionButton
            amount={selectedPlan.amount}
            className="focus-ring inline-flex w-full justify-center rounded-xl bg-deepPurple px-5 py-3 font-semibold text-white sm:w-auto"
            itemName={selectedPlan.title}
            itemType="ai-chart"
            beforeStart={preparePaidInterpretation}
          >
            前往付款 NT${selectedPlan.amount}
          </ActionButton>
        )}
      </div>
    </div>
  )
}
