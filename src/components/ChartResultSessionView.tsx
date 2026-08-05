'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionButton } from './ActionButton'
import { LoginModal } from './LoginModal'
import { LinePayEntryOneDollarTestButton } from './payments/LinePayEntryOneDollarTestButton'
import { PaymentMethodSelector } from './payments/PaymentMethodSelector'
import { useLinePayEntryOneDollarTest } from './payments/useLinePayEntryOneDollarTest'
import { createAsyncIdentityGuard } from '@/lib/auth/asyncIdentityGuard'
import {
  getAiChartDraftNotes,
  getAiChartDraftSession,
  setAiChartDraftNotes,
  setAiChartDraftSession,
  type AiChartDraftSession,
} from '@/lib/ai-chart/chartDraftMemory'
import { saveAiChartPaymentSession } from '@/lib/ai-chart/paymentSession'
import { getAuthAccessToken, getMockUser, subscribeAuthChange } from '@/lib/mockAuth'
import {
  getCheckoutPaymentMethodOptions,
  isLinePayCheckoutMethod,
  toStandardNewebPayCheckoutMode,
  type StandardCheckoutPaymentMethod,
} from '@/lib/payments/paymentMethods'
import {
  getServiceLinePayErrorMessage,
  requestServiceLinePayCheckout,
} from '@/lib/linePay/serviceCheckoutClient'
import { buildNewebPayClientFormFields } from '@/lib/newebpay/clientForm'
import { createZiweiGptPayload, type ChartInput, type ZiweiGptPayload } from '@/features/ziwei-chart/package'
import { OriginalZiweiChartView } from '@/features/ziwei-chart/components/OriginalZiweiChartView'

const TIME_OPTION_COUNT = 13

const selectedPlan = {
  title: '紫微命盤完整分析｜完整解析命盤個性分析',
  amount: 100
}
const AI_CHART_REPORT_TITLE = 'AI 命盤分析'
const AI_CHART_REPORT_PRODUCT_NAME = 'AI 命盤分析'
const isAiChartNewebPayCheckoutEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_CHART_NEWEBPAY === 'true'
const isLinePayCheckoutEnabled = process.env.NEXT_PUBLIC_ENABLE_LINE_PAY === 'true'
const isAiChartDirectCheckoutEnabled =
  isAiChartNewebPayCheckoutEnabled || isLinePayCheckoutEnabled

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

type CreateAiChartNewebPayPaymentResponse =
  | {
      ok: true
      merchantOrderNo: string
      amount: number
      action: string
      fields: unknown
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

function submitNewebPayForm(input: {
  action: string
  fields: Array<{ name: string; value: string }>
}) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = input.action
  form.style.display = 'none'

  for (const field of input.fields) {
    const element = document.createElement('input')
    element.type = 'hidden'
    element.name = field.name
    element.value = field.value
    form.appendChild(element)
  }

  document.body.appendChild(form)
  form.submit()
}

