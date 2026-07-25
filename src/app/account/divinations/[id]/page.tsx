'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { formatTaipeiDateTime } from '@/lib/date/formatTaipeiDateTime'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'

type AccountDivinationReadingDetail = {
  id: string
  question: string
  cardName: string | null
  position: string | null
  drawMode: string | null
  status: string | null
  createdAt: string | null
  interpretedAt: string | null
  hasInterpretation: boolean
  resultSummary: string | null
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

// interpretation 為 DB 內 JSON；只取白名單內的字串欄位，全部以純文字渲染。
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

export default function AccountDivinationDetailPage() {
  const params = useParams<{ id: string }>()
  const readingId = typeof params?.id === 'string' ? params.id : ''

  const [user, setUser] = useState<UserProfile | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [reading, setReading] = useState<AccountDivinationReadingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    async function loadReading(nextUser: UserProfile | null) {
      requestGenerationRef.current += 1
      const requestGeneration = requestGenerationRef.current
      const requestedReadingId = readingId
      const isCurrentRequest = () =>
        requestGenerationRef.current === requestGeneration &&
        requestedReadingId === readingId &&
        getMockUser()?.id === nextUser?.id

      setIsLoading(true)
      setErrorMessage('')

      if (!nextUser || !requestedReadingId) {
        if (isCurrentRequest()) {
          setReading(null)
          setIsLoading(false)
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

        const response = await fetch(`/api/account/divination-readings/${encodeURIComponent(requestedReadingId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!isCurrentRequest()) return
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          reading?: AccountDivinationReadingDetail
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
          setErrorMessage('讀取占卜紀錄失敗，請稍後再試。')
        }
      } finally {
        if (isCurrentRequest()) setIsLoading(false)
      }
    }

    const sync = () => {
      const nextUser = getMockUser()
      setUser(nextUser)
      setLoginOpen(!nextUser)
      setReading(null)
      void loadReading(nextUser)
    }

    sync()
    const unsubscribe = subscribeAuthChange(sync)
    return () => {
      unsubscribe()
      requestGenerationRef.current += 1
    }
  }, [readingId])

  const finalAnswer = pickText(reading?.interpretation, 'finalAnswer')
  const sections = interpretationSections
    .map((section) => ({ ...section, text: pickText(reading?.interpretation, section.key) }))
    .filter((section) => section.text)

  return (
    <>
      <PageHero eyebrow="會員中心" title="占卜解讀" description="重新查看這一次的抽牌與 AI 解讀內容。" />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid max-w-3xl gap-5">
          <Link
            className="focus-ring w-fit rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple"
            href="/account/divinations"
          >
            ← 返回我的占卜紀錄
          </Link>

          {!user ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">
              請先登入會員查看占卜紀錄。
            </div>
          ) : isLoading ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">
              正在讀取解讀內容...
            </div>
          ) : !reading ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">
              {errorMessage || '找不到這筆占卜紀錄。'}
            </div>
          ) : (
            <>
              <div className="grid gap-2 rounded-2xl border border-borderSoft bg-softPurple p-6">
                <p className="text-sm font-semibold text-darkGold">本次問題</p>
                <p className="font-semibold leading-7 text-textDark">{reading.question}</p>
                <div className="mt-2 grid gap-1 text-sm text-textMuted">
                  {reading.cardName ? (
                    <p>
                      抽到的牌：{reading.cardName}
                      {reading.position ? `（${positionLabels[reading.position] ?? reading.position}）` : ''}
                    </p>
                  ) : null}
                  {reading.drawMode ? (
                    <p>抽牌方式：{drawModeLabels[reading.drawMode] ?? reading.drawMode}</p>
                  ) : null}
                  <p>建立時間：{formatTaipeiDateTime(reading.createdAt)}</p>
                  <p>解讀完成時間：{formatTaipeiDateTime(reading.interpretedAt)}</p>
                </div>
              </div>

              {reading.status !== 'completed' ? (
                <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
                  這筆占卜還沒有完成的解讀內容。
                </div>
              ) : finalAnswer ? (
                <div className="grid gap-3 rounded-2xl border border-borderSoft bg-white p-6 leading-8 shadow-soft">
                  <p className="font-semibold text-deepPurple">完整解讀</p>
                  <div className="whitespace-pre-line text-textDark">{finalAnswer}</div>
                </div>
              ) : sections.length > 0 ? (
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
              ) : (
                <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
                  解讀內容格式無法顯示，請聯繫客服協助。
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
