'use client'

import { useState } from 'react'
import { DIVINATION_READING_PRICE_LABEL } from '@/lib/divination/pricing'

type DrawMode = 'manual' | 'auto'

type DivinationQuestionFormProps = {
  disabled?: boolean
  onQuestionSubmit?: (payload: {
    question: string
    mode: DrawMode
  }) => void | Promise<void>
}

const questionPlaceholder = `請問一個你現在最想知道的具體問題。
例如：這段關係接下來要注意什麼？這個工作選擇適合我嗎？`

export function DivinationQuestionForm({ disabled = false, onQuestionSubmit }: DivinationQuestionFormProps) {
  const [question, setQuestion] = useState('')
  const [message, setMessage] = useState('')
  const [selectedMode, setSelectedMode] = useState<DrawMode | null>(null)

  const handlePreviewDraw = (mode: DrawMode) => {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      setMessage('請先填寫占卜問題。')
      return
    }

    setMessage('')
    onQuestionSubmit?.({
      question: trimmedQuestion,
      mode,
    })
  }

  return (
    <section className="rounded-2xl border border-borderSoft bg-softPurple p-5 shadow-soft md:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-borderSoft bg-white p-5 md:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-darkGold">Question</p>
        <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">
          第一步｜寫下你的問題
        </h2>
        <p className="mt-3 leading-7 text-textMuted">
          請寫下一個清楚的問題，再選擇手動抽牌或自動抽牌。
        </p>
        <p className="mt-2 text-sm leading-7 text-textMuted">
          抽牌本身不收費，開始 AI 解讀時每次 {DIVINATION_READING_PRICE_LABEL}。
        </p>

        <div className="mt-6">
          <label htmlFor="divination-question-preview" className="block text-sm font-semibold text-textDark">
            占卜問題
          </label>
          <textarea
            id="divination-question-preview"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value)
              if (message) setMessage('')
            }}
            placeholder={questionPlaceholder}
            className="focus-ring mt-3 min-h-[120px] w-full resize-none rounded-xl border border-borderSoft bg-white p-4 text-base leading-7 text-textDark placeholder:text-textMuted"
          />
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-textDark">抽牌方式</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              disabled={disabled}
              type="button"
              onClick={() => {
                setSelectedMode('manual')
                handlePreviewDraw('manual')
              }}
              className={`focus-ring min-h-12 rounded-xl border px-6 py-3 text-sm font-semibold transition ${
                selectedMode === 'manual'
                  ? 'border-deepPurple bg-softPurple text-deepPurple'
                  : 'border-borderSoft bg-white text-deepPurple hover:bg-softPurple'
              }`}
            >
              手動抽牌
            </button>
            <button
              disabled={disabled}
              type="button"
              onClick={() => {
                setSelectedMode('auto')
                handlePreviewDraw('auto')
              }}
              className={`focus-ring min-h-12 rounded-xl px-6 py-3 text-sm font-semibold transition ${
                selectedMode === 'auto'
                  ? 'bg-deepPurple text-white'
                  : 'bg-deepPurple text-white hover:bg-purpleMain'
              }`}
            >
              自動抽牌
            </button>
          </div>
          <div className="mt-3 grid gap-1 text-sm leading-6 text-textMuted">
            <p>手動抽牌：由你親自選牌。</p>
            <p>自動抽牌：由系統為你隨機抽牌。</p>
          </div>
        </div>

        {message ? (
          <p
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-700"
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