export function ChartResultSessionView() {
  const router = useRouter()
  const isLinePayEntryOneDollarTestAvailable =
    useLinePayEntryOneDollarTest()
  const [session, setSession] = useState<AiChartDraftSession | null>(null)
  const [chartInput, setChartInput] = useState<ChartInput | null>(null)
  const [chartPayload, setChartPayload] = useState<ZiweiGptPayload | null>(null)
  const [notesByChartId, setNotesByChartId] = useState<Record<string, string>>({})
  const [hasAcceptedPaidNotice, setHasAcceptedPaidNotice] = useState(false)
  const [formError, setFormError] = useState('')
  const [paymentSetupMessage, setPaymentSetupMessage] = useState('')
  const [isCreatingPendingReport, setIsCreatingPendingReport] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<StandardCheckoutPaymentMethod>(() =>
      isAiChartNewebPayCheckoutEnabled ? 'credit_card' : 'line_pay',
    )
  const [loginOpen, setLoginOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const checkoutInFlightRef = useRef(false)
  const pendingCheckoutOptionsRef =
    useRef<{ adminOneDollarTest?: boolean }>({})
  const checkoutResourceKey = useMemo(
    () =>
      JSON.stringify({
        accepted: hasAcceptedPaidNotice,
        input: chartInput,
        paymentMethod: selectedPaymentMethod,
      }),
    [chartInput, hasAcceptedPaidNotice, selectedPaymentMethod],
  )
  const checkoutResourceKeyRef = useRef(checkoutResourceKey)
  const [checkoutGuard] = useState(() => createAsyncIdentityGuard())

  useEffect(() => {
    if (checkoutResourceKeyRef.current !== checkoutResourceKey) {
      checkoutResourceKeyRef.current = checkoutResourceKey
      checkoutGuard.invalidate()
    }
  }, [checkoutGuard, checkoutResourceKey])

  useEffect(() => {
    const nextSession = getAiChartDraftSession()
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
    setNotesByChartId(getAiChartDraftNotes())
  }, [])

  useEffect(() => {
    setAiChartDraftNotes(notesByChartId)
  }, [notesByChartId])

  useEffect(() => {
    const unsubscribeAuth = subscribeAuthChange(() => {
      checkoutGuard.invalidate()
      setPaymentSetupMessage('')
    })
    return () => {
      unsubscribeAuth()
      checkoutGuard.invalidate()
    }
  }, [checkoutGuard])

  const persistSession = (nextInput: ChartInput) => {
    const nextSession: AiChartDraftSession = {
      input: nextInput,
      chartId: chartId(nextInput),
      selectedCategory: session?.selectedCategory || '自己',
      birthOrder: session?.birthOrder || ''
    }
    setAiChartDraftSession(nextSession)
    setSession(nextSession)
  }

  const shiftChartTime = (direction: -1 | 1) => {
    if (!chartInput) return
    checkoutGuard.invalidate()

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
    if (!validatePaidInterpretationReadiness()) {
      return false
    }

    setPaymentSetupMessage('')
    setFormError('')
    return true
  }

  const createPendingReportForCheckout = async (
    options: { adminOneDollarTest?: boolean } = {},
  ) => {
    const adminOneDollarTest = options.adminOneDollarTest === true
    if (checkoutInFlightRef.current) {
      return
    }
    pendingCheckoutOptionsRef.current = adminOneDollarTest
      ? { adminOneDollarTest: true }
      : {}
    if (!validatePaidInterpretationReadiness()) {
      return
    }
    if (!chartInput) {
      return
    }

    checkoutInFlightRef.current = true
    const currentIdentity = () => ({
      resourceKey: checkoutResourceKeyRef.current,
      subjectId: getMockUser()?.id ?? null,
    })
    const requestToken = checkoutGuard.begin(currentIdentity())
    if (!requestToken) {
      checkoutInFlightRef.current = false
      setLoginOpen(true)
      return
    }
    const requestChartInput = { ...chartInput }
    const isCurrentRequest = () =>
      checkoutGuard.isCurrent(requestToken, currentIdentity())
    setIsCreatingPendingReport(true)
    setFormError('')
    setPaymentSetupMessage('')

    try {
      const accessToken = await getAuthAccessToken()
      if (!isCurrentRequest()) {
        return
      }
      if (!accessToken) {
        setLoginOpen(true)
        return
      }

      const reportResponse = await fetch('/api/ai-chart/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: AI_CHART_REPORT_TITLE,
          productName: AI_CHART_REPORT_PRODUCT_NAME,
          amountTwd: selectedPlan.amount,
          birthInput: {
            solarDate: requestChartInput.solarDate,
            timeIndex: requestChartInput.timeIndex,
            gender: requestChartInput.gender,
            ...(requestChartInput.name ? { name: requestChartInput.name } : {}),
            ...(typeof requestChartInput.fixLeap === 'boolean'
              ? { fixLeap: requestChartInput.fixLeap }
              : {})
          }
        })
      })
      const reportData = (await reportResponse.json().catch(() => null)) as CreateAiChartReportResponse | null
      if (!isCurrentRequest()) {
        return
      }

      if (
        !reportResponse.ok ||
        !reportData?.ok ||
        reportData.paymentStatus !== 'pending' ||
        reportData.amountTwd !== selectedPlan.amount
      ) {
        throw new Error(reportData && !reportData.ok ? reportData.error : 'ai_chart_report_create_failed')
      }

      const reportId = reportData.reportId

      if (
        adminOneDollarTest
        || isLinePayCheckoutMethod(selectedPaymentMethod)
      ) {
        const linePayResult = await requestServiceLinePayCheckout({
          accessToken,
          source: 'ai_chart_report',
          sourceId: reportId,
          idempotencyKey: `ai-chart-line-pay:${reportId}`,
          ...(adminOneDollarTest ? { adminOneDollarTest: true } : {}),
        })
        if (!isCurrentRequest()) return
        if (!linePayResult.ok) {
          setFormError(getServiceLinePayErrorMessage(linePayResult))
          setPaymentSetupMessage('')
          return
        }
        setPaymentSetupMessage('正在前往 LINE Pay。')
        window.location.assign(linePayResult.paymentUrlWeb)
        return
      }

      const paymentResponse = await fetch('/api/payments/newebpay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          itemKey: 'ai_chart_report_single',
          source: 'ai_chart_report',
          paymentMode: toStandardNewebPayCheckoutMode(selectedPaymentMethod),
          reportId
        })
      })
      const paymentData = (await paymentResponse.json().catch(() => null)) as CreateAiChartNewebPayPaymentResponse | null
      if (!isCurrentRequest()) {
        return
      }

      if (!paymentResponse.ok || !paymentData?.ok) {
        const error = paymentData && !paymentData.ok ? paymentData.error : 'ai_chart_payment_create_failed'
        if (error === 'ai_chart_report_already_linked' || error === 'ai_chart_report_not_payable') {
          setFormError('這筆命盤分析已建立付款資料，請回到付款頁完成付款，或重新開始一筆分析。')
        } else {
          setFormError('線上付款資料建立失敗，請稍後再試。')
        }
        setPaymentSetupMessage('')
        return
      }

      if (
        typeof paymentData.action !== 'string' ||
        paymentData.action.trim().length === 0 ||
        typeof paymentData.merchantOrderNo !== 'string' ||
        paymentData.merchantOrderNo.trim().length === 0 ||
        paymentData.amount !== selectedPlan.amount
      ) {
        setFormError('線上付款資料建立失敗，請稍後再試。')
        setPaymentSetupMessage('')
        return
      }

      const formFields = buildNewebPayClientFormFields(paymentData.fields)

      if (!formFields.ok) {
        setFormError('線上付款資料建立失敗，請稍後再試。')
        setPaymentSetupMessage('')
        return
      }

      if (!isCurrentRequest()) return
      saveAiChartPaymentSession({
        reportId,
        merchantOrderNo: paymentData.merchantOrderNo,
        amountTwd: selectedPlan.amount,
        returnPath: `/ai-chart/result/${reportId}`
      })
      setPaymentSetupMessage('正在前往線上付款。')
      setFormError('')
      if (!isCurrentRequest()) return
      submitNewebPayForm({
        action: paymentData.action,
        fields: formFields.fields
      })
    } catch {
      if (isCurrentRequest()) {
        setFormError('付款資料建立失敗，請稍後再試。')
        setPaymentSetupMessage('')
      }
    } finally {
      checkoutInFlightRef.current = false
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
            <p className="mt-1 text-xs text-textMuted">私人命盤只保留在目前分頁記憶體；重新整理或切換帳號後需重新輸入。</p>
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
                  checkoutGuard.invalidate()
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

        {formError && <p aria-live="polite" className="text-sm font-semibold text-deepPurple">{formError}</p>}
        {paymentSetupMessage && <p aria-live="polite" className="text-sm font-semibold text-darkGold">{paymentSetupMessage}</p>}

        <PaymentMethodSelector
          disabled={isCreatingPendingReport}
          onChange={(method) => {
            if (method === 'credit_card_installment_3' || method === 'credit_card_installment_6') return
            checkoutGuard.invalidate()
            setSelectedPaymentMethod(method)
            setFormError('')
            setPaymentSetupMessage('')
          }}
          options={getCheckoutPaymentMethodOptions({
            includeLinePay: isLinePayCheckoutEnabled,
            includeNewebPay: isAiChartNewebPayCheckoutEnabled,
          })}
          value={selectedPaymentMethod}
        />

        {isAiChartDirectCheckoutEnabled ? (
          <div className="flex flex-wrap gap-3">
            <button
              className="focus-ring inline-flex w-full justify-center rounded-xl bg-deepPurple px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              disabled={isCreatingPendingReport}
              onClick={() => void createPendingReportForCheckout()}
              type="button"
            >
              {isCreatingPendingReport
                ? '建立付款資料中...'
                : `使用所選方式付款 NT$${selectedPlan.amount}`}
            </button>
            <LinePayEntryOneDollarTestButton
              available={isLinePayEntryOneDollarTestAvailable}
              disabled={isCreatingPendingReport || !hasAcceptedPaidNotice}
              onClick={() => void createPendingReportForCheckout({
                adminOneDollarTest: true,
              })}
            />
          </div>
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
      <LoginModal
        open={loginOpen}
        onClose={() => {
          pendingCheckoutOptionsRef.current = {}
          setLoginOpen(false)
        }}
        onSuccess={() => {
          const pendingOptions = pendingCheckoutOptionsRef.current
          pendingCheckoutOptionsRef.current = {}
          setLoginOpen(false)
          void createPendingReportForCheckout(pendingOptions)
        }}
      />
    </div>
  )
}
