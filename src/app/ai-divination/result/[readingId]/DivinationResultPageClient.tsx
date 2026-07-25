'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { formatTaipeiDateTime } from '@/lib/date/formatTaipeiDateTime'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'

type DivinationResultReading = {
  id: string
  question: string
  cardName: string | null
  position: string | null
  drawMode: string | null
  status: string | null
  createdAt: string | null
  interpretedAt: string | null
  interpretation: unknown | null
}

const positionLabels: Record<string, string> = {
  upright: '正位',
  reversed: '反位',
}

const drawModeLabels: Record<string, string> = {
  manual: '手動抽牌',
  auto: '自動抽牌',
}

const interpretationSections: Array<{ key: string; title: string }> = [
  { key: 'summary', title: '牌卡解讀' },
  { key: 'cardMessage', title: '牌卡訊息' },
  { key: 'situationAnalysis', title: '目前狀態' },
  { key: 'advice', title: '使用建議' },
  { key: 'reminder', title: '溫和提醒' },
]

function pickText(source: unknown, key: string): string {
  if (!source || typeof source !== 'object') return ''
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function getStatusMessage(status: string | null) {
  if (status === 'pending_payment') return '正在確認付款結果'
  if (status === 'paid') return '付款完成，正在產生解讀'
  if (status === 'interpreting') return '正在產生解讀，請稍候'
  if (status === 'completed') return '解讀已完成'
  if (status === 'failed') return '付款已完成，但解讀暫時未完成，請聯繫客服'
  return '正在讀取占卜結果'
}

export function DivinationResultPageClient() {
  const params = useParams<{ readingId: string }>()
  const searchParams = useSearchParams()
  const readingId = typeof params?.readingId === 'string' ? params.readingId : ''
  const paymentStatus = searchParams.get('payment')

  const [user, setUser] = useState<UserProfile | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [reading, setReading] = useState<DivinationResultReading | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const resumeStartedRef = useRef('')
  const requestGenerationRef = useRef(0)
  const resumeGenerationRef = useRef(0)
  const activeReadingIdRef = useRef('')
  const activeUserIdRef = useRef<string | null>(null)

  async function loadReading(
    expectedUser: UserProfile | null,
    expectedReadingId: string,
    options: { quiet?: boolean } = {},
  ) {
    requestGenerationRef.current += 1
    const requestGeneration = requestGenerationRef.current
    const isCurrentRequest = () =>
      requestGenerationRef.current === requestGeneration &&
      activeReadingIdRef.current === expectedReadingId &&
      activeUserIdRef.current === expectedUser?.id &&
      getMockUser()?.id === expectedUser?.id

    if (!options.quiet) {
      setIsLoading(true)
      setErrorMessage('')
    }

    if (!expectedUser || !expectedReadingId) {
      if (isCurrentRequest()) {
        setReading(null)
        if (!options.quiet) setIsLoading(false)
      }
      return
    }

    try {
      const accessToken = await getAuthAccessToken()
      if (!isCurrentRequest()) return

      if (!accessToken) {
        setReading(null)
        return
      }

      const response = await fetch(`/api/account/divination-readings/${encodeURIComponent(expectedReadingId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!isCurrentRequest()) return
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        reading?: DivinationResultReading
        message?: string
      }
      if (!isCurrentRequest()) return

      if (!response.ok || data.ok === false || !data.reading) {
        setReading(null)
        setErrorMessage(data.message || '找不到這筆占卜紀錄。')
        return
      }

      setReading(data.reading)
    } catch {
      if (isCurrentRequest()) {
        setReading(null)
        setErrorMessage('讀取占卜結果失敗，請稍後再試。')
      }
    } finally {
      if (!options.quiet && isCurrentRequest()) setIsLoading(false)
    }
  }

  async function resumeInterpretation(
    expectedUser: UserProfile | null,
    expectedReadingId: string,
  ) {
    if (
      !expectedUser ||
      !expectedReadingId ||
      resumeStartedRef.current === expectedReadingId
    ) return

    resumeGenerationRef.current += 1
    const resumeGeneration = resumeGenerationRef.current
    const isCurrentResume = () =>
      resumeGenerationRef.current === resumeGeneration &&
      activeReadingIdRef.current === expectedReadingId &&
      activeUserIdRef.current === expectedUser.id &&
      getMockUser()?.id === expectedUser.id

    resumeStartedRef.current = expectedReadingId
    setIsInterpreting(true)
    setErrorMessage('')

    try {
      const accessToken = await getAuthAccessToken()
      if (!isCurrentResume()) return
      if (!accessToken) return

      const response = await fetch('/api/divination/interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          readingId: expectedReadingId,
          resumeFromDb: true,
        }),
      })
      if (!isCurrentResume()) return
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!isCurrentResume()) return

      if (!response.ok || data.ok === false) {
        if (data.error === 'DIVINATION_READING_INTERPRETING' || data.error === 'PAYMENT_PENDING') {
          return
        }

        setErrorMessage(data.message || '付款已完成，但解讀暫時未完成，請聯繫客服。')
        return
      }

      await loadReading(expectedUser, expectedReadingId, { quiet: true })
    } catch {
      if (isCurrentResume()) {
        setErrorMessage('付款已完成，但解讀暫時未完成，請聯繫客服。')
      }
    } finally {
      if (isCurrentResume()) setIsInterpreting(false)
    }
  }

  useEffect(() => {
    const sync = () => {
      const nextUser = getMockUser()
      requestGenerationRef.current += 1
      resumeGenerationRef.current += 1
      activeReadingIdRef.current = readingId
      activeUserIdRef.current = nextUser?.id ?? null
      resumeStartedRef.current = ''
      setUser(nextUser)
      setLoginOpen(!nextUser)
      setReading(null)
      setIsInterpreting(false)
      void loadReading(nextUser, readingId)
    }

    sync()
    const unsubscribe = subscribeAuthChange(sync)
    return () => {
      requestGenerationRef.current += 1
      resumeGenerationRef.current += 1
      activeReadingIdRef.current = ''
      activeUserIdRef.current = null
      unsubscribe()
    }
  }, [readingId])

  useEffect(() => {
    if (!reading || reading.status === 'completed' || reading.status === 'failed') return

    if (reading.status === 'paid') {
      void resumeInterpretation(user, readingId)
    }

    const timer = window.setTimeout(() => {
      void loadReading(user, readingId, { quiet: true })
    }, reading.status === 'pending_payment' ? 3000 : 2500)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading?.status, readingId])

  const finalAnswer = pickText(reading?.interpretation, 'finalAnswer')
  const sections = interpretationSections
    .map((section) => ({ ...section, text: pickText(reading?.interpretation, section.key) }))
    .filter((section) => section.text)

  return (
    <>
      <section className="bg-softPurple py-12 md:py-16">
        <div className="section-shell grid max-w-3xl gap-5">
          <div className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">紫微牌卡占卜</p>
            <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">本次占卜解讀</h1>
            <p className="mt-3 leading-7 text-textMuted">
              付款完成後會回到這個本次解讀頁。會員紀錄是日後再次觀看入口，不是付款完成當下的主要 landing page。
            </p>
          </div>

          {paymentStatus === 'success' ? (
            <div className="rounded-2xl border border-darkGold/20 bg-lightGold/50 p-4 font-semibold text-darkGold">
              付款導回成功，正在確認本次占卜狀態。
            </div>
          ) : null}

          {!user ? (
            <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
              請先登入會員查看本次占卜結果。
            </div>
          ) : isLoading ? (
            <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
              正在讀取占卜結果...
            </div>
          ) : !reading ? (
            <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
              {errorMessage || '找不到這筆占卜紀錄。'}
            </div>
          ) : (
            <>
              <div className="grid gap-3 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
                <p className="rounded-full bg-softPurple px-4 py-2 text-sm font-semibold text-deepPurple">
                  {isInterpreting ? '付款完成，正在產生解讀' : getStatusMessage(reading.status)}
                </p>
                <div className="grid gap-2 leading-7 text-textMuted">
                  <p className="font-semibold text-textDark">{reading.question}</p>
                  {reading.cardName ? (
                    <p>
                      抽到的牌：{reading.cardName}
                      {reading.position ? `（${positionLabels[reading.position] ?? reading.position}）` : ''}
                    </p>
                  ) : (
                    <p>抽到的牌：資料確認中</p>
                  )}
                  {reading.drawMode ? (
                    <p>抽牌方式：{drawModeLabels[reading.drawMode] ?? reading.drawMode}</p>
                  ) : null}
                  <p>建立時間：{formatTaipeiDateTime(reading.createdAt)}</p>
                  {reading.interpretedAt ? <p>解讀完成時間：{formatTaipeiDateTime(reading.interpretedAt)}</p> : null}
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              {reading.status === 'completed' && finalAnswer ? (
                <div className="grid gap-3 rounded-2xl border border-borderSoft bg-white p-6 leading-8 shadow-soft">
                  <p className="font-semibold text-deepPurple">完整解讀</p>
                  <div className="whitespace-pre-line text-textDark">{finalAnswer}</div>
                </div>
              ) : reading.status === 'completed' && sections.length > 0 ? (
                <div className="grid gap-3">
                  {sections.map((section) => (
                    <div
                      key={section.key}
                      className="grid gap-2 rounded-2xl border border-borderSoft bg-white p-5 leading-7 shadow-soft"
                    >
                      <p className="font-semibold text-deepPurple">{section.title}</p>
                      <p className="whitespace-pre-line text-textDark">{section.text}</p>
                    </div>
                  ))}
                </div>
              ) : reading.status === 'pending_payment' ? (
                <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
                  正在確認付款結果，請不要重新抽牌或重新付款。系統會自動更新狀態。
                </div>
              ) : reading.status === 'failed' ? (
                <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
                  付款已完成，但解讀暫時未完成，請聯繫客服協助。請不要再次付款。
                </div>
              ) : (
                <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
                  正在產生解讀，請稍候。重新整理頁面仍會回到這筆占卜。
                </div>
              )}

              <Link
                className="focus-ring w-fit rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple"
                href="/account/divinations"
              >
                前往我的占卜紀錄
              </Link>
            </>
          )}
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
