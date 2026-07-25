'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { formatTaipeiDateTime } from '@/lib/date/formatTaipeiDateTime'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'
import { DivinationReadingAction } from './DivinationReadingAction'

type AccountDivinationReading = {
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
}

const statusLabels: Record<string, string> = {
  pending_payment: '待付款',
  paid: '付款完成，等待解讀',
  interpreting: '解讀產生中',
  completed: '解讀完成',
  failed: '解讀暫時未完成',
  canceled: '已取消',
}

const positionLabels: Record<string, string> = {
  upright: '正位',
  reversed: '反位',
}

const drawModeLabels: Record<string, string> = {
  manual: '手動抽牌',
  auto: '自動抽牌',
}

function statusBadgeClass(status: string | null) {
  if (status === 'completed') return 'bg-lightGold text-darkGold'
  if (status === 'failed') return 'bg-[#fbeaea] text-[#a03a3a]'
  return 'bg-softPurple text-deepPurple'
}

function cardText(reading: AccountDivinationReading) {
  if (!reading.cardName) return '尚未抽牌'
  const position = reading.position ? positionLabels[reading.position] ?? reading.position : ''
  return position ? `${reading.cardName}（${position}）` : reading.cardName
}

export default function AccountDivinationsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [readings, setReadings] = useState<AccountDivinationReading[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    async function loadReadings(nextUser: UserProfile | null) {
      requestGenerationRef.current += 1
      const requestGeneration = requestGenerationRef.current
      const isCurrentRequest = () =>
        requestGenerationRef.current === requestGeneration &&
        getMockUser()?.id === nextUser?.id

      setIsLoading(true)
      setErrorMessage('')

      if (!nextUser) {
        if (isCurrentRequest()) {
          setReadings([])
          setIsLoading(false)
        }
        return
      }

      try {
        const accessToken = await getAuthAccessToken()
        if (!isCurrentRequest()) return

        if (!accessToken) {
          setReadings([])
          return
        }

        const response = await fetch('/api/account/divination-readings', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!isCurrentRequest()) return
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          readings?: AccountDivinationReading[]
          message?: string
        }

        if (!isCurrentRequest()) return

        if (!response.ok || data.ok === false || !Array.isArray(data.readings)) {
          setReadings([])
          setErrorMessage(data.message || '讀取占卜紀錄失敗，請稍後再試。')
          return
        }

        setReadings(data.readings)
      } catch {
        if (isCurrentRequest()) {
          setReadings([])
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
      setReadings([])
      void loadReadings(nextUser)
    }

    sync()
    const unsubscribe = subscribeAuthChange(sync)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadReadings(getMockUser())
    }
    const refreshAfterPageRestore = () => void loadReadings(getMockUser())

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('pageshow', refreshAfterPageRestore)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshAfterPageRestore)
      requestGenerationRef.current += 1
    }
  }, [])

  return (
    <>
      <PageHero
        eyebrow="會員中心"
        title="我的占卜紀錄"
        description="查看過去的抽牌與已完成的 AI 解讀。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-5">
          {errorMessage && (
            <div className="rounded-2xl border border-borderSoft bg-lightGold p-4 text-sm font-semibold text-darkGold">
              {errorMessage}
            </div>
          )}
          {!user ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">
              請先登入會員查看占卜紀錄。
            </div>
          ) : isLoading ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">
              正在讀取占卜紀錄...
            </div>
          ) : readings.length === 0 ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6">
              <p className="text-textMuted">目前還沒有占卜紀錄。</p>
              <Link
                className="focus-ring mt-5 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white"
                href="/ai-divination"
              >
                前往紫微牌卡占卜
              </Link>
            </div>
          ) : (
            readings.map((reading) => {
              return (
                <article
                  key={reading.id}
                  className="grid gap-3 rounded-2xl border border-borderSoft bg-white p-5 shadow-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="max-w-2xl font-semibold leading-7 text-textDark">{reading.question}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(reading.status)}`}
                    >
                      {reading.status ? statusLabels[reading.status] ?? reading.status : '狀態未知'}
                    </span>
                  </div>
                  <div className="grid gap-1 text-sm text-textMuted">
                    <p>抽到的牌：{cardText(reading)}</p>
                    {reading.drawMode ? (
                      <p>抽牌方式：{drawModeLabels[reading.drawMode] ?? reading.drawMode}</p>
                    ) : null}
                    <p>建立時間：{formatTaipeiDateTime(reading.createdAt)}</p>
                  </div>
                  <DivinationReadingAction readingId={reading.id} status={reading.status} />
                </article>
              )
            })
          )}
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
