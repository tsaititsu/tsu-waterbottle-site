'use client'

import { useState } from 'react'

type DrawMode = 'manual' | 'auto'

type DivinationQuestionFormProps = {
  onQuestionSubmit?: (payload: {
    question: string
    mode: DrawMode
  }) => void
}

const questionPlaceholder = `請問一個你現在最想知道的具體問題。
例如：這段關係接下來要注意什麼？這個工作選擇適合我嗎？`

export function DivinationQuestionForm({ onQuestionSubmit }: DivinationQuestionFormProps) {
  const [question, setQuestion] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'info'>('info')

  const handlePreviewDraw = (mode: DrawMode) => {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      setMessageType('error')
      setMessage('請先填寫占卜問題。')
      return
    }

    onQuestionSubmit?.({
      question: trimmedQuestion,
      mode,
    })
    setMessageType('info')
    setMessage('問題已送出，請往下進行抽牌。')
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

        <div className="mt-6">
          <label htmlFor="divination-question-preview" className="block text-sm font-semibold text-textDark">
            占卜問題
          </label>
          <textarea
            id="divination-question-preview"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value)
              if (messageType === 'error') setMessage('')
            }}
            placeholder={questionPlaceholder}
            className="focus-ring mt-3 min-h-[120px] w-full resize-none rounded-xl border border-borderSoft bg-white p-4 text-base leading-7 text-textDark placeholder:text-textMuted"
          />
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-textDark">抽牌方式</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handlePreviewDraw('manual')}
              className="focus-ring min-h-12 rounded-xl border border-borderSoft bg-white px-6 py-3 text-sm font-semibold text-deepPurple transition hover:bg-softPurple"
            >
              手動抽牌
            </button>
            <button
              type="button"
              onClick={() => handlePreviewDraw('auto')}
              className="focus-ring min-h-12 rounded-xl bg-deepPurple px-6 py-3 text-sm font-semibold text-white transition hover:bg-purpleMain"
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
            className={[
              'mt-4 rounded-xl border px-4 py-3 text-sm leading-7',
              messageType === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-[#cfe8dc] bg-[#f0fbf6] text-[#16664f]'
            ].join(' ')}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
