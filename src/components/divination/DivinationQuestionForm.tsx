'use client'

import { useState } from 'react'

type DrawMode = 'manual' | 'auto'

type DivinationQuestionFormProps = {
  onQuestionSubmit?: (payload: {
    question: string
    mode: DrawMode
  }) => void
}

const questionPlaceholder = `請問一個具體問題。

建議可以寫出：
1. 對象是誰
2. 發生什麼事情
3. 想看的時間範圍
4. 最想知道的重點

範例：
我和目前曖昧對象，未來三個月有沒有機會穩定交往？
我現在這份工作，接下來半年適不適合繼續做？
我最近遇到的合作邀約，是否值得投入時間？`

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
    <section className="rounded-2xl border border-[#d1aa52]/70 bg-[#080808] p-6 text-[#f5d27a] shadow-[0_24px_70px_rgba(31,13,66,0.16)]">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm tracking-[0.32em] text-[#b9944d]">water.bottle.tsu</p>
        <h2 className="mt-3 font-serifTC text-3xl font-semibold tracking-[0.14em] text-[#f5d27a]">
          紫微牌卡占卜
        </h2>
        <p className="mt-3 leading-7 text-[#d8c18a]">
          請先寫下你想詢問的問題，問題越具體，牌卡解讀會越清楚。
        </p>

        <div className="mt-6">
          <label htmlFor="divination-question-preview" className="block text-sm tracking-[0.16em] text-[#d8c18a]">
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
            className="mt-3 h-72 w-full resize-none rounded-2xl border border-[#8c6a2b] bg-[#050505] p-4 text-base leading-8 text-[#f5d27a] outline-none transition placeholder:text-[#7d6a43] focus:border-[#f5d27a]"
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => handlePreviewDraw('manual')}
              className="focus-ring min-h-14 rounded-full border border-[#8c6a2b] bg-[#111] px-8 py-3 text-sm font-semibold tracking-[0.16em] text-[#d8c18a] transition hover:scale-[1.01] hover:bg-[#1b1408]"
            >
              手動抽牌
            </button>
            <p className="text-sm leading-6 text-[#bda870]">手動抽牌：由你親自選牌。</p>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => handlePreviewDraw('auto')}
              className="focus-ring min-h-14 rounded-full border border-[#d7ad55] bg-[#1b1408] px-8 py-3 text-sm font-semibold tracking-[0.16em] text-[#f5d27a] shadow-[0_0_25px_rgba(215,173,85,0.22)] transition hover:scale-[1.01] hover:bg-[#241a0a]"
            >
              自動抽牌
            </button>
            <p className="text-sm leading-6 text-[#bda870]">自動抽牌：由系統為你隨機抽牌。</p>
          </div>
        </div>

        {message ? (
          <p
            className={[
              'mt-4 rounded-xl border px-4 py-3 text-sm leading-7',
              messageType === 'error'
                ? 'border-red-300/50 bg-red-950/20 text-red-100'
                : 'border-[#0f7a5f]/60 bg-[#04130f] text-[#bdf7df]'
            ].join(' ')}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
